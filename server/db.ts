/** ThinTreé database: SQLite for local development, Neon PostgreSQL for free cloud hosting.
 * No private access answers are stored in source code; gates and admin contain scrypt hashes.
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { defaults, giftsSeed, sectionsSeed } from './content.ts';

export function loadEnv() {
  const envFile = resolve(process.cwd(), '.env');
  if (!existsSync(envFile)) return;
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m=line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let value=m[2].trim();
    if ((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'"))) value=value.slice(1,-1);
    process.env[m[1]]=value;
  }
}
loadEnv();

export const slugs=['family','high-school','university'] as const;
export type Slug=typeof slugs[number];
export const isSlug=(x:string):x is Slug => (slugs as readonly string[]).includes(x);
const usePg=!!process.env.DATABASE_URL;
if (process.env.NODE_ENV==='production' && !usePg) {
  throw Error('ThinTreé production requires DATABASE_URL (Neon PostgreSQL); ephemeral SQLite is not allowed.');
}
let sqlite:DatabaseSync|null=null;
let pool:any=null;
const context=new AsyncLocalStorage<any>();

const sqliteSchema=`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sections (
 slug TEXT PRIMARY KEY, label TEXT NOT NULL, chapter TEXT NOT NULL, title TEXT NOT NULL,
 subtitle TEXT NOT NULL, letter TEXT NOT NULL, question TEXT NOT NULL, intro TEXT NOT NULL,
 music_url TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS gates (slug TEXT NOT NULL REFERENCES sections(slug) ON DELETE CASCADE, hash TEXT NOT NULL, PRIMARY KEY(slug,hash));
CREATE TABLE IF NOT EXISTS admins (username TEXT PRIMARY KEY, hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, failures INTEGER NOT NULL DEFAULT 0, lock_until BIGINT NOT NULL DEFAULT 0, modified_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, role TEXT NOT NULL, slug TEXT, expires_at BIGINT NOT NULL, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS gifts (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL REFERENCES sections(slug), canonical_key TEXT NOT NULL,
 title TEXT NOT NULL, description TEXT NOT NULL, note TEXT NOT NULL, illustration TEXT NOT NULL DEFAULT '✧',
 image_url TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS gifts_by_section ON gifts(slug,position);
CREATE TABLE IF NOT EXISTS gift_claims (canonical_key TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'available', changed_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, slug TEXT NOT NULL, caption TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'gallery', image_id TEXT, position INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, slug TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS wishes (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL REFERENCES sections(slug), body TEXT NOT NULL,
 author TEXT NOT NULL DEFAULT 'Anonymous', is_public INTEGER NOT NULL DEFAULT 0,
 approved INTEGER NOT NULL DEFAULT 0, created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS timelines (id TEXT PRIMARY KEY, slug TEXT NOT NULL REFERENCES sections(slug), year_label TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS message_rates (key TEXT PRIMARY KEY, count INTEGER NOT NULL, since_at BIGINT NOT NULL);
`;
function pgSQL(sql:string):string {
  let i=0;
  let result=sql.replace(/\?/g,()=>`$${++i}`)
    .replace(/\bAS\s+([a-z_]*[A-Z][a-zA-Z]*)\b/g, (_m,name)=>`AS "${name}"`)
    .replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i,'INSERT INTO');
  if (/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql)) result+=' ON CONFLICT DO NOTHING';
  return result;
}
/** Emulates only the tiny prepare/get/all/run API used by the app, with awaited PostgreSQL calls. */
export const db={
  prepare(query:string) {
    if(!usePg) {
      if(!sqlite) throw Error('SQLite is not initialized');
      return sqlite.prepare(query);
    }
    const sql=pgSQL(query);
    const exec=async(args:unknown[])=>{
      const active=context.getStore() || pool;
      if(!active)throw Error('Postgres pool unavailable');
      return active.query(sql,args);
    };
    return {
      async get(...args:unknown[]) {const r=await exec(args);return r.rows[0];},
      async all(...args:unknown[]) {const r=await exec(args);return r.rows;},
      async run(...args:unknown[]) {const r=await exec(args);return {changes:r.rowCount||0};},
    };
  },
  async transaction<T>(fn:()=>Promise<T>):Promise<T> {
    if(!usePg) {
      if(!sqlite)throw Error('SQLite unavailable');
      sqlite.exec('BEGIN IMMEDIATE');
      try {const result=await fn();sqlite.exec('COMMIT');return result;}
      catch(e){sqlite.exec('ROLLBACK');throw e;}
    }
    if(context.getStore())return fn();
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const result=await context.run(client,fn);
      await client.query('COMMIT');
      return result;
    }catch(e){await client.query('ROLLBACK');throw e;}
    finally{client.release();}
  },
  async close(){if(usePg)await pool?.end();else sqlite?.close();}
};

async function initialize(){
  if(usePg){
    // Import only in cloud mode, so local tests need no external database packages.
    const { default: pg }=await import('pg');
    pg.types.setTypeParser(20,(v:string)=>Number(v)); // BIGINT timestamps; safe at current epoch ms
    pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:12000,idleTimeoutMillis:30000});
    const schema=sqliteSchema.replace('bytes BLOB NOT NULL','bytes BYTEA NOT NULL');
    await pool.query(schema);
  }else {
    const path=resolve(process.cwd(),process.env.DB_PATH||'./data/thintree.sqlite');
    mkdirSync(dirname(path),{recursive:true});
    sqlite=new DatabaseSync(path);
    sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
    sqlite.exec(sqliteSchema);
  }
  // Idempotent content seeding. Existing customer-generated data is never overwritten.
  await db.transaction(async()=>{
    const setting=db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)');
    for(const [k,v] of Object.entries(defaults))await setting.run(k,v);
    const section=db.prepare('INSERT OR IGNORE INTO sections(slug,label,chapter,title,subtitle,letter,question,intro,music_url) VALUES(?,?,?,?,?,?,?,?,?)');
    for(const s of sectionsSeed)await section.run(s.slug,s.label,s.chapter,s.title,s.subtitle,s.letter,s.question,s.intro,s.music_url);
    const giftsNum=(await db.prepare('SELECT count(*) AS c FROM gifts').get() as {c:number}).c;
    if(!Number(giftsNum)){
      const insert=db.prepare('INSERT INTO gifts(id,slug,canonical_key,title,description,note,illustration,position) VALUES(?,?,?,?,?,?,?,?)');
      const claims=db.prepare('INSERT OR IGNORE INTO gift_claims(canonical_key,status,changed_at) VALUES(?,?,?)');
      for(const [slug,items] of Object.entries(giftsSeed))for(const [idx,row] of items.entries()){
        await insert.run(randomUUID(),slug,row[0],row[1],row[2],row[3],row[4],idx);
        await claims.run(row[0],'available',Date.now());
      }
    }
    const photosNum=(await db.prepare('SELECT count(*) AS c FROM photos').get() as {c:number}).c;
    if(!Number(photosNum)){
      const insert=db.prepare('INSERT INTO photos(id,slug,caption,kind,image_id,position) VALUES(?,?,?,?,NULL,?)');
      await insert.run(randomUUID(),'about','Ảnh chân dung của Thiên Trí — thay trong Admin','portrait',0);
      for(const slug of ['about',...slugs]) {
        const captions=slug==='about' ? ['A day in motion','Scenes from my world','Collected memories']
          :slug==='family'?['Our little universe','Hạnh phúc bên nhau','Home is a feeling']
          :slug==='high-school'?['Một ngày thanh xuân','Ký ức trong lớp học','Những nụ cười']
          :['The very first chapter','Under the same stars','Campus memories'];
        for(const [i,caption] of captions.entries()) await insert.run(randomUUID(),slug,caption,'gallery',i);
      }
    }
    const timelineNum=(await db.prepare('SELECT count(*) AS c FROM timelines').get() as {c:number}).c;
    if(!Number(timelineNum)){
      const insert=db.prepare('INSERT INTO timelines(id,slug,year_label,title,description,position) VALUES(?,?,?,?,?,?)');
      const t=[['01','Trang đầu tiên','Thêm một kỷ niệm mở đầu thời cấp ba.'],['02','Những ngày chúng ta','Một chỗ dành cho những câu chuyện chỉ nhóm mình hiểu.'],['03','Và mãi về sau','Thêm mốc thời gian và ảnh thật trong Admin.']];
      for(const [i,r] of t.entries())await insert.run(randomUUID(),'high-school',...r,i);
    }
  });
}
export const dbReady=initialize();

export async function settings():Promise<Record<string,string>> {
  const rows=await db.prepare('SELECT key,value FROM settings').all() as Array<{key:string,value:string}>;
  return Object.fromEntries(rows.map(r=>[r.key,r.value]));
}
export async function photosFor(slug:string) {
  const rows=await db.prepare('SELECT id,slug,caption,kind,image_id AS imageId,position FROM photos WHERE slug=? ORDER BY position,id').all(slug) as Array<Record<string,unknown>>;
  return rows.map(p=>({...p,url:p.imageId?`/api/media/${p.imageId}`:null}));
}
export async function giftsFor(slug:string) {
  return db.prepare(`SELECT g.id,g.slug,g.canonical_key AS canonicalKey,g.title,g.description,g.note,g.illustration,g.image_url AS imageUrl,g.position,
    COALESCE(c.status,'available') AS status FROM gifts g LEFT JOIN gift_claims c ON c.canonical_key=g.canonical_key WHERE g.slug=? ORDER BY g.position,g.id`).all(slug);
}
export async function sectionFor(slug:Slug) {
  const section=await db.prepare('SELECT * FROM sections WHERE slug=?').get(slug);
  const approved=await db.prepare('SELECT id,slug,body,author,created_at AS createdAt FROM wishes WHERE slug=? AND is_public=1 AND approved=1 ORDER BY created_at DESC LIMIT 50').all(slug);
  const timeline=await db.prepare('SELECT id,year_label AS yearLabel,title,description,position FROM timelines WHERE slug=? ORDER BY position,id').all(slug);
  return {section,gifts:await giftsFor(slug),photos:await photosFor(slug),wishes:approved,timeline};
}

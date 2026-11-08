import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { db, isSlug } from './db.ts';

const SESSION_COOKIE = 'thintree_session';
const SESSION_MS = 1000*60*60*24*7;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 1000*60*15;

export function normalizeAnswer(raw:string) {
  return raw.normalize('NFKC').toLocaleLowerCase('vi').trim().replace(/\s+/gu,' ');
}
export function hashPassword(answer:string, forAdmin=false) {
  const salt=randomBytes(24);
  const key=scryptSync(forAdmin?answer:normalizeAnswer(answer),salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
  return `${forAdmin?'scrypt-raw':'scrypt'}$16384$${salt.toString('hex')}$${key.toString('hex')}`;
}
export function verifyPassword(value:string,stored:string) {
  try {
    const [alg,n,saltHex,hashHex]=stored.split('$');
    if (!['scrypt','scrypt-raw'].includes(alg)||Number(n)!==16384) return false;
    const salt=Buffer.from(saltHex,'hex');
    const hash=Buffer.from(hashHex,'hex');
    if(salt.length!==24 || hash.length!==64) return false;
    const derived=scryptSync(alg==='scrypt-raw'?value:normalizeAnswer(value),salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
    return timingSafeEqual(hash,derived);
  } catch { return false; }
}
function sha(s:string) { return createHash('sha256').update(s).digest('hex'); }
export type Session = { role:'admin'|'guest', slug:string|null, expiresAt:number };
export async function sessionFromCookie(cookieHeader:string|undefined): Promise<Session|null> {
  const value = cookieHeader?.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length+1);
  if (!value || !/^[0-9a-f]{64}$/.test(value)) return null;
  const found=await db.prepare('SELECT role,slug,expires_at AS expiresAt FROM sessions WHERE token_hash=?').get(sha(value)) as Session|undefined;
  if(!found || found.expiresAt<Date.now()) return null;
  return found;
}
export function isAuthorized(session:Session|null,slug:string) { return !!session && (session.role==='admin' || session.slug===slug); }
export async function issueSession(role:'guest'|'admin',slug:string|null) {
  const token=randomBytes(32).toString('hex');
  await db.prepare('INSERT INTO sessions(token_hash,role,slug,expires_at,created_at) VALUES(?,?,?,?,?)')
    .run(sha(token),role,slug,Date.now()+SESSION_MS,Date.now());
  await db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  const secure=process.env.NODE_ENV==='production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS/1000}${secure}`;
}
export async function revokeSession(cookieHeader:string|undefined) {
  const value=cookieHeader?.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length+1);
  if (value && /^[a-f0-9]{64}$/.test(value)) await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(value));
  const secure=process.env.NODE_ENV==='production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}
function throttleKey(ip:string,slug:string) {return sha(ip+'\u0000'+slug);}
export async function loginGate(slug:string,answer:string,ip:string): Promise<{ok:boolean,lockedUntil?:number,unconfigured?:boolean}> {
  if (!isSlug(slug)) return {ok:false};
  const hashes = await db.prepare('SELECT hash FROM gates WHERE slug=?').all(slug) as Array<{hash:string}>;
  if(!hashes.length) return {ok:false,unconfigured:true};
  return await checkLogin(`gate:${slug}`,ip,hashes.map(x=>x.hash),answer);
}
export async function loginAdmin(password:string,ip:string): Promise<{ok:boolean,lockedUntil?:number,unconfigured?:boolean}> {
  const row=await db.prepare("SELECT hash FROM admins WHERE username='owner'").get() as {hash:string}|undefined;
  if(!row) return {ok:false,unconfigured:true};
  return await checkLogin('admin',ip,[row.hash],password);
}
async function checkLogin(target:string,ip:string,hashes:string[],answer:string) {
  const key=throttleKey(ip,target), now=Date.now();
  const state=await db.prepare('SELECT failures,lock_until AS lockUntil,modified_at AS modifiedAt FROM login_attempts WHERE key=?').get(key) as {failures:number,lockUntil:number,modifiedAt:number}|undefined;
  if(state?.lockUntil && state.lockUntil>now) return {ok:false,lockedUntil:state.lockUntil};
  // Every configured answer uses a separately salted scrypt hash; no comparison is made in the browser.
  let ok=false;
  for(const h of hashes) if(verifyPassword(answer,h)) ok=true;
  if(ok) {await db.prepare('DELETE FROM login_attempts WHERE key=?').run(key);return {ok:true};}
  const failures=(state && now-state.modifiedAt<LOCK_MS?state.failures:0)+1;
  const lockUntil=failures>=MAX_ATTEMPTS?now+LOCK_MS:0;
  await db.prepare(`INSERT INTO login_attempts(key,failures,lock_until,modified_at) VALUES(?,?,?,?)
    ON CONFLICT(key) DO UPDATE SET failures=excluded.failures,lock_until=excluded.lock_until,modified_at=excluded.modified_at`)
    .run(key,failures,lockUntil,now);
  return {ok:false, ...(lockUntil?{lockedUntil:lockUntil}:{})};
}
export async function changeGateAnswers(slug:string,answers:string[]) {
  if(!isSlug(slug)||!answers.length||answers.some(x=>x.length<2 || x.length>160)) throw Error('Đáp án không hợp lệ');
  const distinct=[...new Set(answers.map(x=>normalizeAnswer(x)))];
  if(distinct.length>5) throw Error('Tối đa 5 đáp án thay thế');
  const hashes=distinct.map(x=>hashPassword(x));
  return db.transaction(async()=>{
    await db.prepare('DELETE FROM gates WHERE slug=?').run(slug);
    const stmt=db.prepare('INSERT INTO gates(slug,hash) VALUES(?,?)');
    for(const h of hashes)await stmt.run(slug,h);
    await db.prepare("DELETE FROM sessions WHERE slug=? AND role='guest'").run(slug);
  });
}
export async function changeAdminPassword(password:string) {
  if(password.length<12||password.length>200) throw Error('Mật khẩu quản trị phải có từ 12 đến 200 ký tự.');
  await db.prepare(`INSERT INTO admins(username,hash) VALUES('owner',?) ON CONFLICT(username) DO UPDATE SET hash=excluded.hash`).run(hashPassword(password,true));
  await db.prepare("DELETE FROM sessions WHERE role='admin'").run();
}

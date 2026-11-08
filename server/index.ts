import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { db, dbReady, isSlug, settings, photosFor, giftsFor, sectionFor, slugs } from './db.ts';
import { issueSession, revokeSession, sessionFromCookie, isAuthorized, loginGate, loginAdmin, changeGateAnswers, changeAdminPassword } from './auth.ts';

const root=resolve(process.cwd(),'public');
const port=Number(process.env.PORT||3000), host=process.env.HOST||'127.0.0.1';
// Render supplies a verified public URL; APP_ORIGIN overrides it for a custom domain.
const origin=process.env.APP_ORIGIN||process.env.RENDER_EXTERNAL_URL||`http://localhost:${port}`;
if(process.env.NODE_ENV==='production'&&!origin.startsWith('https://')) throw Error('Production requires APP_ORIGIN=https://your-domain');
const HTML=readFileSync(resolve(root,'index.html'));
const allowedStatic=new Set(['/styles.css','/client.js','/favicon.svg', '/audio/intro.wav', '/audio/family.wav', '/audio/school.wav', '/audio/university.wav']);
const mimeTypes:Record<string,string>={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.wav':'audio/wav'};
const MAX_BODY=6*1024*1024;

function securityHeaders(res:any) {
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; media-src 'self' https:; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
}
function json(res:any,code:number,obj:unknown,extra:Record<string,string>={}) {
  res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});
  res.end(JSON.stringify(obj));
}
function err(res:any,status:number,message:string) {json(res,status,{error:message});}
function go(res:any,path:string) {res.writeHead(302,{Location:path,'Cache-Control':'no-store'});res.end();}
function safeText(x:unknown,max=200): string {
  if(typeof x!=='string') throw new HttpError(400,'Vui lòng nhập nội dung dạng chữ.');
  const s=x.trim();
  if(!s || s.length>max) throw new HttpError(400,`Nội dung phải có từ 1 đến ${max} ký tự.`);
  return s;
}
function assetUrl(x:unknown):string {
  if(x===''||x===null||x===undefined)return '';
  const v=safeText(x,700);
  if(/^\/(?!\/)[\w/.-]+(?:\?[\w=&%-]+)?$/.test(v)) return v;
  try {const u=new URL(v);if(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password) return u.toString();}catch{}
  throw new HttpError(400,'URL chỉ được dùng http(s) hoặc đường dẫn nội bộ.');
}
class HttpError extends Error { status:number;constructor(status:number,msg:string){super(msg);this.status=status;} }
async function bodyBytes(req:any) {
  let length=0;const bufs:Buffer[]=[];
  for await(const chunk of req) {
    length+=chunk.length;
    if(length>MAX_BODY) throw new HttpError(413,'Tệp hoặc dữ liệu quá lớn (tối đa 6MB).');
    bufs.push(Buffer.from(chunk));
  }
  return Buffer.concat(bufs);
}
async function readJSON(req:any):Promise<any> {
  if(!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415,'Yêu cầu application/json.');
  const buf=await bodyBytes(req);
  try {const data=JSON.parse(buf.toString('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data;}
  catch{throw new HttpError(400,'JSON không hợp lệ.');}
}
async function readForm(req:any) {
  if(!req.headers['content-type']?.startsWith('multipart/form-data;')) throw new HttpError(415,'Cần form tải ảnh.');
  const buf=await bodyBytes(req);
  const f=new Request('http://localhost/form',{method:'POST',headers:{'Content-Type':req.headers['content-type']},body:buf});
  try{return await f.formData();}catch{throw new HttpError(400,'Biểu mẫu tải ảnh không hợp lệ.');}
}
function ipOf(req:any):string {return req.socket.remoteAddress||'unknown';} // Never trust spoofable X-Forwarded-For.
function csrf(req:any) {
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method||''))return;
  if(req.headers['sec-fetch-site']==='cross-site')throw new HttpError(403,'Yêu cầu khác nguồn bị từ chối.');
  if(req.headers.origin && req.headers.origin!==origin) throw new HttpError(403,'Origin không hợp lệ.');
}
async function authOf(req:any){return sessionFromCookie(req.headers.cookie);}
async function mustAdmin(req:any) {const s=await authOf(req);if(!s||s.role!=='admin')throw new HttpError(401,'Cần đăng nhập quản trị.');return s;}
async function mustSection(req:any,slug:string) {if(!isSlug(slug))throw new HttpError(404,'Không có khu vực này.');if(!isAuthorized(await authOf(req),slug))throw new HttpError(401,'Hãy mở cổng truy cập trước.');}
function uploadMime(bytes:Buffer):string|null {
  if(bytes.length>=8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(bytes.length>=3 && bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=12 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
  return null;
}
function statusOK(s:string){return ['available','reserved','purchased'].includes(s);}
async function getMedia(req:any,res:any,id:string) {
  const media=await db.prepare('SELECT id,slug,mime,bytes FROM media WHERE id=?').get(id) as {slug:string,mime:string,bytes:Uint8Array}|undefined;
  if(!media)throw new HttpError(404,'Không tìm thấy ảnh.');
  if(media.slug!=='about')await mustSection(req,media.slug);
  const b=Buffer.from(media.bytes);
  res.writeHead(200,{'Content-Type':media.mime,'Content-Length':b.length,'Cache-Control':media.slug==='about'?'public, max-age=300':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(b);
}
async function readMessageRate(ip:string,slug:string) {
  const k=createHash('sha256').update(ip+'wish:'+slug).digest('hex'), now=Date.now();
  const row=await db.prepare('SELECT count,since_at AS sinceAt FROM message_rates WHERE key=?').get(k) as {count:number,sinceAt:number}|undefined;
  const count=row&&now-row.sinceAt<3600_000 ? row.count+1:1;
  if(count>8)throw new HttpError(429,'Bạn đã gửi nhiều lời chúc. Hãy thử lại sau nhé.');
  await db.prepare('INSERT INTO message_rates(key,count,since_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,since_at=excluded.since_at').run(k,count,count===1?now:row!.sinceAt);
}

async function api(req:any,res:any,path:string) {
  const method=req.method||'GET';csrf(req);
  if(method==='GET'&&path==='/api/health'){const gates=await db.prepare('SELECT count(DISTINCT slug) AS c FROM gates').get() as {c:number};const admin=await db.prepare("SELECT count(*) AS c FROM admins WHERE username='owner'").get() as {c:number};return json(res,200,{ok:true,app:'ThinTreé',ready:Number(gates.c)===3 && Number(admin.c)===1});}
  if(method==='GET'&&path==='/api/auth/me') {
    const s=await authOf(req);return json(res,200,{authenticated:!!s,role:s?.role||null,slug:s?.slug||null});
  }
  if(method==='POST'&&path==='/api/auth/logout') {return json(res,200,{ok:true},{'Set-Cookie':await revokeSession(req.headers.cookie)});}
  if(method==='POST'&&path==='/api/auth/login') {
    const data=await readJSON(req),slug=safeText(data.slug,30),answer=safeText(data.answer,160);
    if(!isSlug(slug))throw new HttpError(404,'Cổng không tồn tại.');
    const result=await loginGate(slug,answer,ipOf(req));
    if(result.unconfigured)throw new HttpError(503,'Cổng chưa được chủ website cấu hình. Chạy npm run setup.');
    if(result.lockedUntil)return json(res,429,{error:'Sai nhiều lần. Cổng tạm khóa trong 15 phút.',lockedUntil:result.lockedUntil});
    if(!result.ok)throw new HttpError(401,'Đáp án chưa đúng. Thử lại nhé!');
    return json(res,200,{ok:true,slug},{'Set-Cookie':await issueSession('guest',slug)});
  }
  if(method==='POST'&&path==='/api/admin/login') {
    const data=await readJSON(req), password=safeText(data.password,200);
    const result=await loginAdmin(password,ipOf(req));
    if(result.unconfigured)throw new HttpError(503,'Chưa thiết lập tài khoản quản trị. Chạy npm run setup.');
    if(result.lockedUntil)return json(res,429,{error:'Đăng nhập sai nhiều lần. Vui lòng thử lại sau.',lockedUntil:result.lockedUntil});
    if(!result.ok)throw new HttpError(401,'Mật khẩu quản trị không đúng.');
    return json(res,200,{ok:true},{'Set-Cookie':await issueSession('admin',null)});
  }
  const portal=path.match(/^\/api\/portal\/(family|high-school|university)$/);
  if(method==='GET'&&portal) {
    const section=await db.prepare('SELECT slug,label,chapter,title,subtitle,question FROM sections WHERE slug=?').get(portal[1]);
    return json(res,200,section);
  }
  if(method==='GET'&&path==='/api/public') {
    return json(res,200,{settings:await settings(), photos:await photosFor('about')});
  }
  const sectionRoute=path.match(/^\/api\/section\/(family|high-school|university)$/);
  if(method==='GET'&&sectionRoute) {
    await mustSection(req,sectionRoute[1]);return json(res,200,await sectionFor(sectionRoute[1] as any));
  }
  const mediaRoute=path.match(/^\/api\/media\/([0-9a-f-]{36})$/);
  if(method==='GET'&&mediaRoute)return await getMedia(req,res,mediaRoute[1]);
  const reserveRoute=path.match(/^\/api\/gifts\/([0-9a-f-]{36})\/reserve$/);
  if(method==='POST'&&reserveRoute) {
    const gift=await db.prepare('SELECT slug,canonical_key AS canonicalKey,title FROM gifts WHERE id=?').get(reserveRoute[1]) as {slug:string,canonicalKey:string,title:string}|undefined;
    if(!gift)throw new HttpError(404,'Món quà không tồn tại.');
    await mustSection(req,gift.slug);
    const result=await db.prepare("UPDATE gift_claims SET status='reserved',changed_at=? WHERE canonical_key=? AND status='available'").run(Date.now(),gift.canonicalKey);
    if(result.changes!==1)return json(res,409,{error:'Món quà này đã có người chọn trước rồi. Hãy chọn món khác nhé!'});
    return json(res,200,{ok:true,status:'reserved',canonicalKey:gift.canonicalKey});
  }
  const wishRoute=path.match(/^\/api\/wishes\/(family|high-school|university)$/);
  if(method==='POST'&&wishRoute) {
    await mustSection(req,wishRoute[1]);const data=await readJSON(req);
    const body=safeText(data.body,1000);await readMessageRate(ipOf(req),wishRoute[1]);
    // Messages are private by default and visible to the owner only.
    await db.prepare('INSERT INTO wishes(id,slug,body,author,is_public,approved,created_at) VALUES(?,?,?,?,0,0,?)')
      .run(randomUUID(),wishRoute[1],body,'Anonymous',Date.now());
    return json(res,201,{ok:true,message:'Lời chúc đã được gửi riêng cho Trí.'});
  }
  if(!path.startsWith('/api/admin/'))throw new HttpError(404,'Không tìm thấy API.');
  await mustAdmin(req);
  if(method==='GET'&&path==='/api/admin/state'){
    const sections=await db.prepare('SELECT * FROM sections ORDER BY CASE slug WHEN \'family\' THEN 1 WHEN \'high-school\' THEN 2 ELSE 3 END').all();
    const gifts=(await Promise.all(slugs.map(s=>giftsFor(s)))).flat();
    const photos=await db.prepare('SELECT id,slug,caption,kind,image_id AS imageId,position FROM photos ORDER BY slug,position').all();
    const messages=await db.prepare('SELECT id,slug,body,author,is_public AS isPublic,approved,created_at AS createdAt FROM wishes ORDER BY created_at DESC').all();
    const timelines=await db.prepare('SELECT id,slug,year_label AS yearLabel,title,description,position FROM timelines ORDER BY position').all();
    return json(res,200,{settings:await settings(),sections,gifts,photos,messages,timelines});
  }
  if(method==='PUT'&&path==='/api/admin/settings'){
    const d=await readJSON(req),key=safeText(d.key,100);
    if(!/^(home|profile)\.[a-z_]+$/.test(key))throw new HttpError(400,'Trường cấu hình không hợp lệ.');
    const value=typeof d.value==='string'?d.value:'';
    if(value.length>4000)throw new HttpError(400,'Nội dung quá dài.');
    const clean=key.endsWith('music_url')?assetUrl(value):value;
    await db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,clean);
    return json(res,200,{ok:true});
  }
  const sectionAdmin=path.match(/^\/api\/admin\/sections\/(family|high-school|university)$/);
  if(method==='PUT'&&sectionAdmin){
    const d=await readJSON(req);
    const cols=['label','title','subtitle','letter','question','intro','music_url'];
    const keys=cols.filter(k=>d[k]!==undefined);
    if(!keys.length)throw new HttpError(400,'Không có dữ liệu chỉnh sửa.');
    const values=keys.map(k=>k==='music_url'?assetUrl(d[k]):safeText(d[k],k==='letter'?2000:400));
    await db.prepare(`UPDATE sections SET ${keys.map(k=>`${k}=?`).join(',')} WHERE slug=?`).run(...values,sectionAdmin[1]);
    return json(res,200,{ok:true});
  }
  const gateAdmin=path.match(/^\/api\/admin\/gates\/(family|high-school|university)$/);
  if(method==='PUT'&&gateAdmin) {
    const d=await readJSON(req);const answers=d.answers;
    if(!Array.isArray(answers)||!answers.length||answers.length>5)throw new HttpError(400,'Cần 1–5 đáp án.');
    const cleanAnswers=answers.map((x:unknown)=>safeText(x,160));
    if(cleanAnswers.some((x:string)=>x.length<2))throw new HttpError(400,'Đáp án cần ít nhất 2 ký tự.');
    await changeGateAnswers(gateAdmin[1],cleanAnswers);
    return json(res,200,{ok:true,message:'Đã thay đáp án và hủy các phiên đăng nhập cũ của nhóm.'});
  }
  if(method==='PUT'&&path==='/api/admin/password'){
    const d=await readJSON(req);const password=safeText(d.password,200);
    if(password.length<12)throw new HttpError(400,'Mật khẩu admin phải dài ít nhất 12 ký tự.');
    await changeAdminPassword(password);
    return json(res,200,{ok:true,message:'Đã đổi mật khẩu. Vui lòng đăng nhập lại.'},{'Set-Cookie':await revokeSession(req.headers.cookie)});
  }
  if(method==='POST'&&path==='/api/admin/gifts'){
    const d=await readJSON(req),slug=safeText(d.slug,30);
    if(!isSlug(slug))throw new HttpError(400,'Nhóm không hợp lệ.');
    const title=safeText(d.title,180), canonicalKey=safeText(d.canonicalKey||title.toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,''),150);
    const id=randomUUID();
    await db.prepare('INSERT INTO gifts(id,slug,canonical_key,title,description,note,illustration,image_url,position) VALUES(?,?,?,?,?,?,?,?,?)').run(
      id,slug,canonicalKey,title,safeText(d.description||title,600),String(d.note||'').slice(0,600),String(d.illustration||'✧').slice(0,10),assetUrl(d.imageUrl||''),
      Number.isInteger(d.position)?d.position:100
    );
    await db.prepare('INSERT OR IGNORE INTO gift_claims(canonical_key,status,changed_at) VALUES(?,?,?)').run(canonicalKey,'available',Date.now());
    return json(res,201,{ok:true,id});
  }
  const giftAdmin=path.match(/^\/api\/admin\/gifts\/([0-9a-f-]{36})$/);
  if(giftAdmin&&method==='DELETE'){
    const row=await db.prepare('SELECT canonical_key AS canonicalKey FROM gifts WHERE id=?').get(giftAdmin[1]) as {canonicalKey:string}|undefined;
    if(!row)throw new HttpError(404,'Không tìm thấy món quà.');
    await db.prepare('DELETE FROM gifts WHERE id=?').run(giftAdmin[1]);
    await db.prepare('DELETE FROM gift_claims WHERE canonical_key=? AND NOT EXISTS (SELECT 1 FROM gifts WHERE canonical_key=?)').run(row.canonicalKey,row.canonicalKey);
    return json(res,200,{ok:true});
  }
  if(giftAdmin&&method==='PUT'){
    const d=await readJSON(req);const row=await db.prepare('SELECT * FROM gifts WHERE id=?').get(giftAdmin[1]) as Record<string,unknown>|undefined;
    if(!row)throw new HttpError(404,'Không tìm thấy món quà.');
    const title=safeText(d.title,180), desc=safeText(d.description,600), note=typeof d.note==='string'?d.note.slice(0,600):'',
      illustration=String(d.illustration||'✧').slice(0,10),url=assetUrl(d.imageUrl||'');
    await db.prepare('UPDATE gifts SET title=?,description=?,note=?,illustration=?,image_url=? WHERE id=?').run(title,desc,note,illustration,url,giftAdmin[1]);
    return json(res,200,{ok:true});
  }
  if(method==='PUT'&&path==='/api/admin/gift-status') {
    const d=await readJSON(req),key=safeText(d.canonicalKey,150),status=safeText(d.status,30);
    if(!statusOK(status))throw new HttpError(400,'Trạng thái không hợp lệ.');
    const result=await db.prepare('UPDATE gift_claims SET status=?,changed_at=? WHERE canonical_key=?').run(status,Date.now(),key);
    if(!result.changes)throw new HttpError(404,'Không tìm thấy quà.');
    return json(res,200,{ok:true});
  }
  if(method==='POST'&&path==='/api/admin/photos') {
    const form=await readForm(req), slug=String(form.get('slug')||''), caption=safeText(String(form.get('caption')||''),200);
    if(slug!=='about'&&!isSlug(slug))throw new HttpError(400,'Album không hợp lệ.');
    const kind=form.get('kind')==='portrait'&&slug==='about'?'portrait':'gallery';
    const file=form.get('file');
    if(!(file instanceof File)||file.size<10||file.size>5*1024*1024)throw new HttpError(400,'Chọn ảnh PNG, JPEG hoặc WebP dưới 5MB.');
    const bytes=Buffer.from(await file.arrayBuffer()),mime=uploadMime(bytes);
    if(!mime)throw new HttpError(400,'Định dạng ảnh không hợp lệ.');
    const imageId=randomUUID(), replacement=String(form.get('replaceId')||'');
    await db.transaction(async()=>{
      await db.prepare('INSERT INTO media(id,slug,mime,bytes,created_at) VALUES(?,?,?,?,?)').run(imageId,slug,mime,bytes,Date.now());
      if(replacement){
        const old=await db.prepare('SELECT id,image_id AS imageId FROM photos WHERE id=? AND slug=?').get(replacement,slug) as {id:string,imageId:string|null}|undefined;
        if(!old)throw new HttpError(404,'Ảnh thay thế không tồn tại.');
        await db.prepare('UPDATE photos SET image_id=?,caption=? WHERE id=?').run(imageId,caption,replacement);
        if(old.imageId)await db.prepare('DELETE FROM media WHERE id=?').run(old.imageId);
      }else {
        if(kind==='portrait'){
          const old=await db.prepare("SELECT image_id AS imageId FROM photos WHERE slug='about' AND kind='portrait'").all() as Array<{imageId:string|null}>;
          await db.prepare("DELETE FROM photos WHERE slug='about' AND kind='portrait'").run();
          for(const o of old)if(o.imageId)await db.prepare('DELETE FROM media WHERE id=?').run(o.imageId);
        }
        await db.prepare('INSERT INTO photos(id,slug,caption,kind,image_id,position) VALUES(?,?,?,?,?,?)').run(randomUUID(),slug,caption,kind,imageId,99);
      }
    });
    return json(res,201,{ok:true,imageId});
  }
  const photoAdmin=path.match(/^\/api\/admin\/photos\/([0-9a-f-]{36})$/);
  if(photoAdmin&&method==='DELETE'){
    const photo=await db.prepare('SELECT image_id AS imageId FROM photos WHERE id=?').get(photoAdmin[1]) as {imageId:string|null}|undefined;
    if(!photo)throw new HttpError(404,'Ảnh không tồn tại.');
    await db.prepare('DELETE FROM photos WHERE id=?').run(photoAdmin[1]);
    if(photo.imageId)await db.prepare('DELETE FROM media WHERE id=?').run(photo.imageId);
    return json(res,200,{ok:true});
  }
  if(photoAdmin&&method==='PUT'){
    const d=await readJSON(req),caption=safeText(d.caption,200);
    const r=await db.prepare('UPDATE photos SET caption=? WHERE id=?').run(caption,photoAdmin[1]);
    if(!r.changes)throw new HttpError(404,'Ảnh không tồn tại.');return json(res,200,{ok:true});
  }
  if(method==='POST'&&path==='/api/admin/messages'){
    const d=await readJSON(req),slug=safeText(d.slug,30);if(!isSlug(slug))throw new HttpError(400,'Nhóm không hợp lệ.');
    await db.prepare('INSERT INTO wishes(id,slug,body,author,is_public,approved,created_at) VALUES(?,?,?,?,1,1,?)')
      .run(randomUUID(),slug,safeText(d.body,1000),safeText(d.author||'Một người bạn',100),Date.now());
    return json(res,201,{ok:true});
  }
  const msgAdmin=path.match(/^\/api\/admin\/messages\/([0-9a-f-]{36})$/);
  if(msgAdmin&&method==='DELETE'){
    await db.prepare('DELETE FROM wishes WHERE id=?').run(msgAdmin[1]);return json(res,200,{ok:true});
  }
  if(msgAdmin&&method==='PUT') {
    const d=await readJSON(req);
    const r=await db.prepare('UPDATE wishes SET is_public=?,approved=? WHERE id=?').run(d.isPublic?1:0,d.approved?1:0,msgAdmin[1]);
    if(!r.changes)throw new HttpError(404,'Không tìm thấy lời chúc.');
    return json(res,200,{ok:true});
  }
  if(method==='POST'&&path==='/api/admin/timeline') {
    const d=await readJSON(req),slug=safeText(d.slug,30);if(!isSlug(slug))throw new HttpError(400,'Nhóm không hợp lệ.');
    const id=randomUUID();
    await db.prepare('INSERT INTO timelines(id,slug,year_label,title,description,position) VALUES(?,?,?,?,?,?)')
      .run(id,slug,safeText(d.yearLabel,40),safeText(d.title,140),safeText(d.description,500),100);
    return json(res,201,{ok:true,id});
  }
  const timelineAdmin=path.match(/^\/api\/admin\/timeline\/([0-9a-f-]{36})$/);
  if(timelineAdmin&&method==='DELETE'){
    await db.prepare('DELETE FROM timelines WHERE id=?').run(timelineAdmin[1]);return json(res,200,{ok:true});
  }
  if(timelineAdmin&&method==='PUT'){
    const d=await readJSON(req);
    const r=await db.prepare('UPDATE timelines SET year_label=?,title=?,description=? WHERE id=?').run(safeText(d.yearLabel,40),safeText(d.title,140),safeText(d.description,500),timelineAdmin[1]);
    if(!r.changes)throw new HttpError(404,'Không tìm thấy timeline.');return json(res,200,{ok:true});
  }
  throw new HttpError(404,'Không tìm thấy API quản trị.');
}
async function handle(req:any,res:any){
  securityHeaders(res);
  const url=new URL(req.url||'/',origin),path=url.pathname;
  try {
    if(path.startsWith('/api/'))return await api(req,res,path);
    if(allowedStatic.has(path)&&['GET','HEAD'].includes(req.method||'')) {
      const file=resolve(root,'.'+path);
      if(!existsSync(file))throw new HttpError(404,'Tệp không tồn tại.');
      const bytes=readFileSync(file), contentType=mimeTypes[extname(file)]||'application/octet-stream';
      res.writeHead(200,{'Content-Type':contentType,'Content-Length':bytes.length,'Cache-Control':'public, max-age=3600'});res.end(req.method==='HEAD'?undefined:bytes);return;
    }
    if(!['GET','HEAD'].includes(req.method||''))throw new HttpError(405,'Phương thức không được hỗ trợ.');
    const privatePage=path.match(/^\/collection\/(family|high-school|university)\/?$/);
    if(privatePage&&!isAuthorized(await authOf(req),privatePage[1]))return go(res,`/portal/${privatePage[1]}`);
    const pageExists=['/','/about','/worlds','/admin'].includes(path) || /^\/(portal|collection)\/(family|high-school|university)\/?$/.test(path);
    res.writeHead(pageExists?200:404,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:HTML);
  }catch(e){
    const error=e instanceof HttpError?e:new HttpError(500,'Đã xảy ra lỗi máy chủ.');
    if(error.status>=500)console.error('[server]',e);
    if(path.startsWith('/api/'))err(res,error.status,error.message);
    else {res.writeHead(error.status,{'Content-Type':'text/plain; charset=utf-8'});res.end(error.message);}
  }
}
const server=createServer((req,res)=>{void handle(req,res);});
await dbReady;
server.listen(port,host,()=>console.log(`✦ ThinTreé at ${origin} (listening ${host}:${port})`));

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const cwd=resolve(import.meta.dirname,'..');
const tmp=mkdtempSync(join(tmpdir(),'thintree-test-'));
const port=34000+Math.floor(Math.random()*15000);
const base=`http://127.0.0.1:${port}`;
const env={...process.env,DB_PATH:join(tmp,'test.sqlite'),HOST:'127.0.0.1',PORT:String(port),APP_ORIGIN:`http://localhost:${port}`,NODE_ENV:'development',INIT_FAMILY_ANSWER:'test-family-answer',INIT_SCHOOL_ANSWER:'test-notebook',INIT_UNIVERSITY_ANSWERS:'Test Friend|The Test Friend',INIT_ADMIN_PASSWORD:'StrictCasePassword!26'};
let server,output='';
const cookieOf=r=>r.headers.get('set-cookie')?.split(';')[0]||'';
const opts=(method,obj,cookie='')=>({method,headers:{'content-type':'application/json',...(cookie?{'cookie':cookie}:{})},body:JSON.stringify(obj)});
async function req(path, options={}) {return await fetch(base+path,{redirect:'manual',...options});}
async function asJSON(path, options={}) {const r=await req(path,options);let v;try{v=await r.json()}catch{v=null};return {status:r.status,body:v,cookie:cookieOf(r),headers:r.headers};}

before(async()=>{
  const r=spawnSync(process.execPath,['--disable-warning=ExperimentalWarning','--experimental-strip-types','scripts/setup.ts'],{cwd,env,input:'',encoding:'utf8',timeout:15000});
  assert.equal(r.status,0,`setup failed:\n${r.stderr}\n${r.stdout}`);
  server=spawn(process.execPath,['--disable-warning=ExperimentalWarning','--experimental-strip-types','server/index.ts'],{cwd,env,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',b=>output+=String(b));server.stderr.on('data',b=>output+=String(b));
  for(let i=0;i<60;i++){
    if(server.exitCode!==null)throw Error(`Server quit early: ${output}`);
    try {const r=await req('/api/health');if(r.status===200)return;}catch{}
    await sleep(100);
  }
  throw Error(`Server did not start: ${output}`);
});
after(()=>{server?.kill();rmSync(tmp,{recursive:true,force:true});});

test('Public collection is ready, and no gate answers leak through assets',async()=>{
  const health=await asJSON('/api/health');assert.equal(health.body.ready,true);
  const pub=await asJSON('/api/public');assert.equal(pub.status,200);assert.equal(pub.body.settings['profile.name'],'Thiên Trí');
  for(const file of ['/client.js','/styles.css','/favicon.svg']){
    const r=await req(file),text=await r.text();assert.equal(r.status,200);assert.ok(!text.includes('test-family-answer'));assert.ok(!text.includes('StrictCasePassword!26'));
  }
  const portal=await asJSON('/api/portal/family');
  assert.equal(portal.body.question,'Mật khẩu wifi của nhà Trí là gì?');
  assert.ok(!('hash' in portal.body));
});

test('Direct private URLs and API refuse unauthorized readers',async()=>{
  const r=await req('/collection/family');assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/portal/family');
  assert.equal((await asJSON('/api/section/family')).status,401);
  assert.equal((await asJSON('/api/admin/state')).status,401);
  const notFound=await req('/does-not-exist');assert.equal(notFound.status,404); // SPA renders dedicated client 404.
});

test('Family entry, secret note, anonymous shared reservation, and logout',async()=>{
  const fail=await asJSON('/api/auth/login',opts('POST',{slug:'family',answer:'wrong answer'}));assert.equal(fail.status,401);
  const login=await asJSON('/api/auth/login',opts('POST',{slug:'family',answer:' TEST-FAMILY-ANSWER '}));
  assert.equal(login.status,200);assert.match(login.cookie,/^thintree_session=[a-f0-9]{64}$/);assert.match(login.headers.get('set-cookie'),/HttpOnly/);
  const family=await asJSON('/api/section/family',{headers:{cookie:login.cookie}});
  assert.equal(family.status,200);assert.equal(family.body.gifts.length,6);
  assert.equal(family.body.section.letter,"Gia đình mình mãi hạnh phúc nhée, I'll be the part of it in every universe");
  assert.equal((await asJSON('/api/section/high-school',{headers:{cookie:login.cookie}})).status,401);
  const wish=await asJSON('/api/wishes/family',opts('POST',{body:'Birthday secret hello!'},login.cookie));assert.equal(wish.status,201);
  const stillPrivate=await asJSON('/api/section/family',{headers:{cookie:login.cookie}});assert.equal(stillPrivate.body.wishes.length,0);
  const gift=family.body.gifts.find(g=>g.canonicalKey==='boardgame-unique');
  assert.ok(gift);
  assert.equal((await asJSON(`/api/gifts/${gift.id}/reserve`,opts('POST',{},login.cookie))).status,200);
  assert.equal((await asJSON(`/api/gifts/${gift.id}/reserve`,opts('POST',{},login.cookie))).status,409);
  const schoolLogin=await asJSON('/api/auth/login',opts('POST',{slug:'high-school',answer:'test-notebook'}));assert.equal(schoolLogin.status,200);
  const school=await asJSON('/api/section/high-school',{headers:{cookie:schoolLogin.cookie}});
  assert.equal(school.body.gifts.length,13);
  assert.equal(school.body.gifts.find(g=>g.canonicalKey==='boardgame-unique').status,'reserved');
  assert.equal(school.body.section.letter,'Tui cũng mún có thư tay <3, tui cũng mún có sinh nhật bất ngờ như năm ngoái!! Năm ngoái quá đỉnk lun í, arigatou kakegurui mashooo~~~');
  const logout=await asJSON('/api/auth/logout',opts('POST',{},schoolLogin.cookie));assert.equal(logout.status,200);
  assert.equal((await asJSON('/api/section/high-school',{headers:{cookie:schoolLogin.cookie}})).status,401);
  const universityLogin=await asJSON('/api/auth/login',opts('POST',{slug:'university',answer:'The Test Friend'}));assert.equal(universityLogin.status,200);
  const university=await asJSON('/api/section/university',{headers:{cookie:universityLogin.cookie}});
  assert.equal(university.body.gifts.length,9);
  assert.equal(university.body.section.letter,'Không ngờ lên đại học lại gặp được người mean và hợp như cặu, kh có cặu chắc học đại học bùn lắm íii <33');
});

test('Admin is case-sensitive and can manage content, gifts, status, messages and upload media',async()=>{
  const wrongCase=await asJSON('/api/admin/login',opts('POST',{password:'strictcasepassword!26'}));assert.equal(wrongCase.status,401);
  const login=await asJSON('/api/admin/login',opts('POST',{password:'StrictCasePassword!26'}));assert.equal(login.status,200);
  const cookie=login.cookie;
  let state=await asJSON('/api/admin/state',{headers:{cookie}});
  assert.equal(state.status,200);assert.equal(state.body.gifts.length,28);assert.equal(state.body.messages.length,1);
  const upd=await asJSON('/api/admin/sections/family',opts('PUT',{question:'A new secret question?',letter:'A custom letter.'},cookie));assert.equal(upd.status,200);
  assert.equal((await asJSON('/api/portal/family')).body.question,'A new secret question?');
  assert.equal((await asJSON('/api/admin/settings',opts('PUT',{key:'profile.intro',value:'Test new bio'},cookie))).status,200);
  const added=await asJSON('/api/admin/gifts',opts('POST',{slug:'family',title:'A test gift',description:'A test description.',canonicalKey:'test-gift-unique',note:'A thoughtful note'},cookie));assert.equal(added.status,201);
  assert.equal((await asJSON(`/api/admin/gifts/${added.body.id}`,opts('PUT',{title:'Updated test gift',description:'An updated description',note:'Updated note'},cookie))).status,200);
  assert.equal((await asJSON('/api/admin/gift-status',opts('PUT',{canonicalKey:'test-gift-unique',status:'purchased'},cookie))).status,200);
  assert.equal((await asJSON('/api/admin/messages',opts('POST',{slug:'high-school',body:'A letter from a friend',author:'Someone'},cookie))).status,201);
  state=await asJSON('/api/admin/state',{headers:{cookie}});assert.equal(state.body.gifts.length,29);assert.equal(state.body.messages.length,2);
  const secret=state.body.messages.find(m=>m.body==='Birthday secret hello!');assert.ok(secret);assert.equal(secret.isPublic,0);
  assert.equal((await asJSON(`/api/admin/messages/${secret.id}`,opts('PUT',{isPublic:true,approved:true},cookie))).status,200);
  const timeline=await asJSON('/api/admin/timeline',opts('POST',{slug:'high-school',yearLabel:'04',title:'A new story',description:'We remember it.'},cookie));
  assert.equal(timeline.status,201);
  assert.equal((await asJSON(`/api/admin/timeline/${timeline.body.id}`,opts('PUT',{yearLabel:'2026',title:'Edited story',description:'A real milestone.'},cookie))).status,200);
  assert.equal((await asJSON(`/api/admin/timeline/${timeline.body.id}`,{method:'DELETE',headers:{cookie}})).status,200);
  const testPhoto=readFileSync(resolve(cwd,'tests/one-pixel.png'));
  const form=new FormData();form.set('slug','family');form.set('caption','This is a test image');form.set('kind','gallery');form.set('file',new Blob([testPhoto],{type:'image/png'}),'test.png');
  const upload=await asJSON('/api/admin/photos',{method:'POST',headers:{cookie},body:form});assert.equal(upload.status,201);
  assert.equal((await req(`/api/media/${upload.body.imageId}`)).status,401);
  assert.equal((await req(`/api/media/${upload.body.imageId}`,{headers:{cookie}})).status,200);
  const photosState=await asJSON('/api/admin/state',{headers:{cookie}});
  const photo=photosState.body.photos.find(p=>p.imageId===upload.body.imageId);assert.ok(photo);
  assert.equal((await asJSON(`/api/admin/photos/${photo.id}`,opts('PUT',{caption:'Edited image caption'},cookie))).status,200);
  assert.equal((await asJSON(`/api/admin/photos/${photo.id}`,{method:'DELETE',headers:{cookie}})).status,200);
  assert.equal((await req(`/api/media/${upload.body.imageId}`,{headers:{cookie}})).status,404);
  assert.equal((await asJSON(`/api/admin/gifts/${added.body.id}`,{method:'DELETE',headers:{cookie}})).status,200);
  const logout=await asJSON('/api/auth/logout',opts('POST',{},cookie));assert.equal(logout.status,200);
  assert.equal((await asJSON('/api/admin/state',{headers:{cookie}})).status,401);
});

test('Gate locks after five failures',async()=>{
  for(let i=0;i<4;i++)assert.equal((await asJSON('/api/auth/login',opts('POST',{slug:'university',answer:'bad'+i}))).status,401);
  const fifth=await asJSON('/api/auth/login',opts('POST',{slug:'university',answer:'bad5'}));assert.equal(fifth.status,429);
  assert.ok(fifth.body.lockedUntil>Date.now());
  assert.equal((await asJSON('/api/auth/login',opts('POST',{slug:'university',answer:'Test Friend'}))).status,429);
});


test('Admin rotates answers and password, revoking old sessions',async()=>{
  const guest=await asJSON('/api/auth/login',opts('POST',{slug:'family',answer:'test-family-answer'}));assert.equal(guest.status,200);
  const owner=await asJSON('/api/admin/login',opts('POST',{password:'StrictCasePassword!26'}));assert.equal(owner.status,200);
  const updated=await asJSON('/api/admin/gates/family',opts('PUT',{answers:['new private answer']},owner.cookie));assert.equal(updated.status,200);
  assert.equal((await asJSON('/api/section/family',{headers:{cookie:guest.cookie}})).status,401);
  assert.equal((await asJSON('/api/auth/login',opts('POST',{slug:'family',answer:'test-family-answer'}))).status,401);
  assert.equal((await asJSON('/api/auth/login',opts('POST',{slug:'family',answer:'New Private Answer'}))).status,200);
  const pw=await asJSON('/api/admin/password',opts('PUT',{password:'NewCasePassword!27'},owner.cookie));assert.equal(pw.status,200);
  assert.equal((await asJSON('/api/admin/state',{headers:{cookie:owner.cookie}})).status,401);
  assert.equal((await asJSON('/api/admin/login',opts('POST',{password:'StrictCasePassword!26'}))).status,401);
  assert.equal((await asJSON('/api/admin/login',opts('POST',{password:'NewCasePassword!27'}))).status,200);
  assert.equal((await req('/',{method:'HEAD'})).status,200);
  assert.equal((await req('/invalid-page',{method:'HEAD'})).status,404);
});

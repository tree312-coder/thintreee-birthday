import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { changeAdminPassword, changeGateAnswers } from '../server/auth.ts';
import { db, dbReady } from '../server/db.ts';

const rl=createInterface({input,output});
async function ask(label:string, envName:string) {
  if(process.env[envName]) return process.env[envName]!;
  return (await rl.question(label)).trim();
}
try {
  await dbReady;
  console.log('\nThinTreé · Private first-time setup\n');
  console.log('Enter the answers from your original brief. Answers are salted + hashed and NEVER copied to frontend code.');
  const family=await ask('Family answer: ','INIT_FAMILY_ANSWER');
  const school=await ask('High School answer: ','INIT_SCHOOL_ANSWER');
  const university=await ask('University accepted answers (use | between variants): ','INIT_UNIVERSITY_ANSWERS');
  const admin=await ask('New admin password (12+ characters): ','INIT_ADMIN_PASSWORD');
  if(!family || !school || !university || admin.length<12) throw Error('Cần nhập đủ 3 đáp án và mật khẩu admin tối thiểu 12 ký tự.');
  await changeGateAnswers('family',[family]);
  await changeGateAnswers('high-school',[school]);
  await changeGateAnswers('university',university.split('|').map(x=>x.trim()).filter(Boolean));
  await changeAdminPassword(admin);
  await db.close();
  console.log('\n✓ Setup complete. Hashed answers stored in the private configured database. Run npm start.\n');
} catch(e) {console.error('Setup failed:',e instanceof Error?e.message:String(e));process.exitCode=1;}
finally {rl.close();}

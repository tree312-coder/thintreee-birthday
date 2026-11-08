/** Set only the private owner password when the three gate answer hashes have already been seeded. */
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { db, dbReady } from '../server/db.ts';
import { changeAdminPassword } from '../server/auth.ts';

const rl=createInterface({input,output});
try {
  await dbReady;
  const n=(await db.prepare('SELECT count(DISTINCT slug) AS n FROM gates').get() as {n:number}).n;
  if(n!==3)throw Error('Cổng chưa được thiết lập. Chạy npm run setup để cấu hình đủ 3 đáp án.');
  console.log('\nThinTreé · Owner account setup\n');
  const password=process.env.INIT_ADMIN_PASSWORD || (await rl.question('Choose a unique admin password (12+ characters): '));
  if(password.trim().length<12)throw Error('Mật khẩu quản trị phải dài ít nhất 12 ký tự.');
  await changeAdminPassword(password.trim());
  await db.close();
  console.log('✓ Owner password hashed with scrypt and stored in the private configured database.\n');
} catch(e) { console.error('Setup failed:',e instanceof Error?e.message:String(e));process.exitCode=1; }
finally {rl.close();}

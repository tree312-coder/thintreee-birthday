/**
 * Render-friendly first boot: opt-in and idempotent.
 * Never store credentials in version control. Populate INIT_* in your host's
 * private environment settings, deploy once, and remove them immediately after.
 */
import { db, dbReady } from '../server/db.ts';
import { changeAdminPassword, changeGateAnswers } from '../server/auth.ts';

const countGates = db.prepare('SELECT count(*) AS count FROM gates WHERE slug=?');
const hasAdmin = async () => Number((await db.prepare("SELECT count(*) AS count FROM admins WHERE username='owner'").get() as {count:number}).count) > 0;
const missingSlugs: Array<'family'|'high-school'|'university'>=[];
try {
  await dbReady;
  for (const slug of ['family','high-school','university'] as const) {
    if (Number((await countGates.get(slug) as {count:number}).count) === 0) missingSlugs.push(slug);
  }
  if (missingSlugs.length === 0 && (await hasAdmin())) {
    console.log('ThinTreé: private gates and admin are already configured.');
  } else {
    const family = process.env.INIT_FAMILY_ANSWER || '';
    const school = process.env.INIT_SCHOOL_ANSWER || '';
    const university = process.env.INIT_UNIVERSITY_ANSWERS || '';
    const admin = process.env.INIT_ADMIN_PASSWORD || '';
    if (!family || !school || !university || !admin) {
      console.warn('ThinTreé: initial setup still required. Add private INIT_* values or run npm run setup in an interactive terminal.');
    } else {
      if (admin.length < 12 || admin.length > 200) throw Error('Mật khẩu quản trị phải có từ 12 đến 200 ký tự.');
      const answers = {
        family: [family],
        'high-school': [school],
        university: university.split('|').map(x => x.trim()).filter(Boolean),
      };
      for (const slug of missingSlugs) await changeGateAnswers(slug, answers[slug]);
      if (!(await hasAdmin())) await changeAdminPassword(admin);
      console.log('ThinTreé: first boot setup complete, stored salted hashes only. Remove INIT_* secrets from hosting environment.');
    }
  }
} catch (error) {
  console.error('ThinTreé initialization failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
} finally {
  await db.close();
}

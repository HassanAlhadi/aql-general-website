/* يولّد hash كلمة المرور محلياً — كلمة المرور نفسها لا تغادر جهازك ولا تدخل المستودع.
 *
 *   node scripts/make-hash.mjs
 *
 * انسخ السطر الناتج إلى متغيّر البيئة MIQWAD_PASS_HASH في Vercel.
 */
import crypto from 'node:crypto';
import readline from 'node:readline';

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function hash(pass) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pass.normalize('NFKC'), salt, 32, SCRYPT);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

function strength(p) {
  const issues = [];
  if (p.length < 14) issues.push(`الطول ${p.length} — الحد الأدنى الموصى به 14`);
  if (/^\d+$/.test(p)) issues.push('أرقام فقط');
  if (/(012|123|234|345|456|567|678|789|890)/.test(p)) issues.push('يحتوي تسلسل أرقام');
  if (/(.)\1{2,}/.test(p)) issues.push('حرف مكرّر ٣ مرات أو أكثر');
  if (/^(qwerty|asdf|password|admin|welcome|letmein)/i.test(p)) issues.push('يبدأ بنمط شائع');
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  if (classes < 3) issues.push(`${classes} أنواع محارف فقط — المطلوب 3 على الأقل`);
  return issues;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('كلمة المرور (لن تُحفظ ولا تُرسل): ', (p) => {
  rl.close();
  if (!p) { console.error('\n✕ فارغة.'); process.exit(1); }
  const issues = strength(p);
  if (issues.length) {
    console.error('\n✕ كلمة المرور ضعيفة — رُفضت:');
    issues.forEach((i) => console.error('   · ' + i));
    console.error('\nهذه اللوحة تحمي بيانات الشركة كاملة، وكلمة المرور هي الحاجز الوحيد.');
    console.error('اقتراح قوي عشوائي:\n   ' + crypto.randomBytes(18).toString('base64url'));
    process.exit(1);
  }
  console.log('\n✓ مقبولة. انسخ هذا السطر إلى MIQWAD_PASS_HASH في Vercel:\n');
  console.log(hash(p));
  console.log('\nوولّد MIQWAD_SECRET عشوائياً:\n');
  console.log(crypto.randomBytes(32).toString('base64url'));
});

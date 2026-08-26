/* يولّد hash كلمة المرور محلياً — كلمة المرور نفسها لا تغادر جهازك ولا تدخل المستودع.
 *
 *   node scripts/make-hash.mjs
 *
 * انسخ السطرين الناتجين إلى MIQWAD_PASS_HASH و MIQWAD_SECRET.
 */
import crypto from 'node:crypto';
import readline from 'node:readline';

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function hash(pass) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pass.normalize('NFKC'), salt, 32, SCRYPT);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

// الحد الأدنى 8 بطلب المالك (2026-08-26). الرفض بقي للأنماط الكارثية فقط —
// تلك الموجودة حرفياً في كل قائمة تخمين وتسقط في ثوانٍ.
const WORST = new Set([
  '1234', '12345', '123456', '1234567', '12345678', '123456789',
  'password', 'passw0rd', 'qwerty', 'qwertyui', 'abc123', 'admin',
  'letmein', 'welcome', 'iloveyou', '000000', '111111', '123123',
]);

function strength(p) {
  const issues = [];
  if (p.length < 8) issues.push(`الطول ${p.length} — الحد الأدنى 8`);
  if (WORST.has(p.toLowerCase())) issues.push('من أشهر كلمات المرور المخترقة');
  if (/^(.)\1+$/.test(p)) issues.push('حرف واحد مكرّر');
  return issues;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('كلمة المرور (لن تُحفظ ولا تُرسل): ', (p) => {
  rl.close();
  p = p.trim();
  if (!p) { console.error('\n✕ فارغة.'); process.exit(1); }
  const issues = strength(p);
  if (issues.length) {
    console.error('\n✕ رُفضت: ' + issues.join(' · '));
    process.exit(1);
  }
  console.log('\n انسخ هذين السطرين:\n');
  console.log('MIQWAD_PASS_HASH=' + hash(p));
  console.log('MIQWAD_SECRET=' + crypto.randomBytes(32).toString('base64url'));
  console.log('');
});

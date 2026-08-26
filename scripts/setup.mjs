/* إعداد مِقوَد — أمر واحد يسأل ويجهّز كل شيء.
 *
 *   node scripts/setup.mjs
 *
 * يكتب .env.local ثم يشغّل الخادم. لا تحتاج تفتح أي ملف بنفسك.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENV = path.join(ROOT, '.env.local');
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const WORST = new Set(['1234', '12345', '123456', '1234567', '12345678', '123456789',
  'password', 'passw0rd', 'qwerty', 'qwertyui', 'abc123', 'admin', 'letmein',
  'welcome', 'iloveyou', '000000', '111111', '123123']);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q, def = '') => new Promise((res) => {
  rl.question(def ? `${q}\n  [اضغط Enter لـ: ${def}]\n  > ` : `${q}\n  > `,
    (a) => res(a.trim() || def));
});

async function main() {
console.log(`
╭──────────────────────────────────────────╮
│   إعداد مِقوَد — مرة واحدة فقط            │
╰──────────────────────────────────────────╯

سأسألك ٣ أسئلة، ثم أشغّل اللوحة. لن تحتاج فتح أي ملف.
`);

if (fs.existsSync(ENV)) {
  const again = await ask('⚠️  الإعداد موجود مسبقاً. أعيده من جديد؟ (اكتب: نعم)');
  if (!['نعم', 'y', 'yes', 'ايه', 'ايوه'].includes(again.toLowerCase())) {
    rl.close();
    console.log('\n  تمام — أشغّل اللوحة بالإعداد الحالي.\n');
    return run();
  }
}

// ── ١) كلمة المرور ──
let pass = '';
while (!pass) {
  const p = await ask('\n١) اختر كلمة مرور للدخول للوحة (٨ محارف فأكثر):');
  if (p.length < 8) { console.log(`  ✕ قصيرة (${p.length}) — لازم ٨ على الأقل.`); continue; }
  if (WORST.has(p.toLowerCase())) { console.log('  ✕ هذي من أشهر كلمات المرور المخترقة — اختر غيرها.'); continue; }
  if (/^(.)\1+$/.test(p)) { console.log('  ✕ حرف واحد مكرّر — اختر غيرها.'); continue; }
  pass = p;
  console.log('  ✓ تمام');
}

const user = await ask('\n٢) اسم المستخدم للدخول للوحة:', '7sn');

// ── ٣) أودو ──
console.log(`
٣) بيانات أودو (لجلب الأرقام)
   • البريد: نفس اللي تسجّل به دخولك في أودو
   • المفتاح: من أودو ← اضغط اسمك أعلى اليمين ← My Profile ←
     تبويب Account Security ← New API Key`);
const odooUser = await ask('\n   بريدك في أودو:');
const odooKey = await ask('   مفتاح API:');
const odooUrl = await ask('   رابط أودو:', 'https://karry-live.odoo.com');
const odooDb = await ask('   اسم قاعدة البيانات:', 'plementus-karry-master-15192392');

rl.close();

const salt = crypto.randomBytes(16);
const hash = `scrypt$${salt.toString('hex')}$${
  crypto.scryptSync(pass.normalize('NFKC'), salt, 32, SCRYPT).toString('hex')}`;

fs.writeFileSync(ENV, `# أُنشئ بـ scripts/setup.mjs — لا ترفعه لأي مكان
MIQWAD_USER=${user}
MIQWAD_PASS_HASH=${hash}
MIQWAD_SECRET=${crypto.randomBytes(32).toString('base64url')}
ODOO_URL=${odooUrl}
ODOO_DB=${odooDb}
ODOO_USER=${odooUser}
ODOO_API_KEY=${odooKey}
`, { mode: 0o600 });

console.log(`
  ✓ حُفظ الإعداد.
    كلمة المرور نفسها لم تُحفظ في أي مكان — فقط بصمتها. احفظها عندك.

  أشغّل اللوحة الآن…
`);
return run();
}

function run() {
  const p = spawn(process.execPath, [path.join(ROOT, 'scripts', 'dev-server.mjs')],
    { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
  p.on('exit', (c) => process.exit(c ?? 0));
}

main().catch((e) => { console.error('\n✕ ' + e.message); process.exit(1); });

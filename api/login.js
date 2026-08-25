'use strict';
const { checkPassword, setSession, noStore } = require('./_lib.js');

/* تأخير ثابت لكل محاولة — يبطئ التخمين الآلي.
   ⚠️ الدوال بلا حالة مشتركة، فلا يوجد عدّاد محاولات موثوق.
   الحاجز الحقيقي هو قوة كلمة المرور + بطء scrypt. */
const MIN_MS = 700;

module.exports = async (req, res) => {
  noStore(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const started = Date.now();
  const done = async (code, body) => {
    const wait = MIN_MS - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return res.status(code).json(body);
  };

  const { MIQWAD_USER, MIQWAD_PASS_HASH, MIQWAD_SECRET } = process.env;
  if (!MIQWAD_USER || !MIQWAD_PASS_HASH || !MIQWAD_SECRET) {
    return done(503, { error: 'not_configured',
      message: 'لم تُضبط متغيرات البيئة بعد. راجع karry/README.md' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const user = String(body?.user ?? '');
  const pass = String(body?.pass ?? '');

  // يُتحقق من الاثنين دائماً — لا خروج مبكر يكشف أيّهما الخطأ.
  const okUser = user.normalize('NFKC').toLowerCase() === MIQWAD_USER.normalize('NFKC').toLowerCase();
  const okPass = checkPassword(pass, MIQWAD_PASS_HASH);

  if (!okUser || !okPass) return done(401, { error: 'bad_credentials' });

  setSession(res, MIQWAD_USER, MIQWAD_SECRET);
  return done(200, { ok: true });
};

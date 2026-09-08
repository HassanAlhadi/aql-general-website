'use strict';
const { checkPassword, setSession, noStore, sameOrigin } = require('./_lib.js');

/* تأخير ثابت لكل محاولة — يبطئ التخمين الآلي.
   ⚠️ الدوال بلا حالة مشتركة، فلا يوجد عدّاد محاولات موثوق.
   الحاجز الحقيقي هو قوة كلمة المرور + بطء scrypt. */
const MIN_MS = 700;

module.exports = async (req, res) => {
  noStore(res);
  if (!sameOrigin(req)) return res.status(403).json({ error: 'cross_site' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const started = Date.now();
  const done = async (code, body) => {
    const wait = MIN_MS - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return res.status(code).json(body);
  };

  const { MIQWAD_USER, MIQWAD_PASS_HASH, MIQWAD_USER_2, MIQWAD_PASS_HASH_2,
          MIQWAD_SECRET } = process.env;
  if (!MIQWAD_USER || !MIQWAD_PASS_HASH || !MIQWAD_SECRET) {
    return done(503, { error: 'not_configured',
      message: 'لم تُضبط متغيرات البيئة بعد. راجع miqwad/README.md' });
  }

  // حساب ثانٍ اختياري — نفس البيانات، هوية منفصلة. حل مبدئي (طلب حسن
  // 2026-09-08) حتى يُبنى نظام حسابات كامل لاحقاً.
  const accounts = [{ user: MIQWAD_USER, hash: MIQWAD_PASS_HASH }];
  if (MIQWAD_USER_2 && MIQWAD_PASS_HASH_2) {
    accounts.push({ user: MIQWAD_USER_2, hash: MIQWAD_PASS_HASH_2 });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const user = String(body?.user ?? '');
  const pass = String(body?.pass ?? '');

  const norm = (s) => s.normalize('NFKC').toLowerCase();
  const match = accounts.find((a) => norm(a.user) === norm(user));
  // يُتحقق من كلمة المرور دائماً — حتى لو اسم المستخدم مجهولاً — لئلا يكشف
  // فارق التوقيت وجود الحساب من عدمه.
  const okPass = checkPassword(pass, match ? match.hash : MIQWAD_PASS_HASH);

  if (!match || !okPass) return done(401, { error: 'bad_credentials' });

  setSession(res, match.user, MIQWAD_SECRET);
  // Vercel Runtime Logs فقط — بلا كلمة مرور — لمعرفة من دخل ومتى.
  console.log('[miqwad] دخول ناجح:', match.user, new Date().toISOString());
  return done(200, { ok: true });
};

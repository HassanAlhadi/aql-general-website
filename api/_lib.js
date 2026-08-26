'use strict';
/* أدوات مشتركة: جلسة موقّعة + عميل أودو (JSON-RPC، قراءة فقط).
   ⚠️ لا سرّ في هذا الملف. كل الأسرار من متغيرات البيئة في Vercel. */
const crypto = require('crypto');

const COOKIE = 'miqwad_s';
const TTL_MS = 8 * 60 * 60 * 1000;          // الجلسة تنتهي بعد ٨ ساعات
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/* ── كلمة المرور: scrypt مع ملح، والمقارنة بزمن ثابت ── */
function hashPassword(pass, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const key = crypto.scryptSync(String(pass).normalize('NFKC'), salt, 32, SCRYPT);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

function checkPassword(pass, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  let want, got;
  try {
    want = Buffer.from(parts[2], 'hex');
    got = crypto.scryptSync(String(pass).normalize('NFKC'),
                            Buffer.from(parts[1], 'hex'), want.length, SCRYPT);
  } catch { return false; }
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/* ── الجلسة: حمولة موقّعة بـ HMAC، لا تُقرأ من العميل ── */
function sign(payload, secret) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${mac}`;
}

function verify(token, secret) {
  if (typeof token !== 'string' || !secret) return null;
  const i = token.lastIndexOf('.');
  if (i <= 0) return null;
  const data = token.slice(0, i);
  const mac = Buffer.from(token.slice(i + 1));
  const want = Buffer.from(
    crypto.createHmac('sha256', secret).update(data).digest('base64url'));
  if (mac.length !== want.length || !crypto.timingSafeEqual(mac, want)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')); }
  catch { return null; }
  return (p && typeof p.exp === 'number' && Date.now() < p.exp) ? p : null;
}

function setSession(res, user, secret) {
  const t = sign({ u: user, exp: Date.now() + TTL_MS }, secret);
  res.setHeader('Set-Cookie',
    `${COOKIE}=${t}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TTL_MS / 1000}`);
}

function clearSession(res) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}

function readSession(req, secret) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return verify(v.join('='), secret);
  }
  return null;
}

/* يرفض الطلبات القادمة من مواقع أخرى — حاجز CSRF وربط خارجي.
   المتصفحات الحديثة ترسل Sec-Fetch-Site؛ غيابه يعني عميلاً غير متصفح (curl مثلاً)
   وهو مقبول للتشخيص لكنه لا يحمل كوكي الجلسة أصلاً. */
function sameOrigin(req) {
  const s = req.headers['sec-fetch-site'];
  return !s || s === 'same-origin' || s === 'none';
}

/* يمنع الاستجابة من الوصول لأي وسيط تخزين */
function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}

/* ── أودو: JSON-RPC، قراءة فقط ── */
const READ_ONLY = new Set(['search_read', 'search_count', 'read', 'fields_get']);

/* fetch في Node لا يقرأ HTTPS_PROXY تلقائياً. على Vercel لا يوجد بروكسي فلا أثر لهذا،
   لكنه يجعل التشغيل المحلي يعمل خلف بروكسي شركة أو بيئة تطوير. */
let proxyReady = false;
async function ensureProxy() {
  if (proxyReady) return;
  proxyReady = true;
  const url = process.env.HTTPS_PROXY || process.env.https_proxy
           || process.env.HTTP_PROXY || process.env.http_proxy;
  if (!url) return;
  try {
    const { ProxyAgent, setGlobalDispatcher } = await import('undici');
    setGlobalDispatcher(new ProxyAgent(url));
  } catch { /* undici غير متاح — تابع بلا بروكسي */ }
}

async function rpc(service, method, args) {
  await ensureProxy();
  const base = (process.env.ODOO_URL || '').replace(/\/+$/, '');
  const r = await fetch(`${base}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call',
                           params: { service, method, args }, id: Date.now() }),
  });
  if (!r.ok) throw new Error(`odoo_http_${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.data?.message || j.error.message || 'odoo_error');
  return j.result;
}

async function odoo() {
  const { ODOO_DB: db, ODOO_USER: user, ODOO_API_KEY: key } = process.env;
  // يسمّي الناقص بالاسم — «متغيّر ناقص» وحده لا يقول أيّها، وهذا يضيّع وقتاً.
  const missing = ['ODOO_URL', 'ODOO_DB', 'ODOO_USER', 'ODOO_API_KEY']
    .filter((k) => !process.env[k] || !String(process.env[k]).trim());
  if (missing.length) throw new Error(`متغيّرات ناقصة في Vercel: ${missing.join(' · ')}`);
  const uid = await rpc('common', 'authenticate', [db, user, key, {}]);
  if (!uid) throw new Error('odoo_auth_failed');
  return {
    async call(model, method, args, kw) {
      // حاجز صريح: هذه الواجهة لا تكتب على أودو مهما كان الطلب.
      if (!READ_ONLY.has(method)) throw new Error(`method_not_allowed:${method}`);
      return rpc('object', 'execute_kw', [db, uid, key, model, method, args, kw || {}]);
    },
  };
}

const flat = (v) => (Array.isArray(v) ? (v[1] ?? '') : (v === false ? '' : v));

module.exports = { hashPassword, checkPassword, setSession, clearSession,
                   readSession, noStore, sameOrigin, odoo, flat, COOKIE };

/* خادم تطوير محلي لصفحة /miqwad — يشغّل الملفات الثابتة ودوال api/ معاً.
 *
 *   cp .env.local.example .env.local     # املأه ببياناتك
 *   node scripts/dev-server.mjs          # → http://localhost:8899/miqwad
 *
 * لا يحتاج Vercel CLI ولا أي حزمة خارجية. يحاكي بيئة Vercel:
 * يقرأ .env.local إلى process.env، ويلبس req/res بـ status()/json().
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT) || 8899;
const require_ = createRequire(import.meta.url);

// ── .env.local → process.env ──
const envFile = path.join(ROOT, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
  console.log('✓ حُمّل .env.local');
} else {
  console.warn('⚠️  لا يوجد .env.local — الدخول سيردّ «لم تُضبط». انسخ .env.local.example');
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.woff2': 'font/woff2' };

/** يلبس ServerResponse بواجهة Vercel (status/json/setHeader). */
function dress(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => {
    if (!res.hasHeader('Content-Type'))
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(o));
    return res;
  };
  return res;
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  dress(res);
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let p = decodeURIComponent(url.pathname);

  // ── دوال api/ ──
  if (p.startsWith('/api/')) {
    const name = p.slice(5).replace(/[^a-z0-9_-]/gi, '');
    const file = path.join(ROOT, 'api', `${name}.js`);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'not_found' });
    try {
      delete require_.cache[require_.resolve(file)];   // إعادة تحميل عند كل طلب
      const handler = require_(file);
      if (req.method === 'POST') req.body = await readBody(req);
      return await handler(req, res);
    } catch (e) {
      console.error(`✕ /api/${name}:`, e.message);
      return res.status(500).json({ error: 'handler_failed', message: e.message });
    }
  }

  // ── ملفات ثابتة (cleanUrls مثل Vercel) ──
  if (p.endsWith('/')) p += 'index.html';
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) return res.status(403).end('forbidden');   // منع تجاوز الجذر
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    for (const cand of [`${file}.html`, path.join(file, 'index.html')]) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) { file = cand; break; }
    }
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
    return res.status(404).end('404');
  res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`\n  مِقوَد يعمل محلياً:\n  → http://localhost:${PORT}/miqwad\n`);
  const missing = ['MIQWAD_USER', 'MIQWAD_PASS_HASH', 'MIQWAD_SECRET',
                   'ODOO_URL', 'ODOO_DB', 'ODOO_USER', 'ODOO_API_KEY']
    .filter((k) => !process.env[k]);
  if (missing.length) console.warn(`  ⚠️ متغيرات ناقصة: ${missing.join(', ')}\n`);
});

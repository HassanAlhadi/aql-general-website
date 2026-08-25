'use strict';
/* واجهة «مِقوَد» الحيّة. لا تحمل أي بيانات شركة — كلها من /api/data بعد المصادقة. */

const $ = (s) => document.querySelector(s);
const REFRESH_MS = 60000;
let timer = null;

const nf = new Intl.NumberFormat('en-US');
const n = (v, d = 0) => (v === null || v === undefined ? 'غير معروف'
  : nf.format(Number(v).toFixed(d) * 1));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/>',
  box: '<path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5z"/><path d="M3 8.5 12 13l9-4.5M12 13v7"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.5 12h11L21 7H6"/>',
  trend: '<path d="M3 17l6-6 4 4 7-7"/><path d="M14 8h6v6"/>',
  tag: '<path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  chart: '<path d="M3 20h18M6 20V11M11 20V4M16 20v-6M21 20v-9"/>',
  alert: '<path d="M12 9v5M12 17.5v.01"/><path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.8M12 18.7v2.8M2.5 12h2.8M18.7 12h2.8M5.2 5.2l2 2M16.8 16.8l2 2M18.8 5.2l-2 2M7.2 16.8l-2 2"/>',
};
const ic = (k, c = 'currentColor', s = 14) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9"
   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

const NAV = [
  ['overview', 'home', 'نظرة عامة'], ['intg', 'chart', 'عدّاد الربط'],
  ['wh', 'box', 'المخازن'], ['pu', 'cart', 'المشتريات والإنتاج'],
  ['b2b', 'trend', 'مبيعات B2B'], ['alora', 'tag', 'Alora — التجزئة'],
];

const rows = (arr, lab, val, cls = '') => arr.map((x) =>
  `<div class="row"><span class="lab">${esc(lab(x))}</span>
   <span class="n ${cls}">${val(x)}</span></div>`).join('');

const pctCls = (p) => (p >= 90 ? 'cok' : p >= 75 ? 'cwarn' : 'cbad');

function intgUnits(list) {
  const L = { in: ['داخل النظام', 'p-ok'], partial: ['جزئي', 'p-warn'],
              out: ['خارج النظام', 'p-paper'], unknown: ['غير معروف', 'p-plain'] };
  return list.map((r) => `<div class="iu s-${r.status}"><span class="st"></span>
    <div style="min-width:0"><div class="nm">${esc(r.dept)}</div>
    <div class="dt">${esc(r.unit)}</div></div>
    <span class="v">${r.metric === null ? '—' : n(r.metric)}</span></div>`).join('');
}

function render(d) {
  const { warehouse: w, purchasing: p, production: pr, b2b: b, alora: a } = d;
  const m = p.m08;
  const kg = w.stock_by_uom.find((r) => r.uom.toLowerCase() === 'kg') || { qty: 0, reserved: 0 };
  const pc = w.stock_by_uom.find((r) => r.uom.toUpperCase() === 'PC') || { qty: 0 };
  const nIn = d.integration.filter((r) => r.status === 'in').length;
  const nOut = d.integration.filter((r) => r.status === 'out').length;

  $('#stamp').innerHTML = `مباشر من أودو · <span class="mono">${esc(d.generated_at)}</span> UTC`;
  $('#tb').innerHTML =
    `<span class="pill p-ok"><span class="dot-live"></span>حيّ · يتحدّث كل دقيقة</span>
     <span class="pill p-paper"><span class="d"></span>${nOut} أقسام خارج النظام</span>`;

  const V = {};

  V.overview = `<div class="grid" style="grid-template-columns:repeat(4,1fr);
    grid-template-rows:1.05fr .95fr auto;
    grid-template-areas:'hero hero pend pend' 'm08 retail pend pend' 'intg intg intg intg'">
    <div class="card acc" style="grid-area:hero">
      <div class="ch">${ic('tag', 'var(--brand)')}<span class="t">أصناف أُنشئت اليوم</span>
        ${a.created_today.length ? '<span class="sp pill p-brand"><span class="d"></span>جديد</span>' : ''}</div>
      <p class="big xl cbrand">${a.created_today.length}</p>
      <div class="scroll">${a.created_today.length
        ? rows(a.created_today, (x) => x.name.trim(), (x) => `<span class="mono">${esc(x.code)}</span>`)
        : '<p class="sub">لا شيء أُنشئ اليوم.</p>'}</div>
      <p class="say"><b>مدير Alora:</b> كل صنف يُنشأ بسعر صفر يوسّع فجوة التسعير.</p>
    </div>
    <div class="card danger" style="grid-area:m08">
      <div class="ch">${ic('alert', 'var(--bad)')}<span class="t">M-08 · الأعلى أثراً</span></div>
      <p class="big xl cbad">${m.pct === null ? '—' : m.pct.toFixed(0)}<span class="u">%</span></p>
      <p class="sub">${n(m.received_units)} من <b>${n(m.total_units)}</b> وحدة على
        <b class="mono">P00668</b> · <b class="mono">P00670</b></p>
      <p class="say"><b>ضابط المشتريات:</b> خطوة واحدة تفتح سلسلة Alora كاملة.</p>
    </div>
    <div class="card" style="grid-area:retail">
      <div class="ch">${ic('alert', 'var(--bad)')}<span class="t">تغليف التجزئة — مُسلَّم</span></div>
      <p class="big xl cbad">${a.retail_delivered_pct === null ? '—' : a.retail_delivered_pct.toFixed(0)}<span class="u">%</span></p>
      <p class="sub">${n(a.retail_ordered)} وحدة مطلوبة مقابل
        <b class="cok">${b.delivered_pct?.toFixed(0)}%</b> للسائب بالكيلو</p>
      <p class="say"><b>محلل B2B:</b> القناة غير مُشغّلة داخل أودو.</p>
    </div>
    <div class="card" style="grid-area:pend">
      <div class="ch">${ic('alert', 'var(--bad)')}<span class="t">ما ينتظر قرارك</span></div>
      <div class="scroll">
        <div class="row"><span class="lab">ترحيل الاستلامين (M-08)</span><span class="n cbad">${m.pct?.toFixed(0)}%</span></div>
        <div class="row"><span class="lab">أصناف بلا سعر بيع</span><span class="n cbad">${a.skus - a.with_price} من ${a.skus}</span></div>
        <div class="row"><span class="lab">أسماء أصناف مكتوبة خطأ</span><span class="n cwarn">${a.misspelled.length}</span></div>
        <div class="row"><span class="lab">أوامر متأخرة</span><span class="n cwarn">${n(w.overdue_all)}</span></div>
        <div class="row"><span class="lab">محجوز برصيد صفر</span><span class="n cbad">${n(w.reserved_no_stock_units)}</span></div>
        <div class="row"><span class="lab">أوامر ملغاة (السبب غير معروف)</span><span class="n cwarn">${n(b.cancelled_orders)}</span></div>
        <div class="row"><span class="lab">سجلات CRM</span><span class="n cbad">${n(d.crm.leads)}</span></div>
      </div>
      <p class="say"><b>ضابط ربط أودو:</b> لا شيء هنا يُنفَّذ من اللوحة — كلها إجراءات بشرية.</p>
    </div>
    <div class="card" style="grid-area:intg;padding:.5rem .6rem">
      <div class="ch">${ic('chart', 'var(--brand)')}<span class="t">عدّاد الربط</span>
        <span class="sp pill p-ok">${nIn} داخل</span>
        <span class="pill p-paper" style="margin-inline-start:.3rem">${nOut} خارج</span></div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.35rem;overflow:hidden">
        ${intgUnits(d.integration)}</div>
    </div></div>`;

  V.intg = `<div class="grid" style="grid-template-columns:1fr;grid-template-rows:1fr auto">
    <div class="card">
      <div class="ch">${ic('chart', 'var(--brand)')}<span class="t">أي قسم داخل النظام فعلاً؟</span>
        <span class="sp pill p-ok">${nIn} داخل</span>
        <span class="pill p-paper" style="margin-inline-start:.3rem">${nOut} خارج</span></div>
      <div class="scroll" style="display:grid;grid-template-columns:repeat(2,1fr);gap:.4rem;align-content:start">
        ${intgUnits(d.integration)}</div>
      <p class="say"><b>ضابط ربط أودو:</b> الرقم نشاط مسجَّل فعلاً خلال ٣٠ يوماً، لا نسبة مقدَّرة.
        «غير معروف» تعني لم يُفحص — ولا تُقدَّر.</p>
    </div>
    <div class="card acc"><p class="sub" style="font-size:.9rem;line-height:1.6;margin:0">
      <b>الرسالة في جملة:</b> المخازن والمشتريات والإنتاج و B2B <b class="cok">داخل النظام</b>.
      التجزئة و CRM والتسويق <b class="cpaper">على الورق</b>.
      الجودة والموارد البشرية <b>لم تُفحص بعد</b>.</p></div></div>`;

  V.wh = `<div class="grid" style="grid-template-columns:repeat(4,1fr);grid-template-rows:1fr 1fr">
    <div class="card"><div class="ch">${ic('box')}<span class="t">الرصيد السائب</span></div>
      <p class="big">${n(kg.qty)}<span class="u">كجم</span></p>
      <p class="sub">محجوز ${n(kg.reserved)} كجم · وإلى جانبه ${n(pc.qty)} قطعة</p>
      <div class="bar"><i style="width:${kg.qty ? Math.min(100, kg.reserved / kg.qty * 100).toFixed(0) : 0}%"></i></div>
      <p class="say"><b>مراقب المخازن:</b> لا «إجمالي» واحد — الوحدات لا تُجمع.</p></div>
    <div class="card"><div class="ch">${ic('chart')}<span class="t">الرصيد بوحدة القياس</span></div>
      <div class="scroll">${rows(w.stock_by_uom, (x) => x.uom, (x) => n(x.qty))}</div></div>
    <div class="card"><div class="ch">${ic('alert', 'var(--warn)')}<span class="t">أوامر متأخرة</span></div>
      <p class="big cwarn">${n(w.overdue_all)}</p>
      <p class="sub">منها <b>${n(w.overdue_outgoing)}</b> تسليم عملاء</p>
      <div class="scroll">${rows(Object.entries(w.picking_states).sort((x, y) => y[1] - x[1]),
        (x) => x[0], (x) => n(x[1]))}</div></div>
    <div class="card"><div class="ch">${ic('alert', 'var(--bad)')}<span class="t">شذوذ الرصيد</span></div>
      <p class="big cbad">${n(w.reserved_no_stock_units)}<span class="u">محجوز برصيد صفر</span></p>
      <p class="sub">على ${w.reserved_no_stock_lines} أسطر · و${w.negative_lines} برصيد سالب من ${n(w.lines)}</p>
      <p class="say"><b>مراقب المخازن:</b> نسبة منخفضة — الانضباط جيد عموماً.</p></div>
    <div class="card" style="grid-column:span 2">
      <div class="ch">${ic('chart')}<span class="t">أعلى الأصناف رصيداً</span></div>
      <div class="scroll">${rows(w.top_products, (x) => x.name, (x) => n(x.qty))}</div></div>
    <div class="card" style="grid-column:span 2">
      <div class="ch">${ic('trend', 'var(--ok)')}<span class="t">نشاط مسجَّل — ٣٠ يوماً</span>
        <span class="sp pill p-ok"><span class="d"></span>يعمل</span></div>
      <p class="big cok">${n(w.moves_done_30d)}<span class="u">حركة مكتملة</span></p>
      <p class="sub">المستودع يسجّل يومياً. مطابقة التقرير اليدوي: ١١ من ٢٠ بنداً تطابق حتى الكسر
        العشري — <b>أودو دقيق فيما يُسجَّل فيه</b>.</p></div></div>`;

  V.pu = `<div class="grid" style="grid-template-columns:repeat(4,1fr);grid-template-rows:1fr 1fr">
    <div class="card danger" style="grid-column:span 2">
      <div class="ch">${ic('alert', 'var(--bad)')}<span class="t">M-08 — الإجراء الأعلى أثراً</span></div>
      <p class="big xl cbad">${m.pct === null ? '—' : m.pct.toFixed(0)}<span class="u">%</span></p>
      <p class="sub">${n(m.received_units)} من ${n(m.total_units)} وحدة</p>
      <p class="say"><b>ضابط المشتريات:</b> أرخص إجراء متاح وأعلاها أثراً.</p></div>
    <div class="card"><div class="ch">${ic('cart')}<span class="t">أوامر شراء مفتوحة</span></div>
      <p class="big">${n(p.open_orders)}</p>
      <p class="sub">${n(p.orders_30d)} جديداً خلال ٣٠ يوماً</p></div>
    <div class="card"><div class="ch">${ic('alert', 'var(--warn)')}<span class="t">استلامات معلّقة</span></div>
      <p class="big cwarn">${n(p.pending_receipts)}</p>
      <p class="sub">وصلت أو في الطريق ولم تُرحَّل</p></div>
    <div class="card" style="grid-column:span 2">
      <div class="ch">${ic('box')}<span class="t">نسبة الاستلام الإجمالية</span></div>
      <p class="big ${p.received_pct < 80 ? 'cwarn' : 'cok'}">${p.received_pct?.toFixed(1)}<span class="u">%</span></p>
      <p class="sub">${n(p.received_units)} من ${n(p.ordered_units)}</p>
      <div class="bar ${p.received_pct < 80 ? '' : 'ok'}"><i style="width:${p.received_pct?.toFixed(0)}%"></i></div></div>
    <div class="card" style="grid-column:span 2">
      <div class="ch">${ic('gear')}<span class="t">أوامر التصنيع</span></div>
      <p class="big">${n(pr.done)}<span class="u">منجز من ${n(pr.total_orders)}</span></p>
      <p class="sub"><b>${pr.active_orders}</b> جارية (${n(pr.active_units)} وحدة) ·
        ${n(pr.orders_30d)} جديداً خلال ٣٠ يوماً</p>
      <div class="bar ok"><i style="width:${(pr.done / pr.total_orders * 100).toFixed(0)}%"></i></div></div></div>`;

  V.b2b = `<div class="grid" style="grid-template-columns:repeat(3,1fr);grid-template-rows:1fr 1fr">
    <div class="card" style="grid-row:span 2">
      <div class="ch">${ic('trend', 'var(--ok)')}<span class="t">نسبة التسليم — بالكيلو</span></div>
      <p class="big xl cok">${b.delivered_pct?.toFixed(1)}<span class="u">%</span></p>
      <p class="sub">${n(b.delivered_kg)} من ${n(b.ordered_kg)} كجم على ${n(b.confirmed_orders)} أمراً</p>
      <div class="bar ok"><i style="width:${b.delivered_pct?.toFixed(0)}%"></i></div>
      <p class="say"><b>محلل B2B:</b> الكيلو فقط. الخلط مع الصواني يفسد الرقم.</p></div>
    <div class="card" style="grid-row:span 2">
      <div class="ch">${ic('chart')}<span class="t">أعلى العملاء — نسبة السحب</span></div>
      <div class="scroll">${b.top_customers.map((c) =>
        `<div class="row"><span class="lab">${esc(c.name)}</span>
         <span class="n ${pctCls(c.pct || 0)}">${c.pct?.toFixed(0)}%</span></div>`).join('')}</div>
      <p class="say"><b>محلل B2B:</b> النِسب المنخفضة ليست تأخيراً بالضرورة — السحب على دفعات مؤكَّد.</p></div>
    <div class="card"><div class="ch">${ic('alert', 'var(--warn)')}<span class="t">أوامر ملغاة</span></div>
      <p class="big cwarn">${n(b.cancelled_orders)}</p>
      <p class="sub">تراكمية · السبب <b>غير معروف</b></p></div>
    <div class="card"><div class="ch">${ic('trend')}<span class="t">أوامر جديدة — ٣٠ يوماً</span></div>
      <p class="big">${n(b.orders_30d)}</p>
      <p class="sub">النشاط الناضج والعامل</p></div></div>`;

  V.alora = `<div class="grid" style="grid-template-columns:repeat(4,1fr);grid-template-rows:1fr 1fr">
    <div class="card"><div class="ch">${ic('tag')}<span class="t">فواتير عملاء مُرحَّلة</span></div>
      <p class="big cbad">${n(a.posted_invoice_lines)}</p><p class="sub">صفر إيراد مسجَّل</p></div>
    <div class="card"><div class="ch">${ic('box')}<span class="t">تسليمات للعملاء</span></div>
      <p class="big cbad">${n(a.customer_deliveries)}</p><p class="sub">لا حركة خروج لموقع عميل</p></div>
    <div class="card"><div class="ch">${ic('tag')}<span class="t">أصناف لها سعر بيع</span></div>
      <p class="big cbad">${a.with_price}<span class="u">من ${a.skus}</span></p>
      <p class="sub">${a.with_cost} لها تكلفة</p>
      <div class="bar bad"><i style="width:${(a.with_price / a.skus * 100).toFixed(0)}%"></i></div></div>
    <div class="card"><div class="ch">${ic('alert', 'var(--paper)')}<span class="t">على الورق فقط</span></div>
      <p class="big cpaper">${n(a.manual_report_units)}<span class="u">وحدة</span></p>
      <p class="sub">في التقرير اليدوي · <b>صفر</b> في أودو</p></div>
    <div class="card danger" style="grid-column:span 2">
      <div class="ch">${ic('alert', 'var(--bad)')}<span class="t">التغليف التجزئة — مُسلَّم صفر</span></div>
      <p class="big xl cbad">${a.retail_delivered_pct?.toFixed(1)}<span class="u">%</span></p>
      <p class="sub">${n(a.retail_ordered)} وحدة مطلوبة وصفر مُسلَّمة، مقابل
        ${b.delivered_pct?.toFixed(1)}% للسائب — نفس النظام ونفس الفترة.</p>
      <p class="say"><b>محلل B2B:</b> الفصل بوحدة القياس كشف هذا.</p></div>
    <div class="card" style="grid-column:span 2">
      <div class="ch">${ic('alert', 'var(--warn)')}<span class="t">أسماء تُسقط الصنف من كل تقرير</span></div>
      <div class="scroll">${rows(a.misspelled, (x) => x.name.trim(),
        (x) => `<span class="mono">${esc(x.code)}</span>`)}</div>
      <p class="say"><b>ضابط ربط أودو:</b> اللوحة تطابق على <b>كود الصنف</b> لا الاسم.</p></div></div>`;

  $('#views').innerHTML = NAV.map(([k], i) =>
    `<section class="view${i === 0 ? ' on' : ''}" data-v="${k}">${V[k]}</section>`).join('');
  wireNav();
}

function wireNav() {
  const views = document.querySelectorAll('.view');
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.nav-item').forEach((b) =>
        b.setAttribute('aria-current', b === btn ? 'true' : 'false'));
      views.forEach((s) => s.classList.toggle('on', s.dataset.v === btn.dataset.v));
      $('#vt').textContent = btn.querySelector('span').textContent;
      $('#sb').classList.remove('open');
    };
  });
}

async function load() {
  let r;
  try { r = await fetch('/api/data', { credentials: 'same-origin' }); }
  catch { return; }                                  // انقطاع شبكة — أبقِ آخر عرض
  if (r.status === 401) return showGate();
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    $('#stamp').innerHTML = `<span style="color:var(--bad)">تعذّر السحب من أودو — ${esc(e.message || r.status)}</span>`;
    return;
  }
  render(await r.json());
}

function showApp() {
  $('#gate').hidden = true; $('#app').hidden = false;
  $('#nav').innerHTML = '<div class="nav-lbl">القيادة</div>' + NAV.map(([v, i, t], k) =>
    `<button class="nav-item" data-v="${v}" aria-current="${k === 0 ? 'true' : 'false'}">
     ${ic(i)}<span>${t}</span></button>`).join('');
  load();
  clearInterval(timer);
  timer = setInterval(load, REFRESH_MS);
}

function showGate() {
  clearInterval(timer);
  $('#app').hidden = true; $('#gate').hidden = false;
}

$('#gf').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const btn = $('#gb'), err = $('#ge');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; err.hidden = true;
  try {
    const r = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ user: $('#u').value, pass: $('#p').value }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { $('#p').value = ''; return showApp(); }
    err.textContent = j.error === 'not_configured'
      ? (j.message || 'اللوحة لم تُضبط بعد.')
      : 'المستخدم أو كلمة المرور غير صحيحة.';
    err.hidden = false;
  } catch {
    err.textContent = 'تعذّر الاتصال بالخادم.'; err.hidden = false;
  } finally { btn.disabled = false; btn.textContent = 'دخول'; }
});

$('#lo').onclick = async () => {
  await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
  showGate();
};

$('#tt').onclick = () => {
  const dark = document.documentElement.dataset.theme === 'dark';
  if (dark) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = 'dark';
  try { localStorage.setItem('miqwad-theme', dark ? 'light' : 'dark'); } catch {}
};
try { if (localStorage.getItem('miqwad-theme') === 'dark') document.documentElement.dataset.theme = 'dark'; } catch {}

/* عند التحميل: جلسة صالحة؟ ادخل مباشرة. */
fetch('/api/data', { credentials: 'same-origin' })
  .then((r) => (r.status === 401 ? showGate() : showApp()))
  .catch(() => showGate());

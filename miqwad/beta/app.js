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
  truck: '<path d="M2 7h11v9H2z"/><path d="M13 10h4l3 3v3h-7z"/><circle cx="6" cy="18.5" r="1.6"/><circle cx="17" cy="18.5" r="1.6"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 19a6.5 6.5 0 0 1 13 0"/><path d="M16 5.5a3.2 3.2 0 0 1 0 6M17.5 19a6.4 6.4 0 0 0-2-4.6"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
  coins: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  alert: '<path d="M12 9v5M12 17.5v.01"/><path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.8M12 18.7v2.8M2.5 12h2.8M18.7 12h2.8M5.2 5.2l2 2M16.8 16.8l2 2M18.8 5.2l-2 2M7.2 16.8l-2 2"/>',
  file: '<path d="M6 2.5h8l4 4V21H6z"/><path d="M14 2.5V7h4"/>',
};
const ic = (k, c = 'currentColor', s = 14) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9"
   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

const NAV_GROUPS = [
  ['القيادة', [['overview', 'home', 'نظرة عامة'], ['intg', 'chart', 'عدّاد الربط']]],
  ['التشغيل', [['wh', 'box', 'المخازن'], ['pu', 'cart', 'المشتريات والإنتاج'],
               ['ship', 'truck', 'الشحن والتسليم']]],
  ['التجارة', [['b2b', 'trend', 'مبيعات B2B'], ['alora', 'tag', 'Alora — التجزئة'],
               ['cust', 'users', 'العملاء'], ['cat', 'grid', 'المنتجات والتسعير'],
               ['designs', 'file', 'التصميمات']]],
  ['المال', [['fin', 'coins', 'المالية']]],
];
const NAV = NAV_GROUPS.flatMap(([, g]) => g);

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


/* ══════════════════════════════════════════════════════════════════
   المرحلة ١ — اللغة
   لا رمز يظهر للمستخدم. M-08 و G-03 نظام أرشفة داخلي في السجلات،
   لا لغة شاشة. كل بند يجيب: ما الذي حدث؟ لماذا يهمّني؟ ما الذي أفعله؟

   المرحلة ٢ — القرارات
   الترتيب = الأثر × الإلحاح × القدرة على التصرّف.
   البند الذي يُحسم برسالة واحدة يسبق ما يحتاج مشروعاً، حتى لو كان أكبر.
   ══════════════════════════════════════════════════════════════════ */

function decisions(d) {
  const { purchasing: p, alora: a, warehouse: w, customers: cu, catalog: ca, b2b: b } = d;
  const out = [];

  if (p.m08 && p.m08.pct === 0 && p.m08.total_units > 0) {
    out.push({
      sev: 'bad', score: 100,
      t: 'شحنتان وصلتا ولم تدخل النظام',
      i: `${n(p.m08.total_units)} وحدة معلّقة — والنظام لا يعرف أنها في المخزن`,
      a: 'كلمة واحدة لمدير المخازن: رحِّل استلام <b>P00668</b> و<b>P00670</b>',
      why: 'ما دامت البضاعة خارج النظام، لا يمكن بيعها ولا تسليمها ولا فوترتها من أودو. '
         + 'هذه أرخص خطوة وأعلاها أثراً: تفتح سلسلة Alora كاملة بلا مشروع ولا تكلفة.',
      go: ['pu', '#m08'],
    });
  }

  if (ca && ca.retail_no_price > 0) {
    out.push({
      sev: 'bad', score: 92,
      t: `${ca.retail_no_price} صنف تجزئة بلا سعر بيع`,
      i: 'كل منتج يُباع بالعلبة ليس له سعر في النظام',
      a: 'من يحدّد الأسعار يدخلها في أودو — أو تعطيه القائمة',
      why: 'بلا سعر لا تُصدَر فاتورة، وبلا فاتورة لا يوجد إيراد مسجَّل. '
         + 'هذه الحلقة الأولى في السلسلة المقطوعة — قبلها لا يتحرّك شيء.',
      go: ['cat', '#retail-price'],
    });
  }

  if (a && a.retail_delivered_pct === 0 && a.retail_ordered > 0) {
    out.push({
      sev: 'bad', score: 88,
      t: 'كل ما يُباع بالعلبة لم يخرج من المخزن ولا مرة',
      i: `${n(a.retail_ordered)} وحدة تغليف مطلوبة، وصفر مُسلَّمة — مقابل `
       + `${b.delivered_pct != null ? b.delivered_pct.toFixed(0) : '—'}٪ للسائب بالكيلو`,
      a: 'اسأل المخازن: هل تخرج فعلاً ولا تُسجَّل، أم لا تخرج أصلاً؟',
      why: 'نفس النظام ونفس الفترة ونفس الناس — السائب يخرج والتجزئة لا. '
         + 'هذا يعني أن المشكلة ليست في أودو ولا في المخزن، بل أن قناة التجزئة '
         + 'غير مُشغّلة داخل النظام أصلاً.',
      go: ['alora', '#retail-deliv'],
    });
  }

  if (w && w.reserved_no_stock_units > 0) {
    out.push({
      sev: 'bad', score: 74,
      t: 'بضاعة محجوزة لعملاء والمخزن يقول رصيدها صفر',
      i: `${n(w.reserved_no_stock_units)} وحدة على ${w.reserved_no_stock_lines} أسطر`,
      a: 'المخازن تراجع: إنتاج لم يكتمل، أم حجز على وهم؟',
      why: 'الحجز على رصيد صفر يعني وعداً بشيء غير موجود. '
         + 'قد يكون طبيعياً (حجز مقابل أمر تصنيع جارٍ)، وقد يكون خطأً يمنع البيع لعميل آخر.',
      go: ['wh', '#reserved'],
    });
  }

  if (cu && cu.missing_country_pct >= 50) {
    out.push({
      sev: 'warn', score: 62,
      t: 'ثلثا عملائك بلا بلد مسجَّل',
      i: `${n(cu.missing_country)} من ${n(cu.total)} عميلاً`,
      a: 'المبيعات تكمل الحقل — أرخص إصلاح في القائمة كلها',
      why: 'قرارات التوسع تُبنى على «أين نبيع أكثر؟». '
         + 'وبلا بلد لا يمكن الإجابة — ولا معرفة أي سوق ينمو وأيّه يتراجع.',
      go: ['cust', '#country'],
    });
  }

  if (w && w.overdue_all > 0) {
    out.push({
      sev: 'warn', score: 55,
      t: `${n(w.overdue_all)} أمر مخزن فات موعده`,
      i: `منها ${n(w.overdue_outgoing)} تسليم لعملاء`,
      a: 'المخازن تغلق المنجز وتحدّث مواعيد الباقي',
      why: 'الأمر المفتوح بعد موعده يجعل «المتاح للبيع» غير صحيح، '
         + 'فيظهر مخزون محجوز لا يُباع. وأغلبه — غالباً — بضاعة خرجت ولم تُغلق في النظام.',
      go: ['ship', '#overdue'],
    });
  }

  if (b && b.cancelled_orders > 0) {
    out.push({
      sev: 'warn', score: 40,
      t: `${n(b.cancelled_orders)} طلب بيع أُلغي`,
      i: 'تراكمية — والسبب غير معروف',
      a: 'اسأل المحاسبة عن سبب أحدث إلغاء',
      why: 'الإلغاء المتكرّر إمّا عملاء يتراجعون — وهذه مشكلة تجارية، '
         + 'أو النظام يرفض التأكيد لنقص مخزون — وهذه مشكلة تشغيلية. '
         + 'الفرق كبير، والسبب لم يُحسم بعد.',
      go: ['b2b', '#cancelled'],
    });
  }

  return out.sort((x, y) => y.score - x.score);
}

/* المرحلة ٢ — ما تغيّر منذ آخر زيارة. تُحفَظ اللقطة في المتصفح فقط. */
const SNAP_KEY = 'miqwad-last-seen';

function keyMetrics(d) {
  return {
    at: d.generated_at,
    m08: d.purchasing.m08 ? d.purchasing.m08.pct : null,
    overdue: d.warehouse.overdue_all,
    cancelled: d.b2b.cancelled_orders,
    aloraInv: d.alora.posted_invoice_lines,
    aloraDeliv: d.alora.customer_deliveries,
    priced: d.alora.with_price,
    customers: d.customers ? d.customers.total : null,
  };
}

function changesSince(d) {
  let prev = null;
  try { prev = JSON.parse(localStorage.getItem(SNAP_KEY) || 'null'); } catch { prev = null; }
  const cur = keyMetrics(d);
  try { localStorage.setItem(SNAP_KEY, JSON.stringify(cur)); } catch { /* وضع خاص */ }
  if (!prev) return { first: true, since: null, list: [] };

  const list = [];
  const cmp = (k, label, goodUp, fmt = (v) => n(v)) => {
    if (prev[k] == null || cur[k] == null || prev[k] === cur[k]) return;
    const up = cur[k] > prev[k];
    const good = goodUp ? up : !up;
    list.push({ dir: good ? 'up' : 'down',
      text: `<b>${label}</b>: ${fmt(prev[k])} ← ${fmt(cur[k])}` });
  };
  cmp('aloraInv', 'فواتير Alora', true);
  cmp('aloraDeliv', 'تسليمات Alora', true);
  cmp('priced', 'أصناف لها سعر', true);
  cmp('m08', 'ترحيل الشحنتين', true, (v) => `${v}٪`);
  cmp('cancelled', 'الطلبات الملغاة', false);
  cmp('overdue', 'أوامر متأخرة', false);
  cmp('customers', 'عدد العملاء', true);
  return { first: false, since: prev.at, list };
}

/* المؤشرات السبعة التي أراقبها — تُعرض دائماً بقيمتها الحالية، حتى حين لا يتغيّر شيء.
   بدونها تبدو البطاقة فارغة في أول زيارة وفي كل يوم هادئ. */
function watchList(d) {
  const m = keyMetrics(d);
  const priced = d.catalog && d.catalog.retail_total ? d.catalog.retail_total : null;
  return [
    ['فواتير Alora مُرحَّلة', n(m.aloraInv), (m.aloraInv || 0) > 0, 'alora', '#paper'],
    ['تسليمات Alora للعملاء', n(m.aloraDeliv), (m.aloraDeliv || 0) > 0, 'alora', '#retail-deliv'],
    ['أصناف تجزئة لها سعر', priced ? `${m.priced} من ${priced}` : n(m.priced),
      (m.priced || 0) > 0, 'cat', '#retail-price'],
    ['ترحيل الشحنتين', m.m08 == null ? 'غير معروف' : `${m.m08}٪`, (m.m08 || 0) > 0, 'pu', '#m08'],
    ['أوامر متأخرة', n(m.overdue), (m.overdue || 0) === 0, 'ship', '#overdue'],
    ['طلبات ملغاة', n(m.cancelled), (m.cancelled || 0) === 0, 'b2b', '#cancelled'],
    ['عملاء مسجّلون', n(m.customers), true, 'cust', '#country'],
  ];
}

/* المرحلة ٣ — انتقال + وميض */
function goTo(view, sel) {
  const btn = document.querySelector(`.nav-item[data-v="${view}"]`);
  if (btn) btn.click();
  requestAnimationFrame(() => {
    const el = sel && document.querySelector(`.view.on ${sel}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('flash');
    void el.offsetWidth;              // يعيد تشغيل الحركة عند النقر المتكرر
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 2400);
  });
}

/* زرّ «ليش يهمّني؟» — يظهر عند الطلب فقط، فلا يزحم من يعرف */
const why = (text) => `<div class="why"><button class="why-btn" type="button"
  onclick="this.parentElement.classList.toggle('open')">
  ليش يهمّني؟</button><div class="why-body">${esc(text)}</div></div>`;

/* رقم قابل للنقر */
const goNum = (view, sel, inner) =>
  `<button class="go" type="button" onclick="window.__go('${view}','${sel}')">${inner}
   <span class="arrow">←</span></button>`;


function render(d) {
  const { warehouse: w, purchasing: p, production: pr, b2b: b, alora: a,
          logistics: l, customers: cu, catalog: ca, finance_detail: fd } = d;
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

  const DEC = decisions(d).slice(0, 3);
  const CH = changesSince(d);
  const hour = new Date().getUTCHours() + 3;              // توقيت مصر/السعودية صيفاً
  const greet = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء الخير';

  const decCards = DEC.length ? DEC.map((x, i) => `
    <div class="dec-item ${i === 0 ? 'sev-' + x.sev : 'sev-' + x.sev + ' quiet'}">
      <span class="dec-rank">${i + 1}</span>
      <div class="dec-b">
        <div class="dec-t">${esc(x.t)}</div>
        <div class="dec-i">${x.i}</div>
        <div class="dec-a">${x.a}</div>
        <div class="dec-btns">
          <button class="dec-btn primary" type="button"
            onclick="window.__go('${x.go[0]}','${x.go[1]}')">افتح التفاصيل</button>
          <button class="dec-btn" type="button"
            onclick="this.closest('.dec-item').style.display='none'">أجّل ليوم</button>
        </div>
        ${why(x.why)}
      </div>
    </div>`).join('') : '<p class="sub">لا شيء ينتظر قرارك اليوم.</p>';

  const chgList = CH.first
    ? '<p class="sub">هذه أول زيارة تُسجَّل. من المرة القادمة سأعرض لك ما تغيّر بينهما.</p>'
    : CH.list.length
      ? CH.list.map((c) => `<div class="chg ${c.dir}"><span class="dot"></span>
          <span>${c.text}</span></div>`).join('')
      : `<div class="chg flat"><span class="dot"></span><span>لا شيء تغيّر منذ آخر زيارتك
         ${CH.since ? `(${esc(CH.since.slice(0, 16))})` : ''}.</span></div>`;

  const inCount = d.integration.filter((r) => r.status === 'in').length;
  const outCount = d.integration.filter((r) => r.status === 'out').length;
  const needAttn = (w.overdue_all || 0) + (b.cancelled_orders || 0);

  V.overview = `<div class="grid" style="grid-template-columns:5fr 4fr;
    grid-template-rows:auto 1fr auto">
    <div class="card" style="grid-column:1/-1;padding:.7rem .9rem">
      <div class="hello">${greet} حسن — إليك ما يهمّ اليوم</div>
      <div class="hello-sub">آخر قراءة من أودو:
        <span class="mono">${esc(d.generated_at)}</span> UTC</div>
    </div>

    <div class="card" style="grid-row:2">
      <div class="ch">${ic('alert', 'var(--bad)')}<span class="t">ينتظر قرارك</span>
        <span class="sp pill p-plain">${DEC.length} من ${decisions(d).length}</span></div>
      <div class="dec">${decCards}</div>
    </div>

    <div class="card" style="grid-row:2">
      <div class="ch">${ic('trend', 'var(--brand)')}<span class="t">ما تغيّر منذ آخر زيارتك</span></div>
      <div class="scroll">
        ${chgList}
        <div class="wl-h">المؤشرات التي أراقبها لك — قيمتها الآن</div>
        ${watchList(d).map(([lab, val, ok, view, sel]) => goNum(view, sel,
          `<div class="wl"><span class="lab">${esc(lab)}</span>
             <span class="n ${ok ? 'ok' : 'bad'}">${val}</span></div>`)).join('')}
      </div>
      <p class="say"><b>ملاحظة:</b> «ما تغيّر» يُقاس من آخر مرة فتحت فيها اللوحة على هذا الجهاز،
        لا من بداية اليوم. اضغط أي مؤشر ليفتح مصدره.</p>
    </div>

    <div class="card" style="grid-column:1/-1;padding:.6rem .8rem">
      <div class="ch">${ic('chart', 'var(--brand)')}<span class="t">الشركة بنظرة واحدة</span></div>
      <div class="glance">
        ${goNum('intg', '.iu.s-in', `<div class="gl-cell ok"><span class="k">يعمل داخل النظام</span>
          <span class="v">${inCount} أقسام</span>
          <span class="d">المخازن · المشتريات · الإنتاج · مبيعات B2B</span></div>`)}
        ${goNum('ship', '#overdue', `<div class="gl-cell warn"><span class="k">يحتاج انتباهك</span>
          <span class="v">${n(needAttn)}</span>
          <span class="d">أمر متأخر وطلب ملغى</span></div>`)}
        ${goNum('alora', '#paper', `<div class="gl-cell paper"><span class="k">خارج النظام</span>
          <span class="v">${outCount} أقسام</span>
          <span class="d">التجزئة · التسويق · سجل العملاء المحتملين</span></div>`)}
      </div>
    </div>
  </div>`;

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
    <div class="card" id="reserved"><div class="ch">${ic('alert', 'var(--bad)')}<span class="t">محجوز برصيد صفر</span></div>
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
    <div class="card danger" id="m08" style="grid-column:span 2">
      <div class="ch">${ic('alert', 'var(--bad)')}<span class="t">الشحنتان المعلّقتان — الأعلى أثراً</span></div>
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
    <div class="card" id="cancelled"><div class="ch">${ic('alert', 'var(--warn)')}<span class="t">أوامر ملغاة</span></div>
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
    <div class="card" id="paper"><div class="ch">${ic('alert', 'var(--paper)')}<span class="t">على الورق فقط</span></div>
      <p class="big cpaper">${n(a.manual_report_units)}<span class="u">وحدة</span></p>
      <p class="sub">في التقرير اليدوي · <b>صفر</b> في أودو</p></div>
    <div class="card danger" id="retail-deliv" style="grid-column:span 2">
      <div class="ch">${ic('alert', 'var(--bad)')}<span class="t">ما يُباع بالعلبة — لم يخرج ولا مرة</span></div>
      <p class="big xl cbad">${a.retail_delivered_pct?.toFixed(1)}<span class="u">%</span></p>
      <p class="sub">${n(a.retail_ordered)} وحدة مطلوبة وصفر مُسلَّمة، مقابل
        ${b.delivered_pct?.toFixed(1)}% للسائب — نفس النظام ونفس الفترة.</p>
      <p class="say"><b>محلل B2B:</b> الفصل بوحدة القياس كشف هذا.</p></div>
    <div class="card" style="grid-column:span 2">
      <div class="ch">${ic('alert', 'var(--warn)')}<span class="t">أسماء تُسقط الصنف من كل تقرير</span></div>
      <div class="scroll">${rows(a.misspelled, (x) => x.name.trim(),
        (x) => `<span class="mono">${esc(x.code)}</span>`)}</div>
      <p class="say"><b>ضابط ربط أودو:</b> اللوحة تطابق على <b>كود الصنف</b> لا الاسم.</p></div></div>`;

  V.ship = `<div class="grid" style="grid-template-columns:repeat(4,1fr);grid-template-rows:1fr 1fr">
    <div class="card danger" style="grid-column:span 2">
      <div class="ch">${ic('alert', 'var(--bad)')}<span class="t">فارق التسجيل — الموعد مقابل الإغلاق</span>
        <span class="sp pill p-bad"><span class="d"></span>الوسيط ${l.lag_median_days} يوماً</span></div>
      <p class="big xl cbad">${l.on_time_pct?.toFixed(1)}<span class="u">% في الموعد</span></p>
      <div class="rows">${rows(Object.entries(l.lag_buckets), (x) => x[0], (x) => n(x[1]))}</div>
      <p class="say"><b>مراقب المخازن:</b> ⚠️ هذا فارق <b>التسجيل</b> لا التسليم. أوامر مجدولة على مدى
        أسابيع أُغلقت دفعةً واحدة خلال دقائق — متى خرجت البضاعة فعلياً: <b>غير معروف</b>.</p></div>
    <div class="card"><div class="ch">${ic('truck')}<span class="t">أوامر خروج مفتوحة</span></div>
      <p class="big cwarn">${n(l.open)}</p>
      <p class="sub">من ${n(l.total)} إجمالاً · ${n(l.done)} منجزة</p>
      <div class="scroll">${rows(Object.entries(l.states).sort((x, y) => y[1] - x[1]), (x) => x[0], (x) => n(x[1]))}</div></div>
    <div class="card" id="overdue"><div class="ch">${ic('alert', 'var(--warn)')}<span class="t">متأخرة الآن</span></div>
      <p class="big cwarn">${n(l.late)}</p>
      <p class="sub">تاريخها المجدول مضى ولم تُغلق</p></div>
    <div class="card" style="grid-column:span 4">
      <div class="ch">${ic('users')}<span class="t">أكثر العملاء تأخّراً</span></div>
      <div class="scroll">${rows(l.top_late_partners, (x) => x.name, (x) => n(x.n), 'cwarn')}</div></div>
  </div>`;

  V.cust = `<div class="grid" style="grid-template-columns:repeat(4,1fr);grid-template-rows:1fr 1fr">
    <div class="card"><div class="ch">${ic('users')}<span class="t">عملاء مسجّلون</span></div>
      <p class="big">${n(cu.total)}</p><p class="sub">${n(cu.new_30d)} جديداً خلال ٣٠ يوماً</p></div>
    <div class="card danger" id="country" style="grid-column:span 2">
      <div class="ch">${ic('alert', 'var(--bad)')}<span class="t">بلا بلد مسجَّل</span>
        <span class="sp pill p-bad"><span class="d"></span>أرخص إصلاح</span></div>
      <p class="big xl cbad">${cu.missing_country_pct?.toFixed(0)}<span class="u">%</span></p>
      <p class="sub">${n(cu.missing_country)} من ${n(cu.total)} عميلاً بلا حقل بلد.</p>
      <p class="say"><b>محلل B2B:</b> استراتيجية التوسع تُبنى على بيانات أسواق — أرخص فجوة إصلاحاً.</p></div>
    <div class="card"><div class="ch">${ic('chart')}<span class="t">سجلات CRM</span></div>
      <p class="big cbad">${n(d.crm.leads)}</p><p class="sub">صفر عميل محتمل مسجَّل</p></div>
    <div class="card" style="grid-column:span 4">
      <div class="ch">${ic('chart')}<span class="t">التوزيع الجغرافي — ما هو مسجَّل فعلاً</span></div>
      <div class="scroll">${cu.by_country.map((x) =>
        `<div class="row"><span class="lab">${esc(x.country)}</span>
         <span class="n ${x.country === 'غير محدّد' ? 'cbad' : ''}">${n(x.n)}</span></div>`).join('')}</div></div>
  </div>`;

  V.cat = `<div class="grid" style="grid-template-columns:repeat(4,1fr);grid-template-rows:1fr 1fr">
    <div class="card"><div class="ch">${ic('grid')}<span class="t">أصناف في النظام</span></div>
      <p class="big">${n(ca.total)}</p><p class="sub">تشمل المواد الخام والتغليف</p></div>
    <div class="card"><div class="ch">${ic('coins')}<span class="t">لها تكلفة</span></div>
      <p class="big cwarn">${ca.cost_pct?.toFixed(0)}<span class="u">%</span></p>
      <p class="sub">${n(ca.with_cost)} من ${n(ca.total)}</p>
      <div class="bar"><i style="width:${ca.cost_pct?.toFixed(0)}%"></i></div></div>
    <div class="card danger" id="retail-price" style="grid-column:span 2">
      <div class="ch">${ic('alert', 'var(--bad)')}<span class="t">التجزئة — بلا سعر بيع</span></div>
      <p class="big xl cbad">${ca.retail_no_price}<span class="u">من ${ca.retail_total}</span></p>
      <p class="sub">كل صنف تجزئة (كود 701/702/703) بلا سعر بيع.</p>
      <p class="say"><b>مدير Alora:</b> بلا سعر لا فاتورة، وبلا فاتورة لا إيراد مسجَّل.</p></div>
    <div class="card" style="grid-column:span 2">
      <div class="ch">${ic('alert', 'var(--warn)')}<span class="t">B2B بلا تكلفة</span></div>
      <p class="big cwarn">${ca.b2b_no_cost}<span class="u">من ${ca.b2b_total}</span></p>
      <p class="sub">منتجات سائبة (كود 60xx) — ربحيتها غير معروفة.</p></div>
    <div class="card" style="grid-column:span 2">
      <div class="ch">${ic('alert', 'var(--warn)')}<span class="t">أسماء تُسقط الصنف من التقارير</span></div>
      <div class="scroll">${rows(a.misspelled, (x) => x.name.trim(),
        (x) => `<span class="mono">${esc(x.code)}</span>`)}</div></div>
  </div>`;

  V.fin = `<div class="grid" style="grid-template-columns:repeat(4,1fr);grid-template-rows:1fr 1fr">
    <div class="card"><div class="ch">${ic('coins')}<span class="t">فواتير عملاء</span></div>
      <p class="big">${n(fd.customer_invoices)}</p>
      <p class="sub">${n(fd.posted)} مُرحَّلة · ${n(fd.draft)} مسودة</p></div>
    <div class="card"><div class="ch">${ic('cart')}<span class="t">فواتير موردين</span></div>
      <p class="big">${n(fd.vendor_bills)}</p>
      <p class="sub">مقابل ${n(fd.customer_invoices)} فاتورة عميل</p></div>
    <div class="card" style="grid-column:span 2">
      <div class="ch">${ic('chart')}<span class="t">قيود محاسبية مُرحَّلة</span></div>
      <p class="big">${n(d.finance.posted)}</p>
      <p class="sub">${n(d.finance.moves_30d)} قيداً جديداً خلال ٣٠ يوماً</p>
      <p class="say"><b>المحاسب:</b> ⚠️ المبالغ التفصيلية تحتاج debit/credit — price_subtotal صفر في 98.2%.</p></div>
    <div class="card" style="grid-column:span 4">
      <div class="ch">${ic('coins')}<span class="t">الفواتير المُرحَّلة بالعملة</span>
        <span class="sp pill p-warn"><span class="d"></span>لا تُجمع</span></div>
      <div class="scroll">${fd.by_currency.map((x) =>
        `<div class="row"><span class="lab">${esc(x.currency)} — ${n(x.count)} فاتورة</span>
         <span class="n">${n(x.total, 2)}</span></div>`).join('')}</div>
      <p class="say"><b>المحاسب:</b> كل عملة سطر مستقل — جمعها بلا سعر صرف يعطي رقماً بلا معنى.</p></div>
  </div>`;

  const dz = d.designs || [];
  const pendingDesigns = dz.filter((x) => x.status !== 'approved').length;
  V.designs = `<div class="grid" style="grid-template-columns:1fr;grid-template-rows:1fr">
    <div class="card">
      <div class="ch">${ic('file')}<span class="t">التصميمات</span>
        <span class="sp pill p-warn"><span class="d"></span>${pendingDesigns} بانتظار قرارك</span></div>
      <div class="scroll">
        ${dz.length ? dz.map((x) => `
          <div class="dec-item ${x.status === 'approved' ? 'sev-ok' : x.status === 'blocked' ? 'sev-bad' : 'sev-warn'}" style="margin-bottom:.5rem">
            <div class="dec-b">
              <div class="dec-t">${esc(x.product)}</div>
              <div class="dec-i">${esc(x.statusLabel)} · آخر تحديث ${esc(x.updated)}</div>
              <div class="dec-a">${(x.facts || []).map((f) => esc(f)).join(' · ')}</div>
              ${x.note ? `<p class="say" style="margin-top:.4rem">${esc(x.note)}</p>` : ''}
            </div>
          </div>`).join('') : '<p class="sub">لا تصميمات قيد المراجعة حالياً.</p>'}
      </div>
      <p class="say"><b>ملاحظة:</b> الملفات الأصلية لا تُنشر هنا — هذه لوحة عامة الاستضافة.
        الملفات محفوظة في السجل الداخلي الخاص. حدّثني بالحالة الجديدة (مُعتمد / يحتاج تعديلاً)
        وأنا أحدّثها هنا.</p>
    </div>
  </div>`;

  $('#views').innerHTML = NAV.map(([k], i) =>
    `<section class="view${i === 0 ? ' on' : ''}" data-v="${k}">${V[k]}</section>`).join('');
  wireNav();
}

window.__go = goTo;

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
    $('#views').innerHTML = `<section class="view on"><div style="height:100%;display:grid;
      place-items:center;padding:2rem"><div class="card danger" style="max-width:34rem">
      <div class="ch">${ic('alert', 'var(--bad)')}<span class="t">لم تصل البيانات</span></div>
      <p class="sub" style="font-size:.9rem;margin:.4rem 0 0">${esc(e.message || 'خطأ ' + r.status)}</p>
      <p class="say"><b>ما العمل:</b> افتح إعدادات Vercel ← Environment Variables، وتأكد أن كل
      متغيّر مذكور أعلاه موجود ومؤشَّر على <b>Production</b>، ثم أعد النشر.</p></div></div></section>`;
    return;
  }
  render(await r.json());
}

function skeleton() {
  $('#stamp').innerHTML = '<span class="spin"></span> جارٍ السحب من أودو…';
  $('#tb').innerHTML = '<span class="pill p-plain"><span class="spin"></span>لحظة</span>';
  $('#views').innerHTML = `<section class="view on"><div class="grid"
    style="grid-template-columns:repeat(4,1fr);grid-template-rows:1fr 1fr">
    ${Array.from({ length: 8 }, () => `<div class="card"
      style="opacity:.45;justify-content:center;align-items:center">
      <span class="spin" style="color:var(--brand)"></span></div>`).join('')}
  </div></section>`;
}

function showApp() {
  $('#gate').hidden = true; $('#app').hidden = false;
  skeleton();
  $('#nav').innerHTML = NAV_GROUPS.map(([g, items]) =>
    `<div class="nav-lbl">${g}</div>` + items.map(([v, i, t]) =>
      `<button class="nav-item" data-v="${v}" aria-current="${v === NAV[0][0] ? 'true' : 'false'}">
       ${ic(i)}<span>${t}</span></button>`).join('')).join('');
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

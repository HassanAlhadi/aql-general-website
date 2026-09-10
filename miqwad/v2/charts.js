'use strict';
/* ════════════════════════════════════════════════════════════════════════
 * مكتبة رسوم «مِقوَد» — SVG صِرف، بلا أي مكتبة خارجية.
 * كل دالة عامة تُرجع نص SVG جاهزاً للإدراج المباشر (container.innerHTML = ...).
 *
 * الألوان توكنات miqwad-design فقط: var(--ok) var(--warn) var(--bad) var(--paper)
 * var(--brand) — لا لون مكتوب مباشرة، ولا hex. يعمل تلقائياً في الوضعين لأن
 * القيمة تُحل وقت الرسم من CSS الصفحة المضيفة.
 *
 * ⭐ --paper هنا يعني تحديداً «غير معروف / خارج القياس» — لا رمادي عادي.
 *   يُستخدم حصراً لنقاط بيانتها null، أبداً لقيمة صفر حقيقية.
 * ⭐ الصفر الحقيقي يُرسم دائماً بشكل مرئي (شريحة رفيعة + رقم 0) لا يُخفى.
 *
 * راجع: docs/prd-miqwad-v2.md §7 و .claude/skills/miqwad-design/SKILL.md
 * ════════════════════════════════════════════════════════════════════════ */

/* ── أدوات مشتركة ─────────────────────────────────────────────────────── */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const nf = new Intl.NumberFormat('en-US');
// تنسيق رقم: null/undefined = «غير معروف» صراحة — لا صفر ولا تقدير
const fmt = (v) => (v === null || v === undefined || Number.isNaN(v))
  ? 'غير معروف' : nf.format(Math.round(Number(v)));
const fmtU = (v, unit) => (v === null || v === undefined)
  ? 'غير معروف' : `${fmt(v)}${unit ? ' ' + unit : ''}`;

let uidSeed = 0;
const uid = (p) => `mq-${p}-${(uidSeed++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// أقرب «رقم نظيف» أعلى من القيمة — لخطوط المحور
function niceMax(v) {
  if (!(v > 0)) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const norm = v / base;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * base;
}

// قياس عرض نص حقيقي عبر Canvas عند توفره، وإلا تقدير محافظ للعربية
let _mctx = null;
function textWidth(str, size, weight = 500) {
  const s = String(str ?? '');
  if (typeof document !== 'undefined') {
    try {
      if (!_mctx) _mctx = document.createElement('canvas').getContext('2d');
      _mctx.font = `${weight} ${size}px Tajawal, sans-serif`;
      return _mctx.measureText(s).width;
    } catch { /* بيئة بلا Canvas */ }
  }
  return s.length * size * (weight >= 700 ? 0.60 : 0.54);
}

// خرائط الحالة الدلالية → توكن اللون
// ⚠️ --brand و--bad قريبان جداً بصرياً في هذا النظام (كلاهما أحمر طماطمي) —
// «neutral» (ink-soft محايد بلا حرارة) هو المستخدم لأي عنصر «بداية قياس»
// لا يحمل حكم جيد/سيء، حتى لا يُقرأ خطأً كحالة «سيئة».
const TONE = {
  ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)',
  brand: 'var(--brand)', paper: 'var(--paper)', win: 'var(--win)',
  neutral: 'var(--ink-soft)',
};
const toneVar = (t) => TONE[t] || TONE.brand;

// نسبة إنجاز/بقاء → حالة دلالية (null = غير معروف)
function severity(ratio) {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return 'paper';
  if (ratio <= 0) return 'bad';
  if (ratio < 0.5) return 'bad';
  if (ratio < 0.9) return 'warn';
  return 'ok';
}

// حقن CSS التفاعل مرة واحدة فقط في الصفحة المضيفة
function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('mq-chart-css')) return;
  const st = document.createElement('style');
  st.id = 'mq-chart-css';
  st.textContent = `
.mq-chart-tip{position:fixed;z-index:9999;pointer-events:none;
  background:var(--ink);color:var(--surface);font:500 12px 'Tajawal',sans-serif;
  padding:.42rem .65rem;border-radius:9px;box-shadow:var(--sh-md,0 4px 16px rgba(0,0,0,.25));
  max-width:250px;line-height:1.55;opacity:0;transform:translateY(4px);
  transition:opacity .12s,transform .12s;direction:rtl;text-align:start;white-space:pre-line}
svg.mq-chart{display:block;width:100%;height:auto;direction:ltr}
/* ⚠️ حاسم: نتحكم بالـRTL يدوياً بإحداثيات x معكوسة (المحور يبدأ يميناً)،
   فنُثبّت اتجاه SVG على ltr صراحة. بلا هذا يرث النص اتجاه <html dir="rtl">
   فينقلب معنى text-anchor="end" (يصير مرساة يسار تكبر يميناً) وتُقصّ
   الأسماء العربية الطويلة عند حافة viewBox. جرّبها بنفسك بحذف هذا السطر. */
svg.mq-chart text{direction:ltr}
/* لا bidi-override هنا: نريد فقط تصحيح معنى text-anchor، لا كسر ترتيب
   حروف الكلمة العربية نفسها — خوارزمية Unicode Bidi تُعيد ترتيب المقطع
   العربي بصرياً بشكل صحيح حتى داخل سياق أساسه ltr. */
svg.mq-chart [data-tip]{cursor:pointer}
svg.mq-chart .mq-hover{filter:brightness(1.16)}
svg.mq-chart [data-drill]:focus-visible{outline:2px solid var(--brand);outline-offset:2px;border-radius:4px}
svg.mq-chart .mq-crosshair{opacity:0;pointer-events:none}
svg.mq-chart .mq-anim{transition:opacity .15s ease-out,transform .15s ease-out}
@media (prefers-reduced-motion:reduce){svg.mq-chart *{transition:none!important;animation:none!important}}
`;
  document.head.appendChild(st);
}

/* ── طبقة التفاعل: تلميح + مؤشر تقاطع + هبوط بالنقر/Enter ──────────────
 * تُستدعى مرة واحدة على حاوية كل رسم بعد إدراجه في الصفحة. تعمل بتفويض
 * الأحداث فلا حاجة لإعادة ربطها عند إعادة رسم نفس الحاوية. */
let tipEl = null;
function ensureTip() {
  if (tipEl) return tipEl;
  tipEl = document.createElement('div');
  tipEl.className = 'mq-chart-tip';
  tipEl.setAttribute('role', 'status');
  document.body.appendChild(tipEl);
  return tipEl;
}
function showTip(x, y, text) {
  const t = ensureTip();
  t.textContent = text; // نص خام — لا innerHTML؛ أسماء العملاء بيانات غير موثوقة
  t.style.left = (x + 14) + 'px';
  t.style.top = (y + 14) + 'px';
  t.style.opacity = '1';
  t.style.transform = 'translateY(0)';
  requestAnimationFrame(() => {
    const r = t.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > innerHeight - 8) top = y - r.height - 14;
    t.style.left = left + 'px';
    t.style.top = top + 'px';
  });
}
function hideTip() {
  if (tipEl) { tipEl.style.opacity = '0'; tipEl.style.transform = 'translateY(4px)'; }
}

/**
 * يفعّل التلميح والهبوط على كل عناصر [data-tip]/[data-drill] داخل حاوية رسم.
 * استدعها مرة واحدة بعد كل `container.innerHTML = chartSVG`.
 * تُصدر الحاوية حدث `miqwad:drill` عند النقر/Enter على عنصر [data-drill]،
 * بتفصيل `{ key, label }` — الشاشة المستضيفة تلتقطه وتفتح السجلات المطابقة.
 */
function initChartInteractions(root) {
  if (!root || root.__mqWired) return;
  root.__mqWired = true;
  let active = null;
  const clear = () => { if (active) { active.classList.remove('mq-hover'); active = null; }
    root.querySelectorAll('.mq-crosshair').forEach((l) => { l.style.opacity = '0'; });
    hideTip(); };
  const activate = (el, x, y) => {
    if (el !== active) { clear(); el.classList.add('mq-hover'); active = el; }
    const tip = el.getAttribute('data-tip');
    if (tip) showTip(x, y, tip);
    const chId = el.getAttribute('data-crosshair');
    const cx = el.getAttribute('data-x');
    if (chId && cx) {
      const line = root.querySelector('#' + chId);
      if (line) { line.setAttribute('x1', cx); line.setAttribute('x2', cx); line.style.opacity = '1'; }
    }
  };
  root.addEventListener('pointermove', (e) => {
    const el = e.target.closest('[data-tip],[data-drill]');
    if (!el) { clear(); return; }
    activate(el, e.clientX, e.clientY);
  });
  root.addEventListener('pointerleave', clear);
  root.addEventListener('focusin', (e) => {
    const el = e.target.closest('[data-tip],[data-drill]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    activate(el, r.left + r.width / 2, r.top);
  });
  root.addEventListener('focusout', clear);
  const fire = (el) => {
    const key = el.getAttribute('data-drill');
    if (key === null) return;
    root.dispatchEvent(new CustomEvent('miqwad:drill', {
      bubbles: true,
      detail: { key, label: el.getAttribute('data-drill-label') || '' },
    }));
  };
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-drill]');
    if (el) fire(el);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest('[data-drill]');
    if (!el) return;
    e.preventDefault();
    fire(el);
  });
}

// حاوية <g> قابلة للتفاعل بأكملها: تلميح + هبوط + وصول بلوحة المفاتيح
function hitGroup({ tip, drill, drillLabel, x, crosshair }) {
  const parts = [`data-tip="${esc(tip)}"`];
  if (drill !== undefined) {
    parts.push(`data-drill="${esc(drill)}" tabindex="0" role="button" aria-label="${esc(tip)}"`);
    if (drillLabel) parts.push(`data-drill-label="${esc(drillLabel)}"`);
  } else {
    parts.push(`aria-label="${esc(tip)}"`);
  }
  if (x !== undefined) parts.push(`data-x="${x}"`);
  if (crosshair) parts.push(`data-crosshair="${crosshair}"`);
  return parts.join(' ');
}

// جدول HTML مصاحب — طبقة الوصول الكاملة («عرض كجدول») لأي رسم
function tableView({ caption, headers, rows }) {
  const th = headers.map((h) => `<th scope="col">${esc(h)}</th>`).join('');
  const tr = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  return `<table class="mq-chart-table"><caption>${esc(caption)}</caption>
<thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

// غلاف SVG موحّد: أبعاد جوهرية (px) + viewBox مطابق ⇒ تحجيم متجانس بلا تشويه
function svgShell(w, h, ariaLabel, inner, titleDesc) {
  ensureStyles();
  return `<svg class="mq-chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"
  role="img" aria-label="${esc(ariaLabel)}" xmlns="http://www.w3.org/2000/svg">
<title>${esc(ariaLabel)}</title>${titleDesc ? `<desc>${esc(titleDesc)}</desc>` : ''}
${inner}
</svg>`;
}

/* ════════════════════════════════════════════════════════════════════════
 * 1) خط الاتجاه — lineChart({series, unit, days})
 *
 * days:   ['يونيو','يوليو',...] — تسميات المحور الزمني، من الأقدم إلى الأحدث
 * series: إما مصفوفة قيم مسطّحة (سلسلة واحدة تلقائياً: [17,37,18,17])
 *         أو مصفوفة كائنات: [{name,values:[...],tone?}, ...]
 *         value = null ⇐ «غير معروف»: يُرسم فجوة + علامة --paper، لا صفراً ولا خطاً واصلاً.
 * unit:   وحدة القيم — تُلحق بالتلميح والتسمية.
 *
 * المحور الزمني يبدأ من اليمين (الأقدم يميناً) اتساقاً مع اتجاه القراءة RTL.
 * نسبة العرض/الارتفاع الموصى بها للحاوية: 640/260 ≈ 2.46.
 * ════════════════════════════════════════════════════════════════════════ */
function lineChart({ series, unit = '', days = [] }) {
  const raw = Array.isArray(series) && typeof series[0] !== 'object'
    ? [{ name: unit || 'القيمة', values: series, tone: 'brand' }]
    : (series || []);
  const ss = raw.map((s, i) => ({
    name: s.name || `سلسلة ${i + 1}`,
    values: s.values || [],
    tone: s.tone || (i === 0 ? 'brand' : ['ok', 'warn', 'bad', 'paper'][i % 4]),
  }));

  const W = 640, H = 260;
  const padL = 44, padR = 20, padT = 22, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = days.length;

  const allVals = ss.flatMap((s) => s.values).filter((v) => v !== null && v !== undefined);
  const vMax = niceMax(Math.max(0, ...allVals, 1));
  const y0 = padT + plotH; // خط الصفر (الأساس)
  const yOf = (v) => y0 - (v / vMax) * plotH;
  // ترتيب RTL: المؤشر 0 (الأقدم) في أقصى اليمين
  const xOf = (i) => n <= 1 ? padL + plotW / 2 : (padL + plotW) - (i / (n - 1)) * plotW;

  if (!n || !ss.length) {
    return svgShell(W, H, 'خط اتجاه — لا بيانات', '<text x="50%" y="50%" text-anchor="middle" style="fill:var(--ink-faint);font:600 13px Tajawal">لا بيانات كافية لرسم اتجاه</text>');
  }

  let inner = '';

  // خطوط شبكة أفقية متكررة (٠ / نص / أقصى) — رفيعة، منسحبة
  const ticks = [0, vMax / 2, vMax];
  inner += ticks.map((t) => `
<line x1="${padL}" x2="${padL + plotW}" y1="${yOf(t).toFixed(1)}" y2="${yOf(t).toFixed(1)}"
  stroke="var(--line)" stroke-width="1"/>
<text x="${padL - 8}" y="${(yOf(t) + 3).toFixed(1)}" text-anchor="end"
  style="fill:var(--ink-faint);font:500 10.5px Tajawal">${fmt(t)}</text>`).join('');

  // خطوط المؤشر (تُحرَّك عبر JS عند التمرير)
  const chId = uid('cross');
  inner += `<line id="${chId}" class="mq-crosshair" x1="0" x2="0" y1="${padT}" y2="${y0}"
  stroke="var(--ink-faint)" stroke-width="1"/>`;

  // تسميات المحور الزمني
  for (let i = 0; i < n; i++) {
    inner += `<text x="${xOf(i).toFixed(1)}" y="${H - 12}" text-anchor="middle"
  style="fill:var(--ink-faint);font:600 10.5px Tajawal">${esc(days[i])}</text>`;
  }

  // مقياس لون احتياطي إن لم يُحدَّد الاسم صراحة
  ss.forEach((s) => {
    const color = toneVar(s.tone);
    // مسارات متقطّعة عند كل فجوة null — الفجوة تُرسم فجوة لا صفراً
    let seg = [];
    const flush = () => {
      if (seg.length > 1) {
        const d = seg.map((p, k) => `${k === 0 ? 'M' : 'L'}${xOf(p.i).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(' ');
        inner += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round"/>`;
      }
      seg = [];
    };
    s.values.forEach((v, i) => {
      if (v === null || v === undefined) { flush(); return; }
      seg.push({ i, v });
    });
    flush();

    // النقاط: قيمة حقيقية = دائرة مملوءة بلون السلسلة (الصفر نقطة حقيقية أيضاً)
    // قيمة null = معيّن --paper مفرّغ على خط الأساس، مختلف بصرياً عمداً
    s.values.forEach((v, i) => {
      const x = xOf(i).toFixed(1);
      const tipBase = `${esc(days[i])}\n${esc(s.name)}: ${fmtU(v, unit)}`;
      if (v === null || v === undefined) {
        inner += `<g class="mq-hover-target" ${hitGroup({ tip: `${tipBase} — لا قراءة مسجّلة`, x, crosshair: chId })}>
<line x1="${x}" x2="${x}" y1="${(y0 - 6).toFixed(1)}" y2="${(y0 + 6).toFixed(1)}"
  stroke="var(--paper)" stroke-width="2" stroke-dasharray="2.5 2.5"/>
<circle cx="${x}" cy="${y0}" r="5" fill="var(--surface)" stroke="var(--paper)" stroke-width="2"/>
</g>`;
      } else {
        const y = yOf(v).toFixed(1);
        inner += `<g class="mq-hover-target" ${hitGroup({ tip: tipBase, drill: `trend:${esc(s.name)}:${esc(days[i])}`, x, crosshair: chId })}>
<circle cx="${x}" cy="${y}" r="4.5" fill="${color}" stroke="var(--surface)" stroke-width="2"/>
</g>`;
      }
    });
  });

  // مفتاح السلاسل — فقط عند أكثر من سلسلة واحدة (سلسلة واحدة تكفيها التسمية)
  let legend = '';
  if (ss.length > 1) {
    let lx = padL;
    legend = ss.map((s) => {
      const w = 18 + textWidth(s.name, 11, 700) + 18;
      const g = `<g transform="translate(${lx},10)">
<line x1="0" x2="14" y1="0" y2="0" stroke="${toneVar(s.tone)}" stroke-width="2.5" stroke-linecap="round"/>
<text x="20" y="3.5" style="fill:var(--ink-soft);font:700 11px Tajawal">${esc(s.name)}</text>
</g>`;
      lx += w;
      return g;
    }).join('');
  }

  const summary = ss.map((s) => `${s.name}: ${s.values.map((v) => fmtU(v, unit)).join('، ')}`).join(' — ');
  return svgShell(W, H, `اتجاه عبر الزمن: ${ss.map((s) => s.name).join('، ')}`, legend + inner, summary);
}
function lineChartTable({ series, unit = '', days = [] }) {
  const raw = Array.isArray(series) && typeof series[0] !== 'object'
    ? [{ name: unit || 'القيمة', values: series }] : (series || []);
  return tableView({
    caption: 'بيانات رسم الاتجاه',
    headers: ['الفترة', ...raw.map((s) => s.name)],
    rows: days.map((d, i) => [d, ...raw.map((s) => fmtU(s.values[i], unit))]),
  });
}

/* ════════════════════════════════════════════════════════════════════════
 * 2) عمود أفقي — barChart({rows, unit, tone})
 *
 * rows: [{label, value, drill?}, ...] — تُرتَّب تنازلياً داخلياً دائماً.
 *       value = null ⇐ «غير معروف» (--paper)؛ value = 0 ⇐ شريط صفري مرئي.
 * tone: لون الحالة الدلالية لكل الأعمدة (bad/warn/ok/brand/paper) — افتراضي brand.
 *
 * التسمية فوق كل عمود (الأسماء العربية طويلة، لا تُحشر في محور جانبي).
 * الأساس (٠) عند الحافة اليمنى، والعمود يمتد يساراً — طرف البيانات مستدير.
 * نسبة العرض/الارتفاع تتغيّر بعدد الصفوف؛ الحاوية تتحكم بالعرض فقط.
 * ════════════════════════════════════════════════════════════════════════ */
function barChart({ rows = [], unit = '', tone = 'brand' }) {
  const color = toneVar(tone);
  const sorted = [...rows].sort((a, b) => {
    if (a.value === null || a.value === undefined) return 1;
    if (b.value === null || b.value === undefined) return -1;
    return b.value - a.value;
  });

  const W = 640;
  const padX = 16, padTop = 10, padBottom = 10;
  const rowH = 44, barH = 16, labelGap = 4;
  const H = padTop + sorted.length * rowH + padBottom;
  const plotRight = W - padX; // خط الأساس (٠) — يمين، اتساقاً مع RTL
  const plotW = W - padX * 2;

  const vMax = niceMax(Math.max(0, ...sorted.map((r) => r.value || 0), 1));
  const r = 4; // نصف قطر الاستدارة عند طرف البيانات

  if (!sorted.length) {
    return svgShell(W, 80, 'أعمدة أفقية — لا بيانات', '<text x="50%" y="50%" text-anchor="middle" style="fill:var(--ink-faint);font:600 13px Tajawal">لا بيانات</text>');
  }

  let inner = `<line x1="${plotRight}" x2="${plotRight}" y1="${padTop - 2}" y2="${H - padBottom + 2}"
  stroke="var(--line)" stroke-width="1"/>`;

  sorted.forEach((row, i) => {
    const y = padTop + i * rowH;
    const barY = y + 18 + (barH - barH) / 2;
    const label = esc(row.label);
    const isUnknown = row.value === null || row.value === undefined;
    const isZero = row.value === 0;
    const len = isUnknown ? 0 : Math.max(0, (row.value / vMax) * plotW);

    const tip = `${row.label}\n${fmtU(row.value, unit)}`;
    const drillAttr = row.drill !== undefined ? row.drill : `row:${row.label}`;

    inner += `<g class="mq-hover-target" ${hitGroup({ tip, drill: drillAttr, drillLabel: row.label })}>
<rect x="${padX}" y="${y}" width="${plotW}" height="${rowH - 6}" fill="transparent"/>
<text x="${plotRight}" y="${y + 12}" text-anchor="end"
  style="fill:var(--ink);font:700 12.5px Tajawal">${label}</text>`;

    if (isUnknown) {
      // غير معروف: شريط قصير ثابت بلون --paper المتقطّع، لا يُقاس بمقياس القيم
      inner += `
<rect x="${plotRight - 22}" y="${barY}" width="22" height="${barH}" rx="4" ry="4"
  fill="none" stroke="var(--paper)" stroke-width="2" stroke-dasharray="3 3"/>
<text x="${plotRight - 28}" y="${barY + barH / 2 + 4}" text-anchor="end"
  style="fill:var(--paper);font:700 11.5px Tajawal">غير معروف</text>`;
    } else if (isZero) {
      // صفر حقيقي: شريحة رفيعة مرئية عند خط الأساس + رقم ٠ صريح — لا يُخفى
      inner += `
<rect x="${plotRight - 5}" y="${barY}" width="5" height="${barH}" rx="2.5" ry="2.5" fill="${color}"/>
<text x="${plotRight - 12}" y="${barY + barH / 2 + 4}" text-anchor="end"
  style="fill:var(--ink);font:800 12px Tajawal">٠${unit ? ' ' + esc(unit) : ''}</text>`;
    } else {
      const xTip = plotRight - len;
      const overlayW = Math.min(r, len);
      inner += `
<rect x="${xTip}" y="${barY}" width="${len.toFixed(1)}" height="${barH}" rx="${r}" ry="${r}" fill="${color}"/>
<rect x="${(plotRight - overlayW).toFixed(1)}" y="${barY}" width="${overlayW}" height="${barH}" fill="${color}"/>`;
      const valTxt = fmtU(row.value, unit);
      const vw = textWidth(valTxt, 12, 700);
      const outside = xTip - 8 - vw < padX;
      inner += outside
        ? `<text x="${(xTip + 8).toFixed(1)}" y="${barY + barH / 2 + 4}" text-anchor="start"
  style="fill:var(--surface);font:700 12px Tajawal">${esc(valTxt)}</text>`
        : `<text x="${(xTip - 8).toFixed(1)}" y="${barY + barH / 2 + 4}" text-anchor="end"
  style="fill:var(--ink-soft);font:700 12px Tajawal">${esc(valTxt)}</text>`;
    }
    inner += '</g>';
  });

  const summary = sorted.map((r) => `${r.label}: ${fmtU(r.value, unit)}`).join('، ');
  return svgShell(W, H, `مقارنة فئات: ${sorted.map((r) => r.label).join('، ')}`, inner, summary);
}
function barChartTable({ rows = [], unit = '' }) {
  const sorted = [...rows].sort((a, b) => {
    if (a.value === null || a.value === undefined) return 1;
    if (b.value === null || b.value === undefined) return -1;
    return b.value - a.value;
  });
  return tableView({
    caption: 'بيانات مقارنة الفئات',
    headers: ['الفئة', 'القيمة'],
    rows: sorted.map((r) => [r.label, fmtU(r.value, unit)]),
  });
}

/* ════════════════════════════════════════════════════════════════════════
 * 3) Sankey — sankeyChart({stages})
 *
 * stages: [{name, value, drill?}, ...] بترتيب التدفق (الأول → الأخير).
 *         value = null ⇐ مرحلة لم تُقَس (عقدة متقطّعة --paper)؛
 *         value = 0   ⇐ انهيار كامل (عقدة وشريط ضيّقان --bad يُريان بالعين فوراً).
 *
 * أهم رسم في المنتج: العرض الرأسي لكل مرحلة يساوي حجمها، والشريط الواصل
 * بين مرحلتين يضيق بنفس النسبة — فالانكسار هندسي لا رقمي، يُرى قبل أن يُقرأ.
 * تدفق من اليمين إلى اليسار (المرحلة الأولى يمين) اتساقاً مع RTL.
 * نسبة العرض/الارتفاع الموصى بها: 640/280 ≈ 2.3.
 * ════════════════════════════════════════════════════════════════════════ */
function sankeyChart({ stages = [] }) {
  const W = 640, H = 280;
  const padX = 66, plotTop = 66, plotH = 148, midY = plotTop + plotH / 2;
  const nodeW = 30;
  const n = stages.length;

  if (n < 2) {
    return svgShell(W, H, 'مخطط تدفق — بيانات غير كافية', '<text x="50%" y="50%" text-anchor="middle" style="fill:var(--ink-faint);font:600 13px Tajawal">يحتاج مرحلتين على الأقل</text>');
  }

  const xRight = W - padX, xLeft = padX;
  const step = n > 1 ? (xRight - xLeft) / (n - 1) : 0;
  const xc = stages.map((_, i) => xRight - i * step); // ترتيب RTL: الأولى يميناً

  const vMax = Math.max(1, ...stages.map((s) => s.value || 0));
  const MIN_ZERO = 4, MIN_POS = 8;
  const h = stages.map((s) => {
    if (s.value === null || s.value === undefined) return null; // غير معروف
    if (s.value <= 0) return MIN_ZERO; // صفر حقيقي — شريط رفيع لكن مرئي دوماً
    return Math.max(MIN_POS, (s.value / vMax) * plotH);
  });

  // لون كل مرحلة: الأولى محايدة (بداية القياس)، والبقية بحسب النسبة مما سبقها
  const tones = stages.map((s, i) => {
    if (i === 0) return s.value === null ? 'paper' : 'neutral';
    const prev = stages[i - 1].value;
    if (s.value === null || prev === null || prev === undefined) return 'paper';
    if (prev <= 0) return s.value > 0 ? 'warn' : 'bad';
    return severity(s.value / prev);
  });

  let inner = '';

  // الأشرطة الواصلة أولاً (تحت العقد)
  for (let i = 0; i < n - 1; i++) {
    if (h[i] === null || h[i + 1] === null) continue; // لا رسم شريط بين مجهولين
    const x1 = xc[i] - nodeW / 2, x2 = xc[i + 1] + nodeW / 2, xm = (x1 + x2) / 2;
    const t1 = midY - h[i] / 2, b1 = midY + h[i] / 2;
    const t2 = midY - h[i + 1] / 2, b2 = midY + h[i + 1] / 2;
    const color = toneVar(tones[i + 1]);
    const collapsed = stages[i + 1].value <= 0 && stages[i].value > 0;
    const d = `M${x1},${t1} C${xm},${t1} ${xm},${t2} ${x2},${t2}
      L${x2},${b2} C${xm},${b2} ${xm},${b1} ${x1},${b1} Z`;
    const drop = (stages[i].value > 0)
      ? ` (انخفاض ${Math.round(100 - (stages[i + 1].value / stages[i].value) * 100)}٪)` : '';
    const tip = `${stages[i].name} ← ${stages[i + 1].name}\n${fmtU(stages[i].value)} → ${fmtU(stages[i + 1].value)}${drop}`;
    inner += `<path d="${d}" fill="${color}" fill-opacity="${collapsed ? 0.9 : 0.42}" ${hitGroup({ tip, drill: `flow:${esc(stages[i].name)}->${esc(stages[i + 1].name)}` })}/>`;
  }

  // العقد + التسميات
  stages.forEach((s, i) => {
    const cx = xc[i];
    const unknown = h[i] === null;
    const hh = unknown ? 20 : h[i];
    const y = midY - hh / 2;
    const color = toneVar(tones[i]);
    const tip = `${s.name}\n${fmtU(s.value)}`;
    const drillAttr = s.drill !== undefined ? s.drill : `stage:${s.name}`;
    inner += `<g ${hitGroup({ tip, drill: drillAttr, drillLabel: s.name })}>`;
    if (unknown) {
      inner += `<rect x="${(cx - nodeW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${nodeW}" height="${hh}"
  rx="4" ry="4" fill="none" stroke="var(--paper)" stroke-width="2" stroke-dasharray="3 3"/>`;
    } else {
      inner += `<rect x="${(cx - nodeW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${nodeW}" height="${hh}"
  rx="4" ry="4" fill="${color}"/>`;
    }
    // اسم المرحلة أعلى العقدة
    inner += `<text x="${cx}" y="${plotTop - 30}" text-anchor="middle"
  style="fill:var(--ink-soft);font:700 11.5px Tajawal">${esc(s.name)}</text>`;
    // الرقم + نقطة الحالة
    inner += `<circle cx="${(cx - 20).toFixed(1)}" cy="${plotTop - 14}" r="3.5" fill="${unknown ? 'var(--paper)' : color}"/>
<text x="${(cx + 6).toFixed(1)}" y="${plotTop - 10}" text-anchor="middle"
  style="fill:var(--ink);font:800 15px Tajawal">${esc(fmtU(s.value))}</text>`;
    // نسبة التغيّر أسفل العقدة (من المرحلة السابقة)
    if (i > 0) {
      const prev = stages[i - 1].value;
      const pctTxt = (s.value === null || prev === null || prev === undefined) ? 'غير معروف'
        : prev > 0 ? `${Math.round((s.value / prev) * 100)}٪ مما سبقها` : (s.value > 0 ? 'ظهرت من العدم' : 'ما زالت صفراً');
      inner += `<text x="${cx}" y="${plotTop + plotH + 28}" text-anchor="middle"
  style="fill:var(--ink-faint);font:600 10.5px Tajawal">${esc(pctTxt)}</text>`;
    }
    inner += '</g>';
  });

  const summary = stages.map((s) => `${s.name}: ${fmtU(s.value)}`).join(' ← ');
  return svgShell(W, H, `مخطط تدفق السلسلة: ${summary}`, inner, summary);
}
function sankeyChartTable({ stages = [] }) {
  return tableView({
    caption: 'بيانات مخطط التدفق',
    headers: ['المرحلة', 'العدد', 'نسبة مما سبقها'],
    rows: stages.map((s, i) => {
      if (i === 0) return [s.name, fmtU(s.value), '—'];
      const prev = stages[i - 1].value;
      const pct = (s.value === null || prev === null || !prev) ? 'غير معروف' : `${Math.round((s.value / prev) * 100)}٪`;
      return [s.name, fmtU(s.value), pct];
    }),
  });
}

/* ════════════════════════════════════════════════════════════════════════
 * 4) Bullet — bulletChart({actual, target, unit, label})
 *
 * actual/target: رقم أو null. label: تسمية اختيارية للمقياس (توضع كعنوان SVG).
 * لون شريط الفعلي بحسب نسبة الإنجاز (سيء/تحذير/جيد) — علامة الهدف محايدة.
 * نسبة العرض/الارتفاع الموصى بها: 640/110 ≈ 5.8.
 * ════════════════════════════════════════════════════════════════════════ */
function bulletChart({ actual, target, unit = '', label = '' }) {
  const W = 640, H = 110;
  const padX = 20, trackY = 56, trackH = 22;
  const xRight = W - padX, xLeft = padX, trackW = xRight - xLeft;

  const unknown = actual === null || actual === undefined || target === null || target === undefined;
  const badTarget = !unknown && target <= 0;

  let inner = `<text x="${xRight}" y="24" text-anchor="end"
  style="fill:var(--ink-soft);font:700 13px Tajawal">${esc(label)}</text>`;

  if (unknown || badTarget) {
    inner += `
<rect x="${xLeft}" y="${trackY}" width="${trackW}" height="${trackH}" rx="6" ry="6"
  fill="none" stroke="var(--paper)" stroke-width="2" stroke-dasharray="4 4"/>
<text x="${xRight - 12}" y="${trackY + trackH / 2 + 5}" text-anchor="end"
  style="fill:var(--paper);font:700 13px Tajawal">غير معروف</text>`;
    return svgShell(W, H, `${label}: بيانات غير كافية`, inner);
  }

  const scaleMax = niceMax(Math.max(actual, target) * 1.12);
  const wOf = (v) => Math.max(0, (v / scaleMax) * trackW);
  const ratio = actual / target;
  const tone = severity(ratio);
  const color = toneVar(tone);
  const actualLen = wOf(actual);
  const targetX = xRight - wOf(target);

  inner += `
<rect x="${xLeft}" y="${trackY}" width="${trackW}" height="${trackH}" rx="6" ry="6" fill="var(--surface-3)"/>`;

  if (actual <= 0) {
    inner += `<rect x="${(xRight - 5).toFixed(1)}" y="${trackY}" width="5" height="${trackH}" rx="2.5" ry="2.5" fill="${color}"/>`;
  } else {
    const r = Math.min(6, actualLen);
    const xTip = xRight - actualLen;
    inner += `
<rect x="${xTip.toFixed(1)}" y="${trackY}" width="${actualLen.toFixed(1)}" height="${trackH}" rx="6" ry="6" fill="${color}"/>
<rect x="${(xRight - r).toFixed(1)}" y="${trackY}" width="${r}" height="${trackH}" fill="${color}"/>`;
  }

  // علامة الهدف — عارضة رأسية محايدة تبرز فوق وتحت المسار
  inner += `
<line x1="${targetX.toFixed(1)}" x2="${targetX.toFixed(1)}" y1="${trackY - 8}" y2="${trackY + trackH + 8}"
  stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>`;

  const valTxt = `${fmt(actual)} من ${fmt(target)}${unit ? ' ' + esc(unit) : ''}`;
  inner += `<text x="${xRight}" y="${trackY + trackH + 26}" text-anchor="end"
  style="fill:var(--ink);font:800 18px Tajawal">${valTxt}</text>
<text x="${xLeft}" y="${trackY + trackH + 26}" text-anchor="start"
  style="fill:var(--ink-faint);font:600 11px Tajawal">${Math.round(ratio * 100)}٪ من الهدف</text>`;

  // مفتاح صغير يشرح دلالة العارضة (بلا صندوق مفتاح كامل — عنصر واحد فقط)
  inner += `<g transform="translate(${xLeft},${trackY - 22})">
<line x1="0" x2="0" y1="-4" y2="6" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>
<text x="8" y="3" style="fill:var(--ink-faint);font:600 10px Tajawal">الهدف</text></g>`;

  const wrapTip = `${label}\nالفعلي: ${fmtU(actual, unit)} — الهدف: ${fmtU(target, unit)} — ${Math.round(ratio * 100)}٪`;
  inner = `<g ${hitGroup({ tip: wrapTip, drill: `bullet:${esc(label)}`, drillLabel: label })}>
<rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/>
${inner}</g>`;

  return svgShell(W, H, `${label}: ${fmtU(actual, unit)} من هدف ${fmtU(target, unit)}`, inner, wrapTip);
}
function bulletChartTable({ actual, target, unit = '', label = '' }) {
  const ratio = (actual !== null && target) ? `${Math.round((actual / target) * 100)}٪` : 'غير معروف';
  return tableView({
    caption: `بيانات ${label || 'المقياس'}`,
    headers: ['المقياس', 'الفعلي', 'الهدف', 'النسبة'],
    rows: [[label || '—', fmtU(actual, unit), fmtU(target, unit), ratio]],
  });
}

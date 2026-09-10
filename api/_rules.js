'use strict';
/*
 * محرّك القواعد العام لـ«مِقوَد» — يأخذ (metrics, narrative) ويرجّع فجوات مرتّبة.
 *
 * ⚠️ هذا الملف عام على GitHub. لا اسم شركة ولا شخص ولا اقتباس مكتوب هنا حرفياً —
 * كل نص عرضي (عنوان · شرح · اسم مسؤول) يأتي من `narrative` وقت التشغيل (متغيّر
 * بيئة مُحقَن)، لا من هذا الكود. مفاتيح المقاييس (مثل retail.stuck_pickings) هي
 * أسماء تقنية ثابتة من طبقة البيانات — جزء من العقد، لا نص معروض للمستخدم.
 *
 * كل قاعدة هنا مرآة حرفية لدالة rule_* المقابلة في tools/miqwad_decide.py:
 * نفس الشرط، نفس الكود (code)، نفس blocks، نفس منطق severity. الفرق الوحيد:
 * النصوص تُملأ من narrative.gaps.<name> عبر عناصر نائبة {metric.key|بديل}.
 */

const SEV_WEIGHT = { 'حرج': 100, 'متوسط': 55, 'منخفض': 25 };

// المقاييس التي بلا قيمة (null) تُعلَن غائبة — لا تُستبدل بصفر أبداً.
const MISSING_METRIC_KEYS = [
  'retail.delivered_pct',
  'catalog.retail_skus',
  'retail.bom_count',
  'po.received_pct',
];

function metricValue(metrics, key) {
  const m = metrics && metrics[key];
  return m && m.value !== null && m.value !== undefined ? m.value : null;
}

function metricUnit(metrics, key) {
  const m = metrics && metrics[key];
  return m ? (m.unit || null) : null;
}

// نفس صيغة f"{x:.0f}" (بلا كسور) مع فاصل الآلاف — يطابق كل استخدامات
// التنسيق في miqwad_decide.py (بما فيها f"{n:,.0f}" لِـ W-02).
function fmtNum(v) {
  if (v === null || v === undefined) return '';
  return Math.round(v).toLocaleString('en-US');
}

/* يملأ العناصر النائبة في نص من السرد:
     {metric.key|بديل}   → قيمة المقياس، أو البديل إن كانت null
     {metric.key#unit}   → وحدة المقياس
     {retail_label} / {wholesale_label} / {company_label} → من narrative.brand
     {missing}           → قيمة محسوبة داخل القاعدة (extra.missing) */
function fillTemplate(text, metrics, narrative, extra) {
  if (text === null || text === undefined) return null;
  return text.replace(/\{([^}]+)\}/g, (whole, expr) => {
    if (expr === 'retail_label') return narrative.brand.retail_label;
    if (expr === 'wholesale_label') return narrative.brand.wholesale_label;
    if (expr === 'company_label') return narrative.brand.company_label;
    if (expr === 'missing') {
      return extra && extra.missing !== null && extra.missing !== undefined
        ? fmtNum(extra.missing) : whole;
    }
    let m = expr.match(/^([a-zA-Z0-9_.]+)#unit$/);
    if (m) return metricUnit(metrics, m[1]) || '';
    m = expr.match(/^([a-zA-Z0-9_.]+)\|(.*)$/);
    if (m) {
      const v = metricValue(metrics, m[1]);
      return v !== null ? fmtNum(v) : m[2];
    }
    const v = metricValue(metrics, expr);
    return v !== null ? fmtNum(v) : whole;
  });
}

/* ═══════════════════════════════════════════════════════════════════════
 * القواعد الثماني — نسخ حرفي لشروط miqwad_decide.py
 * ═══════════════════════════════════════════════════════════════════════ */

// الفجوة الأم: دورة التجزئة كاملة غير مسجَّلة — لا تسليم ولا فوترة.
function ruleRetailCycle(metrics, narrative) {
  const delivered = metricValue(metrics, 'retail.delivered_pct');
  const stuck = metricValue(metrics, 'retail.stuck_pickings');
  if (delivered === null || stuck === null) return null;
  if (delivered > 0 || stuck === 0) return null;
  const def = narrative.gaps.retail_cycle;
  return {
    code: def.code, severity: def.severity, scope: def.scope,
    title: fillTemplate(def.title, metrics, narrative),
    system_says: fillTemplate(def.system_says, metrics, narrative),
    reality_says: fillTemplate(def.reality_says, metrics, narrative),
    owner: def.owner || null,
    action: fillTemplate(def.action, metrics, narrative),
    blocks: def.blocks || [],
    drill: { kind: 'picking', scope: 'retail', open_only: true },
  };
}

// لا أمر تصنيع واحد لأي صنف تجزئة — فالإنتاج غير قابل للتسجيل أصلاً.
function ruleNoManufacturing(metrics, narrative) {
  const mo = metricValue(metrics, 'retail.mo_count');
  if (mo === null || mo > 0) return null;
  const def = narrative.gaps.no_manufacturing;
  return {
    code: def.code, severity: def.severity, scope: def.scope,
    title: fillTemplate(def.title, metrics, narrative),
    system_says: fillTemplate(def.system_says, metrics, narrative),
    reality_says: fillTemplate(def.reality_says, metrics, narrative),
    owner: def.owner || null,
    action: fillTemplate(def.action, metrics, narrative),
    blocks: def.blocks || [],
  };
}

// تغطية BOM — المقام يُقرأ من البيانات لا من الذاكرة.
function ruleBomCoverage(metrics, narrative) {
  const boms = metricValue(metrics, 'retail.bom_count');
  const skus = metricValue(metrics, 'catalog.retail_skus');
  if (boms === null || !skus || boms >= skus) return null;
  const missing = skus - boms;
  const def = narrative.gaps.bom_coverage;
  const severity = boms === 0 ? 'حرج' : def.severity;
  return {
    code: def.code, severity, scope: def.scope,
    title: fillTemplate(def.title, metrics, narrative, { missing }),
    system_says: fillTemplate(def.system_says, metrics, narrative, { missing }),
    reality_says: fillTemplate(def.reality_says, metrics, narrative, { missing }),
    owner: def.owner || null,
    action: fillTemplate(def.action, metrics, narrative, { missing }),
    blocks: def.blocks || [],
  };
}

// أصناف تجزئة بلا سعر بيع — أي رقم إيراد للتجزئة غير قابل للحساب.
function ruleNoPrice(metrics, narrative) {
  const n = metricValue(metrics, 'catalog.retail_no_price');
  const skus = metricValue(metrics, 'catalog.retail_skus');
  if (n === null || n === 0) return null;
  const def = narrative.gaps.no_price;
  // ١٠٠٪ حالة مختلفة نوعياً — لا صنف واحد مسعَّر، فالفهرس كله غير قابل للبيع.
  const severity = (skus && n >= skus) ? (def.severity_when_total || def.severity) : def.severity;
  return {
    code: def.code, severity, scope: def.scope,
    title: fillTemplate(def.title, metrics, narrative),
    system_says: fillTemplate(def.system_says, metrics, narrative),
    reality_says: fillTemplate(def.reality_says, metrics, narrative),
    owner: def.owner || null,
    action: fillTemplate(def.action, metrics, narrative),
    blocks: def.blocks || [],
  };
}

// الركود: أوامر فُتحت ولم تُلمس. لا يمسكها تقرير يومي ولا كاشف تغيّر.
function ruleUntouched(metrics, narrative) {
  const n = metricValue(metrics, 'retail.untouched_pickings');
  if (n === null || n === 0) return null;
  const def = narrative.gaps.untouched;
  return {
    code: def.code, severity: def.severity, scope: def.scope,
    title: fillTemplate(def.title, metrics, narrative),
    system_says: fillTemplate(def.system_says, metrics, narrative),
    reality_says: fillTemplate(def.reality_says, metrics, narrative),
    owner: def.owner || null,
    action: fillTemplate(def.action, metrics, narrative),
    blocks: def.blocks || [],
    drill: { kind: 'picking', scope: 'retail', open_only: true, untouched: true },
  };
}

function ruleOverdue(metrics, narrative) {
  const n = metricValue(metrics, 'wh.overdue_all');
  if (n === null || n === 0) return null;
  const def = narrative.gaps.overdue;
  return {
    code: def.code, severity: def.severity, scope: def.scope,
    title: fillTemplate(def.title, metrics, narrative),
    system_says: fillTemplate(def.system_says, metrics, narrative),
    reality_says: fillTemplate(def.reality_says, metrics, narrative),
    owner: def.owner || null,
    action: fillTemplate(def.action, metrics, narrative),
    blocks: def.blocks || [],
    drill: { kind: 'picking', open_only: true },
  };
}

function ruleReservedNoStock(metrics, narrative) {
  const n = metricValue(metrics, 'wh.reserved_no_stock_units');
  if (n === null || n === 0) return null;
  const def = narrative.gaps.reserved_no_stock;
  return {
    code: def.code, severity: def.severity, scope: def.scope,
    title: fillTemplate(def.title, metrics, narrative),
    system_says: fillTemplate(def.system_says, metrics, narrative),
    reality_says: fillTemplate(def.reality_says, metrics, narrative),
    owner: def.owner || null,
    action: fillTemplate(def.action, metrics, narrative),
    blocks: def.blocks || [],
  };
}

function rulePoReceipt(metrics, narrative) {
  const p = metricValue(metrics, 'po.received_pct');
  if (p === null || p > 0) return null;
  const def = narrative.gaps.po_receipt;
  return {
    code: def.code, severity: def.severity, scope: def.scope,
    title: fillTemplate(def.title, metrics, narrative),
    system_says: fillTemplate(def.system_says, metrics, narrative),
    reality_says: fillTemplate(def.reality_says, metrics, narrative),
    owner: def.owner || null,
    action: fillTemplate(def.action, metrics, narrative),
    blocks: def.blocks || [],
  };
}

// نفس ترتيب RULES في miqwad_decide.py — يحدّد الترتيب الأصلي قبل الفرز
// المستقر، وهو ما يحسم تعادل الأكواد بنفس score.
const RULES = [
  ruleRetailCycle, ruleNoManufacturing, ruleBomCoverage,
  ruleNoPrice, ruleUntouched, ruleOverdue,
  ruleReservedNoStock, rulePoReceipt,
];

/* الترتيب — الصيغة معلنة في docs/miqwad-api-contract.md:
     score = وزن الخطورة (حرج 100 · متوسط 55 · منخفض 25)
           + 20 × عدد الفجوات المفتوحة التي تمنعها هذه الفجوة
           + 15 إن كانت بلا مالك مسمّى                              */
function scoreOf(gap, openCodes) {
  let s = SEV_WEIGHT[gap.severity] || 25;
  const blocked = (gap.blocks || []).filter((c) => openCodes.has(c));
  s += 20 * blocked.length;
  if (!gap.owner) s += 15;
  return s;
}

// مراجع سجلات فعلية لفجوة — حتى لا تبقى ادّعاءً بلا ما ينزل إليه.
function computeEvidence(records, drill) {
  if (!drill) return null;
  let recs = (records || []).filter((r) => r.kind === (drill.kind || 'picking'));
  if (drill.scope) recs = recs.filter((r) => r.scope === drill.scope);
  if (drill.open_only) recs = recs.filter((r) => !['done', 'cancel'].includes(r.state));
  if (drill.untouched) recs = recs.filter((r) => r.untouched === true);
  return { count: recs.length, refs: recs.slice(0, 25).map((r) => r.ref) };
}

/* يبني كل الفجوات (المطلقة + المقاييس الغائبة)، يحسب score، ويفرز تنازلياً.
   `records` اختياري — يُستخدم لملء evidence لكل فجوة تحمل drill. */
function buildGaps(metrics, narrative, records) {
  const fired = RULES.map((rule) => rule(metrics, narrative)).filter(Boolean);

  // مقياس مطلوب غائب (null) لا يُنتج فجوة عادية — بل فجوة من نوع آخر تُعلن
  // الغياب صراحةً، ولا تُستبدل بصفر أبداً.
  for (const key of MISSING_METRIC_KEYS) {
    if (metricValue(metrics, key) === null) {
      fired.push({
        code: `X-${key}`, kind: 'missing_metric', severity: 'منخفض', scope: 'company',
        title: `مقياس غائب: ${key}`,
        system_says: 'القيمة غير معروفة في آخر لقطة — لم تُقرأ أو رجعت فارغة.',
        reality_says: null, owner: null, action: null, blocks: [],
      });
    }
  }

  const openCodes = new Set(fired.map((g) => g.code));
  for (const g of fired) {
    g.kind = g.kind || 'gap';
    g.evidence = computeEvidence(records, g.drill);
    delete g.drill;
    g.score = scoreOf(g, openCodes);
  }

  fired.sort((a, b) => b.score - a.score);
  return fired;
}

module.exports = {
  buildGaps, computeEvidence, fillTemplate, metricValue, metricUnit,
  SEV_WEIGHT, MISSING_METRIC_KEYS,
};

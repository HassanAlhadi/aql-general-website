'use strict';
/*
 * GET /api/decide — نقطة «مِقوَد»: تقرأ نظام ERP، تحسب المقاييس، تُطلق القواعد،
 * وترجّع القرارات مرتّبة. العقد الكامل في docs/miqwad-api-contract.md (خاص).
 *
 * ⚠️ هذا المستودع عام. لا اسم شركة ولا شخص ولا اقتباس ولا كود منتج مكتوب هنا.
 * كل ما يخص جهة بعينها — التسميات، الاقتباسات، المُلّاك، بادئات أكواد المنتجات،
 * أوامر الشراء المتابَعة — يأتي وقت التشغيل من متغيّرَي البيئة:
 *     MIQWAD_NARRATIVE     (base64 لـJSON السرد)
 *     MIQWAD_COMMITMENTS   (base64 لـJSON الالتزامات)
 * إن غاب أيّهما ترجع 503 — ولا يُستبدل بنص بديل ولا ببيانات تجريبية، لأن لوحة
 * تعرض بيانات وهمية أسوأ من لوحة لا تعمل: الأولى تُتَّخذ عليها قرارات.
 */
const { readSession, noStore, sameOrigin, odoo, flat } = require('./_lib.js');
const { buildGaps } = require('./_rules.js');

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
                   `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
/* num() للكميات الرقمية الخام من نظام ERP فقط — تلك الحقول ترجع 0.0 لا false،
   فالتحويل هنا لا يُخفي «غير معروف». ⚠️ لا تُستخدم على قيمة مقياس: هناك null
   يجب أن يبقى null (انظر pct أدناه، ترجع null عند القسمة على صفر). */
const num = (v) => Number(v) || 0;
const r1 = (x) => Math.round(x * 10) / 10;

/* أودو يرجّع false لحقل التاريخ الفارغ، لا null. تخزينه كما هو يتحوّل صمتاً
   إلى 0 أو "" فيبدو تاريخاً حيث لا يوجد شيء. (نفس مزلق nz() في محرّك بايثون.) */
const nz = (v) => (v === false || v === undefined || v === '' ? null : v);

/* نسبة أو null — القسمة على صفر «غير معروف»، لا صفر. */
const pct = (a, b) => (b ? r1((a / b) * 100) : null);

function loadEnvJson(name) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    return null;   // مُعطَّل أو مقطوع — يُعامَل كغائب، ولا نخمّن محتواه
  }
}

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

module.exports = async (req, res) => {
  noStore(res);
  if (!sameOrigin(req)) return res.status(403).json({ error: 'cross_site' });
  const session = readSession(req, process.env.MIQWAD_SECRET);
  if (!session) return res.status(401).json({ error: 'unauthorized' });

  const narrative = loadEnvJson('MIQWAD_NARRATIVE');
  const commitCfg = loadEnvJson('MIQWAD_COMMITMENTS');
  if (!narrative || !narrative.gaps || !narrative.classify) {
    return res.status(503).json({
      error: 'narrative_missing',
      message: 'الإعداد غير مكتمل: متغيّر السرد غائب أو غير صالح.',
    });
  }

  let od;
  try { od = await odoo(); }
  catch (e) {
    console.error('[miqwad] فشل الاتصال بنظام ERP:', e.message);
    return res.status(502).json({ error: 'odoo_unreachable', message: String(e.message) });
  }

  try {
    const SR = (m, dom, fields, kw) => od.call(m, 'search_read', [dom], { fields, ...(kw || {}) });
    const SC = (m, dom) => od.call(m, 'search_count', [dom]);

    const cls = narrative.classify;
    const PREFIX = cls.retail_prefixes || [];
    const isRetail = (code) => PREFIX.some((p) => String(code || '').startsWith(p));
    const BULK_UOM = String(cls.wholesale_uom || '').toLowerCase();

    const now = new Date();
    const midnight = fmt(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));

    /* ── ١) خريطة أكواد المنتجات — التصنيف بالكود لا بالاسم ── */
    const products = await SR('product.product', [], ['default_code', 'list_price']);
    const pcode = new Map(products.map((p) => [p.id, p.default_code || '']));
    const retailProducts = products.filter((p) => isRetail(p.default_code));
    const retailNoPrice = retailProducts.filter((p) => num(p.list_price) <= 0).length;

    /* ── ٢) أوامر الشحن الصادرة + حركاتها ── */
    const pickings = await SR('stock.picking', [['picking_type_id.code', '=', 'outgoing']],
      ['name', 'partner_id', 'state', 'scheduled_date', 'date_done', 'create_date', 'write_date']);
    const movesBy = new Map();
    for (const ids of chunk(pickings.map((p) => p.id), 500)) {
      const mv = await SR('stock.move', [['picking_id', 'in', ids]],
        ['picking_id', 'product_id', 'product_uom_qty', 'product_uom']);
      for (const m of mv) {
        const pk = Array.isArray(m.picking_id) ? m.picking_id[0] : null;
        if (pk === null) continue;
        if (!movesBy.has(pk)) movesBy.set(pk, []);
        movesBy.get(pk).push(m);
      }
    }

    const pickingRecords = pickings.map((p) => {
      const mvs = movesBy.get(p.id) || [];
      const codes = mvs.map((m) => pcode.get(Array.isArray(m.product_id) ? m.product_id[0] : null) || '');
      const scope = codes.length ? (codes.some(isRetail) ? 'retail' : 'wholesale') : null;
      const cd = nz(p.create_date), wd = nz(p.write_date);
      return {
        id: `picking:${p.name}`, kind: 'picking', ref: p.name,
        partner: flat(p.partner_id) || null, scope,
        opened_at: cd, scheduled_at: nz(p.scheduled_date),
        state: p.state,
        untouched: (cd && wd) ? cd === wd : null,
        qty: null, uom: null,
      };
    });

    /* ── ٣) أوامر البيع + أسطرها ── */
    const sales = await SR('sale.order', [],
      ['name', 'partner_id', 'state', 'date_order', 'commitment_date', 'create_date', 'write_date']);
    const linesBy = new Map();
    for (const ids of chunk(sales.map((s) => s.id), 500)) {
      const ln = await SR('sale.order.line', [['order_id', 'in', ids]],
        ['order_id', 'product_id', 'product_uom', 'product_uom_qty', 'qty_delivered']);
      for (const l of ln) {
        const oid = Array.isArray(l.order_id) ? l.order_id[0] : null;
        if (oid === null) continue;
        if (!linesBy.has(oid)) linesBy.set(oid, []);
        linesBy.get(oid).push(l);
      }
    }

    // ⚠️ لا تُجمع الكميات عبر وحدات القياس. النسبتان أدناه محسوبتان كلٌّ داخل
    // مجموعتها فقط: التجزئة بالكود، والجملة بوحدة قياسها المعرَّفة في السرد.
    let bulkOrd = 0, bulkDel = 0, retOrd = 0, retDel = 0;
    const saleRecords = sales.map((s) => {
      const lns = linesBy.get(s.id) || [];
      const codes = lns.map((l) => pcode.get(Array.isArray(l.product_id) ? l.product_id[0] : null) || '');
      const scope = codes.length ? (codes.some(isRetail) ? 'retail' : 'wholesale') : null;
      if (s.state === 'sale' || s.state === 'done') {
        for (const l of lns) {
          const u = String(flat(l.product_uom) || '').toLowerCase();
          const code = pcode.get(Array.isArray(l.product_id) ? l.product_id[0] : null) || '';
          if (BULK_UOM && u === BULK_UOM) {
            bulkOrd += num(l.product_uom_qty); bulkDel += num(l.qty_delivered);
          }
          if (isRetail(code)) {
            retOrd += num(l.product_uom_qty); retDel += num(l.qty_delivered);
          }
        }
      }
      const cd = nz(s.create_date), wd = nz(s.write_date);
      return {
        id: `sale:${s.name}`, kind: 'sale', ref: s.name,
        partner: flat(s.partner_id) || null, scope,
        opened_at: cd, scheduled_at: nz(s.commitment_date),
        state: s.state,
        untouched: (cd && wd) ? cd === wd : null,
        qty: null, uom: null,
      };
    });

    /* ── ٤) أسطر الفواتير المُرحَّلة لأصناف التجزئة ──
       parent_state='posted' + move_type='out_invoice' — لا price_subtotal وحده،
       فهو صفر في الغالبية العظمى من الأسطر ولا يصلح مؤشراً. */
    const invDomain = [['parent_state', '=', 'posted'], ['move_id.move_type', '=', 'out_invoice']];
    for (let i = 0; i < PREFIX.length - 1; i++) invDomain.push('|');
    for (const p of PREFIX) invDomain.push(['product_id.default_code', '=like', `${p}%`]);
    const invoicedLines = PREFIX.length ? await SC('account.move.line', invDomain) : null;

    /* ── ٥) قوائم المكوّنات وأوامر التصنيع لأصناف التجزئة ── */
    const boms = await SR('mrp.bom', [], ['product_tmpl_id']);
    const tmplIds = [...new Set(boms.map((b) => (Array.isArray(b.product_tmpl_id) ? b.product_tmpl_id[0] : null))
                                    .filter((x) => x !== null))];
    const tmplCode = new Map();
    for (const ids of chunk(tmplIds, 500)) {
      for (const t of await SR('product.template', [['id', 'in', ids]], ['default_code'])) {
        tmplCode.set(t.id, t.default_code || '');
      }
    }
    const bomCount = boms.filter((b) => Array.isArray(b.product_tmpl_id)
      && isRetail(tmplCode.get(b.product_tmpl_id[0]))).length;

    const mos = await SR('mrp.production', [], ['product_id']);
    const moCount = mos.filter((m) => isRetail(
      pcode.get(Array.isArray(m.product_id) ? m.product_id[0] : null))).length;

    /* ── ٦) محجوز على رصيد صفر — مفصولاً بوحدة القياس ── */
    const quants = await SR('stock.quant', [['location_id.usage', '=', 'internal']],
      ['quantity', 'reserved_quantity', 'product_uom_id']);
    const resByUom = new Map();
    for (const q of quants) {
      if (!(num(q.reserved_quantity) > 0 && num(q.quantity) <= 0)) continue;
      const u = flat(q.product_uom_id) || '?';
      resByUom.set(u, (resByUom.get(u) || 0) + num(q.reserved_quantity));
    }
    // المقياس الرسمي يحمل الوحدة الأكبر وحدها — لا نجمع كجم مع قطعة.
    let domUom = null, domQty = null;
    for (const [u, v] of resByUom) if (domQty === null || v > domQty) { domUom = u; domQty = v; }

    const overdueAll = await SC('stock.picking',
      [['state', 'not in', ['done', 'cancel']], ['scheduled_date', '<', midnight]]);

    /* ── ٧) نسبة استلام أوامر شراء بعينها (أسماؤها من السرد) ── */
    let poPct = null;
    const watch = cls.po_watch || [];
    if (watch.length) {
      const pos = await SR('purchase.order', [['name', 'in', watch]], ['id']);
      const poLines = pos.length
        ? await SR('purchase.order.line', [['order_id', 'in', pos.map((p) => p.id)]],
                   ['product_qty', 'qty_received'])
        : [];
      const tot = poLines.reduce((a, l) => a + num(l.product_qty), 0);
      const rec = poLines.reduce((a, l) => a + num(l.qty_received), 0);
      poPct = pct(rec, tot);      // tot = 0 ⇒ null، لا صفر
    }

    /* ── المقاييس بشكل العقد ── */
    const retailOpen = pickingRecords.filter((r) => r.scope === 'retail'
      && r.state !== 'done' && r.state !== 'cancel');
    const M = (value, unit, scope) => ({ value, unit, scope });
    const metrics = {
      'retail.stuck_pickings':     M(retailOpen.length, 'أمر', 'retail'),
      'retail.untouched_pickings': M(retailOpen.filter((r) => r.untouched === true).length, 'أمر', 'retail'),
      'retail.bom_count':          M(bomCount, 'BOM', 'retail'),
      'retail.mo_count':           M(moCount, 'أمر تصنيع', 'retail'),
      'retail.invoiced_lines':     M(invoicedLines, 'سطر', 'retail'),
      'retail.delivered_pct':      M(pct(retDel, retOrd), '%', 'retail'),
      'wholesale.delivered_pct':   M(pct(bulkDel, bulkOrd), '%', 'wholesale'),
      'wh.overdue_all':            M(overdueAll, 'أمر', 'company'),
      'wh.reserved_no_stock_units': M(domQty === null ? null : Math.round(domQty * 10) / 10,
                                      domUom, 'company'),
      'catalog.retail_no_price':   M(retailNoPrice, 'صنف', 'retail'),
      'catalog.retail_skus':       M(retailProducts.length, 'صنف', 'retail'),
      'po.received_pct':           M(poPct, '%', 'retail'),
    };

    const records = [...pickingRecords, ...saleRecords].slice(0, 300);
    const gaps = buildGaps(metrics, narrative, [...pickingRecords, ...saleRecords]);

    /* ── انكسار السلسلة ── */
    const stageCount = {
      sales_orders: saleRecords.filter((r) => r.scope === 'retail').length,
      pickings: pickingRecords.filter((r) => r.scope === 'retail').length,
      delivered: pickingRecords.filter((r) => r.scope === 'retail' && r.state === 'done').length,
      invoiced: invoicedLines,
    };
    const flow = (narrative.flow_stages || []).map((s) => ({
      key: s.key, label: s.label,
      count: Object.prototype.hasOwnProperty.call(stageCount, s.key) ? stageCount[s.key] : null,
    }));

    return res.status(200).json({
      taken_at: new Date().toISOString(),
      viewer: (narrative.viewers || {})[session.u] || null,
      labels: {
        retail: narrative.brand?.retail_label || null,
        wholesale: narrative.brand?.wholesale_label || null,
        company: narrative.brand?.company_label || null,
      },
      metrics,
      gaps,
      commitments: evaluateCommitments(commitCfg, metrics),
      flow,
      records,
      departments: narrative.departments || [],
      // فارغة عمداً: هذه الواجهة تقرأ لحظياً ولا تحتفظ بتاريخ. الأرشيف الزمني
      // في قاعدة SQLite داخل المستودع الخاص، ولا يمرّ من هنا.
      series: {},
    });
  } catch (e) {
    console.error('[miqwad] خطأ في /api/decide:', e.message);
    return res.status(500).json({ error: 'decide_failed', message: String(e.message) });
  }
};

/* حالة كل التزام تُحسب من المقاييس، لا تُكتب باليد — نفس منطق
   evaluate_commitments في محرّك بايثون. بلا تاريخ لا يمكن أن يتأخر التزام،
   ولذلك «بلا موعد» حالة تُعرض لا نقص يُخفى. */
function evaluateCommitments(cfg, metrics) {
  const list = (cfg && cfg.commitments) || [];
  const today = new Date().toISOString().slice(0, 10);
  const val = (k) => {
    const m = k && metrics[k];
    return m && m.value !== null && m.value !== undefined ? m.value : null;
  };
  return list.map((c) => {
    let target = (c.target !== undefined && c.target !== null) ? c.target : null;
    if (target === null && c.target_from_metric) target = val(c.target_from_metric);

    /* خط الأساس = قيمة المقياس يوم قُطع الوعد. هذه الواجهة تقرأ لحظياً بلا
       أرشيف زمني، فلا تستطيع استخراجه بنفسها — لذلك يُسجَّل في ملف الالتزامات
       وقت تسجيل الوعد (baseline_value)، بعد التحقّق منه لا بتقديره. بدونه
       يبقى null، وحالة «متحرك» غير قابلة للتمييز عن «معلّق» هنا. */
    const baseline = (c.baseline_value !== undefined && c.baseline_value !== null)
      ? c.baseline_value : null;
    if (target === null && baseline !== null
        && c.target_from_baseline !== undefined && c.target_from_baseline !== null) {
      target = baseline + c.target_from_baseline;
    }

    const current = val(c.verify_key);
    let status;
    if (!c.verify_key || current === null || target === null) status = 'بلا مقياس';
    else if (current >= target) status = 'منجز';
    else if (baseline !== null && current > baseline) status = 'متحرك';
    else if (c.due_at && String(c.due_at).slice(0, 10) < today) status = 'متأخر';
    else status = 'معلّق';
    return {
      what: c.what, owner: c.owner, source: c.source || null,
      due_at: c.due_at || null, verify_key: c.verify_key || null,
      target, current, baseline, status,
    };
  });
}

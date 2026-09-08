'use strict';
const { readSession, noStore, sameOrigin, odoo, flat } = require('./_lib.js');

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
                   `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
const r0 = (x) => Math.round(x);
const r1 = (x) => Math.round(x * 10) / 10;
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
const num = (v) => Number(v) || 0;

module.exports = async (req, res) => {
  noStore(res);
  if (!sameOrigin(req)) return res.status(403).json({ error: 'cross_site' });
  if (!readSession(req, process.env.MIQWAD_SECRET)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  let od;
  try { od = await odoo(); }
  catch (e) {
    // يُسجَّل في Vercel Runtime Logs — بلا مفاتيح، فقط ما يكفي للتشخيص.
    console.error('[miqwad] فشل الاتصال بأودو:', e.message, JSON.stringify({
      url: String(process.env.ODOO_URL || '').trim(),
      db: String(process.env.ODOO_DB || '').trim(),
      user: String(process.env.ODOO_USER || '').trim(),
      keyLen: String(process.env.ODOO_API_KEY || '').trim().length,
      keyHadWhitespace: /^\s|\s$/.test(String(process.env.ODOO_API_KEY || '')),
    }));
    return res.status(502).json({ error: 'odoo_unreachable', message: String(e.message) });
  }

  try {
    const now = new Date();
    const midnight = fmt(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
    const d30 = fmt(new Date(now.getTime() - 30 * 864e5));
    const tomorrow = fmt(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)));

    const SR = (m, dom, fields, kw) => od.call(m, 'search_read', [dom], { fields, ...(kw || {}) });
    const SC = (m, dom) => od.call(m, 'search_count', [dom]);

    /* ── المخازن ── */
    const quants = await SR('stock.quant', [['location_id.usage', '=', 'internal']],
      ['product_id', 'quantity', 'reserved_quantity', 'product_uom_id']);

    // ⚠️ لا «إجمالي» موحّد: المستودع يخزّن بالكيلو وبالقطعة وباللتر.
    const uomMap = new Map();
    for (const q of quants) {
      const u = flat(q.product_uom_id) || '?';
      const e = uomMap.get(u) || { uom: u, qty: 0, reserved: 0, lines: 0 };
      e.qty += num(q.quantity); e.reserved += num(q.reserved_quantity); e.lines++;
      uomMap.set(u, e);
    }
    const stock_by_uom = [...uomMap.values()]
      .map((e) => ({ ...e, qty: r0(e.qty), reserved: r0(e.reserved) }))
      .sort((a, b) => b.qty - a.qty);

    const negative = quants.filter((q) => num(q.quantity) < 0);
    const resNo = quants.filter((q) => num(q.reserved_quantity) > 0 && num(q.quantity) <= 0);

    const prodMap = new Map();
    for (const q of quants) {
      const k = flat(q.product_id) || '?';
      prodMap.set(k, (prodMap.get(k) || 0) + num(q.quantity));
    }
    const top_products = [...prodMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([name, qty]) => ({ name, qty: r0(qty) }));

    const notDone = [['state', 'not in', ['done', 'cancel']]];
    const [overdue_all, overdue_outgoing, picks, moves30] = await Promise.all([
      SC('stock.picking', [...notDone, ['scheduled_date', '<', tomorrow]]),
      SC('stock.picking', [...notDone, ['scheduled_date', '<', tomorrow],
                           ['picking_type_id.code', '=', 'outgoing']]),
      SR('stock.picking', notDone, ['state']),
      SC('stock.move', [['date', '>=', d30], ['state', '=', 'done']]),
    ]);
    const picking_states = {};
    for (const p of picks) picking_states[p.state] = (picking_states[p.state] || 0) + 1;

    /* ── سجل الحركة المصنَّف ──
       التصنيف يعتمد على usage الموقعين لا على اسميهما، وعلى origin_returned_move_id
       للمرتجع — الاسم قد يتغيّر، وهذان الحقلان لا يتغيّران. */
    const [mvRaw, locRows, codeRows] = await Promise.all([
      SR('stock.move', [['date', '>=', d30], ['state', '=', 'done']],
        ['date', 'product_id', 'product_uom_qty', 'product_uom',
         'location_id', 'location_dest_id', 'origin_returned_move_id', 'reference'],
        { order: 'date desc', limit: 3000 }),
      SR('stock.location', [], ['usage']),
      SR('product.product', [], ['default_code']),
    ]);
    const locUsage = new Map(locRows.map((l) => [l.id, l.usage]));
    const codeOf = new Map(codeRows.map((p) => [p.id, p.default_code || '']));
    const isRetail = (c) => /^(701|702|703)/.test(c || '');

    const classify = (m) => {
      const src = m.location_id ? locUsage.get(m.location_id[0]) : null;
      const dst = m.location_dest_id ? locUsage.get(m.location_dest_id[0]) : null;
      if (m.origin_returned_move_id || src === 'customer') return 'return';
      if (dst === 'customer') return 'out';
      if (src === 'supplier') {
        return isRetail(codeOf.get(m.product_id && m.product_id[0])) ? 'in_allora' : 'in_karry';
      }
      return 'internal';
    };

    const mvCounts = { out: 0, in_allora: 0, in_karry: 0, return: 0, internal: 0 };
    const mvLog = [];
    for (const m of mvRaw) {
      const k = classify(m);
      mvCounts[k]++;
      if (k !== 'internal' && mvLog.length < 60) {
        mvLog.push({
          kind: k,
          date: (m.date || '').slice(0, 10),
          product: flat(m.product_id) || '—',
          code: codeOf.get(m.product_id && m.product_id[0]) || '',
          qty: r0(num(m.product_uom_qty)),
          uom: flat(m.product_uom) || '',
          where: flat(k === 'out' ? m.location_dest_id : m.location_id) || '',
          ref: m.reference || '',
        });
      }
    }

    /* ── المشتريات ── */
    const m08Orders = await SR('purchase.order', [['name', 'in', ['P00668', 'P00670']]], ['id']);
    const m08Lines = await SR('purchase.order.line',
      [['order_id', 'in', m08Orders.map((o) => o.id)]], ['product_qty', 'qty_received']);
    const m08tot = m08Lines.reduce((s, l) => s + num(l.product_qty), 0);
    const m08rec = m08Lines.reduce((s, l) => s + num(l.qty_received), 0);

    const openStates = [['state', 'in', ['purchase', 'done']]];
    const [poOpen, pol, pending_receipts, orders30] = await Promise.all([
      SC('purchase.order', openStates),
      SR('purchase.order.line', [['order_id.state', 'in', ['purchase', 'done']]],
         ['product_qty', 'qty_received']),
      SC('stock.picking', [['picking_type_id.code', '=', 'incoming'], ...notDone]),
      SC('purchase.order', [['create_date', '>=', d30]]),
    ]);
    const polTot = pol.reduce((s, l) => s + num(l.product_qty), 0);
    const polRec = pol.reduce((s, l) => s + num(l.qty_received), 0);

    /* ── الإنتاج ── */
    const mo = await SR('mrp.production', [], ['state', 'product_qty']);
    const mo30 = await SC('mrp.production', [['create_date', '>=', d30]]);
    const moStates = {};
    for (const m of mo) moStates[m.state] = (moStates[m.state] || 0) + 1;
    const active = mo.filter((m) => ['confirmed', 'progress', 'to_close'].includes(m.state));

    /* ── المبيعات: الكيلو منفصل عن تغليف التجزئة ── */
    const so = await SR('sale.order', [['state', 'in', ['sale', 'done']]], ['partner_id']);
    const sol = await SR('sale.order.line', [['order_id.state', 'in', ['sale', 'done']]],
      ['product_uom_qty', 'qty_delivered', 'order_id', 'product_uom']);
    const isKg = (l) => String(flat(l.product_uom)).toLowerCase() === 'kg';
    const bulk = sol.filter(isKg), retail = sol.filter((l) => !isKg(l));
    const tally = (rows) => {
      const o = rows.reduce((s, l) => s + num(l.product_uom_qty), 0);
      const d = rows.reduce((s, l) => s + num(l.qty_delivered), 0);
      return { ordered: r0(o), delivered: r0(d), pct: pct(d, o) };
    };
    const B = tally(bulk), R = tally(retail);

    const partnerOf = new Map(so.map((o) => [o.id, flat(o.partner_id) || '?']));
    const custMap = new Map();
    for (const l of bulk) {
      const nm = partnerOf.get(Array.isArray(l.order_id) ? l.order_id[0] : l.order_id);
      if (!nm) continue;
      const e = custMap.get(nm) || { name: nm, ordered: 0, delivered: 0 };
      e.ordered += num(l.product_uom_qty); e.delivered += num(l.qty_delivered);
      custMap.set(nm, e);
    }
    const top_customers = [...custMap.values()].sort((a, b) => b.ordered - a.ordered).slice(0, 6)
      .map((c) => ({ name: c.name, ordered: r0(c.ordered), delivered: r0(c.delivered),
                     pct: pct(c.delivered, c.ordered) }));

    const [so30, cancelled] = await Promise.all([
      SC('sale.order', [['create_date', '>=', d30]]),
      SC('sale.order', [['state', '=', 'cancel']]),
    ]);

    /* ── Alora: المطابقة على الكود لا الاسم (صنف كُتب «Alura» يسقط من أي بحث بالاسم) ── */
    const allp = await SR('product.product', [['type', '!=', 'service']],
      ['name', 'default_code', 'list_price', 'standard_price', 'create_date']);
    const fg = allp.filter((p) => /^(701|702|703)/.test(p.default_code || ''));
    const [invLines, aMoves] = await Promise.all([
      SC('account.move.line', [['product_id.name', 'ilike', 'alora'],
        ['move_id.move_type', '=', 'out_invoice'], ['move_id.state', '=', 'posted']]),
      SR('stock.move', [['product_id.name', 'ilike', 'alora'], ['state', '=', 'done']],
         ['location_dest_id']),
    ]);
    const toCustomer = aMoves.filter((m) =>
      String(flat(m.location_dest_id)).toLowerCase().includes('customer'));


    /* ── الشحن والتسليم ── */
    const outAll = await SR('stock.picking', [['picking_type_id.code', '=', 'outgoing']],
      ['state', 'scheduled_date', 'date_done', 'partner_id', 'name', 'create_date', 'write_date']);
    const outOpen = outAll.filter((r) => !['done', 'cancel'].includes(r.state));
    const outDone = outAll.filter((r) => r.state === 'done');
    const lateP = outOpen.filter((r) => (r.scheduled_date || '') < midnight);

    /* ── التقادم — ما لا يتحرك، لا ما يتحرك ──
       السؤال «ماذا حدث؟» لا يمسك أمراً فُتح في يونيو ولم يُلمس منذها: هو لا «يحدث»
       في أي يوم. فُقدت به فعلياً 89 طلبية تجزئة على مدى 3 أشهر (اكتُشفت بسؤال حسن
       المباشر 2026-09-08، لا بأي روتين). هذا القسم هو الإصلاح.
       التصنيف تجزئة/B2B عبر default_code (701/702/703) لا الاسم — نفس قاعدة alora أعلاه. */
    const openIds = outOpen.map((r) => r.id);
    const openMoves = openIds.length
      ? await SR('stock.move', [['picking_id', 'in', openIds]],
          ['picking_id', 'product_id', 'product_uom_qty'])
      : [];
    const productNameById = new Map(allp.map((x) => [x.id, (x.name || '').trim()]));
    const retailPickingIds = new Set();
    const productsByPicking = new Map();          // pickingId → [{name, code, qty}]
    for (const m of openMoves) {
      const pid = m.product_id && m.product_id[0];
      const code = codeOf.get(pid) || '';
      if (isRetail(code)) retailPickingIds.add(m.picking_id[0]);
      const pkId = m.picking_id[0];
      const arr = productsByPicking.get(pkId) || [];
      arr.push({ name: productNameById.get(pid) || '?', code, qty: num(m.product_uom_qty) });
      productsByPicking.set(pkId, arr);
    }
    const agingRetail = outOpen.filter((r) => retailPickingIds.has(r.id));
    const agingB2B = outOpen.filter((r) => !retailPickingIds.has(r.id));
    const untouched = (r) => (r.write_date || '').slice(0, 16) === (r.create_date || '').slice(0, 16);

    const oldestOf = (list) => list.length
      ? list.reduce((a, b) => ((a.scheduled_date || '') < (b.scheduled_date || '') ? a : b)) : null;

    const byPartnerAging = (list) => {
      const map = new Map();
      for (const r of list) {
        const k = flat(r.partner_id) || '—';
        const e = map.get(k) || { name: k, n: 0, oldest: null };
        e.n++;
        if (!e.oldest || (r.scheduled_date || '') < e.oldest) e.oldest = (r.scheduled_date || '').slice(0, 10);
        map.set(k, e);
      }
      return [...map.values()].sort((a, b) => b.n - a.n).slice(0, 8);
    };

    const retailOldest = oldestOf(agingRetail);
    const aging = {
      source: 'stock.picking (outgoing, غير منجز) × stock.move → default_code',
      retail: {
        open: agingRetail.length,
        untouched: agingRetail.filter(untouched).length,
        oldest: retailOldest ? retailOldest.scheduled_date.slice(0, 10) : null,
        oldest_ref: retailOldest ? retailOldest.name : null,
        top_partners: byPartnerAging(agingRetail),
        // كل سجل بذاته — لا تجميع — عشان بحث وفهم مباشر بدل أودو
        list: agingRetail
          .sort((r1, r2) => (r1.scheduled_date || '') < (r2.scheduled_date || '') ? -1 : 1)
          .slice(0, 300)
          .map((r) => ({
            ref: r.name,
            partner: flat(r.partner_id) || '—',
            products: (productsByPicking.get(r.id) || [])
              .map((x) => `${x.name} ×${r0(x.qty)}`),
            scheduled: (r.scheduled_date || '').slice(0, 10),
            state: r.state,
            untouched: untouched(r),
          })),
      },
      b2b: {
        open: agingB2B.length,
        oldest: oldestOf(agingB2B)?.scheduled_date?.slice(0, 10) || null,
        note: 'قد يعكس عقود تصدير تُسحب على دفعات — لا يُقرأ كمشكلة تلقائياً',
      },
    };

    // ⚠️ الفارق بالأيام لا بالطابع الزمني — تسليم أُنجز بعد ساعتين ليس متأخراً.
    const lagDays = (r) => {
      if (!r.scheduled_date || !r.date_done) return null;
      const d1 = new Date(r.scheduled_date.replace(' ', 'T') + 'Z');
      const d2 = new Date(r.date_done.replace(' ', 'T') + 'Z');
      return Math.floor((d2 - d1) / 864e5);
    };
    const lags = outDone.map(lagDays).filter((x) => x !== null).sort((a, b) => a - b);
    const onTime = lags.filter((x) => x <= 0).length;
    const lateBy = new Map();
    for (const r of lateP) {
      const k = flat(r.partner_id) || '—';
      lateBy.set(k, (lateBy.get(k) || 0) + 1);
    }
    const logistics = {
      source: 'stock.picking (outgoing)',
      total: outAll.length, open: outOpen.length, done: outDone.length, late: lateP.length,
      states: outOpen.reduce((a, r) => (a[r.state] = (a[r.state] || 0) + 1, a), {}),
      on_time_done: onTime,
      on_time_pct: lags.length ? Math.round(onTime / lags.length * 1000) / 10 : null,
      lag_buckets: {
        'في الموعد أو قبله': onTime,
        '1-7 أيام': lags.filter((x) => x >= 1 && x <= 7).length,
        '8-30 يوم': lags.filter((x) => x >= 8 && x <= 30).length,
        'أكثر من 30 يوم': lags.filter((x) => x > 30).length,
      },
      lag_median_days: lags.length ? lags[Math.floor(lags.length / 2)] : null,
      measures: 'الفارق بين الموعد المجدول وتاريخ الإغلاق في أودو',
      top_late_partners: [...lateBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([name, n_]) => ({ name, n: n_ })),
      aging,
    };

    /* ── العملاء ── */
    const parts = await SR('res.partner', [['customer_rank', '>', 0]],
      ['name', 'country_id', 'city', 'create_date']);
    const noCountry = parts.filter((x) => !x.country_id);
    const byCountry = new Map();
    for (const x of parts) {
      const k = flat(x.country_id) || 'غير محدّد';
      byCountry.set(k, (byCountry.get(k) || 0) + 1);
    }
    const customers = {
      source: 'res.partner (customer_rank > 0)',
      total: parts.length,
      missing_country: noCountry.length,
      missing_country_pct: pct(noCountry.length, parts.length),
      new_30d: parts.filter((x) => (x.create_date || '') >= d30).length,
      by_country: [...byCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([country, n_]) => ({ country, n: n_ })),
    };

    /* ── المنتجات والتسعير ── */
    const b2bProds = allp.filter((x) => /^60/.test(x.default_code || ''));
    const catalog = {
      source: 'product.product (type != service)',
      total: allp.length,
      with_price: allp.filter((x) => num(x.list_price) > 0).length,
      with_cost: allp.filter((x) => num(x.standard_price) > 0).length,
      price_pct: pct(allp.filter((x) => num(x.list_price) > 0).length, allp.length),
      cost_pct: pct(allp.filter((x) => num(x.standard_price) > 0).length, allp.length),
      b2b_total: b2bProds.length,
      b2b_no_cost: b2bProds.filter((x) => num(x.standard_price) <= 0).length,
      retail_total: fg.length,
      retail_no_price: fg.filter((x) => num(x.list_price) <= 0).length,
    };

    /* ── المالية — تفصيل ── */
    const invs = await SR('account.move', [['move_type', 'in', ['out_invoice', 'in_invoice']]],
      ['move_type', 'state', 'currency_id', 'amount_total']);
    const custInv = invs.filter((x) => x.move_type === 'out_invoice');
    const curMap = new Map();
    for (const r of custInv) {
      if (r.state !== 'posted') continue;
      const k = flat(r.currency_id) || '?';
      const e = curMap.get(k) || { currency: k, count: 0, total: 0 };
      e.count++; e.total += num(r.amount_total);
      curMap.set(k, e);
    }
    const finance_detail = {
      source: 'account.move',
      customer_invoices: custInv.length,
      posted: custInv.filter((x) => x.state === 'posted').length,
      draft: custInv.filter((x) => x.state === 'draft').length,
      vendor_bills: invs.filter((x) => x.move_type === 'in_invoice').length,
      // ⚠️ لا تُجمع عبر العملات — كل عملة سطر مستقل
      by_currency: [...curMap.values()].sort((a, b) => b.total - a.total)
        .map((x) => ({ ...x, total: Math.round(x.total * 100) / 100 })),
    };

    /* ── المالية و CRM ── */
    const [amPosted, am30, leads] = await Promise.all([
      SC('account.move', [['state', '=', 'posted']]),
      SC('account.move', [['create_date', '>=', d30]]),
      SC('crm.lead', []),
    ]);

    const L = { in: 'in', partial: 'partial', out: 'out', unknown: 'unknown' };
    return res.status(200).json({
      generated_at: fmt(now),
      live: true,
      source: { db: process.env.ODOO_DB, version: '17.0+e' },
      warehouse: {
        source: 'stock.quant · stock.picking · stock.move',
        stock_by_uom, lines: quants.length,
        negative_lines: negative.length,
        reserved_no_stock_lines: resNo.length,
        reserved_no_stock_units: r0(resNo.reduce((s, q) => s + num(q.reserved_quantity), 0)),
        overdue_all, overdue_outgoing, picking_states, moves_done_30d: moves30, top_products,
        move_log: mvLog, move_counts: mvCounts, move_total: mvRaw.length,
      },
      purchasing: {
        source: 'purchase.order · stock.picking',
        m08: { orders: ['P00668', 'P00670'], total_units: r0(m08tot),
               received_units: r0(m08rec), pct: pct(m08rec, m08tot) },
        open_orders: poOpen, ordered_units: r0(polTot), received_units: r0(polRec),
        received_pct: pct(polRec, polTot), pending_receipts, orders_30d: orders30,
      },
      production: {
        source: 'mrp.production', total_orders: mo.length, states: moStates,
        done: moStates.done || 0, active_orders: active.length,
        active_units: r0(active.reduce((s, m) => s + num(m.product_qty), 0)), orders_30d: mo30,
      },
      b2b: {
        source: 'sale.order · sale.order.line',
        confirmed_orders: so.length, ordered_kg: B.ordered, delivered_kg: B.delivered,
        delivered_pct: B.pct, orders_30d: so30, cancelled_orders: cancelled, top_customers,
      },
      alora: {
        source: 'product.product (كود 701/702/703) · account.move.line · stock.move',
        skus: fg.length,
        with_price: fg.filter((p) => num(p.list_price) > 0).length,
        with_cost: fg.filter((p) => num(p.standard_price) > 0).length,
        posted_invoice_lines: invLines, customer_deliveries: toCustomer.length,
        manual_report_units: 54863,
        retail_ordered: R.ordered, retail_delivered: R.delivered, retail_delivered_pct: R.pct,
        created_today: fg.filter((p) => (p.create_date || '') >= midnight)
          .map((p) => ({ code: p.default_code, name: p.name })),
        misspelled: fg.filter((p) => !/alora/i.test(p.name || ''))
          .map((p) => ({ code: p.default_code, name: p.name })),
      },
      logistics, customers, catalog, finance_detail,
      /* بيانات مُدارة يدوياً — لا تأتي من أودو. تُحدَّث بالكود عند تغيّر الحالة.
         الملفات الأصلية لا تُنشر هنا (المستودع عام) — الحقائق نصية فقط. */
      designs: [
        {
          id: 'pink-lemonade-250',
          product: 'Allora — فراولة ليمون 250 مل (Pink Lemonade)',
          status: 'blocked',
          statusLabel: '🔴 يوقف الطباعة — جملة الصلاحية مكرّرة مرتين',
          updated: '2026-09-03',
          facts: [
            'جملة «الصلاحية ١٢ شهر من تاريخ الانتاج» مطبوعة مرتين بلغتيها: أسفل اللوحة اليسرى، ومرة تحت جدول القيم الغذائية',
            'أمسكها فريق الجودة — فاتتني في تدقيقي الأول',
            'الباركود 6 224004 227629 · المواصفة المصرية 7650/2024 · 33 جم سكر مضاف = 67% من المرجع اليومي',
          ],
          note: 'التصميم يحمل شعار Allora، لكن اسم الملف يذكر "A-One" وهو غير ظاهر داخل التصميم إطلاقاً — هل هو صنف Allora جديد أم تصميم عميل B2B؟ سؤال ما زال مفتوحاً.',
        },
        {
          id: 'allora-tp-360',
          product: 'Allora — معجون طماطم 360 جم',
          status: 'approved',
          statusLabel: 'معتمد — Approved as data (3 سبتمبر)',
          updated: '2026-09-03',
          facts: [
            'الوزن 360 جم والملح 2% — مطابقان لقرار اجتماع 30 أغسطس',
            'الباركود سليم (تحقّق EAN-13) · الصوديوم يتّسق حسابياً مع ملح 2%',
            'باقٍ للمراجعة: %RDI السكريات 9.5% مقابل ~4.2% محسوبة · «طماطم طبيعية» نحوياً تُكتب «طبيعي»',
          ],
          note: '⚠️ سُحب بلاغان خاطئان كنت أبلغت بهما 3 سبتمبر: هجاء «Allora» صحيح (هو الاسم المسجَّل رسمياً)، ورقم الهاتف بالعربي سليم بأربعة أصفار. تناقض ما زال قائماً: طلب خامات من Wael Moustafa لإنتاج 10 آلاف وحدة يذكر "Jar 380gm" رغم اعتماد 360 جم.',
        },
      ],
      finance: { source: 'account.move', posted: amPosted, moves_30d: am30 },
      crm: { source: 'crm.lead', leads },
      integration: [
        { dept: 'المخازن', status: L.in, metric: moves30, unit: 'حركة مسجَّلة (٣٠ يوماً)' },
        { dept: 'المشتريات', status: L.in, metric: orders30, unit: 'أمر شراء جديد (٣٠ يوماً)' },
        { dept: 'الإنتاج', status: L.in, metric: mo30, unit: 'أمر تصنيع جديد (٣٠ يوماً)' },
        { dept: 'مبيعات B2B', status: L.in, metric: so30, unit: 'أمر بيع جديد (٣٠ يوماً)' },
        { dept: 'المالية', status: L.partial, metric: am30, unit: 'قيد جديد — المبالغ تحتاج تحقّقاً' },
        { dept: 'Alora — التجزئة', status: L.out, metric: 0,
          unit: 'صفر إيراد وصفر تسليم — ٥٤٬٨٦٣ وحدة على الورق' },
        { dept: 'CRM', status: L.out, metric: leads, unit: 'صفر سجل' },
        { dept: 'التسويق', status: L.out, metric: 0, unit: 'لا مصدر بيانات إطلاقاً' },
        { dept: 'الجودة / المختبر', status: L.unknown, metric: null, unit: 'لم يُفحص بعد' },
        { dept: 'الموارد البشرية', status: L.unknown, metric: null, unit: 'لم يُفحص بعد' },
      ],
    });
  } catch (e) {
    return res.status(500).json({ error: 'build_failed', message: String(e.message) });
  }
};

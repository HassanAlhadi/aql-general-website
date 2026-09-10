'use strict';
/* ══════════════════════════════════════════════════════════════════════════
   مِقوَد v2 — data.js · طبقة الربط
   تجلب GET /api/decide مرة واحدة وتملأ الشاشات السبع.

   ⚠️ هذا المستودع عام. لا رقم ولا اسم ولا اقتباس مكتوب في هذا الملف —
   كل نص معروض يأتي من الرد. أي سطر يكتب قيمة هنا هو خطأ، لا اختصار.

   ⭐ أخطر سطر يمكن كتابته في هذا الملف هو `value || 0`:
   يحوّل «غير معروف» إلى «صفر» صمتاً، فيقرأ المستخدم غياب البيانات إنجازاً.
   لذلك لا يوجد `|| 0` واحد هنا — القيمة الغائبة تمرّ عبر fmt() فتُعرض نصاً.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const UNKNOWN = 'غير معروف';
  const $ = (slot) => document.querySelector(`[data-slot="${slot}"]`);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* null ≠ صفر. هذه الدالة هي الحارس الوحيد على تلك القاعدة في الواجهة. */
  const isNum = (v) => v !== null && v !== undefined && typeof v === 'number' && !Number.isNaN(v);
  const fmt = (v) => (isNum(v) ? v.toLocaleString('ar-EG', { maximumFractionDigits: 1 }) : UNKNOWN);
  const fmtU = (v, u) => (isNum(v) ? `${fmt(v)}${u ? ' ' + esc(u) : ''}` : UNKNOWN);

  const SEV_PILL = { 'حرج': 'p-bad', 'متوسط': 'p-warn', 'منخفض': 'p-paper' };
  const STATUS_PILL = { 'منجز': 'p-ok', 'متحرك': 'p-brand', 'متأخر': 'p-bad', 'معلّق': 'p-warn', 'بلا مقياس': 'p-paper' };

  const set = (slot, html) => { const el = $(slot); if (el) { el.className = 'scroll'; el.innerHTML = html; } };
  const setStat = (slot, value, unit, caption) => {
    const el = $(slot);
    if (!el) return;
    el.className = 'empty';
    el.innerHTML = `<div class="stat"><b class="${isNum(value) ? '' : 'unk'}">${fmtU(value, unit)}</b>`
      + `<span>${esc(caption)}</span></div>`;
  };

  /* ── الحالات الثلاث: تحميل · خطأ · فارغ — لكل شاشة، بلا استثناء ── */
  function everySlot(fn) { document.querySelectorAll('[data-slot]').forEach(fn); }

  function showLoading() {
    everySlot((el) => {
      const et = el.querySelector('.et');
      if (et) et.textContent = 'جارٍ التحميل…';
    });
  }

  function showError(title, detail) {
    everySlot((el) => {
      el.className = 'empty paper';
      el.innerHTML = `<div class="et">${esc(title)}</div><div class="ed">${esc(detail)}</div>`;
    });
  }

  /* ── ش١ · القيادة ── */
  function renderCommand(d) {
    const gaps = d.gaps.filter((g) => g.kind !== 'missing_metric');

    // شريط الفجوة: مؤشر واحد — نسبة ما يُسجَّل فعلاً من نشاط التجزئة.
    const delivered = d.metrics['retail.delivered_pct'];
    const el = $('command:gapbar');
    if (el) {
      el.className = 'gapbar';
      const v = delivered ? delivered.value : null;
      const pctIn = isNum(v) ? Math.max(0, Math.min(100, v)) : null;
      el.innerHTML = `
        <div class="gb-head">
          <span class="gb-lbl">${esc(d.labels.retail || '')} — ما يعرفه النظام من نشاطها</span>
          <b class="${isNum(v) ? '' : 'unk'}">${fmtU(v, delivered && delivered.unit)}</b>
        </div>
        <div class="gb-track" role="img" aria-label="${esc(fmtU(v, '%'))} داخل النظام">
          ${pctIn === null
            ? '<div class="gb-unk"></div>'
            : `<div class="gb-in" style="width:${pctIn}%"></div>`}
        </div>
        <div class="gb-foot">${pctIn === null
          ? 'القيمة غير معروفة — لم تُقرأ، ولا تُقدَّر صفراً.'
          : `الباقي (${fmt(100 - pctIn)}%) يجري خارج النظام — وهذا ما يقيسه مِقوَد.`}</div>`;
    }

    // ثلاثة قرارات فقط. لا أربعون رقماً — هذا الفرق كله عن النسخة الأولى.
    ['dec1', 'dec2', 'dec3'].forEach((slot, i) => {
      const g = gaps[i];
      const box = $(`command:${slot}`);
      if (!box) return;
      if (!g) {
        box.className = 'empty';
        box.innerHTML = `<div class="et">لا قرار ثالث</div>`
          + `<div class="ed">عدد الفجوات المفتوحة أقل من ثلاث — وهذا خبر جيد لا نقص عرض.</div>`;
        return;
      }
      box.className = 'decision';
      box.innerHTML = `
        <div class="d-top"><span class="pill ${SEV_PILL[g.severity] || 'p-paper'}"><span class="d"></span>${esc(g.severity)}</span>
          <span class="mono d-code">${esc(g.code)}</span></div>
        <h3 class="d-title">${esc(g.title)}</h3>
        <div class="d-why">
          <div class="w-sys"><span>النظام يقول</span><p>${esc(g.system_says || UNKNOWN)}</p></div>
          <div class="w-real"><span>والواقع يقول</span><p>${g.reality_says
            ? esc(g.reality_says) : '<i class="unk">لا اقتباس موثّق</i>'}</p></div>
        </div>
        ${g.action ? `<div class="d-act"><span>افعل</span><p>${esc(g.action)}</p></div>` : ''}
        <div class="d-owner"><span>لمن</span><b>${g.owner ? esc(g.owner)
          : '<i class="unk">⚠️ بلا مالك مسمّى</i>'}</b></div>`;
    });

    // الاتجاه: رسم واحد فقط في هذه الشاشة، عمداً.
    const key = 'retail.stuck_pickings';
    const series = (d.series && d.series[key]) || [];
    const trend = $('command:trend');
    if (trend) {
      if (series.length >= 2 && typeof lineChart === 'function') {
        trend.className = 'chart';
        trend.innerHTML = lineChart({
          series: [{ name: key, values: series.map((p) => p.v), tone: 'bad' }],
          unit: (d.metrics[key] || {}).unit || '',
          days: series.map((p) => String(p.t).slice(5, 10)),
        });
      } else {
        trend.className = 'empty paper';
        trend.innerHTML = `<div class="et">التاريخ يبدأ من أول لقطة</div>`
          + `<div class="ed">هذه القراءة لحظية بلا أرشيف زمني، فلا يوجد خط اتجاه بعد. `
          + `لا يُرسم خط من نقطة واحدة، ولا تُخترع نقاط سابقة.</div>`;
      }
    }

    const missing = d.gaps.filter((g) => g.kind === 'missing_metric');
    set('command:changes', missing.length
      ? `<div class="lst">${missing.map((g) =>
          `<div class="li"><span class="pill p-paper"><span class="d"></span>غائب</span>`
          + `<span class="mono">${esc(g.title)}</span></div>`).join('')}</div>`
      : `<div class="empty"><div class="et">كل المقاييس المطلوبة حاضرة</div>`
        + `<div class="ed">لا مقياس غائب في هذه القراءة.</div></div>`);
  }

  /* ── ش٢ · الفجوة — الشاشة المميِّزة: عمودان لا يُدمجان ── */
  function renderGap(d) {
    const gaps = d.gaps.filter((g) => g.kind !== 'missing_metric');
    const by = (s) => gaps.filter((g) => g.severity === s).length;
    setStat('gap:n-critical', by('حرج'), 'فجوة', 'تمنع غيرها أو توقف الدورة');
    setStat('gap:n-medium', by('متوسط'), 'فجوة', 'تحتاج موعداً ومالكاً');
    setStat('gap:n-low', by('منخفض'), 'فجوة', 'تُتابَع ولا تُوقف شيئاً');

    set('gap:table', gaps.map((g) => `
      <article class="gapcard">
        <header><span class="pill ${SEV_PILL[g.severity] || 'p-paper'}"><span class="d"></span>${esc(g.severity)}</span>
          <span class="mono">${esc(g.code)}</span>
          <h3>${esc(g.title)}</h3></header>
        <div class="two">
          <div class="col-sys"><span class="lbl">النظام يقول</span><p>${esc(g.system_says || UNKNOWN)}</p></div>
          <div class="col-real"><span class="lbl">والواقع يقول</span>
            <p>${g.reality_says ? esc(g.reality_says)
              : '<i class="unk">لا اقتباس موثّق — لا يُملأ هذا العمود بجملة عامة.</i>'}</p></div>
        </div>
        <footer>
          <span>المالك: <b>${g.owner ? esc(g.owner) : '<i class="unk">⚠️ بلا مالك</i>'}</b></span>
          ${g.evidence ? `<span>السجلات: <b>${fmt(g.evidence.count)}</b></span>` : ''}
          ${(g.blocks && g.blocks.length)
            ? `<span>تمنع: <b class="mono">${g.blocks.map(esc).join(' · ')}</b></span>` : ''}
        </footer>
        ${g.evidence && g.evidence.refs.length
          ? `<details><summary>عرض المراجع (${fmt(g.evidence.refs.length)} من ${fmt(g.evidence.count)})</summary>
             <div class="refs mono">${g.evidence.refs.map(esc).join(' · ')}</div></details>` : ''}
      </article>`).join(''));

    set('gap:timeline', `<div class="lst">${gaps.map((g) =>
      `<div class="li"><span class="mono">${esc(g.code)}</span>`
      + `<span>${esc(g.title)}</span>`
      + `<b class="score" title="الترتيب = خطورة + ٢٠ لكل فجوة تمنعها + ١٥ إن كانت بلا مالك">`
      + `${fmt(g.score)}</b></div>`).join('')}</div>`
      + `<p class="note">الترتيب ليس رأياً: صيغته معلَنة، فيمكن الاعتراض عليه بحجة.</p>`);
  }

  /* ── ش٣ · الالتزامات — «بلا موعد» حالة تُعرض لا نقص يُخفى ── */
  function renderCommitments(d) {
    const cs = d.commitments || [];
    setStat('commitments:n-open', cs.filter((c) => c.status === 'معلّق' || c.status === 'متحرك').length,
      'التزام', 'قائم ولم يبلغ هدفه بعد');
    setStat('commitments:n-late', cs.filter((c) => c.status === 'متأخر').length,
      'التزام', 'مضى موعده ولم يتحرك');

    set('commitments:table', cs.map((c) => `
      <article class="commit ${c.due_at ? '' : 'nodate'}">
        <header><span class="pill ${STATUS_PILL[c.status] || 'p-paper'}"><span class="d"></span>${esc(c.status)}</span>
          <h3>${esc(c.what)}</h3></header>
        <div class="meta">
          <span>المالك: <b>${esc(c.owner || UNKNOWN)}</b></span>
          <span>الموعد: <b>${c.due_at ? esc(c.due_at)
            : '<i class="unk">⚠️ بلا موعد — لا يمكن أن يتأخر، فلا يُحاسَب عليه أحد</i>'}</b></span>
          <span>التحقق: <b class="mono">${c.verify_key ? esc(c.verify_key)
            : '<i class="unk">لا مقياس آلي</i>'}</b></span>
        </div>
        ${c.source ? `<p class="src">المصدر: ${esc(c.source)}</p>` : ''}
      </article>`).join(''));

    const verify = $('commitments:verify');
    if (verify) {
      const drawable = cs.filter((c) => isNum(c.current) && isNum(c.target) && c.target > 0);
      if (drawable.length && typeof bulletChart === 'function') {
        verify.className = 'scroll';
        verify.innerHTML = drawable.map((c) => bulletChart({
          actual: c.current, target: c.target,
          unit: (d.metrics[c.verify_key] || {}).unit || '',
          label: c.what.slice(0, 46),
        })).join('');
      } else {
        verify.className = 'empty paper';
        verify.innerHTML = `<div class="et">لا التزام قابل للتحقق الآلي</div>`
          + `<div class="ed">التحقق يحتاج مقياساً وهدفاً رقمياً. الالتزام بلا مقياس يُعرض في الجدول ولا يُرسم.</div>`;
      }
    }
  }

  /* ── ش٤ · التدفق — أين تنكسر السلسلة بالضبط ── */
  function renderFlow(d) {
    const stages = d.flow || [];
    const first = stages.length ? stages[0].count : null;
    const last = stages.length ? stages[stages.length - 1].count : null;
    setStat('flow:completion', (isNum(first) && isNum(last) && first > 0)
      ? Math.round((last / first) * 1000) / 10 : null, '%', 'يصل آخر السلسلة من أولها');

    const sk = $('flow:sankey');
    if (sk) {
      if (stages.length >= 2 && typeof sankeyChart === 'function') {
        sk.className = 'chart';
        sk.innerHTML = sankeyChart({
          stages: stages.map((s) => ({ label: s.label, value: s.count })),
        });
      } else {
        sk.className = 'empty paper';
        sk.innerHTML = `<div class="et">لا مراحل كافية</div><div class="ed">يحتاج مرحلتين على الأقل.</div>`;
      }
    }

    // نقطة الانكسار: أول مرحلة تفقد أكثر من نصف ما قبلها.
    let brk = null;
    for (let i = 1; i < stages.length; i++) {
      const a = stages[i - 1].count, b = stages[i].count;
      if (isNum(a) && isNum(b) && a > 0 && b <= a / 2) { brk = { from: stages[i - 1], to: stages[i] }; break; }
    }
    set('flow:breakpoint', brk
      ? `<div class="brk"><span class="pill p-bad"><span class="d"></span>الانكسار</span>
         <p>بين <b>${esc(brk.from.label)}</b> (${fmt(brk.from.count)}) و<b>${esc(brk.to.label)}</b> (${fmt(brk.to.count)}).</p>
         <p class="note">أول مرحلة تفقد أكثر من نصف ما قبلها — والمعيار مكتوب هنا لا مخفياً.</p></div>`
      : `<div class="empty"><div class="et">لا انكسار حاد</div>
         <div class="ed">لا مرحلة تفقد أكثر من نصف ما قبلها في هذه القراءة.</div></div>`);
  }

  /* ── ش٥ · السجلات — ما تهبط إليه كل قيمة مجمَّعة ── */
  function renderRecords(d) {
    const rows = d.records || [];
    setStat('records:n-total', rows.length, 'سجل', 'مقروء في هذه القراءة');
    setStat('records:updated', null, '', `آخر قراءة: ${esc(String(d.taken_at || '').slice(0, 16).replace('T', ' '))}`);

    const filters = $('records:filters');
    if (filters) {
      filters.className = 'filters';
      filters.innerHTML = `
        <label class="fld"><span>بحث</span>
          <input id="rq" type="search" placeholder="مرجع · جهة · حالة" autocomplete="off"></label>
        <label class="fld"><span>النوع</span><select id="rk"><option value="">الكل</option>
          ${[...new Set(rows.map((r) => r.kind))].map((k) => `<option>${esc(k)}</option>`).join('')}</select></label>
        <label class="fld"><span>النطاق</span><select id="rs"><option value="">الكل</option>
          ${[...new Set(rows.map((r) => r.scope).filter(Boolean))].map((k) => `<option>${esc(k)}</option>`).join('')}</select></label>
        <label class="fld chk"><input id="ru" type="checkbox"><span>لم يُلمس فقط</span></label>`;
    }

    // فهرس بحث مبني مرة واحدة — البحث بعده مقارنة نصية على مصفوفة جاهزة،
    // لا إعادة تجميع للحقول في كل ضغطة مفتاح.
    const idx = rows.map((r) => ({
      r, hay: [r.ref, r.partner, r.state, r.scope, r.kind].filter(Boolean).join(' ').toLowerCase(),
    }));

    function draw() {
      const q = (document.getElementById('rq') || {}).value || '';
      const k = (document.getElementById('rk') || {}).value || '';
      const s = (document.getElementById('rs') || {}).value || '';
      const u = (document.getElementById('ru') || {}).checked;
      const needle = q.trim().toLowerCase();
      const out = idx.filter((x) => (!needle || x.hay.includes(needle))
        && (!k || x.r.kind === k) && (!s || x.r.scope === s) && (!u || x.r.untouched === true));

      setStat('records:n-filtered', out.length, 'سجل', 'مطابق للفلتر الحالي');
      set('records:table', out.length ? `<table class="tbl"><thead><tr>
          <th>المرجع</th><th>النوع</th><th>الجهة</th><th>النطاق</th>
          <th>فُتح</th><th>الموعد</th><th>الحالة</th><th>لم يُلمس</th></tr></thead><tbody>
        ${out.slice(0, 300).map(({ r }) => `<tr>
          <td class="mono">${esc(r.ref)}</td><td>${esc(r.kind)}</td>
          <td>${r.partner ? esc(r.partner) : `<i class="unk">${UNKNOWN}</i>`}</td>
          <td>${r.scope ? esc(r.scope) : `<i class="unk">${UNKNOWN}</i>`}</td>
          <td class="mono">${esc(String(r.opened_at || '').slice(0, 10)) || `<i class="unk">${UNKNOWN}</i>`}</td>
          <td class="mono">${r.scheduled_at ? esc(String(r.scheduled_at).slice(0, 10))
            : `<i class="unk">${UNKNOWN}</i>`}</td>
          <td>${esc(r.state || UNKNOWN)}</td>
          <td>${r.untouched === true ? '<span class="pill p-warn"><span class="d"></span>نعم</span>'
            : (r.untouched === false ? '—' : `<i class="unk">${UNKNOWN}</i>`)}</td>
        </tr>`).join('')}</tbody></table>
        ${out.length > 300 ? `<p class="note">يُعرض أول ٣٠٠ من ${fmt(out.length)}.</p>` : ''}`
        : `<div class="empty"><div class="et">لا سجل مطابق</div>
           <div class="ed">غيّر الفلتر أو امسح البحث.</div></div>`);
    }

    ['rq', 'rk', 'rs', 'ru'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(el.tagName === 'INPUT' && el.type !== 'checkbox' ? 'input' : 'change', draw);
    });
    draw();
  }

  /* ── ش٦ · الأقسام — من داخل النظام ومن خارجه ── */
  function renderDepartments(d) {
    const ds = d.departments || [];
    const by = (v) => ds.filter((x) => x.in_system === v).length;
    setStat('departments:n-in', by('داخل'), 'قسم', 'نشاطه مسجَّل في النظام');
    setStat('departments:n-partial', by('جزئي'), 'قسم', 'جزء من نشاطه خارج النظام');
    setStat('departments:n-out', by('خارج'), 'قسم', 'خارج النظام في نطاقه');
    setStat('departments:n-items', ds.length, 'قسم', 'مرصود');

    const TONE = { 'داخل': 'p-ok', 'جزئي': 'p-warn', 'خارج': 'p-bad' };
    set('departments:cards', `<div class="depgrid">${ds.map((x) => `
      <article class="dep ${x.in_system === 'خارج' ? 'paper' : ''}">
        <header><span class="pill ${TONE[x.in_system] || 'p-paper'}"><span class="d"></span>${esc(x.in_system || UNKNOWN)}</span>
          <h3>${esc(x.name)}</h3></header>
        <p class="who">المسؤول: <b>${esc(x.owner || UNKNOWN)}</b></p>
        <p class="note">${esc(x.note || '')}</p>
      </article>`).join('')}</div>`);

    // الفجوات مرتّبة على المالك — نفس البيانات، مدخل آخر.
    const gaps = d.gaps.filter((g) => g.kind !== 'missing_metric');
    set('departments:items', `<div class="lst">${gaps.map((g) =>
      `<div class="li"><span class="mono">${esc(g.code)}</span><span>${esc(g.title)}</span>`
      + `<b>${g.owner ? esc(g.owner) : '<i class="unk">⚠️ بلا مالك</i>'}</b></div>`).join('')}</div>`);
  }

  /* ── ش٧ · الاتجاهات ── */
  function renderTrends(d) {
    const keys = Object.keys(d.series || {}).filter((k) => (d.series[k] || []).length >= 2);
    setStat('trends:headline', keys.length, 'مقياس', 'له تاريخ كافٍ لرسم اتجاه');

    if (!keys.length) {
      const msg = `<div class="empty paper"><div class="et">لا تاريخ بعد</div>
        <div class="ed">هذه القراءة لحظية. الاتجاه يحتاج لقطتين على الأقل — ولا يُرسم خط من نقطة واحدة.</div></div>`;
      ['trends:delta', 'trends:series', 'trends:compare'].forEach((s) => set(s, msg));
      return;
    }
    set('trends:series', keys.map((k) => {
      const pts = d.series[k];
      return `<div class="chart">${lineChart({
        series: [{ name: k, values: pts.map((p) => p.v), tone: 'brand' }],
        unit: (d.metrics[k] || {}).unit || '',
        days: pts.map((p) => String(p.t).slice(5, 10)),
      })}</div>`;
    }).join(''));

    const rows = keys.map((k) => {
      const pts = d.series[k];
      const a = pts[0].v, b = pts[pts.length - 1].v;
      return { label: k, value: (isNum(a) && isNum(b)) ? b - a : null };
    });
    set('trends:delta', typeof barChart === 'function'
      ? `<div class="chart">${barChart({ rows, unit: '', tone: 'brand' })}</div>` : '');
    set('trends:compare', `<table class="tbl"><thead><tr><th>المقياس</th><th>أول قراءة</th><th>آخر قراءة</th><th>الفرق</th></tr></thead><tbody>
      ${keys.map((k) => {
        const p = d.series[k]; const a = p[0].v, b = p[p.length - 1].v;
        return `<tr><td class="mono">${esc(k)}</td><td>${fmt(a)}</td><td>${fmt(b)}</td>
          <td>${(isNum(a) && isNum(b)) ? fmt(b - a) : UNKNOWN}</td></tr>`;
      }).join('')}</tbody></table>`);
  }

  /* ── التشغيل ── */
  async function boot() {
    showLoading();
    let r;
    try {
      r = await fetch('/api/decide', { credentials: 'same-origin' });
    } catch {
      return showError('تعذّر الوصول للخادم',
        'لا اتصال. لا تُعرض بيانات قديمة ولا بديلة — أعد المحاولة بعد قليل.');
    }

    if (r.status === 401) { window.location.href = '/miqwad/'; return; }

    let d = null;
    try { d = await r.json(); } catch { d = null; }

    if (r.status === 503 && d && d.error === 'narrative_missing') {
      return showError('الإعداد غير مكتمل',
        (d.message || '') + ' لن تُعرض أي بيانات حتى يكتمل الإعداد — لوحة ببيانات وهمية أخطر من لوحة لا تعمل.');
    }
    if (!r.ok || !d) {
      return showError('تعذّرت القراءة', (d && d.message) ? d.message : `الخادم ردّ بالحالة ${r.status}.`);
    }

    const nm = document.getElementById('viewerName');
    if (nm && d.viewer) nm.textContent = d.viewer;
    const stamp = document.getElementById('lastRead');
    if (stamp) stamp.textContent = String(d.taken_at || '').slice(0, 16).replace('T', ' ');

    try {
      renderCommand(d); renderGap(d); renderCommitments(d);
      renderFlow(d); renderRecords(d); renderDepartments(d); renderTrends(d);
      if (typeof initChartInteractions === 'function') initChartInteractions(document);
    } catch (e) {
      console.error('[miqwad] فشل العرض:', e);
      showError('فشل عرض البيانات', String(e && e.message ? e.message : e));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

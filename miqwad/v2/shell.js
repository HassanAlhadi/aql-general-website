/* ══════════════════════════════════════════════════════════════
   مِقوَد v2 — shell.js
   مسؤوليته فقط: التنقّل بين الشاشات السبع · تبديل الثيم · قائمة الجوال.
   لا يقرأ بيانات، ولا يرسم رسوماً — تلك مهمة charts.js (يُبنى بالتوازي)
   وطبقة البيانات (م0/م1) لاحقاً.
   ══════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var STORE_KEY = 'miqwad-v2-theme';

  /* ── الثيم — فاتح/داكن، يعمل في الاتجاهين، محفوظ بأمان ── */
  var root = document.documentElement;
  var themeBtn = document.getElementById('themeBtn');
  var themeIcon = document.getElementById('themeIcon');
  var themeLbl = document.getElementById('themeLbl');

  function readStoredTheme(){
    try { return localStorage.getItem(STORE_KEY); }
    catch (e) { return null; }
  }
  function writeStoredTheme(v){
    try { localStorage.setItem(STORE_KEY, v); }
    catch (e) { /* تخزين محجوب — لا يوقف الواجهة */ }
  }
  function systemPrefersDark(){
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function isDark(){
    var explicit = root.getAttribute('data-theme');
    if (explicit === 'dark') return true;
    if (explicit === 'light') return false;
    return systemPrefersDark();
  }
  function applyThemeUI(){
    var dark = isDark();
    themeBtn.setAttribute('aria-pressed', String(dark));
    themeLbl.textContent = dark ? 'فاتح' : 'داكن';
    // شمس (فاتح) عند وضع داكن الحالي، قمر (داكن) عند وضع فاتح الحالي — أيقونة تصف الوجهة لا الحالة
    themeIcon.innerHTML = dark
      ? '<path d="M21 12.4A8.5 8.5 0 1 1 11.6 3 6.8 6.8 0 0 0 21 12.4Z"/>'
      : '<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>';
  }
  function setTheme(v){
    if (v) { root.setAttribute('data-theme', v); writeStoredTheme(v); }
    else { root.removeAttribute('data-theme'); writeStoredTheme(''); }
    applyThemeUI();
  }

  (function initTheme(){
    var stored = readStoredTheme();
    if (stored === 'dark' || stored === 'light') root.setAttribute('data-theme', stored);
    applyThemeUI();
  })();

  themeBtn.addEventListener('click', function(){
    setTheme(isDark() ? 'light' : 'dark');
  });

  /* ── التنقّل بين الشاشات السبع ── */
  var navItems = Array.prototype.slice.call(document.querySelectorAll('.nav-item[data-target]'));
  var views = Array.prototype.slice.call(document.querySelectorAll('.view[id]'));

  function showView(id){
    views.forEach(function(v){ v.classList.toggle('on', v.id === id); });
    navItems.forEach(function(n){
      n.setAttribute('aria-current', String(n.getAttribute('data-target') === id));
    });
    // حدث للاستهلاك من charts.js — يُبنى بواسطة وكيل آخر بالتوازي، لا نفترض وجوده
    window.dispatchEvent(new CustomEvent('miqwad:viewchange', { detail: { view: id } }));
    closeMobileSidebar();
  }

  navItems.forEach(function(btn){
    btn.addEventListener('click', function(){ showView(btn.getAttribute('data-target')); });
  });

  /* ── قائمة الجوال — الشريط الجانبي درج منزلق تحت 900px ── */
  var menuBtn = document.getElementById('menuBtn');
  var sidebar = document.getElementById('sidebar');

  function openMobileSidebar(){
    sidebar.classList.add('open');
    menuBtn.setAttribute('aria-expanded', 'true');
  }
  function closeMobileSidebar(){
    sidebar.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  menuBtn.addEventListener('click', function(){
    sidebar.classList.contains('open') ? closeMobileSidebar() : openMobileSidebar();
  });

  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') closeMobileSidebar();
  });
})();

/* timer.js - MenMen Timer panel: Pomodoro + Countdown.
 * Time is kept as an end timestamp, so the timer stays right when the panel is closed / reopened
 * or AE is busy. State and settings live in localStorage (this panel only). */
(function () {
  var B = window.Bridge;
  var KEY = 'mmw:timer:v1';
  var $ = document.getElementById('timer');

  // ---------------- state ----------------
  var DEF = {
    tab: 'pomo',
    settings: { pomo: 25, short: 5, long: 15, autoBreaks: false, autoPomos: false, interval: 4 },
    pomo: { phase: 'pomo', running: false, end: 0, remaining: null, count: 0 },
    count: { running: false, end: 0, remaining: null, total: 5 * 60000 }
  };
  var st;
  function load() {
    try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { st = null; }
    if (!st || typeof st !== 'object') st = {};
    st.tab = st.tab || DEF.tab;
    st.settings = Object.assign({}, DEF.settings, st.settings || {});
    st.pomo = Object.assign({}, DEF.pomo, st.pomo || {});
    st.count = Object.assign({}, DEF.count, st.count || {});
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } }

  var PHASES = { pomo: 'Pomodoro', short: 'Short Break', long: 'Long Break' };
  function phaseMs(p) { return Math.max(1, Number(st.settings[p]) || DEF.settings[p]) * 60000; }
  function remainingOf(t, full) {
    if (t.running) return Math.max(0, t.end - Date.now());
    return t.remaining == null ? full : t.remaining;
  }
  function pomoFull() { return phaseMs(st.pomo.phase); }

  // ---------------- sound (Web Audio, no files) ----------------
  var actx = null;
  function beep(times) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var t0 = actx.currentTime + 0.02;
      for (var i = 0; i < (times || 3); i++) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = i % 2 ? 660 : 880;
        g.gain.setValueAtTime(0.0001, t0 + i * 0.32);
        g.gain.exponentialRampToValueAtTime(0.35, t0 + i * 0.32 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.32 + 0.26);
        o.connect(g); g.connect(actx.destination);
        o.start(t0 + i * 0.32); o.stop(t0 + i * 0.32 + 0.28);
      }
    } catch (e) { /* no audio */ }
  }

  // ---------------- timer actions ----------------
  function start(t, full) { var r = remainingOf(t, full); t.end = Date.now() + r; t.running = true; save(); }
  function pause(t, full) { t.remaining = remainingOf(t, full); t.running = false; save(); }
  function reset(t) { t.running = false; t.remaining = null; save(); }
  function setPhase(p, autostart) {
    st.pomo.phase = p; st.pomo.running = false; st.pomo.remaining = null;
    if (autostart) start(st.pomo, pomoFull()); else save();
  }
  // a phase ended (or Skip): pomodoro -> short/long break, break -> pomodoro
  function nextPhase(finished) {
    var s = st.settings;
    if (st.pomo.phase === 'pomo') {
      if (finished) st.pomo.count++;
      var long = st.pomo.count > 0 && st.pomo.count % Math.max(1, s.interval) === 0;
      setPhase(long ? 'long' : 'short', finished && s.autoBreaks);
    } else setPhase('pomo', finished && s.autoPomos);
  }
  // Every phase that ended by `now`: the next one starts exactly when the previous one ended (not when
  // the panel noticed - hidden panels run their timers late), and several phases are caught up when
  // the panel was hidden or closed. Stops at a phase that does not auto-start. Returns phases ended.
  function advancePomo(now) {
    var n = 0, s = st.settings;
    while (st.pomo.running && now >= st.pomo.end && n < 1000) {
      var endedAt = st.pomo.end, next, auto;
      if (st.pomo.phase === 'pomo') {
        st.pomo.count++;
        next = st.pomo.count % Math.max(1, s.interval) === 0 ? 'long' : 'short';
        auto = s.autoBreaks;
      } else { next = 'pomo'; auto = s.autoPomos; }
      st.pomo.phase = next; st.pomo.remaining = null;
      if (auto) st.pomo.end = endedAt + phaseMs(next);   // keeps running, in rhythm
      else st.pomo.running = false;
      n++;
    }
    if (n) save();
    return n;
  }
  var flashT = null;
  function finished(which) {
    beep(3);
    $.classList.add('tm-flash'); clearTimeout(flashT); flashT = setTimeout(function () { $.classList.remove('tm-flash'); }, 2400);
    if (which !== 'pomo') { st.count.running = false; st.count.remaining = 0; save(); }
  }

  // ---------------- UI ----------------
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function fmt(ms) {
    var s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    var mm = (h ? String(m).padStart(2, '0') : String(m).padStart(2, '0')), ss = String(x).padStart(2, '0');
    return (h ? h + ':' : '') + mm + ':' + ss;
  }
  var ICON = {
    gear: '<circle cx="8" cy="8" r="2.2"/><path d="M6.9 1.5h2.2l.4 1.8 1.3.6 1.6-1 1.5 1.6-1 1.6.6 1.3 1.8.4v2.2l-1.8.4-.6 1.3 1 1.6-1.5 1.5-1.6-1-1.3.6-.4 1.8H6.9l-.4-1.8-1.3-.6-1.6 1-1.5-1.5 1-1.6-.6-1.3-1.8-.4V6.9l1.8-.4.6-1.3-1-1.6 1.5-1.6 1.6 1 1.3-.6z"/>',
    clock: '<circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/>',
    close: '<path d="M4 4l8 8M12 4l-8 8"/>',
    reset: '<path d="M3 8a5 5 0 1 0 1.5-3.5"/><path d="M3 2.5V5h2.5"/>',
    skip: '<path d="M4 3.5l6 4.5-6 4.5z"/><path d="M12 3.5v9"/>'
  };
  function svg(k) { return '<svg viewBox="0 0 16 16">' + ICON[k] + '</svg>'; }

  var ui = {};
  function build() {
    $.innerHTML = '';
    var head = el('div', 'tm-head');
    var tabs = el('div', 'seg tm-tabs');
    [['pomo', 'Pomodoro'], ['count', 'Countdown']].forEach(function (t) {
      var b = el('button', 'seg-btn' + (st.tab === t[0] ? ' on' : ''), t[1]);
      b.addEventListener('click', function () { st.tab = t[0]; save(); build(); });
      tabs.appendChild(b);
    });
    var gear = el('button', 'icon-btn tm-gear', svg('gear'));
    gear.title = 'Setting';
    gear.addEventListener('click', openSettings);
    head.append(tabs, gear);
    $.appendChild(head);

    var body = el('div', 'tm-main');
    if (st.tab === 'pomo') {
      var phases = el('div', 'tm-phases');
      Object.keys(PHASES).forEach(function (p) {
        var b = el('button', 'tm-phase' + (st.pomo.phase === p ? ' on' : ''), PHASES[p]);
        b.addEventListener('click', function () { if (st.pomo.phase !== p) { setPhase(p, false); build(); } });
        phases.appendChild(b);
      });
      body.appendChild(phases);
    }
    ui.time = el('div', 'tm-time');
    ui.edit = el('div', 'tm-edit');
    body.appendChild(ui.time);
    if (st.tab === 'count') {
      // min / sec fields (shown while not running) + quick presets
      var mi = el('input', 'input tm-in'); mi.type = 'number'; mi.min = 0; mi.max = 999; mi.title = 'Minutes';
      var se = el('input', 'input tm-in'); se.type = 'number'; se.min = 0; se.max = 59; se.title = 'Seconds';
      var setTotal = function () {
        var ms = (Math.max(0, Number(mi.value) || 0) * 60 + Math.min(59, Math.max(0, Number(se.value) || 0))) * 1000;
        st.count.total = Math.max(1000, ms); reset(st.count); ui.dirty = true; paint();
      };
      [mi, se].forEach(function (i) {
        i.addEventListener('focus', function () { i.select(); });  // typing replaces the old value
        i.addEventListener('change', setTotal);
        i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { setTotal(); i.blur(); } });
      });
      ui.edit.append(mi, el('span', 'tm-colon', ':'), se);
      ui.mi = mi; ui.se = se;
      var chips = el('div', 'tm-chips');
      [1, 5, 10, 15, 30, 60].forEach(function (m) {
        var c = el('button', 'tm-chip', m + 'm');
        c.addEventListener('click', function () { st.count.total = m * 60000; reset(st.count); ui.dirty = false; paint(); });
        chips.appendChild(c);
      });
      body.append(ui.edit, chips);
    }
    ui.bar = el('div', 'tm-bar', '<i></i>');
    body.appendChild(ui.bar);

    var ctl = el('div', 'tm-ctl');
    ui.go = el('button', 'w-btn w-primary tm-go');
    ui.go.addEventListener('click', toggle);
    var rs = el('button', 'w-btn tm-ico', svg('reset')); rs.title = 'Reset';
    rs.addEventListener('click', function () { if (st.tab === 'pomo') reset(st.pomo); else reset(st.count); paint(); });
    ctl.append(rs, ui.go);
    if (st.tab === 'pomo') {
      var sk = el('button', 'w-btn tm-ico', svg('skip')); sk.title = 'Skip to the next phase';
      sk.addEventListener('click', function () { nextPhase(false); build(); });
      ctl.appendChild(sk);
    }
    body.appendChild(ctl);
    ui.info = el('div', 'tm-info');
    body.appendChild(ui.info);
    $.appendChild(body);
    paint();
  }
  function toggle() {
    ui.dirty = false;
    if (st.tab === 'pomo') { if (st.pomo.running) pause(st.pomo, pomoFull()); else start(st.pomo, pomoFull()); }
    else {
      if (st.count.running) pause(st.count, st.count.total);
      else { if (remainingOf(st.count, st.count.total) <= 0) st.count.remaining = null; start(st.count, st.count.total); }
    }
    paint();
  }
  function paint() {
    var pomo = st.tab === 'pomo', t = pomo ? st.pomo : st.count, full = pomo ? pomoFull() : st.count.total;
    var rem = remainingOf(t, full);
    ui.time.textContent = fmt(rem);
    ui.bar.firstChild.style.width = (100 - rem / full * 100).toFixed(2) + '%';
    ui.go.textContent = t.running ? 'Pause' : (rem < full && rem > 0 ? 'Resume' : 'Start');
    $.classList.toggle('tm-running', !!t.running);
    $.dataset.phase = pomo ? st.pomo.phase : 'count';
    if (pomo) ui.info.textContent = '#' + (st.pomo.count + (st.pomo.phase === 'pomo' ? 1 : 0)) + ' · ' + (st.pomo.phase === 'pomo' ? 'Time to focus!' : 'Time for a break!');
    else {
      ui.info.textContent = rem === 0 ? 'Time is up!' : 'Countdown ' + fmt(st.count.total);
      var editing = !t.running && rem === full;
      ui.edit.style.display = editing ? '' : 'none';
      ui.time.style.display = editing ? 'none' : '';
      if (editing && !ui.dirty && document.activeElement !== ui.mi && document.activeElement !== ui.se) {
        var s = Math.round(st.count.total / 1000);
        ui.mi.value = Math.floor(s / 60); ui.se.value = String(s % 60).padStart(2, '0');
      }
    }
  }
  function tick() {
    var changed = false;
    if (st.pomo.running && Date.now() >= st.pomo.end && advancePomo(Date.now())) { finished('pomo'); changed = true; }
    if (st.count.running && Date.now() >= st.count.end) { finished('count'); changed = true; }
    if (changed) build(); else if (!document.hidden) paint();  // hidden panel: only watch for the end
  }

  // ---------------- settings (like the reference: SETTING / TIMER) ----------------
  function openSettings() {
    var ov = el('div', 'tm-ov');
    var dlg = el('div', 'tm-dlg');
    var hd = el('div', 'tm-dlg-head', '<span>SETTING</span>');
    var x = el('button', 'icon-btn', svg('close')); x.title = 'Close';
    hd.appendChild(x);
    var bd = el('div', 'tm-dlg-body');
    bd.appendChild(el('div', 'tm-sec', svg('clock') + '<span>TIMER</span>'));
    bd.appendChild(el('div', 'tm-label', 'Time (minutes)'));
    var grid = el('div', 'tm-grid3'), s = st.settings;
    function numField(label, key, min, max) {
      var f = el('label', 'tm-nf', '<span>' + label + '</span>');
      var i = el('input', 'input'); i.type = 'number'; i.min = min; i.max = max; i.value = s[key];
      i.addEventListener('change', function () {
        var v = Math.round(Math.min(max, Math.max(min, Number(i.value) || min))); i.value = v;
        var phaseIdle = !st.pomo.running && st.pomo.remaining == null;
        s[key] = v; save(); if (phaseIdle) paint();
      });
      f.appendChild(i); return f;
    }
    grid.append(numField('Pomodoro', 'pomo', 1, 600), numField('Short Break', 'short', 1, 600), numField('Long Break', 'long', 1, 600));
    bd.appendChild(grid);
    function toggleRow(label, key) {
      var r = el('label', 'tm-row', '<span>' + label + '</span>');
      var i = el('input', 'tm-switch'); i.type = 'checkbox'; i.checked = !!s[key];
      i.addEventListener('change', function () { s[key] = i.checked; save(); });
      r.appendChild(i); return r;
    }
    bd.append(toggleRow('Auto Start Breaks', 'autoBreaks'), toggleRow('Auto Start Pomodoros', 'autoPomos'));
    var lr = el('label', 'tm-row', '<span>Long Break interval</span>');
    var li = el('input', 'input tm-num-s'); li.type = 'number'; li.min = 1; li.max = 20; li.value = s.interval;
    li.addEventListener('change', function () { s.interval = Math.round(Math.min(20, Math.max(1, Number(li.value) || 4))); li.value = s.interval; save(); paint(); });
    lr.appendChild(li); bd.appendChild(lr);
    var rc = el('button', 'tm-link', 'Reset pomodoro count');
    rc.addEventListener('click', function () { st.pomo.count = 0; save(); paint(); });
    bd.appendChild(rc);
    dlg.append(hd, bd); ov.appendChild(dlg); document.body.appendChild(ov);
    var close = function () { ov.remove(); build(); };
    x.addEventListener('click', close);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { document.removeEventListener('keydown', esc); close(); } });
  }

  // ---------------- theme: AE panel color + the MenMen accent / native look ----------------
  function theme() {
    var r = document.documentElement.style, env = B.hostEnv(), t = {};
    try {
      var raw = (B.userData && B.fs.read(B.userData.replace(/\\/g, '/') + '/MenMenWorkflow/settings.json')) || localStorage.getItem('mmw:settings:v2');
      t = (JSON.parse(raw || '{}').theme) || {};
    } catch (e) { t = {}; }
    if (t.accent) r.setProperty('--accent', t.accent);
    document.body.classList.toggle('native', !!t.native);
    if (t.followHost !== false && env && env.appSkinInfo) {
      var c = env.appSkinInfo.panelBackgroundColor.color;
      r.setProperty('--bg', 'rgb(' + [c.red, c.green, c.blue].map(Math.round).join(',') + ')');
      document.body.classList.toggle('light', (0.299 * c.red + 0.587 * c.green + 0.114 * c.blue) / 255 > 0.55);
    }
  }
  function sizeClass() { document.body.classList.toggle('tm-small', window.innerWidth < 200 || window.innerHeight < 230); }

  load();
  theme();
  sizeClass();
  // a timer that ran out while the panel was closed: finish it now
  advancePomo(Date.now());
  if (st.count.running && Date.now() >= st.count.end) { st.count.running = false; st.count.remaining = 0; save(); }
  build();
  // 4 updates/s while a timer runs, 1/s when idle
  (function loop() { tick(); setTimeout(loop, st.pomo.running || st.count.running ? 250 : 1000); })();
  window.addEventListener('resize', sizeClass);
  if (B.inCEP) B.on('com.adobe.csxs.events.ThemeColorChanged', theme);
  window.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
  });
  window.MMWTimer = { state: function () { return st; }, tick: tick };
})();

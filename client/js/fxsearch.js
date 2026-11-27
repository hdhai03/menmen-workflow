/* fxsearch.js - FX Search: one search box for every installed effect, the presets / scripts in the library
 * and the MenMen tools. Enter applies the highlighted item to the selected layers; Shift+Enter puts an
 * effect on a new adjustment layer. Empty search shows Favorites (star) and Recent.
 * Clicking the tool opens its settings (shortcut, what to search, where Enter applies); the shortcut
 * (Ctrl+Space by default) opens the search while a MenMen panel has the focus. */
(function () {
  var B = window.Bridge, W = window.Widgets, T = window.Tools;
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var CACHE = 'mmw:fxlist:v1', MAX_ROWS = 60, RECENT = 12;
  var effects = null;  // [{n, m, c}]
  function loadEffects(ctx, force) {
    if (effects && !force) return Promise.resolve(effects);
    if (!force) {
      try { var c = JSON.parse(localStorage.getItem(CACHE) || 'null'); if (c && c.list && c.list.length) { effects = c.list; return Promise.resolve(effects); } } catch (e) { /* ignore */ }
    }
    return ctx.query('listEffects', {}).then(function (r) {
      var list = [];
      try { list = JSON.parse(r && r.ok ? r.msg : '[]'); } catch (e) { list = null; }
      if (!list || !list.length) {  // preview mode: a few sample effects
        list = [['Gaussian Blur', 'ADBE Gaussian Blur 2', 'Blur & Sharpen'], ['Glow', 'ADBE Glo2', 'Stylize'], ['Fill', 'ADBE Fill', 'Generate'],
          ['Drop Shadow', 'ADBE Drop Shadow', 'Perspective'], ['Curves', 'ADBE CurvesCustom', 'Color Correction'], ['Turbulent Displace', 'ADBE Turbulent Displace', 'Distort'],
          ['Tint', 'ADBE Tint', 'Color Correction'], ['Fractal Noise', 'ADBE Fractal Noise', 'Noise & Grain'], ['Slider Control', 'ADBE Slider Control', 'Expression Controls']]
          .map(function (x) { return { n: x[0], m: x[1], c: x[2] }; });
      } else {
        try { localStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), list: list })); } catch (e) { /* ignore */ }
      }
      effects = list;
      return list;
    });
  }

  // every searchable item: {key, kind: 'fx' | 'tool' | 'script', name, sub, ...}
  function items(d) {
    var out = [], sc = scope(d);
    if (sc.fx) (effects || []).forEach(function (e) { out.push({ key: 'fx:' + e.m, kind: 'fx', name: e.n, sub: e.c, match: e.m }); });
    T.list.forEach(function (t) {
      if (t.id === 'fxSearch') return;
      var scr = t.cat === 'scripts';
      if (scr ? !sc.scripts : !sc.tools) return;
      out.push({ key: 'tool:' + t.id, kind: scr ? 'script' : 'tool', name: t.name, sub: scr ? (/\.ffx$/i.test(t.file || '') ? 'Preset' : 'Script') : 'MenMen · ' + (T.cat(t.cat) || {}).name, tool: t.id });
    });
    return out;
  }
  var KIND = { fx: 'FX', tool: 'MM', script: 'JS' };
  function scope(d) { var s = d.scope || {}; return { fx: s.fx !== false, scripts: s.scripts !== false, tools: s.tools !== false }; }

  // ---------- shortcut ----------
  var SHORTCUTS = [['ctrl+space', 'Ctrl + Space'], ['shift+space', 'Shift + Space'], ['ctrl+tab', 'Ctrl + Tab'], ['shift+tab', 'Shift + Tab'], ['custom', 'Custom']];
  function keyName(e) {  // "Ctrl+Alt+F" from a key event (physical key, so it does not depend on the layout)
    var k = e.code || e.key || '';
    k = k.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '');
    if (/^(Control|Shift|Alt|Meta)(Left|Right)?$/.test(k)) return '';
    return (e.ctrlKey ? 'Ctrl+' : '') + (e.metaKey ? 'Cmd+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey ? 'Shift+' : '') + k;
  }
  function shortcutOf(d) {
    var s = d.shortcut || 'ctrl+space';
    if (s === 'custom') return d.custom || '';
    return { 'ctrl+space': 'Ctrl+Space', 'shift+space': 'Shift+Space', 'ctrl+tab': 'Ctrl+Tab', 'shift+tab': 'Shift+Tab' }[s] || 'Ctrl+Space';
  }
  // the panels call this on every keydown
  function matches(e, d) {
    var want = shortcutOf(d || {});
    if (!want) return false;
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (typing && !/^(Ctrl|Cmd|Alt)\+/.test(want) && !/^F\d+$/.test(want)) return false;  // Shift+Space still types in fields
    return keyName(e) === want;
  }
  window.FxSearch = { matches: matches, shortcutOf: shortcutOf };

  // all words must appear; names starting with / words starting with the query rank first
  function score(it, words, q) {
    var n = it.name.toLowerCase(), hay = n + ' ' + it.sub.toLowerCase(), s = 0;
    for (var i = 0; i < words.length; i++) {
      var at = hay.indexOf(words[i]);
      if (at < 0) return -1;
      if (n.indexOf(words[i]) === 0) s += 40;
      else if (n.indexOf(' ' + words[i]) >= 0) s += 20;
      else if (at < n.length) s += 8;
    }
    if (n === q) s += 100;
    if (it.kind === 'fx') s += 3;  // effects first on ties, like FX Console
    return s - n.length * 0.15;
  }

  // ---------- settings (what clicking the tool shows) ----------
  W.fxSearchSettings = function (d, ctx) {
    var root = el('div', 'w gx fxset');
    function field(label, node) { var f = el('label', 'gx-f', '<span>' + label + '</span>'); f.appendChild(node); root.appendChild(f); return f; }
    // shortcut
    var sel = el('select', 'input');
    SHORTCUTS.forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; sel.appendChild(op); });
    sel.value = d.shortcut || 'ctrl+space';
    field('Shortcut', sel);
    var cap = el('input', 'input fxset-cap'); cap.readOnly = true; cap.placeholder = 'Click here, then press the keys';
    cap.value = d.custom || '';
    var capF = field('Custom shortcut', cap);
    function showCap() { capF.style.display = sel.value === 'custom' ? '' : 'none'; }
    showCap();
    sel.addEventListener('change', function () { d.shortcut = sel.value; showCap(); ctx.save(); note(); if (sel.value === 'custom') cap.focus(); });
    cap.addEventListener('keydown', function (e) {
      e.preventDefault(); e.stopPropagation();
      var k = keyName(e);
      if (!k || k === 'Escape') return;
      if (!/\+/.test(k) && !/^F\d+$/.test(k)) { cap.value = ''; cap.placeholder = 'Use a modifier (Ctrl / Alt / Shift) or an F key'; return; }
      cap.value = k; d.custom = k; ctx.save(); note();
    });
    // what to search
    var sc = scope(d), box = el('div', 'fxset-checks');
    [['fx', 'Effects'], ['scripts', 'Presets & scripts'], ['tools', 'MenMen tools']].forEach(function (o) {
      var l = el('label', 'dm-check small', '<input type="checkbox"> ' + o[1]), c = l.firstChild;
      c.checked = sc[o[0]];
      c.addEventListener('change', function () { d.scope = d.scope || {}; d.scope[o[0]] = c.checked; ctx.save(); });
      box.appendChild(l);
    });
    field('Search in', box);
    // where Enter applies
    var ent = el('select', 'input');
    [['layers', 'Selected layers (Shift: new adjustment layer)'], ['adjust', 'New adjustment layer (Shift: selected layers)']].forEach(function (o) {
      var op = el('option', null, o[1]); op.value = o[0]; ent.appendChild(op);
    });
    ent.value = d.enter || 'layers';
    ent.addEventListener('change', function () { d.enter = ent.value; ctx.save(); });
    field('Enter applies effects to', ent);
    // actions
    var row = el('div', 'fxset-btns');
    var open = el('button', 'w-btn w-primary', 'Open FX Search');
    open.addEventListener('click', function () { if (window.UI) window.UI.close(); setTimeout(function () { window.dispatchEvent(new CustomEvent('mmw-fxsearch')); }, 0); });
    var rl = el('button', 'w-btn', 'Reload effects');
    rl.title = 'Read the installed effects again (after installing plugins)';
    rl.addEventListener('click', function () { rl.textContent = 'Reading…'; loadEffects(ctx, true).then(function (l) { rl.textContent = l.length + ' effects'; }); });
    var cr = el('button', 'w-btn', 'Clear Recent');
    cr.addEventListener('click', function () { if (ctx.data && ctx.data.fxRecent) ctx.data.fxRecent.length = 0; ctx.save(); cr.textContent = 'Cleared'; });
    row.append(open, rl, cr);
    root.appendChild(row);
    var info = el('div', 'muted small fxset-note');
    function note() {
      var k = shortcutOf(d);
      info.textContent = (k ? 'Press ' + k.replace(/\+/g, ' + ') + ' in a MenMen panel to open the search. ' : 'Set a custom shortcut. ') +
        'After Effects does not give panels global shortcuts, so click a MenMen panel first.';
    }
    note();
    root.appendChild(info);
    return root;
  };

  W.fxSearch = function (d, ctx) {
    var data = ctx.data || {}, fav = data.fxFav || (data.fxFav = []), recent = data.fxRecent || (data.fxRecent = []);
    var root = el('div', 'w fxs');
    var bar = el('div', 'fxs-bar');
    var input = el('input', 'input fxs-input'); input.placeholder = 'Search effects, presets, tools…'; input.spellcheck = false;
    var reload = el('button', 'icon-btn fxs-reload', '<svg viewBox="0 0 16 16"><path d="M13 8a5 5 0 1 1-1.5-3.5M13 2.5v3h-3"/></svg>');
    reload.title = 'Reload the effect list (after installing plugins)';
    bar.append(input, reload);
    var list = el('div', 'fxs-list'), hint = el('div', 'fxs-hint muted small',
      (d.enter === 'adjust' ? 'Enter: on a new adjustment layer \u00B7 Shift+Enter: on the selected layers' : 'Enter: apply \u00B7 Shift+Enter: on a new adjustment layer') +
      ' \u00B7 \u2191\u2193: choose \u00B7 \u2605: favorite');
    root.append(bar, list, hint);

    var rows = [], cur = 0, all = [];
    function byKey(k) { for (var i = 0; i < all.length; i++) if (all[i].key === k) return all[i]; return null; }
    function render() {
      var q = input.value.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean), res = [];
      if (!words.length) {
        fav.forEach(function (k) { var it = byKey(k); if (it) res.push({ it: it, group: 'Favorites' }); });
        recent.forEach(function (k) { var it = byKey(k); if (it && fav.indexOf(k) < 0) res.push({ it: it, group: 'Recent' }); });
      } else {
        all.forEach(function (it) {
          var s = score(it, words, q);
          if (s < 0) return;
          if (fav.indexOf(it.key) >= 0) s += 15;
          var ri = recent.indexOf(it.key); if (ri >= 0) s += 10 - ri * 0.5;
          res.push({ it: it, s: s });
        });
        res.sort(function (a, b) { return b.s - a.s; });
      }
      rows = res.slice(0, MAX_ROWS);
      cur = Math.min(cur, Math.max(0, rows.length - 1));
      list.innerHTML = '';
      if (!rows.length) {
        list.appendChild(el('div', 'fxs-empty muted small', words.length ? 'Nothing found' : 'Type to search. Star (★) the ones you use most - they show up here.'));
        return;
      }
      var lastGroup = null;
      rows.forEach(function (r, i) {
        if (r.group && r.group !== lastGroup) { list.appendChild(el('div', 'fxs-group', r.group)); lastGroup = r.group; }
        var row = el('div', 'fxs-row' + (i === cur ? ' on' : ''));
        var isFav = fav.indexOf(r.it.key) >= 0;
        row.innerHTML = '<span class="fxs-kind k-' + r.it.kind + '">' + KIND[r.it.kind] + '</span><span class="fxs-name">' + esc(r.it.name) +
          '</span><span class="fxs-sub">' + esc(r.it.sub) + '</span><button class="fxs-star' + (isFav ? ' on' : '') + '" title="Favorite">' + (isFav ? '★' : '☆') + '</button>';
        row.addEventListener('mousedown', function (e) { e.preventDefault(); });  // keep the focus in the search box
        row.addEventListener('click', function (e) {
          if (e.target.classList.contains('fxs-star')) { toggleFav(r.it.key); return; }
          cur = i; run(r.it, e);
        });
        row.addEventListener('mousemove', function () { if (cur !== i) { cur = i; mark(); } });
        list.appendChild(row);
      });
    }
    function mark() {
      var rs = list.querySelectorAll('.fxs-row');
      for (var i = 0; i < rs.length; i++) rs[i].classList.toggle('on', i === cur);
      if (rs[cur]) rs[cur].scrollIntoView({ block: 'nearest' });
    }
    function toggleFav(k) {
      var i = fav.indexOf(k);
      if (i >= 0) fav.splice(i, 1); else fav.unshift(k);
      ctx.save(); render();
    }
    function remember(k) {
      var i = recent.indexOf(k); if (i >= 0) recent.splice(i, 1);
      recent.unshift(k); if (recent.length > RECENT) recent.length = RECENT;
      ctx.save();
    }
    function run(it, e) {
      remember(it.key);
      var adjust = !!(e && e.shiftKey) !== (d.enter === 'adjust'), keep = !!(e && (e.ctrlKey || e.metaKey)) && it.kind === 'fx';
      // close first: a tool may open its own dialog (Ctrl/Cmd+Enter on an effect keeps the search open)
      if (window.UI && !keep) window.UI.close();
      if (it.kind === 'fx') ctx.run('applyEffect', { match: it.match, name: it.name, adjust: adjust }, e);
      else if (ctx.runTool) ctx.runTool(it.tool, e);
    }

    input.addEventListener('input', function () { cur = 0; render(); });
    input.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'ArrowDown') { e.preventDefault(); if (cur < rows.length - 1) { cur++; mark(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (cur > 0) { cur--; mark(); } }
      else if (e.key === 'Enter') { e.preventDefault(); if (rows[cur]) run(rows[cur].it, e); }
      else if (e.key === 'Escape') { if (window.UI) window.UI.close(); }
    });
    reload.addEventListener('click', function () {
      list.innerHTML = '<div class="fxs-empty muted small">Reading the effects…</div>';
      loadEffects(ctx, true).then(function () { all = items(d); render(); input.focus(); });
    });

    list.innerHTML = '<div class="fxs-empty muted small">Reading the effects…</div>';
    loadEffects(ctx).then(function () { all = items(d); render(); });
    setTimeout(function () { input.focus(); }, 40);
    return root;
  };
})();

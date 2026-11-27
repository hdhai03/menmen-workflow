/* fxsearch.js - FX Search: one search box for every installed effect, the presets / scripts in the library
 * and the MenMen tools. Enter applies the highlighted item to the selected layers; Shift+Enter puts an
 * effect on a new adjustment layer. Empty search shows Favorites (star) and Recent.
 * Open it from the tool, or with Ctrl+Space while a MenMen panel has the focus. */
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
  function items() {
    var out = [];
    (effects || []).forEach(function (e) { out.push({ key: 'fx:' + e.m, kind: 'fx', name: e.n, sub: e.c, match: e.m }); });
    T.list.forEach(function (t) {
      if (t.widget === 'fxSearch') return;
      var scr = t.cat === 'scripts';
      out.push({ key: 'tool:' + t.id, kind: scr ? 'script' : 'tool', name: t.name, sub: scr ? (/\.ffx$/i.test(t.file || '') ? 'Preset' : 'Script') : 'MenMen · ' + (T.cat(t.cat) || {}).name, tool: t.id });
    });
    return out;
  }
  var KIND = { fx: 'FX', tool: 'MM', script: 'JS' };

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

  W.fxSearch = function (d, ctx) {
    var data = ctx.data || {}, fav = data.fxFav || (data.fxFav = []), recent = data.fxRecent || (data.fxRecent = []);
    var root = el('div', 'w fxs');
    var bar = el('div', 'fxs-bar');
    var input = el('input', 'input fxs-input'); input.placeholder = 'Search effects, presets, tools…'; input.spellcheck = false;
    var reload = el('button', 'icon-btn fxs-reload', '<svg viewBox="0 0 16 16"><path d="M13 8a5 5 0 1 1-1.5-3.5M13 2.5v3h-3"/></svg>');
    reload.title = 'Reload the effect list (after installing plugins)';
    bar.append(input, reload);
    var list = el('div', 'fxs-list'), hint = el('div', 'fxs-hint muted small',
      'Enter: apply · Shift+Enter: on a new adjustment layer · ↑↓: choose · ★: favorite');
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
      var adjust = !!(e && e.shiftKey), keep = !!(e && (e.ctrlKey || e.metaKey)) && it.kind === 'fx';
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
      loadEffects(ctx, true).then(function () { all = items(); render(); input.focus(); });
    });

    list.innerHTML = '<div class="fxs-empty muted small">Reading the effects…</div>';
    loadEffects(ctx).then(function () { all = items(); render(); });
    setTimeout(function () { input.focus(); }, 40);
    return root;
  };
})();

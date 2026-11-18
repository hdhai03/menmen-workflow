/* app.js - MenMen Workflow UI.
 *  - Main panel (com.menmen.workflow.main): search, favorites, 12 tool categories, user panels, add items.
 *  - Sub panels (panel1..4): show one category or one user panel docked from the main panel. */
(function () {
  var B = window.Bridge, S = window.Store, T = window.Tools, W = window.Widgets, U = window.UI;
  var el = U.el, esc = U.esc;
  var $app = document.getElementById('app');
  var st = { hostOk: false, hostMsg: '', sheet: null, query: '', sel: 0, edit: false, showHidden: false, horizontal: false };
  var MOD = { alt: 'Alt', shift: 'Shift', ctrl: 'Ctrl' };

  // ============ theme ============
  function hexToRgb(h) {
    var m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [79, 140, 255];
    var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function applyTheme() {
    var t = S.data.theme, r = document.documentElement.style, b = document.body;
    r.setProperty('--accent', t.accent);
    r.setProperty('--accent-rgb', hexToRgb(t.accent).join(','));
    b.className = b.className.replace(/\b(theme|size)-\w+/g, '').trim();
    b.classList.add('theme-' + t.style, 'size-' + t.iconSize);
    b.classList.toggle('no-tips', !t.tooltips);
    b.classList.toggle('is-main', B.isMain);
    b.classList.toggle('horizontal', st.horizontal);
    var env = B.hostEnv();
    if (t.followHost && env && env.appSkinInfo) {
      var c = env.appSkinInfo.panelBackgroundColor.color;
      r.setProperty('--bg', 'rgb(' + [c.red, c.green, c.blue].map(Math.round).join(',') + ')');
      b.classList.toggle('light', (0.299 * c.red + 0.587 * c.green + 0.114 * c.blue) / 255 > 0.55);
    } else { r.removeProperty('--bg'); b.classList.remove('light'); }
  }
  function catStyle(node, catId) {
    var c = T.cat(catId); if (!c) return node;
    node.style.setProperty('--cat', c.color);
    node.style.setProperty('--cat-rgb', hexToRgb(c.color).join(','));
    return node;
  }

  // ============ run tools / items ============
  function mods(e) { return e ? { alt: !!e.altKey, shift: !!e.shiftKey, ctrl: !!(e.ctrlKey || e.metaKey) } : {}; }
  var busy = 0;
  function exec(hostId, opts, e, label) {
    busy++;
    document.body.classList.add('busy');
    if ($tip) $tip.innerHTML = '<span class="tip-run">Running ' + esc(label || hostId) + '…</span>';
    var done = function () { if (--busy <= 0) { busy = 0; document.body.classList.remove('busy'); setTip(); } };
    return B.run(hostId, Object.assign(mods(e), opts || {})).then(function (r) {
      done();
      U.toast((label ? label + ': ' : '') + (r.msg || (r.ok ? 'Done' : 'Error')), r.ok);
      return r;
    }, function (err) { done(); U.toast('Error: ' + err, false); });
  }
  function runTool(t, e) {
    if (t.widget) return openWidget(t);
    if (t.params && t.params.length) return openParams(t, e);
    return exec(t.host || t.id, t.opts, e, t.name);
  }
  function runItem(it, e) {
    var label = itemLabel(it);
    switch (it.type) {
      case 'tool': { var t = T.get(it.tool); return t ? runTool(t, e) : U.toast('Tool does not exist: ' + it.tool, false); }
      case 'expression': return exec('applyExpression', { code: it.code }, e, label);
      case 'scriptlet': return exec('runScriptlet', { code: it.code }, e, label);
      case 'script': case 'preset': return exec('runFile', { path: it.path }, e, label);
      case 'effect': return exec('applyEffect', { effect: it.effect }, e, label);
      case 'command': return exec('runCommand', { command: it.command }, e, label);
    }
  }
  function itemLabel(it) {
    if (it.label) return it.label;
    if (it.type === 'tool') { var t = T.get(it.tool); return t ? t.name : it.tool; }
    if (it.type === 'script' || it.type === 'preset') return (it.path || '').split(/[\\/]/).pop() || 'Script';
    if (it.type === 'effect') return it.effect;
    if (it.type === 'command') return it.command;
    return T.ITEM_TYPES.filter(function (x) { return x.type === it.type; })[0].name;
  }
  function itemIcon(it) {
    if (it.type === 'tool') { var t = T.get(it.tool); return t ? T.toolIcon(t) : T.iconSvg('script'); }
    var ty = T.ITEM_TYPES.filter(function (x) { return x.type === it.type; })[0];
    return T.iconSvg(ty ? ty.icon : 'script');
  }
  function itemCat(it) {
    if (it.type === 'tool') { var t = T.get(it.tool); return t ? t.cat : null; }
    return null;
  }
  function itemDesc(it) {
    if (it.type === 'tool') { var t = T.get(it.tool); return t ? t.desc : ''; }
    return { expression: 'Applies the expression to the selected properties', scriptlet: 'Runs an ExtendScript snippet', script: it.path,
      preset: it.path, effect: 'Applies the effect to the selected layers', command: 'Runs the menu command: ' + it.command }[it.type] || '';
  }

  // ============ tooltip / helptip ============
  var $tip = null;
  function tipTool(t) {
    var h = '<b>' + esc(t.name) + '</b><span class="tip-desc">' + esc(t.desc) + '</span>';
    if (t.mods) Object.keys(t.mods).forEach(function (k) { h += '<span class="tip-mod"><kbd>' + MOD[k] + '</kbd>' + esc(t.mods[k]) + '</span>'; });
    if (t.params) h += '<span class="tip-mod muted">· opens a parameter form</span>';
    return h;
  }
  function setTip(html) { if ($tip) $tip.innerHTML = html || defaultTip(); }
  function defaultTip() {
    if (!st.hostOk && B.inCEP) return '<span class="tip-err">Host not loaded: ' + esc(st.hostMsg) + '</span>';
    if (!B.inCEP) return '<span class="tip-desc">Preview mode (outside After Effects) – tools are simulated</span>';
    return '<span class="tip-desc">Hover a tool for help · Alt / Shift / Ctrl + click for alternate modes</span>';
  }
  function hoverTip(node, html) {
    node.addEventListener('mouseenter', function () { setTip(typeof html === 'function' ? html() : html); });
    node.addEventListener('mouseleave', function () { setTip(); });
  }

  // ============ shared building blocks ============
  function svgBtn(cls, title, path, onClick) {
    var b = el('button', 'icon-btn ' + (cls || ''), '<svg viewBox="0 0 16 16">' + path + '</svg>');
    b.title = title;
    if (onClick) b.addEventListener('click', function (e) { e.stopPropagation(); onClick(e); });
    return b;
  }
  var ICONS = {
    back: '<path d="M10 3L5 8l5 5"/>', close: '<path d="M4 4l8 8M12 4l-8 8"/>',
    dock: '<rect x="2.5" y="2.5" width="11" height="11"/><path d="M2.5 6h11M8 9v3M6.5 10.5L8 12l1.5-1.5"/>',
    menu: '<path d="M3 4.5h10M3 8h10M3 11.5h10"/>', edit: '<path d="M11.3 2.3l2.4 2.4-8.2 8.2H3.1v-2.4z"/>',
    grid: '<rect x="2.5" y="2.5" width="4.5" height="4.5"/><rect x="9" y="2.5" width="4.5" height="4.5"/><rect x="2.5" y="9" width="4.5" height="4.5"/><rect x="9" y="9" width="4.5" height="4.5"/>',
    list: '<path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><circle cx="2.8" cy="4" r=".8"/><circle cx="2.8" cy="8" r=".8"/><circle cx="2.8" cy="12" r=".8"/>',
    plus: '<path d="M8 3v10M3 8h10"/>', search: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>',
    eyeOff: '<path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4z"/><path d="M3 13L13 3"/>',
    gear: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>',
    refresh: '<path d="M13 8a5 5 0 1 1-1.5-3.6"/><path d="M13 2.5v3h-3"/>',
    layout: '<path d="M2.5 2.5h6v6h-6zM10.5 2.5h3v3h-3zM10.5 7.5h3v6h-3zM2.5 10.5h6v3h-6z"/>',
    expand: '<path d="M9.5 2.5h4v4M13.5 2.5L9 7M6.5 13.5h-4v-4M2.5 13.5L7 9"/>',
    folder: '<path d="M2 4.5h4l1.5 1.5H14v7H2z"/>',
    star: '<path d="M8 1.8l1.8 3.8 4.1.5-3 2.8.8 4.1L8 11l-3.7 2 .8-4.1-3-2.8 4.1-.5z"/>'
  };

  // List row: icon + name + modifier badges + extra buttons (star / hide)
  function toolRow(t, extra) {
    extra = extra || {};
    var row = catStyle(el('div', 'row-item' + (extra.hidden ? ' is-hidden' : '')), t.cat);
    row.innerHTML = '<span class="ri-ico">' + T.toolIcon(t) + '</span><span class="ri-name">' + esc(t.name) + '</span>' +
      (t.mods ? '<span class="ri-mods">' + Object.keys(t.mods).map(function (k) { return MOD[k][0]; }).join('') + '</span>' : '') +
      (t.params || t.widget ? '<span class="ri-more">…</span>' : '');
    if (extra.star) {
      var fav = S.isFav(t.id);
      row.appendChild(svgBtn('ri-act star' + (fav ? ' on' : ''), fav ? 'Remove from favorites' : 'Add to favorites', ICONS.star, function () {
        S.toggleFav(t.id); render();
      }));
    }
    if (extra.hideToggle) {
      row.appendChild(svgBtn('ri-act hide' + (extra.hidden ? ' on' : ''), extra.hidden ? 'Unhide' : 'Hide from panel', ICONS.eyeOff, function () {
        S.toggleHidden(t.cat, t.id); render();
      }));
    }
    row.addEventListener('click', function (e) { runTool(t, e); });
    hoverTip(row, tipTool(t));
    return row;
  }
  function toolTile(t, small) {
    var b = catStyle(el('button', 'tile' + (small ? ' small' : '')), t.cat);
    b.innerHTML = '<span class="tile-ico">' + T.toolIcon(t) + '</span><span class="tile-lbl">' + esc(t.name) + '</span>';
    b.addEventListener('click', function (e) { runTool(t, e); });
    hoverTip(b, tipTool(t));
    return b;
  }
  function itemNode(it, grid) {
    if (it.type === 'divider') return el('div', grid ? 'grid-divider' : 'list-divider');
    var cat = itemCat(it), label = itemLabel(it);
    var n = el(grid ? 'button' : 'div', grid ? 'tile' : 'row-item');
    if (cat) catStyle(n, cat); else n.classList.add('custom');
    n.innerHTML = grid ? '<span class="tile-ico">' + itemIcon(it) + '</span><span class="tile-lbl">' + esc(label) + '</span>'
      : '<span class="ri-ico">' + itemIcon(it) + '</span><span class="ri-name">' + esc(label) + '</span>' +
        (it.type !== 'tool' ? '<span class="ri-type">' + esc(it.type) + '</span>' : '');
    n.addEventListener('click', function (e) { if (!st.edit) runItem(it, e); });
    hoverTip(n, function () {
      if (it.type === 'tool' && T.get(it.tool)) return tipTool(T.get(it.tool));
      return '<b>' + esc(label) + '</b><span class="tip-desc">' + esc(itemDesc(it)) + '</span>';
    });
    return n;
  }

  // ============ params / widget dialogs ============
  function openParams(t, e) {
    var vals = S.params(t), form = el('div', 'form');
    var inputs = {};
    (t.params || []).forEach(function (p) {
      var f = el('label', 'field' + (p.type === 'check' ? ' inline check' : ''), '<span>' + esc(p.label) + '</span>');
      var i;
      if (p.type === 'textarea') { i = el('textarea', 'input code'); i.rows = 6; i.spellcheck = false; i.value = vals[p.key] == null ? '' : vals[p.key]; }
      else if (p.type === 'select') {
        i = el('select', 'input');
        p.options.forEach(function (o) { var op = el('option', null, esc(o[1])); op.value = o[0]; i.appendChild(op); });
        i.value = vals[p.key];
      } else if (p.type === 'check') { i = el('input'); i.type = 'checkbox'; i.checked = !!vals[p.key]; }
      else {
        i = el('input', 'input'); i.type = p.type === 'number' ? 'number' : 'text';
        if (p.min != null) i.min = p.min; if (p.max != null) i.max = p.max;
        i.value = vals[p.key] == null ? '' : vals[p.key];
      }
      inputs[p.key] = i; f.appendChild(i); form.appendChild(f);
    });
    if (t.mods) {
      var hint = el('div', 'muted small');
      hint.innerHTML = Object.keys(t.mods).map(function (k) { return '<kbd>' + MOD[k] + '</kbd> ' + esc(t.mods[k]); }).join(' · ') + ' (hold the key while clicking Run)';
      form.appendChild(hint);
    }
    function collect() {
      var out = {};
      (t.params || []).forEach(function (p) {
        var i = inputs[p.key];
        out[p.key] = p.type === 'check' ? i.checked : (p.type === 'number' ? (i.value === '' ? '' : Number(i.value)) : i.value);
      });
      return out;
    }
    var go = function (ev) {
      var v = collect(); S.setParams(t.id, v);
      exec(t.host || t.id, Object.assign({}, t.opts || {}, v), ev, t.name);
    };
    form.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && ev.target.tagName !== 'TEXTAREA') { ev.preventDefault(); go(ev); U.close(); }
    });
    var dlg = U.dialog(t.name, form, [{ label: 'Cancel' }, { label: 'Run', primary: true, onClick: function () { go(lastClick); } }]);
    catStyle(dlg, t.cat).classList.add('tool-dialog');
    var lastClick = null;
    dlg.querySelector('.btn.primary').addEventListener('mousedown', function (ev) { lastClick = { altKey: ev.altKey, shiftKey: ev.shiftKey, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey }; });
  }
  // Context handed to widgets: run a host tool, persist state, and the saved-curve library.
  function widgetCtx(t) {
    return {
      run: function (id, o, e) { return exec(id, o, e, t.name); },
      save: function () { S.save(); },
      lib: {
        list: function () { return S.data.curves; },
        save: function (bz, done) {
          U.prompt('Save curve', 'Name', 'Curve ' + (S.data.curves.length + 1), function (v) {
            S.data.curves.push({ name: v, bz: bz }); S.save(); if (done) done();
          });
        },
        remove: function (i) { S.data.curves.splice(i, 1); S.save(); }
      }
    };
  }
  function openWidget(t) {
    var data = S.widgetData(t.id);
    var body = el('div', 'widget-host');
    body.appendChild(W[t.widget](data, widgetCtx(t)));
    var dlg = U.dialog(t.name, body, []);
    catStyle(dlg, t.cat).classList.add('tool-dialog', 'widget-dialog', 'wd-' + t.widget);
    var tip = el('div', 'dlg-tip muted small', esc(t.desc) + (t.mods ? ' · ' + Object.keys(t.mods).map(function (k) { return MOD[k] + ': ' + esc(t.mods[k]); }).join(' · ') : ''));
    dlg.appendChild(tip);
  }

  // ============ MAIN PANEL ============
  function renderMain() {
    $app.innerHTML = '';
    var root = el('div', 'main');
    // header
    var head = el('header', 'm-head');
    head.innerHTML = '<span class="brand">MenMen</span>';
    head.appendChild(svgBtn('m-menu', 'Menu', ICONS.menu, mainMenu));
    root.appendChild(head);
    // search
    var sw = el('label', 'm-search', '<svg viewBox="0 0 16 16">' + ICONS.search + '</svg>');
    var inp = el('input'); inp.placeholder = 'Search tools…'; inp.value = st.query; inp.spellcheck = false;
    sw.appendChild(inp);
    root.appendChild(sw);
    var body = el('div', 'm-body');
    root.appendChild(body);
    $tip = el('footer', 'helptip');
    root.appendChild($tip);
    $app.appendChild(root);

    inp.addEventListener('input', function () { st.query = inp.value; st.sel = 0; fillMainBody(body); });
    inp.addEventListener('keydown', function (e) {
      var rows = body.querySelectorAll('.search-results .row-item');
      if (e.key === 'ArrowDown') { st.sel = Math.min(rows.length - 1, st.sel + 1); markSel(rows); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { st.sel = Math.max(0, st.sel - 1); markSel(rows); e.preventDefault(); }
      else if (e.key === 'Enter' && rows[st.sel]) rows[st.sel].click();
      else if (e.key === 'Escape') { st.query = ''; inp.value = ''; fillMainBody(body); }
    });
    fillMainBody(body);
    setTip();
    if (st.sheet) openSheet(st.sheet);
  }
  function markSel(rows) {
    rows.forEach(function (r, i) { r.classList.toggle('sel', i === st.sel); });
    if (rows[st.sel]) rows[st.sel].scrollIntoView({ block: 'nearest' });
  }

  function fillMainBody(body) {
    body.innerHTML = '';
    var q = st.query.trim().toLowerCase();
    if (q) {
      var res = el('div', 'search-results');
      T.list.filter(function (t) { return (t.name + ' ' + t.desc + ' ' + t.cat).toLowerCase().indexOf(q) >= 0; })
        .forEach(function (t) {
          var r = toolRow(t, { star: true });
          r.insertAdjacentHTML('beforeend', '<span class="ri-cat">' + esc(T.cat(t.cat).name) + '</span>');
          res.appendChild(r);
        });
      S.data.upOrder.forEach(function (uid) {
        S.data.userPanels[uid].items.forEach(function (it) {
          if (it.type === 'divider' || it.type === 'tool') return;
          if (itemLabel(it).toLowerCase().indexOf(q) < 0) return;
          var n = itemNode(it, false);
          n.insertAdjacentHTML('beforeend', '<span class="ri-cat">' + esc(S.data.userPanels[uid].name) + '</span>');
          res.appendChild(n);
        });
      });
      if (!res.children.length) res.appendChild(el('div', 'empty', 'No results for “' + esc(st.query) + '”'));
      body.appendChild(res);
      markSel(res.querySelectorAll('.row-item'));
      return;
    }

    // favorites
    var fav = el('section', 'm-fav');
    var favs = S.data.favorites.map(T.get).filter(Boolean);
    if (favs.length) favs.forEach(function (t) { fav.appendChild(toolTile(t, true)); });
    else fav.appendChild(el('div', 'fav-empty', '☆ Click the star next to a tool to pin it here'));
    body.appendChild(fav);

    // categories
    var cats = el('nav', 'm-list');
    T.CATS.forEach(function (c) {
      var r = catStyle(el('button', 'm-row'), c.id);
      r.innerHTML = '<span class="mr-ico">' + T.iconSvg('cat-' + c.id) + '</span><span class="mr-name">' + esc(c.name) + '</span><span class="mr-count">' + T.inCat(c.id).length + '</span>';
      r.addEventListener('click', function () { openSheet({ kind: 'category', id: c.id }); });
      hoverTip(r, '<b>' + esc(c.name) + '</b><span class="tip-desc">' + T.inCat(c.id).length + ' tools · click to open, Dock to pin as a panel</span>');
      cats.appendChild(r);
    });
    body.appendChild(cats);
    body.appendChild(el('div', 'sep'));

    // user panels
    var users = el('nav', 'm-list');
    S.data.upOrder.forEach(function (id, idx) {
      var u = S.data.userPanels[id];
      var r = el('button', 'm-row user');
      r.innerHTML = '<span class="mr-ico">' + T.iconSvg('user') + '<i>' + (idx + 1) + '</i></span><span class="mr-name">' + esc(u.name) + '</span><span class="mr-count">' + u.items.filter(function (x) { return x.type !== 'divider'; }).length + '</span>';
      r.addEventListener('click', function () { openSheet({ kind: 'user', id: id }); });
      r.addEventListener('contextmenu', function (e) { e.preventDefault(); userPanelMenu(id, e); });
      hoverTip(r, '<b>' + esc(u.name) + '</b><span class="tip-desc">User panel · right-click to rename / delete</span>');
      users.appendChild(r);
    });
    var addUp = el('button', 'm-row ghost', '<span class="mr-ico"><svg viewBox="0 0 16 16" class="ico16">' + ICONS.plus + '</svg></span><span class="mr-name">New user panel</span>');
    addUp.addEventListener('click', newUserPanel);
    users.appendChild(addUp);
    body.appendChild(users);
    body.appendChild(el('div', 'sep'));

    var add = el('button', 'm-row ghost add-item', '<span class="mr-ico"><svg viewBox="0 0 16 16" class="ico16">' + ICONS.plus + '</svg></span><span class="mr-name">Add New Item</span>');
    add.addEventListener('click', function () { addItemDialog(null); });
    body.appendChild(add);
  }

  // Sheet: the menu of a category / user panel, covering the main panel
  function openSheet(sh) {
    st.sheet = sh;
    var old = $app.querySelector('.sheet'); if (old) old.remove();
    var isCat = sh.kind === 'category';
    var c = isCat ? T.cat(sh.id) : null, u = isCat ? null : S.data.userPanels[sh.id];
    if (!c && !u) { st.sheet = null; return; }
    var sheet = el('div', 'sheet');
    if (c) catStyle(sheet, c.id);
    var head = el('header', 'sh-head');
    head.appendChild(svgBtn('', 'Back', ICONS.back, closeSheet));
    head.insertAdjacentHTML('beforeend', '<span class="sh-ico">' + T.iconSvg(c ? 'cat-' + c.id : 'user') + '</span><span class="sh-title">' + esc(c ? c.name : u.name) + '</span>');
    head.appendChild(el('span', 'spacer'));
    if (u) head.appendChild(svgBtn('', 'Add item', ICONS.plus, function () { addItemDialog(sh.id); }));
    if (c && c.id === 'scripts') scriptButtons().forEach(function (b) { head.appendChild(b); });
    head.appendChild(svgBtn('', 'Dock as panel', ICONS.dock, function () { dock(sh.kind, sh.id); }));
    head.appendChild(svgBtn('', 'Close', ICONS.close, closeSheet));
    sheet.appendChild(head);
    var list = el('div', 'sh-body');
    if (c) {
      T.inCat(c.id).forEach(function (t) { list.appendChild(toolRow(t, { star: true })); });
      if (c.id === 'scripts' && !T.inCat(c.id).length) list.appendChild(scriptsEmpty());
    }
    else {
      if (!u.items.length) list.appendChild(el('div', 'empty', 'No items yet. Click + to add scripts, expressions, effects…'));
      u.items.forEach(function (it) {
        var n = itemNode(it, false);
        n.addEventListener('contextmenu', function (e) { e.preventDefault(); itemMenu(sh.id, it, e); });
        list.appendChild(n);
      });
    }
    sheet.appendChild(list);
    $app.querySelector('.main').appendChild(sheet);
  }
  function closeSheet() { st.sheet = null; var s = $app.querySelector('.sheet'); if (s) s.remove(); setTip(); }

  function mainMenu(e) {
    var r = e.currentTarget.getBoundingClientRect();
    U.menu(r.left, r.bottom + 4, [
      { label: 'Settings…', onClick: openSettings },
      { label: 'New user panel…', onClick: newUserPanel },
      { label: 'New quick panel (layout)…', onClick: newQuickPanel },
      { label: 'Add New Item…', onClick: function () { addItemDialog(null); } },
      { label: 'Open Scripts folder', onClick: function (e) { exec('openScriptsFolder', { root: B.extPath }, e, 'Scripts'); } },
      { label: 'Refresh Scripts', onClick: function () { loadLibrary(true); } },
      '-',
      { header: 'Sub panels' }
    ].concat(S.SLOTS.map(function (ext, i) {
      var name = S.contentName(S.slot(ext));
      return { label: 'Panel ' + (i + 1), hint: name || 'empty', onClick: function () { openSlot(ext); } };
    })).concat(['-',
      { label: 'Back up settings…', onClick: exportSettings },
      { label: 'Restore settings…', onClick: importSettings },
      { label: 'Reload host scripts', onClick: loadHost },
      { label: 'Diagnostics…', onClick: diagnostics },
      { label: 'About MenMen Workflow', onClick: about }
    ]), { minWidth: 210 });
  }

  // ============ dock ============
  function openSlot(ext) {
    if (!B.openPanel(ext)) U.toast('(preview) open ' + ext.replace(/^.*\./, ''), true);
  }
  function dock(kind, id) {
    var found = S.findSlot(kind, id);
    var go = function (ext) {
      S.setSlot(ext, kind, id);
      openSlot(ext);
      U.toast('Docked to MenMen Panel ' + ext.slice(-1), true);
    };
    if (found) return go(found.ext);
    // no free slot → ask which panel to replace
    U.menu(window.innerWidth / 2 - 100, 60, [{ header: 'Replace which panel?' }].concat(S.SLOTS.map(function (ext, i) {
      return { label: 'Panel ' + (i + 1), hint: S.contentName(S.slot(ext)) || '', onClick: function () { go(ext); } };
    })), { minWidth: 200 });
  }

  // ============ user panels & items ============
  function newUserPanel() {
    U.prompt('New user panel', 'Name', 'User Panel ' + (S.data.upOrder.length + 1), function (v) {
      var id = S.newUserPanel(v); render();
      if (B.isMain) openSheet({ kind: 'user', id: id });
    });
  }
  function userPanelMenu(id, e) {
    var u = S.data.userPanels[id];
    U.menu(e.clientX, e.clientY, [
      { header: u.name },
      { label: 'Open', onClick: function () { openSheet({ kind: 'user', id: id }); } },
      { label: 'Dock as panel', onClick: function () { dock('user', id); } },
      { label: 'Rename…', onClick: function () { U.prompt('Rename', 'Name', u.name, function (v) { u.name = v; S.save(); render(); }); } },
      '-',
      { label: 'Delete user panel', danger: true, onClick: function () {
        U.dialog('Delete "' + u.name + '"?', el('p', null, 'All items in this panel will be deleted.'), [{ label: 'Cancel' },
          { label: 'Delete', danger: true, onClick: function () { S.deleteUserPanel(id); closeSheet(); render(); } }]);
      } }
    ]);
  }
  function itemMenu(upId, it, e) {
    var u = S.data.userPanels[upId], idx = u.items.indexOf(it);
    U.menu(e.clientX, e.clientY, [
      { header: itemLabel(it) },
      { label: 'Edit…', disabled: it.type === 'divider', onClick: function () { itemForm(upId, it.type, it); } },
      { label: 'Move up', disabled: idx === 0, onClick: function () { u.items.splice(idx - 1, 0, u.items.splice(idx, 1)[0]); S.save(); render(); } },
      { label: 'Move down', disabled: idx === u.items.length - 1, onClick: function () { u.items.splice(idx + 1, 0, u.items.splice(idx, 1)[0]); S.save(); render(); } },
      { header: 'Size in Layout view' }, { node: sizeChips(it) },
      '-',
      { label: 'Delete', danger: true, onClick: function () { u.items.splice(idx, 1); S.save(); render(); } }
    ]);
  }

  // Step 1: choose the item type
  function addItemDialog(upId) {
    if (!S.data.upOrder.length) S.newUserPanel('User Panel 1');
    var wrap = el('div', 'form');
    var target = el('label', 'field', '<span>Add to</span>');
    var sel = el('select', 'input');
    S.data.upOrder.forEach(function (id) { var o = el('option', null, esc(S.data.userPanels[id].name)); o.value = id; sel.appendChild(o); });
    sel.value = upId || S.data.upOrder[0];
    target.appendChild(sel);
    wrap.appendChild(target);
    var types = el('div', 'type-list');
    T.ITEM_TYPES.forEach(function (ty) {
      var b = el('button', 'type-row', '<span class="ri-ico">' + T.iconSvg(ty.icon) + '</span><span class="lib-text"><b>' + esc(ty.name) + '</b><small>' + esc(ty.desc) + '</small></span>');
      b.addEventListener('click', function () {
        if (ty.type === 'divider') { S.data.userPanels[sel.value].items.push({ id: S.uid(), type: 'divider' }); S.save(); U.close(); render(); return; }
        itemForm(sel.value, ty.type, null);
      });
      types.appendChild(b);
    });
    wrap.appendChild(types);
    U.dialog('Add New Item', wrap, []);
  }

  // Step 2: form for the item type
  function itemForm(upId, type, existing) {
    var it = existing ? Object.assign({}, existing) : { id: S.uid(), type: type };
    var form = el('div', 'form');
    function field(label, node) { var f = el('label', 'field', '<span>' + esc(label) + '</span>'); f.appendChild(node); form.appendChild(f); return node; }
    var name = el('input', 'input'); name.value = it.label || ''; name.placeholder = 'Automatic';
    var getters = [];
    if (type === 'tool') {
      var picked = it.tool || null;
      var search = el('input', 'input'); search.placeholder = 'Search tools…';
      var list = el('div', 'pick-list');
      var fill = function () {
        var q = search.value.toLowerCase(); list.innerHTML = '';
        T.list.forEach(function (t) {
          if (q && (t.name + ' ' + t.cat).toLowerCase().indexOf(q) < 0) return;
          var r = catStyle(el('button', 'pick-row' + (picked === t.id ? ' on' : '')), t.cat);
          r.innerHTML = '<span class="ri-ico">' + T.toolIcon(t) + '</span><span>' + esc(t.name) + '</span><span class="ri-cat">' + esc(T.cat(t.cat).name) + '</span>';
          r.addEventListener('click', function () { picked = t.id; fill(); });
          list.appendChild(r);
        });
      };
      search.addEventListener('input', fill);
      form.appendChild(search); form.appendChild(list); fill();
      getters.push(function () { if (!picked) throw new Error('Pick a tool'); it.tool = picked; });
    } else if (type === 'expression' || type === 'scriptlet') {
      var ta = el('textarea', 'input code'); ta.rows = 8; ta.spellcheck = false; ta.value = it.code || '';
      ta.placeholder = type === 'expression' ? 'wiggle(2, 30)' : 'app.project.activeItem.layers.addNull();';
      ta.addEventListener('keydown', function (e) { if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); } });
      field(type === 'expression' ? 'Expression' : 'ExtendScript', ta);
      getters.push(function () { if (!ta.value.trim()) throw new Error('Enter some code'); it.code = ta.value; });
    } else if (type === 'script' || type === 'preset') {
      var row = el('div', 'row');
      var pi = el('input', 'input'); pi.value = it.path || ''; pi.placeholder = type === 'preset' ? '/path/to/preset.ffx' : '/path/to/script.jsx';
      var br = el('button', 'btn', 'Browse…');
      br.addEventListener('click', function (e) {
        e.preventDefault();
        var p = B.fs.openDialog(type === 'preset' ? 'Choose a preset' : 'Choose a script', type === 'preset' ? ['ffx'] : ['jsx', 'jsxbin']);
        if (p) pi.value = p; else if (!B.fs.available) U.toast('The file dialog is only available inside After Effects', false);
      });
      row.append(pi, br);
      var f = el('div', 'field', '<span>File</span>'); f.appendChild(row); form.appendChild(f);
      getters.push(function () { if (!pi.value.trim()) throw new Error('Choose a file'); it.path = pi.value.trim(); });
    } else if (type === 'effect') {
      var ef = field('Effect name or matchName (e.g. ADBE Gaussian Blur 2)', el('input', 'input'));
      ef.value = it.effect || '';
      getters.push(function () { if (!ef.value.trim()) throw new Error('Enter an effect'); it.effect = ef.value.trim(); });
    } else if (type === 'command') {
      var cm = field('Menu command name (e.g. Pre-compose...) or command ID', el('input', 'input'));
      cm.value = it.command || '';
      getters.push(function () { if (!cm.value.trim()) throw new Error('Enter a command'); it.command = cm.value.trim(); });
    }
    field('Display name', name);
    var tyName = T.ITEM_TYPES.filter(function (x) { return x.type === type; })[0].name;
    U.dialog((existing ? 'Edit ' : 'Add ') + tyName, form, [{ label: 'Cancel' }, { label: existing ? 'Save' : 'Add', primary: true, onClick: function () {
      try { getters.forEach(function (g) { g(); }); } catch (err) { U.toast(err.message, false); return false; }
      it.label = name.value.trim() || undefined;
      var items = S.data.userPanels[upId].items;
      if (existing) items[items.indexOf(existing)] = it; else items.push(it);
      S.save(); render();
      U.toast((existing ? 'Saved ' : 'Added ') + itemLabel(it), true);
    } }]);
  }

  // ============ SUB PANELS ============
  function renderSub() {
    $app.innerHTML = '';
    var slot = S.slot(B.extId);
    var name = S.contentName(slot);
    if (slot && !name) { S.clearSlot(B.extId); slot = null; }
    var root = el('div', 'sub');
    if (slot && slot.kind === 'category') catStyle(root, slot.id);
    var head = el('header', 'p-head');
    var title = el('button', 'p-title');
    title.innerHTML = slot ? '<span class="sh-ico">' + T.iconSvg(slot.kind === 'category' ? 'cat-' + slot.id : 'user') + '</span><span class="pt-name">' + esc(name) + '</span>'
      : '<span class="pt-name muted">MenMen Panel ' + esc(B.panelNo) + '</span>';
    title.insertAdjacentHTML('beforeend', '<svg class="caret" viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3"/></svg>');
    title.addEventListener('click', function (e) { contentPicker(e.currentTarget.getBoundingClientRect()); });
    head.appendChild(title);
    head.appendChild(el('span', 'spacer'));
    if (slot) {
      var view = slot.view || 'list';
      head.appendChild(svgBtn('', 'View: ' + view, view === 'list' ? ICONS.list : (view === 'grid' ? ICONS.grid : ICONS.layout), function (e) {
        var r = e.currentTarget.getBoundingClientRect();
        U.menu(r.left - 100, r.bottom + 4, [{ header: 'View' }].concat([['list', 'List'], ['grid', 'Grid'], ['layout', 'Layout (compact, inline widgets)']].map(function (v) {
          return { label: v[1], hint: v[0] === view ? '✓' : '', onClick: function () { slot.view = v[0]; S.save(); render(); } };
        })), { minWidth: 200 });
      }));
      if (slot.kind === 'category' && slot.id === 'scripts') scriptButtons().forEach(function (b) { head.appendChild(b); });
      if (slot.kind === 'user') head.appendChild(svgBtn(st.edit ? 'on' : '', 'Edit (drag to reorder)', ICONS.edit, function () { st.edit = !st.edit; render(); }));
      else head.appendChild(svgBtn(st.edit ? 'on' : '', 'Hide / show tools', ICONS.eyeOff, function () { st.edit = !st.edit; render(); }));
    }
    head.appendChild(svgBtn('', 'Menu', ICONS.menu, subMenu));
    root.appendChild(head);
    var body = el('div', 'p-body');
    root.appendChild(body);
    $tip = el('footer', 'helptip');
    root.appendChild($tip);
    $app.appendChild(root);

    if (!slot) { body.appendChild(emptySub()); setTip(); return; }
    if (slot.view === 'layout') { renderLayout(body, slot); setTip(); return; }
    var grid = slot.view === 'grid';
    var box = el('div', grid ? 'tile-grid' : 'row-list');
    body.appendChild(box);
    if (slot.kind === 'category') {
      var tools = T.inCat(slot.id), hiddenCount = 0;
      tools.forEach(function (t) {
        var hidden = S.isHidden(slot.id, t.id);
        if (hidden) hiddenCount++;
        if (hidden && !st.edit && !st.showHidden) return;
        if (grid && !st.edit) box.appendChild(toolTile(t));
        else box.appendChild(toolRow(t, { star: !st.edit, hideToggle: st.edit, hidden: hidden }));
      });
      if (slot.id === 'scripts' && !tools.length) body.appendChild(scriptsEmpty());
      if (hiddenCount && !st.edit) {
        var un = el('button', 'unhide', st.showHidden ? 'Hide ' + hiddenCount + ' tool(s) again' : 'Unhide all (' + hiddenCount + ' hidden)');
        un.addEventListener('click', function () { st.showHidden = !st.showHidden; render(); });
        body.appendChild(un);
      }
    } else {
      var u = S.data.userPanels[slot.id];
      u.items.forEach(function (it, idx) {
        var n = itemNode(it, grid);
        n.addEventListener('contextmenu', function (e) { e.preventDefault(); itemMenu(u.id, it, e); });
        if (st.edit) {
          n.classList.add('editable'); n.draggable = true;
          n.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', String(idx)); n.classList.add('dragging'); });
          n.addEventListener('dragend', function () { n.classList.remove('dragging'); });
          n.addEventListener('dragover', function (e) { e.preventDefault(); n.classList.add('drop'); });
          n.addEventListener('dragleave', function () { n.classList.remove('drop'); });
          n.addEventListener('drop', function (e) {
            e.preventDefault();
            var from = Number(e.dataTransfer.getData('text/plain'));
            if (isNaN(from) || from === idx) return;
            u.items.splice(idx, 0, u.items.splice(from, 1)[0]); S.save(); render();
          });
          var x = svgBtn('del-x', 'Delete', ICONS.close, function () { u.items.splice(idx, 1); S.save(); render(); });
          n.appendChild(x);
        }
        box.appendChild(n);
      });
      var add = el('button', grid ? 'tile add' : 'row-item add', (grid ? '<span class="tile-ico">' : '<span class="ri-ico">') +
        '<svg viewBox="0 0 16 16" class="ico16">' + ICONS.plus + '</svg></span><span class="' + (grid ? 'tile-lbl' : 'ri-name') + '">Add item</span>');
      add.addEventListener('click', function () { addItemDialog(u.id); });
      box.appendChild(add);
    }
    setTip();
  }
  // ============ LAYOUT VIEW (compact grid, inline widgets) ============
  var INLINE = { easyKeyframes: 'easyKeyframesCompact', easings: 'easings', moveAnchor: 'moveAnchor', sequencer: 'sequencerCompact', align: 'align' };
  var DEFAULT_SIZE = { easyKeyframes: [2, 2], easings: [2, 1], moveAnchor: [2, 2], sequencer: [2, 1], align: [2, 2] };
  function cellSize(it) {
    var t = it.type === 'tool' ? T.get(it.tool) : null, d = (t && t.widget && DEFAULT_SIZE[t.widget]) || [1, 1];
    return [it.w || d[0], it.h || d[1]];
  }
  function sizeChips(it) {
    var box = el('div', 'menu-sizes'), cur = cellSize(it);
    [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [4, 2], [4, 3]].forEach(function (sz) {
      var b = el('button', 'size-chip' + (cur[0] === sz[0] && cur[1] === sz[1] ? ' on' : ''), sz[0] + '×' + sz[1]);
      b.addEventListener('click', function () { it.w = sz[0]; it.h = sz[1]; S.save(); U.close(); render(); });
      box.appendChild(b);
    });
    return box;
  }
  function renderLayout(body, slot) {
    var grid = el('div', 'q-grid'), user = slot.kind === 'user', u = user ? S.data.userPanels[slot.id] : null;
    body.appendChild(grid);
    var items = user ? u.items : T.inCat(slot.id).filter(function (t) { return !S.isHidden(slot.id, t.id); })
      .map(function (t) { return { type: 'tool', tool: t.id }; });
    items.forEach(function (it, idx) { grid.appendChild(layoutCell(it, idx, u)); });
    fitLayout(grid);
    if (user) {
      var add = el('button', 'q-cell q-tile q-add', '<svg viewBox="0 0 16 16" class="ico16">' + ICONS.plus + '</svg>');
      add.title = 'Add item';
      add.addEventListener('click', function () { addItemDialog(u.id); });
      grid.appendChild(add);
    } else if (slot.id === 'scripts' && !items.length) body.appendChild(scriptsEmpty());
  }
  // Square cells that exactly fill the panel width; spans wider than the column count are clamped.
  function fitLayout(grid) {
    var apply = function () {
      var W = grid.clientWidth;
      if (!W) return;
      var gap = 3, base = parseFloat(getComputedStyle(document.body).getPropertyValue('--qc')) || 46;
      var cols = Math.max(1, Math.floor((W + gap) / (base + gap)));
      var cell = Math.floor((W - gap * (cols - 1)) / cols);
      grid.style.gridTemplateColumns = 'repeat(' + cols + ', ' + cell + 'px)';
      grid.style.gridAutoRows = cell + 'px';
      Array.prototype.forEach.call(grid.children, function (c) {
        if (!c.dataset.w) return;
        c.style.gridColumn = 'span ' + Math.min(cols, Number(c.dataset.w));
      });
      grid.classList.toggle('q-narrow', cols < 2);
    };
    apply();
    requestAnimationFrame(apply);
    if (window.ResizeObserver) new ResizeObserver(apply).observe(grid);
  }
  function layoutCell(it, idx, u) {
    if (it.type === 'divider') {
      var dv = el('div', 'q-divider');
      if (u) dv.addEventListener('contextmenu', function (e) { e.preventDefault(); itemMenu(u.id, it, e); });
      return dv;
    }
    var t = it.type === 'tool' ? T.get(it.tool) : null, sz = cellSize(it), n;
    if (t && t.widget && INLINE[t.widget]) {
      n = el('div', 'q-cell q-widget wq-' + t.widget);
      n.appendChild(W[INLINE[t.widget]](S.widgetData(t.id), widgetCtx(t)));
      var ex = svgBtn('q-expand', 'Open ' + t.name, ICONS.expand, function () { openWidget(t); });
      n.appendChild(ex);
      hoverTip(n, tipTool(t));
    } else {
      n = el('button', 'q-cell q-tile');
      n.innerHTML = '<span class="tile-ico">' + itemIcon(it) + '</span>' + (sz[0] > 1 ? '<span class="q-lbl">' + esc(itemLabel(it)) + '</span>' : '');
      n.addEventListener('click', function (e) { if (!st.edit) runItem(it, e); });
      hoverTip(n, function () {
        if (t) return tipTool(t);
        return '<b>' + esc(itemLabel(it)) + '</b><span class="tip-desc">' + esc(itemDesc(it)) + '</span>';
      });
    }
    if (t) catStyle(n, t.cat); else n.classList.add('custom');
    n.dataset.w = sz[0];
    n.style.gridColumn = 'span ' + sz[0];
    n.style.gridRow = 'span ' + sz[1];
    if (!u) return n;
    n.addEventListener('contextmenu', function (e) { e.preventDefault(); itemMenu(u.id, it, e); });
    if (st.edit) {
      n.classList.add('editable'); n.draggable = true;
      n.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', String(idx)); n.classList.add('dragging'); });
      n.addEventListener('dragend', function () { n.classList.remove('dragging'); });
      n.addEventListener('dragover', function (e) { e.preventDefault(); n.classList.add('drop'); });
      n.addEventListener('dragleave', function () { n.classList.remove('drop'); });
      n.addEventListener('drop', function (e) {
        e.preventDefault();
        var from = Number(e.dataTransfer.getData('text/plain'));
        if (isNaN(from) || from === idx) return;
        u.items.splice(idx, 0, u.items.splice(from, 1)[0]); S.save(); render();
      });
      n.appendChild(svgBtn('del-x', 'Delete', ICONS.close, function () { u.items.splice(idx, 1); S.save(); render(); }));
      var rs = el('div', 'q-resize'); rs.title = 'Drag to resize';
      rs.addEventListener('mousedown', function (e) {
        e.preventDefault(); e.stopPropagation(); n.draggable = false;
        var unit = n.getBoundingClientRect().width / sz[0], sx = e.clientX, sy = e.clientY, w0 = sz[0], h0 = sz[1];
        var mv = function (ev) {
          it.w = Math.max(1, Math.min(6, w0 + Math.round((ev.clientX - sx) / unit)));
          it.h = Math.max(1, Math.min(4, h0 + Math.round((ev.clientY - sy) / unit)));
          n.style.gridColumn = 'span ' + it.w; n.style.gridRow = 'span ' + it.h;
        };
        var up = function () { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); S.save(); render(); };
        document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
      });
      n.appendChild(rs);
    }
    return n;
  }
  function newQuickPanel() {
    U.prompt('New quick panel', 'Name', 'Quick Panel', function (v) {
      var id = S.newUserPanel(v);
      S.data.userPanels[id].items = S.quickItems();
      S.save();
      var slot = S.findSlot('user', id);
      if (slot) { S.setSlot(slot.ext, 'user', id); S.data.slots[slot.ext].view = 'layout'; S.save(true); openSlot(slot.ext); }
      render();
    });
  }

  function emptySub() {
    var w = el('div', 'sub-empty');
    w.innerHTML = '<div class="se-title">Empty panel</div><div class="muted">Choose what this panel shows, or click the Dock icon in the main panel.</div>';
    var list = el('div', 'se-list');
    T.CATS.forEach(function (c) {
      var b = catStyle(el('button', 'chip', '<span class="chip-ico">' + T.iconSvg('cat-' + c.id) + '</span>' + esc(c.name)), c.id);
      b.addEventListener('click', function () { S.setSlot(B.extId, 'category', c.id); render(); });
      list.appendChild(b);
    });
    S.data.upOrder.forEach(function (id) {
      var b = el('button', 'chip user', '<span class="chip-ico">' + T.iconSvg('user') + '</span>' + esc(S.data.userPanels[id].name));
      b.addEventListener('click', function () { S.setSlot(B.extId, 'user', id); render(); });
      list.appendChild(b);
    });
    w.appendChild(list);
    return w;
  }
  function contentPicker(r) {
    var items = [{ header: 'Tool categories' }];
    T.CATS.forEach(function (c) { items.push({ label: c.name, onClick: function () { st.edit = false; S.setSlot(B.extId, 'category', c.id); render(); } }); });
    items.push({ header: 'User panels' });
    S.data.upOrder.forEach(function (id) { items.push({ label: S.data.userPanels[id].name, onClick: function () { st.edit = false; S.setSlot(B.extId, 'user', id); render(); } }); });
    items.push('-', { label: 'Leave empty', onClick: function () { S.clearSlot(B.extId); render(); } });
    U.menu(r.left, r.bottom + 4, items, { minWidth: 190 });
  }
  function subMenu(e) {
    var r = e.currentTarget.getBoundingClientRect(), slot = S.slot(B.extId), items = [];
    if (slot && slot.kind === 'user') {
      items.push({ label: 'Add item…', onClick: function () { addItemDialog(slot.id); } });
      items.push({ label: 'Rename panel…', onClick: function () {
        var u = S.data.userPanels[slot.id]; U.prompt('Rename', 'Name', u.name, function (v) { u.name = v; S.save(); render(); });
      } });
    }
    items.push({ label: 'Change content…', onClick: function () { contentPicker(r); } });
    items.push({ label: 'Settings…', onClick: openSettings }, { label: 'Reload host scripts', onClick: loadHost }, { label: 'Diagnostics…', onClick: diagnostics });
    U.menu(r.right - 190, r.bottom + 4, items, { minWidth: 190 });
  }

  // ============ settings ============
  function seg(label, value, options, onChange) {
    var f = el('div', 'field inline', '<span>' + esc(label) + '</span>');
    var g = el('div', 'seg');
    options.forEach(function (o) {
      var b = el('button', 'seg-btn' + (value === o[0] ? ' on' : ''), esc(o[1]));
      b.addEventListener('click', function () { g.querySelectorAll('.seg-btn').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); onChange(o[0]); });
      g.appendChild(b);
    });
    f.appendChild(g); return f;
  }
  function openSettings() {
    var th = S.data.theme, form = el('div', 'form settings');
    function toggle(label, key) {
      var f = el('label', 'field inline check', '<span>' + label + '</span>');
      var i = el('input'); i.type = 'checkbox'; i.checked = !!th[key];
      i.addEventListener('change', function () { th[key] = i.checked; S.save(); render(); });
      f.appendChild(i); return f;
    }
    var accent = el('label', 'field inline', '<span>Accent color</span>');
    var ai = el('input'); ai.type = 'color'; ai.value = th.accent;
    ai.addEventListener('input', function () { th.accent = ai.value; applyTheme(); });
    ai.addEventListener('change', function () { S.save(); });
    accent.appendChild(ai);
    var data = el('div', 'row wrap');
    var exp = el('button', 'btn', 'Back up…'), imp = el('button', 'btn', 'Restore…'), rst = el('button', 'btn danger', 'Reset');
    exp.addEventListener('click', exportSettings);
    imp.addEventListener('click', importSettings);
    rst.addEventListener('click', function () {
      U.dialog('Reset?', el('p', null, 'Reset favorites, user panels and settings to defaults?'), [
        { label: 'Cancel' }, { label: 'Reset', danger: true, onClick: function () { S.reset(); render(); } }]);
    });
    data.append(exp, imp, rst);
    form.append(
      el('div', 'sec', 'Appearance'),
      seg('Icon style', th.style, [['mono', 'Mono'], ['color', 'Color'], ['solid', 'Solid']], function (v) { th.style = v; S.save(); render(); }),
      seg('Icon size', th.iconSize, [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']], function (v) { th.iconSize = v; S.save(); render(); }),
      toggle('Show tooltips / help bar', 'tooltips'),
      toggle('Match After Effects background', 'followHost'),
      accent,
      el('div', 'sec', 'Data'), data
    );
    if (S.file) form.appendChild(el('div', 'muted small', 'Settings file: ' + esc(S.file)));
    U.dialog('Settings', form, [{ label: 'Close', primary: true }]);
  }
  function exportSettings() {
    var json = S.exportJSON();
    if (B.fs.available) {
      var p = B.fs.saveDialog('Back up MenMen settings', 'menmen-workflow-backup.json', ['json']);
      if (p) { B.fs.write(p, json); U.toast('Backed up → ' + p, true); }
      return;
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = 'menmen-workflow-backup.json'; a.click();
  }
  function importSettings() {
    function apply(txt) {
      try { S.importJSON(txt); render(); U.toast('Settings restored', true); }
      catch (e) { U.toast('Invalid file: ' + e.message, false); }
    }
    if (B.fs.available) { var p = B.fs.openDialog('Restore MenMen settings', ['json']); if (p) apply(B.fs.read(p)); return; }
    var i = document.createElement('input'); i.type = 'file'; i.accept = '.json';
    i.onchange = function () { var r = new FileReader(); r.onload = function () { apply(r.result); }; r.readAsText(i.files[0]); };
    i.click();
  }
  function about() {
    var box = el('div', 'about');
    box.innerHTML = '<h3>MenMen Workflow</h3><p class="muted">v0.2.0 · ' + T.list.length + ' tools · 12 categories</p>' +
      '<p>The main panel holds every tool; dock a category or user panel to MenMen Panel 1–4.</p><p class="muted small" id="hostInfo">Checking host…</p>';
    U.dialog('About', box, [{ label: 'Close', primary: true }]);
    B.run('hostInfo').then(function (r) { var n = document.getElementById('hostInfo'); if (n) n.textContent = r.msg; });
  }

  // ============ script library ============
  var DEMO_SCRIPTS = [];  // preview mode: no script files
  function loadLibrary(notify) {
    if (!B.inCEP) { T.registerScripts(DEMO_SCRIPTS); render(); return; }
    B.run('listLibrary', { root: B.extPath }).then(function (r) {
      if (!r.ok) return U.toast('Could not list scripts: ' + r.msg, false);
      var list = [];
      try { list = JSON.parse(r.msg || '[]'); } catch (e) { return U.toast('Could not read the script list', false); }
      T.registerScripts(list);
      render();
      if (notify) U.toast(list.length + ' script(s) found', true);
    });
  }
  function scriptButtons() {
    return [
      svgBtn('', 'Refresh scripts', ICONS.refresh, function () { loadLibrary(true); }),
      svgBtn('', 'Open your Scripts folder (Alt: bundled library folder)', ICONS.folder, function (e) {
        exec('openScriptsFolder', { root: B.extPath }, e, 'Scripts');
      })
    ];
  }
  function scriptsEmpty() {
    return el('div', 'empty', 'No scripts yet. Put .jsx, .jsxbin or .ffx files in Documents/MenMen Workflow/Scripts (folder icon above), then click Refresh.');
  }

  // ============ diagnostics ============
  // Checks every step between the panel and After Effects and shows a copyable report.
  function diagnostics() {
    var box = el('div', 'form');
    var ta = el('textarea', 'input code'); ta.rows = 14; ta.readOnly = true; ta.value = 'Running checks…';
    box.appendChild(ta);
    U.dialog('Diagnostics', box, [{ label: 'Copy', onClick: function () { ta.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } U.toast('Copied', true); return false; } },
      { label: 'Close', primary: true }]);
    var lines = [
      'Panel: ' + B.extId,
      'Inside After Effects (CEP): ' + (B.inCEP ? 'yes' : 'NO - preview mode'),
      'Extension path: ' + (B.extPath || '(none)'),
      'Settings file: ' + (S.file || '(none)'),
      'Host load result: ' + (st.hostOk ? 'OK ' : 'FAILED ') + st.hostMsg
    ];
    var checks = [
      ['ExtendScript reachable (1+1)', '1+1'],
      ['After Effects version', 'app.version'],
      ['typeof MMW', 'typeof MMW'],
      ['MMW.load exists', 'typeof MMW !== "undefined" && typeof MMW.load'],
      ['Tools loaded', '(function(){if(typeof MMW==="undefined"||!MMW.tools)return 0;var n=0;for(var k in MMW.tools)n++;return n;})()'],
      ['main.jsx exists', 'new File(' + JSON.stringify((B.extPath || '').replace(/\\/g, '/') + '/host/main.jsx') + ').exists'],
      ['core.jsx exists', 'new File(' + JSON.stringify((B.extPath || '').replace(/\\/g, '/') + '/host/lib/core.jsx') + ').exists'],
      ['Active item', 'app.project.activeItem ? (app.project.activeItem instanceof CompItem ? "comp: " : "item: ") + app.project.activeItem.name : "none"'],
      ['Test tool run (hostInfo)', 'typeof MMW !== "undefined" && MMW.run ? MMW.run("hostInfo",{}) : "MMW.run missing"']
    ];
    var i = 0;
    (function next() {
      if (i >= checks.length) { ta.value = lines.join('\n'); return; }
      var c = checks[i++];
      B.evalScript(c[1]).then(function (r) { lines.push(c[0] + ': ' + r); ta.value = lines.join('\n') + '\n…'; next(); });
    })();
  }

  // ============ host & init ============
  function loadHost() {
    return B.loadHost().then(function (r) {
      st.hostOk = r.ok; st.hostMsg = r.msg;
      if (!r.ok) U.toast('Could not load host: ' + r.msg, false);
      setTip();
      if (r.ok) loadLibrary();
    });
  }
  function render() {
    applyTheme();
    if (B.isMain) renderMain(); else renderSub();
  }
  // Responsive size classes: w-xs (< 130px), w-sm (< 220px), h-sm (< 260px tall).
  function sizeClasses() {
    var w = window.innerWidth, h = window.innerHeight, b = document.body;
    b.classList.toggle('w-xs', w < 130);
    b.classList.toggle('w-sm', w < 220);
    b.classList.toggle('h-sm', h < 260);
  }
  function checkOrientation() {
    sizeClasses();
    var h = B.isMain && window.innerWidth > window.innerHeight * 1.6 && window.innerHeight < 160;
    if (h !== st.horizontal) { st.horizontal = h; applyTheme(); }
  }
  window.addEventListener('resize', checkOrientation);

  S.load();
  S.onExternalChange(render);
  if (B.inCEP) B.on('com.adobe.csxs.events.ThemeColorChanged', applyTheme);
  checkOrientation();
  render();
  loadHost();
  window.MMWApp = { render: render, state: st, dock: dock };
})();

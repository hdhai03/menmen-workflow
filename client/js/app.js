/* app.js - MenMen Workflow UI.
 *  - Main panel (com.menmen.workflow.main): search, favorites, 12 nhóm tool, user panels, thêm item.
 *  - Panel phụ (panel1..4): hiển thị 1 nhóm tool hoặc 1 user panel đã "Dock" từ main panel. */
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

  // ============ chạy tool / item ============
  function mods(e) { return e ? { alt: !!e.altKey, shift: !!e.shiftKey, ctrl: !!(e.ctrlKey || e.metaKey) } : {}; }
  function exec(hostId, opts, e, label) {
    return B.run(hostId, Object.assign(mods(e), opts || {})).then(function (r) {
      U.toast((label ? label + ': ' : '') + (r.msg || (r.ok ? 'Xong' : 'Lỗi')), r.ok);
      return r;
    });
  }
  function runTool(t, e) {
    if (t.widget) return openWidget(t);
    if (t.params && t.params.length) return openParams(t, e);
    return exec(t.host || t.id, t.opts, e, t.name);
  }
  function runItem(it, e) {
    var label = itemLabel(it);
    switch (it.type) {
      case 'tool': { var t = T.get(it.tool); return t ? runTool(t, e) : U.toast('Tool không tồn tại: ' + it.tool, false); }
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
    return { expression: 'Áp expression lên property đang chọn', scriptlet: 'Chạy đoạn ExtendScript', script: it.path,
      preset: it.path, effect: 'Áp effect cho layer đang chọn', command: 'Chạy lệnh menu: ' + it.command }[it.type] || '';
  }

  // ============ tooltip / helptip ============
  var $tip = null;
  function tipTool(t) {
    var h = '<b>' + esc(t.name) + '</b><span class="tip-desc">' + esc(t.desc) + '</span>';
    if (t.mods) Object.keys(t.mods).forEach(function (k) { h += '<span class="tip-mod"><kbd>' + MOD[k] + '</kbd>' + esc(t.mods[k]) + '</span>'; });
    if (t.params) h += '<span class="tip-mod muted">· mở form tham số</span>';
    return h;
  }
  function setTip(html) { if ($tip) $tip.innerHTML = html || defaultTip(); }
  function defaultTip() {
    if (!st.hostOk && B.inCEP) return '<span class="tip-err">Host chưa nạp: ' + esc(st.hostMsg) + '</span>';
    if (!B.inCEP) return '<span class="tip-desc">Chế độ xem trước (ngoài After Effects) – tool chỉ được giả lập</span>';
    return '<span class="tip-desc">Rê chuột lên tool để xem hướng dẫn · Alt / Shift / Ctrl + click để đổi chế độ</span>';
  }
  function hoverTip(node, html) {
    node.addEventListener('mouseenter', function () { setTip(typeof html === 'function' ? html() : html); });
    node.addEventListener('mouseleave', function () { setTip(); });
  }

  // ============ khối dựng dùng chung ============
  function svgBtn(cls, title, path, onClick) {
    var b = el('button', 'icon-btn ' + (cls || ''), '<svg viewBox="0 0 16 16">' + path + '</svg>');
    b.title = title;
    if (onClick) b.addEventListener('click', function (e) { e.stopPropagation(); onClick(e); });
    return b;
  }
  var ICONS = {
    back: '<path d="M10 3L5 8l5 5"/>', close: '<path d="M4 4l8 8M12 4l-8 8"/>',
    dock: '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M2.5 6h11M8 9v3M6.5 10.5L8 12l1.5-1.5"/>',
    menu: '<path d="M3 4.5h10M3 8h10M3 11.5h10"/>', edit: '<path d="M11.3 2.3l2.4 2.4-8.2 8.2H3.1v-2.4z"/>',
    grid: '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>',
    list: '<path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><circle cx="2.8" cy="4" r=".8"/><circle cx="2.8" cy="8" r=".8"/><circle cx="2.8" cy="12" r=".8"/>',
    plus: '<path d="M8 3v10M3 8h10"/>', search: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>',
    eyeOff: '<path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4z"/><path d="M3 13L13 3"/>',
    gear: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>',
    star: '<path d="M8 1.8l1.8 3.8 4.1.5-3 2.8.8 4.1L8 11l-3.7 2 .8-4.1-3-2.8 4.1-.5z"/>'
  };

  // Hàng tool dạng list: icon + tên + chấm phím bổ trợ + nút phụ (sao / ẩn)
  function toolRow(t, extra) {
    extra = extra || {};
    var row = catStyle(el('div', 'row-item' + (extra.hidden ? ' is-hidden' : '')), t.cat);
    row.innerHTML = '<span class="ri-ico">' + T.toolIcon(t) + '</span><span class="ri-name">' + esc(t.name) + '</span>' +
      (t.mods ? '<span class="ri-mods">' + Object.keys(t.mods).map(function (k) { return MOD[k][0]; }).join('') + '</span>' : '') +
      (t.params || t.widget ? '<span class="ri-more">…</span>' : '');
    if (extra.star) {
      var fav = S.isFav(t.id);
      row.appendChild(svgBtn('ri-act star' + (fav ? ' on' : ''), fav ? 'Bỏ khỏi favorites' : 'Thêm vào favorites', ICONS.star, function () {
        S.toggleFav(t.id); render();
      }));
    }
    if (extra.hideToggle) {
      row.appendChild(svgBtn('ri-act hide' + (extra.hidden ? ' on' : ''), extra.hidden ? 'Hiện lại' : 'Ẩn khỏi panel', ICONS.eyeOff, function () {
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
      hint.innerHTML = Object.keys(t.mods).map(function (k) { return '<kbd>' + MOD[k] + '</kbd> ' + esc(t.mods[k]); }).join(' · ') + ' (giữ phím khi bấm Chạy)';
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
    var dlg = U.dialog(t.name, form, [{ label: 'Hủy' }, { label: 'Chạy', primary: true, onClick: function () { go(lastClick); } }]);
    catStyle(dlg, t.cat).classList.add('tool-dialog');
    var lastClick = null;
    dlg.querySelector('.btn.primary').addEventListener('mousedown', function (ev) { lastClick = { altKey: ev.altKey, shiftKey: ev.shiftKey, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey }; });
  }
  function openWidget(t) {
    var data = S.widgetData(t.id);
    var body = el('div', 'widget-host');
    body.appendChild(W[t.widget](data, { run: function (id, o, e) { return exec(id, o, e, t.name); }, save: function () { S.save(); } }));
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
    head.innerHTML = '<span class="logo">M</span><span class="brand">MenMen</span>';
    head.appendChild(svgBtn('m-menu', 'Menu', ICONS.menu, mainMenu));
    root.appendChild(head);
    // search
    var sw = el('label', 'm-search', '<svg viewBox="0 0 16 16">' + ICONS.search + '</svg>');
    var inp = el('input'); inp.placeholder = 'Tìm tool…'; inp.value = st.query; inp.spellcheck = false;
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
      if (!res.children.length) res.appendChild(el('div', 'empty', 'Không tìm thấy “' + esc(st.query) + '”'));
      body.appendChild(res);
      markSel(res.querySelectorAll('.row-item'));
      return;
    }

    // favorites
    var fav = el('section', 'm-fav');
    var favs = S.data.favorites.map(T.get).filter(Boolean);
    if (favs.length) favs.forEach(function (t) { fav.appendChild(toolTile(t, true)); });
    else fav.appendChild(el('div', 'fav-empty', '☆ Bấm ngôi sao cạnh tool để ghim vào đây'));
    body.appendChild(fav);

    // categories
    var cats = el('nav', 'm-list');
    T.CATS.forEach(function (c) {
      var r = catStyle(el('button', 'm-row'), c.id);
      r.innerHTML = '<span class="mr-ico">' + T.iconSvg('cat-' + c.id) + '</span><span class="mr-name">' + esc(c.name) + '</span><span class="mr-count">' + T.inCat(c.id).length + '</span>';
      r.addEventListener('click', function () { openSheet({ kind: 'category', id: c.id }); });
      hoverTip(r, '<b>' + esc(c.name) + '</b><span class="tip-desc">' + T.inCat(c.id).length + ' tool · bấm để mở, bấm Dock để ghim thành panel</span>');
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
      hoverTip(r, '<b>' + esc(u.name) + '</b><span class="tip-desc">User panel · chuột phải để đổi tên / xóa</span>');
      users.appendChild(r);
    });
    var addUp = el('button', 'm-row ghost', '<span class="mr-ico"><svg viewBox="0 0 16 16" class="ico16">' + ICONS.plus + '</svg></span><span class="mr-name">User panel mới</span>');
    addUp.addEventListener('click', newUserPanel);
    users.appendChild(addUp);
    body.appendChild(users);
    body.appendChild(el('div', 'sep'));

    var add = el('button', 'm-row ghost add-item', '<span class="mr-ico"><svg viewBox="0 0 16 16" class="ico16">' + ICONS.plus + '</svg></span><span class="mr-name">Add New Item</span>');
    add.addEventListener('click', function () { addItemDialog(null); });
    body.appendChild(add);
  }

  // Sheet: menu của 1 nhóm / user panel, phủ lên main panel
  function openSheet(sh) {
    st.sheet = sh;
    var old = $app.querySelector('.sheet'); if (old) old.remove();
    var isCat = sh.kind === 'category';
    var c = isCat ? T.cat(sh.id) : null, u = isCat ? null : S.data.userPanels[sh.id];
    if (!c && !u) { st.sheet = null; return; }
    var sheet = el('div', 'sheet');
    if (c) catStyle(sheet, c.id);
    var head = el('header', 'sh-head');
    head.appendChild(svgBtn('', 'Quay lại', ICONS.back, closeSheet));
    head.insertAdjacentHTML('beforeend', '<span class="sh-ico">' + T.iconSvg(c ? 'cat-' + c.id : 'user') + '</span><span class="sh-title">' + esc(c ? c.name : u.name) + '</span>');
    head.appendChild(el('span', 'spacer'));
    if (u) head.appendChild(svgBtn('', 'Thêm item', ICONS.plus, function () { addItemDialog(sh.id); }));
    head.appendChild(svgBtn('', 'Dock thành panel', ICONS.dock, function () { dock(sh.kind, sh.id); }));
    head.appendChild(svgBtn('', 'Đóng', ICONS.close, closeSheet));
    sheet.appendChild(head);
    var list = el('div', 'sh-body');
    if (c) T.inCat(c.id).forEach(function (t) { list.appendChild(toolRow(t, { star: true })); });
    else {
      if (!u.items.length) list.appendChild(el('div', 'empty', 'Chưa có item. Bấm + để thêm script, expression, effect…'));
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
      { label: 'Cài đặt…', onClick: openSettings },
      { label: 'User panel mới…', onClick: newUserPanel },
      { label: 'Add New Item…', onClick: function () { addItemDialog(null); } },
      '-',
      { header: 'Panel phụ' }
    ].concat(S.SLOTS.map(function (ext, i) {
      var name = S.contentName(S.slot(ext));
      return { label: 'Panel ' + (i + 1), hint: name || 'trống', onClick: function () { openSlot(ext); } };
    })).concat(['-',
      { label: 'Backup cài đặt…', onClick: exportSettings },
      { label: 'Khôi phục cài đặt…', onClick: importSettings },
      { label: 'Nạp lại host scripts', onClick: loadHost },
      { label: 'About MenMen Workflow', onClick: about }
    ]), { minWidth: 210 });
  }

  // ============ dock ============
  function openSlot(ext) {
    if (!B.openPanel(ext)) U.toast('(xem trước) mở ' + ext.replace(/^.*\./, ''), true);
  }
  function dock(kind, id) {
    var found = S.findSlot(kind, id);
    var go = function (ext) {
      S.setSlot(ext, kind, id);
      openSlot(ext);
      U.toast('Đã dock vào MenMen Panel ' + ext.slice(-1), true);
    };
    if (found) return go(found.ext);
    // hết slot → hỏi thay panel nào
    U.menu(window.innerWidth / 2 - 100, 60, [{ header: 'Thay nội dung panel nào?' }].concat(S.SLOTS.map(function (ext, i) {
      return { label: 'Panel ' + (i + 1), hint: S.contentName(S.slot(ext)) || '', onClick: function () { go(ext); } };
    })), { minWidth: 200 });
  }

  // ============ user panels & items ============
  function newUserPanel() {
    U.prompt('User panel mới', 'Tên', 'User Panel ' + (S.data.upOrder.length + 1), function (v) {
      var id = S.newUserPanel(v); render();
      if (B.isMain) openSheet({ kind: 'user', id: id });
    });
  }
  function userPanelMenu(id, e) {
    var u = S.data.userPanels[id];
    U.menu(e.clientX, e.clientY, [
      { header: u.name },
      { label: 'Mở', onClick: function () { openSheet({ kind: 'user', id: id }); } },
      { label: 'Dock thành panel', onClick: function () { dock('user', id); } },
      { label: 'Đổi tên…', onClick: function () { U.prompt('Đổi tên', 'Tên', u.name, function (v) { u.name = v; S.save(); render(); }); } },
      '-',
      { label: 'Xóa user panel', danger: true, onClick: function () {
        U.dialog('Xóa "' + u.name + '"?', el('p', null, 'Mọi item trong panel sẽ bị xóa.'), [{ label: 'Hủy' },
          { label: 'Xóa', danger: true, onClick: function () { S.deleteUserPanel(id); closeSheet(); render(); } }]);
      } }
    ]);
  }
  function itemMenu(upId, it, e) {
    var u = S.data.userPanels[upId], idx = u.items.indexOf(it);
    U.menu(e.clientX, e.clientY, [
      { header: itemLabel(it) },
      { label: 'Sửa…', disabled: it.type === 'divider', onClick: function () { itemForm(upId, it.type, it); } },
      { label: 'Lên trên', disabled: idx === 0, onClick: function () { u.items.splice(idx - 1, 0, u.items.splice(idx, 1)[0]); S.save(); render(); } },
      { label: 'Xuống dưới', disabled: idx === u.items.length - 1, onClick: function () { u.items.splice(idx + 1, 0, u.items.splice(idx, 1)[0]); S.save(); render(); } },
      '-',
      { label: 'Xóa', danger: true, onClick: function () { u.items.splice(idx, 1); S.save(); render(); } }
    ]);
  }

  // Bước 1: chọn loại item
  function addItemDialog(upId) {
    if (!S.data.upOrder.length) S.newUserPanel('User Panel 1');
    var wrap = el('div', 'form');
    var target = el('label', 'field', '<span>Thêm vào</span>');
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

  // Bước 2: form theo loại item
  function itemForm(upId, type, existing) {
    var it = existing ? Object.assign({}, existing) : { id: S.uid(), type: type };
    var form = el('div', 'form');
    function field(label, node) { var f = el('label', 'field', '<span>' + esc(label) + '</span>'); f.appendChild(node); form.appendChild(f); return node; }
    var name = el('input', 'input'); name.value = it.label || ''; name.placeholder = 'Tự động';
    var getters = [];
    if (type === 'tool') {
      var picked = it.tool || null;
      var search = el('input', 'input'); search.placeholder = 'Tìm tool…';
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
      getters.push(function () { if (!picked) throw new Error('Chọn một tool'); it.tool = picked; });
    } else if (type === 'expression' || type === 'scriptlet') {
      var ta = el('textarea', 'input code'); ta.rows = 8; ta.spellcheck = false; ta.value = it.code || '';
      ta.placeholder = type === 'expression' ? 'wiggle(2, 30)' : 'app.project.activeItem.layers.addNull();';
      ta.addEventListener('keydown', function (e) { if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); } });
      field(type === 'expression' ? 'Expression' : 'ExtendScript', ta);
      getters.push(function () { if (!ta.value.trim()) throw new Error('Nhập nội dung'); it.code = ta.value; });
    } else if (type === 'script' || type === 'preset') {
      var row = el('div', 'row');
      var pi = el('input', 'input'); pi.value = it.path || ''; pi.placeholder = type === 'preset' ? '/đường/dẫn/preset.ffx' : '/đường/dẫn/script.jsx';
      var br = el('button', 'btn', 'Chọn…');
      br.addEventListener('click', function (e) {
        e.preventDefault();
        var p = B.fs.openDialog(type === 'preset' ? 'Chọn preset' : 'Chọn script', type === 'preset' ? ['ffx'] : ['jsx', 'jsxbin']);
        if (p) pi.value = p; else if (!B.fs.available) U.toast('Hộp thoại chọn file chỉ có trong After Effects', false);
      });
      row.append(pi, br);
      var f = el('div', 'field', '<span>File</span>'); f.appendChild(row); form.appendChild(f);
      getters.push(function () { if (!pi.value.trim()) throw new Error('Chọn file'); it.path = pi.value.trim(); });
    } else if (type === 'effect') {
      var ef = field('Tên effect hoặc matchName (vd: ADBE Gaussian Blur 2)', el('input', 'input'));
      ef.value = it.effect || '';
      getters.push(function () { if (!ef.value.trim()) throw new Error('Nhập effect'); it.effect = ef.value.trim(); });
    } else if (type === 'command') {
      var cm = field('Tên lệnh menu (vd: Pre-compose...) hoặc command ID', el('input', 'input'));
      cm.value = it.command || '';
      getters.push(function () { if (!cm.value.trim()) throw new Error('Nhập lệnh'); it.command = cm.value.trim(); });
    }
    field('Tên hiển thị', name);
    var tyName = T.ITEM_TYPES.filter(function (x) { return x.type === type; })[0].name;
    U.dialog((existing ? 'Sửa ' : 'Thêm ') + tyName, form, [{ label: 'Hủy' }, { label: existing ? 'Lưu' : 'Thêm', primary: true, onClick: function () {
      try { getters.forEach(function (g) { g(); }); } catch (err) { U.toast(err.message, false); return false; }
      it.label = name.value.trim() || undefined;
      var items = S.data.userPanels[upId].items;
      if (existing) items[items.indexOf(existing)] = it; else items.push(it);
      S.save(); render();
      U.toast((existing ? 'Đã lưu ' : 'Đã thêm ') + itemLabel(it), true);
    } }]);
  }

  // ============ PANEL PHỤ ============
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
      head.appendChild(svgBtn('', view === 'list' ? 'Dạng lưới' : 'Dạng danh sách', view === 'list' ? ICONS.grid : ICONS.list, function () {
        slot.view = view === 'list' ? 'grid' : 'list'; S.save(); render();
      }));
      if (slot.kind === 'user') head.appendChild(svgBtn(st.edit ? 'on' : '', 'Chỉnh sửa (kéo để sắp xếp)', ICONS.edit, function () { st.edit = !st.edit; render(); }));
      else head.appendChild(svgBtn(st.edit ? 'on' : '', 'Ẩn / hiện tool', ICONS.eyeOff, function () { st.edit = !st.edit; render(); }));
    }
    head.appendChild(svgBtn('', 'Menu', ICONS.menu, subMenu));
    root.appendChild(head);
    var body = el('div', 'p-body');
    root.appendChild(body);
    $tip = el('footer', 'helptip');
    root.appendChild($tip);
    $app.appendChild(root);

    if (!slot) { body.appendChild(emptySub()); setTip(); return; }
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
      if (hiddenCount && !st.edit) {
        var un = el('button', 'unhide', st.showHidden ? 'Ẩn lại ' + hiddenCount + ' tool' : 'Hiện tất cả (' + hiddenCount + ' đang ẩn)');
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
          var x = svgBtn('del-x', 'Xóa', ICONS.close, function () { u.items.splice(idx, 1); S.save(); render(); });
          n.appendChild(x);
        }
        box.appendChild(n);
      });
      var add = el('button', grid ? 'tile add' : 'row-item add', (grid ? '<span class="tile-ico">' : '<span class="ri-ico">') +
        '<svg viewBox="0 0 16 16" class="ico16">' + ICONS.plus + '</svg></span><span class="' + (grid ? 'tile-lbl' : 'ri-name') + '">Thêm item</span>');
      add.addEventListener('click', function () { addItemDialog(u.id); });
      box.appendChild(add);
    }
    setTip();
  }
  function emptySub() {
    var w = el('div', 'sub-empty');
    w.innerHTML = '<div class="se-title">Panel trống</div><div class="muted">Chọn nội dung cho panel này, hoặc bấm biểu tượng Dock trong main panel.</div>';
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
    var items = [{ header: 'Nhóm tool' }];
    T.CATS.forEach(function (c) { items.push({ label: c.name, onClick: function () { st.edit = false; S.setSlot(B.extId, 'category', c.id); render(); } }); });
    items.push({ header: 'User panels' });
    S.data.upOrder.forEach(function (id) { items.push({ label: S.data.userPanels[id].name, onClick: function () { st.edit = false; S.setSlot(B.extId, 'user', id); render(); } }); });
    items.push('-', { label: 'Để trống', onClick: function () { S.clearSlot(B.extId); render(); } });
    U.menu(r.left, r.bottom + 4, items, { minWidth: 190 });
  }
  function subMenu(e) {
    var r = e.currentTarget.getBoundingClientRect(), slot = S.slot(B.extId), items = [];
    if (slot && slot.kind === 'user') {
      items.push({ label: 'Thêm item…', onClick: function () { addItemDialog(slot.id); } });
      items.push({ label: 'Đổi tên panel…', onClick: function () {
        var u = S.data.userPanels[slot.id]; U.prompt('Đổi tên', 'Tên', u.name, function (v) { u.name = v; S.save(); render(); });
      } });
    }
    items.push({ label: 'Đổi nội dung…', onClick: function () { contentPicker(r); } });
    items.push({ label: 'Cài đặt…', onClick: openSettings }, { label: 'Nạp lại host scripts', onClick: loadHost });
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
    var accent = el('label', 'field inline', '<span>Màu nhấn</span>');
    var ai = el('input'); ai.type = 'color'; ai.value = th.accent;
    ai.addEventListener('input', function () { th.accent = ai.value; applyTheme(); });
    ai.addEventListener('change', function () { S.save(); });
    accent.appendChild(ai);
    var data = el('div', 'row wrap');
    var exp = el('button', 'btn', 'Backup…'), imp = el('button', 'btn', 'Khôi phục…'), rst = el('button', 'btn danger', 'Reset');
    exp.addEventListener('click', exportSettings);
    imp.addEventListener('click', importSettings);
    rst.addEventListener('click', function () {
      U.dialog('Reset?', el('p', null, 'Khôi phục favorites, user panels và cài đặt về mặc định?'), [
        { label: 'Hủy' }, { label: 'Reset', danger: true, onClick: function () { S.reset(); render(); } }]);
    });
    data.append(exp, imp, rst);
    form.append(
      el('div', 'sec', 'Giao diện'),
      seg('Kiểu icon', th.style, [['mono', 'Đơn sắc'], ['color', 'Màu'], ['solid', 'Khối màu']], function (v) { th.style = v; S.save(); render(); }),
      seg('Cỡ icon', th.iconSize, [['s', 'Nhỏ'], ['m', 'Vừa'], ['l', 'Lớn']], function (v) { th.iconSize = v; S.save(); render(); }),
      toggle('Hiện tooltip / helptip', 'tooltips'),
      toggle('Theo màu nền After Effects', 'followHost'),
      accent,
      el('div', 'sec', 'Dữ liệu'), data
    );
    if (S.file) form.appendChild(el('div', 'muted small', 'File cài đặt: ' + esc(S.file)));
    U.dialog('Cài đặt', form, [{ label: 'Đóng', primary: true }]);
  }
  function exportSettings() {
    var json = S.exportJSON();
    if (B.fs.available) {
      var p = B.fs.saveDialog('Backup cài đặt MenMen', 'menmen-workflow-backup.json', ['json']);
      if (p) { B.fs.write(p, json); U.toast('Đã backup → ' + p, true); }
      return;
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = 'menmen-workflow-backup.json'; a.click();
  }
  function importSettings() {
    function apply(txt) {
      try { S.importJSON(txt); render(); U.toast('Đã khôi phục cài đặt', true); }
      catch (e) { U.toast('File không hợp lệ: ' + e.message, false); }
    }
    if (B.fs.available) { var p = B.fs.openDialog('Khôi phục cài đặt MenMen', ['json']); if (p) apply(B.fs.read(p)); return; }
    var i = document.createElement('input'); i.type = 'file'; i.accept = '.json';
    i.onchange = function () { var r = new FileReader(); r.onload = function () { apply(r.result); }; r.readAsText(i.files[0]); };
    i.click();
  }
  function about() {
    var box = el('div', 'about');
    box.innerHTML = '<div class="about-logo">M</div><h3>MenMen Workflow</h3><p class="muted">v0.2.0 · ' + T.list.length + ' tool · 12 nhóm</p>' +
      '<p>Main panel chứa toàn bộ tool; Dock một nhóm hoặc user panel ra MenMen Panel 1–4.</p><p class="muted small" id="hostInfo">Đang kiểm tra host…</p>';
    U.dialog('About', box, [{ label: 'Đóng', primary: true }]);
    B.run('hostInfo').then(function (r) { var n = document.getElementById('hostInfo'); if (n) n.textContent = r.msg; });
  }

  // ============ host & init ============
  function loadHost() {
    return B.loadHost().then(function (r) {
      st.hostOk = r.ok; st.hostMsg = r.msg;
      if (!r.ok) U.toast('Không nạp được host: ' + r.msg, false);
      setTip();
    });
  }
  function render() {
    applyTheme();
    if (B.isMain) renderMain(); else renderSub();
  }
  function checkOrientation() {
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

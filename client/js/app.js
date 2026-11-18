/* app.js - panel chính: lưới tool, layout, edit mode, settings, menu. */
(function () {
  var B = window.Bridge, S = window.Store, T = window.Tools, W = window.Widgets, U = window.UI;
  var el = U.el, esc = U.esc;
  var $grid = document.getElementById('grid');
  var $tip = document.getElementById('helptip');
  var state = { edit: false, dragId: null, hostOk: false, hostMsg: '' };

  // ---------------- theme ----------------
  function hexToRgb(h) {
    var m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [79, 140, 255];
    var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function applyTheme() {
    var t = S.data.theme, r = document.documentElement.style;
    r.setProperty('--cell', t.cellSize + 'px');
    r.setProperty('--gap', t.gap + 'px');
    r.setProperty('--fs', t.fontSize + 'px');
    r.setProperty('--accent', t.accent);
    r.setProperty('--accent-rgb', hexToRgb(t.accent).join(','));
    document.body.classList.toggle('no-labels', !t.showLabels);
    document.body.classList.toggle('no-tips', !t.helptips);
    var env = B.hostEnv();
    if (t.followHost && env && env.appSkinInfo) {
      var c = env.appSkinInfo.panelBackgroundColor.color;
      var lum = (0.299 * c.red + 0.587 * c.green + 0.114 * c.blue) / 255;
      r.setProperty('--bg', 'rgb(' + [c.red, c.green, c.blue].map(Math.round).join(',') + ')');
      document.body.classList.toggle('light', lum > 0.55);
    } else {
      r.removeProperty('--bg');
      document.body.classList.remove('light');
    }
  }

  // ---------------- run tool ----------------
  function mods(e) {
    return e ? { alt: !!e.altKey, shift: !!e.shiftKey, ctrl: !!(e.ctrlKey || e.metaKey) } : {};
  }
  function run(hostId, opts, e, label) {
    var o = Object.assign(mods(e), opts || {});
    return B.run(hostId, o).then(function (r) {
      U.toast((label ? label + ': ' : '') + (r.msg || (r.ok ? 'Xong' : 'Lỗi')), r.ok);
      return r;
    });
  }
  function runCell(c, e) {
    var t = T.get(c.tool); if (!t) return;
    if (t.id === 'customScript') {
      if (!c.data.path) return editCustom(c);
      return run('runFile', { path: c.data.path }, e, c.label || t.name);
    }
    if (t.id === 'customExpression') {
      if (!c.data.code) return editCustom(c);
      return run('applyExpression', { code: c.data.code }, e, c.label || t.name);
    }
    run(t.hostId || t.id, c.data && c.data.opts, e, t.name);
  }

  // ---------------- helptips ----------------
  var MOD_LABEL = { alt: 'Alt', shift: 'Shift', ctrl: 'Ctrl' };
  function tipFor(t, c) {
    var name = (c && c.label) || t.name;
    var html = '<b>' + esc(name) + '</b><span class="tip-desc">' + esc(t.desc) + '</span>';
    if (t.mods) Object.keys(t.mods).forEach(function (k) {
      html += '<span class="tip-mod"><kbd>' + MOD_LABEL[k] + '</kbd>' + esc(t.mods[k]) + '</span>';
    });
    return html;
  }
  function setTip(html) { $tip.innerHTML = html || defaultTip(); }
  function defaultTip() {
    if (!state.hostOk && B.inCEP) return '<span class="tip-err">Host chưa nạp: ' + esc(state.hostMsg) + '</span>';
    if (state.edit) return '<b>Edit mode</b><span class="tip-desc">Kéo ô để sắp xếp · chuột phải để đổi kích thước / xóa · bấm + để thêm tool</span>';
    return '<span class="tip-desc">' + (B.inCEP ? 'Rê chuột lên tool để xem hướng dẫn · chuột phải để thêm tùy chọn'
      : 'Chế độ xem trước (ngoài After Effects) – tool chỉ được giả lập') + '</span>';
  }

  // ---------------- render ----------------
  function render() {
    applyTheme();
    var L = S.layout();
    document.getElementById('layoutName').textContent = L.name;
    document.getElementById('editBtn').classList.toggle('on', state.edit);
    document.body.classList.toggle('editing', state.edit);
    $grid.innerHTML = '';
    L.cells.forEach(function (c) { $grid.appendChild(renderCell(c)); });
    if (state.edit || !L.cells.length) {
      var add = el('button', 'cell add-cell', '<svg viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></svg><span class="lbl">Thêm tool</span>');
      add.addEventListener('click', openLibrary);
      $grid.appendChild(add);
    }
    setTip();
  }

  function renderCell(c) {
    var t = T.get(c.tool);
    var node = el('div', 'cell');
    node.dataset.id = c.id;
    node.style.gridColumn = 'span ' + c.w;
    node.style.gridRow = 'span ' + c.h;
    if (!t) { node.classList.add('missing'); node.textContent = '?' + c.tool; return node; }
    var color = c.color || T.CATS[t.cat].color;
    node.style.setProperty('--cat', color);
    node.style.setProperty('--cat-rgb', hexToRgb(color).join(','));

    if (t.widget && W[t.widget]) {
      node.classList.add('widget');
      if (c.w === 1 && c.h === 1) node.classList.add('tiny');
      var head = el('div', 'w-head', '<span class="w-ico">' + T.icon(t.id) + '</span><span class="w-title">' + esc(c.label || t.name) + '</span>');
      node.appendChild(head);
      node.appendChild(W[t.widget](c, { run: function (id, o, e) { return run(id, o, e, t.name); }, save: function () { S.save(); } }));
    } else {
      node.classList.add('tool');
      if (c.w === 1 && c.h === 1) node.classList.add('small');
      node.innerHTML = '<span class="t-ico">' + T.icon(t.id) + '</span><span class="lbl">' + esc(c.label || t.name) + '</span>' +
        (t.mods ? '<span class="t-mods">' + Object.keys(t.mods).map(function (k) { return MOD_LABEL[k][0]; }).join('') + '</span>' : '');
      node.addEventListener('click', function (e) { if (!state.edit) runCell(c, e); });
    }
    node.addEventListener('mouseenter', function () { if (!state.edit) setTip(tipFor(t, c)); });
    node.addEventListener('mouseleave', function () { setTip(); });
    node.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); cellMenu(c, e); });

    if (state.edit) {
      node.draggable = true;
      node.classList.add('editable');
      var del = el('button', 'cell-x', '<svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg>');
      del.title = 'Xóa';
      del.addEventListener('click', function (e) { e.stopPropagation(); removeCell(c); });
      var rs = el('div', 'cell-resize'); rs.title = 'Kéo để đổi kích thước';
      bindResize(rs, c, node);
      node.append(del, rs);
      node.addEventListener('dragstart', function (e) { state.dragId = c.id; node.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); });
      node.addEventListener('dragend', function () { state.dragId = null; node.classList.remove('dragging'); });
      node.addEventListener('dragover', function (e) { if (state.dragId && state.dragId !== c.id) { e.preventDefault(); node.classList.add('drop'); } });
      node.addEventListener('dragleave', function () { node.classList.remove('drop'); });
      node.addEventListener('drop', function (e) { e.preventDefault(); node.classList.remove('drop'); moveCell(state.dragId, c.id); });
    }
    return node;
  }

  // Kéo góc dưới phải để đổi số cột / hàng của ô.
  function bindResize(handle, c, node) {
    handle.addEventListener('mousedown', function (e) {
      e.preventDefault(); e.stopPropagation();
      node.draggable = false;
      var unit = S.data.theme.cellSize + S.data.theme.gap;
      var sx = e.clientX, sy = e.clientY, w0 = c.w, h0 = c.h;
      function mv(ev) {
        c.w = Math.max(1, Math.min(6, w0 + Math.round((ev.clientX - sx) / unit)));
        c.h = Math.max(1, Math.min(4, h0 + Math.round((ev.clientY - sy) / unit)));
        node.style.gridColumn = 'span ' + c.w; node.style.gridRow = 'span ' + c.h;
      }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); S.save(); render(); }
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
  }

  function moveCell(fromId, toId) {
    var cells = S.layout().cells;
    var fi = cells.findIndex(function (c) { return c.id === fromId; });
    var ti = cells.findIndex(function (c) { return c.id === toId; });
    if (fi < 0 || ti < 0) return;
    var item = cells.splice(fi, 1)[0];
    cells.splice(ti, 0, item);
    S.save(); render();
  }
  function removeCell(c) {
    var L = S.layout();
    L.cells = L.cells.filter(function (x) { return x.id !== c.id; });
    S.save(); render();
  }

  // ---------------- context menus ----------------
  function cellMenu(c, e) {
    var t = T.get(c.tool), items = [{ header: c.label || (t ? t.name : c.tool) }];
    if (t && !t.widget) {
      items.push({ label: 'Chạy', onClick: function () { runCell(c, null); } });
      if (t.mods) Object.keys(t.mods).forEach(function (k) {
        items.push({ label: t.mods[k], hint: MOD_LABEL[k] + '+Click', onClick: function () {
          var fake = { altKey: k === 'alt', shiftKey: k === 'shift', ctrlKey: k === 'ctrl' }; runCell(c, fake);
        } });
      });
      items.push('-');
    }
    if (t && t.user) items.push({ label: 'Sửa nội dung…', onClick: function () { editCustom(c); } });
    items.push({ label: 'Đổi tên hiển thị…', onClick: function () {
      U.prompt('Đổi tên', 'Tên hiển thị', c.label || (t && t.name), function (v) { c.label = v; S.save(); render(); });
    } });
    items.push({ label: 'Đổi màu…', onClick: function () { colorDialog(c); } });
    var sizes = el('div', 'menu-sizes');
    [[1, 1], [2, 1], [3, 1], [2, 2], [3, 2], [4, 2]].forEach(function (s) {
      var b = el('button', 'size-chip' + (c.w === s[0] && c.h === s[1] ? ' on' : ''), s[0] + '×' + s[1]);
      b.addEventListener('click', function () { c.w = s[0]; c.h = s[1]; S.save(); U.close(); render(); });
      sizes.appendChild(b);
    });
    items.push({ header: 'Kích thước' }, { node: sizes }, '-');
    items.push({ label: 'Xóa khỏi layout', danger: true, onClick: function () { removeCell(c); } });
    U.menu(e.clientX, e.clientY, items, { minWidth: 190 });
  }

  document.getElementById('gridWrap').addEventListener('contextmenu', function (e) {
    e.preventDefault();
    U.menu(e.clientX, e.clientY, [
      { label: 'Thêm tool…', onClick: openLibrary },
      { label: state.edit ? 'Thoát Edit mode' : 'Edit mode', onClick: toggleEdit },
      { label: 'Cài đặt…', onClick: openSettings },
      '-',
      { label: 'Nạp lại host scripts', onClick: loadHost }
    ]);
  });

  // ---------------- layout selector ----------------
  document.getElementById('layoutBtn').addEventListener('click', function (e) {
    var r = e.currentTarget.getBoundingClientRect();
    var box = el('div', 'layout-pop');
    var search = el('input', 'input search'); search.placeholder = 'Tìm layout…';
    var list = el('div', 'layout-list');
    box.append(search, list);
    function fill() {
      var q = search.value.trim().toLowerCase(); list.innerHTML = '';
      S.data.order.forEach(function (id) {
        var L = S.data.layouts[id];
        if (q && L.name.toLowerCase().indexOf(q) < 0) return;
        var row = el('div', 'layout-row' + (id === S.panel().layout ? ' active' : ''));
        row.innerHTML = '<span class="lr-name">' + esc(L.name) + '</span><span class="lr-count">' + L.cells.length + '</span>';
        var acts = el('span', 'lr-acts');
        [['Đổi tên', 'M3 13h3l7-7-3-3-7 7z', function () {
          U.prompt('Đổi tên layout', 'Tên', L.name, function (v) { L.name = v; S.save(); render(); });
        }], ['Nhân bản', 'M5 5h8v8H5zM3 3h8', function () { S.setLayout(S.duplicateLayout(id)); render(); }],
        ['Xóa', 'M4 4l8 8M12 4l-8 8', function () {
          if (!S.deleteLayout(id)) return U.toast('Cần giữ ít nhất 1 layout', false);
          S.save(); render();
        }]].forEach(function (a) {
          var b = el('button', 'icon-btn tiny', '<svg viewBox="0 0 16 16"><path d="' + a[1] + '"/></svg>');
          b.title = a[0];
          b.addEventListener('click', function (ev) { ev.stopPropagation(); U.close(); a[2](); });
          acts.appendChild(b);
        });
        row.appendChild(acts);
        row.addEventListener('click', function () { S.setLayout(id); U.close(); render(); });
        list.appendChild(row);
      });
    }
    search.addEventListener('input', fill);
    fill();
    var neu = el('button', 'menu-item', '<span class="mi-label">+ Layout mới</span>');
    neu.addEventListener('click', function () {
      U.prompt('Layout mới', 'Tên layout', 'My Layout', function (v) { S.setLayout(S.newLayout(v)); state.edit = true; render(); });
    });
    U.menu(r.left, r.bottom + 4, [{ node: box }, '-', { node: neu }], { minWidth: 220 });
    setTimeout(function () { search.focus(); }, 20);
  });

  // ---------------- edit mode ----------------
  function toggleEdit() { state.edit = !state.edit; render(); }
  document.getElementById('editBtn').addEventListener('click', toggleEdit);

  // ---------------- tool library ----------------
  function openLibrary() {
    var wrap = el('div', 'lib');
    var search = el('input', 'input search'); search.placeholder = 'Tìm tool…';
    var cats = el('div', 'lib-cats');
    var list = el('div', 'lib-list');
    var cur = 'all';
    function fillCats() {
      cats.innerHTML = '';
      [['all', 'Tất cả', '#888']].concat(Object.keys(T.CATS).map(function (k) { return [k, T.CATS[k].name, T.CATS[k].color]; }))
        .forEach(function (c) {
          var b = el('button', 'chip' + (cur === c[0] ? ' on' : ''), '<i style="background:' + c[2] + '"></i>' + esc(c[1]));
          b.addEventListener('click', function () { cur = c[0]; fillCats(); fill(); });
          cats.appendChild(b);
        });
    }
    function fill() {
      var q = search.value.trim().toLowerCase(); list.innerHTML = '';
      T.list.forEach(function (t) {
        if (cur !== 'all' && t.cat !== cur) return;
        if (q && (t.name + ' ' + t.desc).toLowerCase().indexOf(q) < 0) return;
        var row = el('button', 'lib-row');
        row.style.setProperty('--cat', T.CATS[t.cat].color);
        row.innerHTML = '<span class="t-ico">' + T.icon(t.id) + '</span><span class="lib-text"><b>' + esc(t.name) +
          '</b><small>' + esc(t.desc) + '</small></span><span class="lib-add">+</span>';
        row.addEventListener('click', function () {
          var c = S.newCell(t.id);
          S.layout().cells.push(c); S.save(); render();
          U.toast('Đã thêm ' + t.name, true);
          if (t.user) editCustom(c);
        });
        list.appendChild(row);
      });
      if (!list.children.length) list.appendChild(el('div', 'empty', 'Không có tool phù hợp'));
    }
    search.addEventListener('input', fill);
    wrap.append(search, cats, list);
    fillCats(); fill();
    U.dialog('Thư viện tool', wrap, [{ label: 'Xong', primary: true }]);
  }

  // ---------------- custom script / expression ----------------
  function editCustom(c) {
    var t = T.get(c.tool), form = el('div', 'form');
    var name = el('label', 'field', '<span>Tên hiển thị</span>');
    var ni = el('input', 'input'); ni.value = c.label || ''; ni.placeholder = t.name; name.appendChild(ni);
    form.appendChild(name);
    var getVal;
    if (t.id === 'customScript') {
      var f = el('label', 'field', '<span>File .jsx / .jsxbin / .ffx</span>');
      var row = el('div', 'row');
      var pi = el('input', 'input'); pi.value = c.data.path || ''; pi.placeholder = '/đường/dẫn/script.jsx';
      var br = el('button', 'btn', 'Chọn…');
      br.addEventListener('click', function () {
        var p = B.fs.openDialog('Chọn script hoặc preset', ['jsx', 'jsxbin', 'ffx']);
        if (p) { pi.value = p; if (!ni.value) ni.value = p.split(/[\\/]/).pop().replace(/\.\w+$/, ''); }
        else if (!B.fs.available) U.toast('Hộp thoại chọn file chỉ có trong After Effects', false);
      });
      row.append(pi, br); f.appendChild(row); form.appendChild(f);
      getVal = function () { c.data.path = pi.value.trim(); };
    } else {
      var ex = el('label', 'field', '<span>Expression</span>');
      var ta = el('textarea', 'input code'); ta.value = c.data.code || ''; ta.rows = 8; ta.spellcheck = false;
      ta.placeholder = 'wiggle(2, 30)';
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') { e.preventDefault(); var s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); }
      });
      ex.appendChild(ta); form.appendChild(ex);
      getVal = function () { c.data.code = ta.value; };
    }
    U.dialog(t.name, form, [{ label: 'Hủy' }, { label: 'Lưu', primary: true, onClick: function () {
      getVal(); c.label = ni.value.trim() || undefined; S.save(); render();
    } }]);
  }

  function colorDialog(c) {
    var t = T.get(c.tool), form = el('div', 'form');
    var sw = el('div', 'swatches');
    var palette = ['#7b8cff', '#ff8a4c', '#35c9a0', '#c47dff', '#f2c14e', '#ff5d7a', '#4fc3f7', '#9aa4b2', '#8bd450', '#ff7eb6'];
    palette.forEach(function (p) {
      var b = el('button', 'swatch'); b.style.background = p;
      b.addEventListener('click', function () { c.color = p; S.save(); render(); U.close(); });
      sw.appendChild(b);
    });
    var reset = el('button', 'btn', 'Màu mặc định (' + (t ? T.CATS[t.cat].name : '') + ')');
    reset.addEventListener('click', function () { delete c.color; S.save(); render(); U.close(); });
    form.append(sw, reset);
    U.dialog('Màu ô', form, []);
  }

  // ---------------- settings ----------------
  function openSettings() {
    var th = S.data.theme, form = el('div', 'form settings');
    function rangeField(label, key, min, max, unit) {
      var f = el('label', 'field inline', '<span>' + label + '</span>');
      var i = el('input'); i.type = 'range'; i.min = min; i.max = max; i.value = th[key];
      var v = el('span', 'val', th[key] + unit);
      i.addEventListener('input', function () { th[key] = Number(i.value); v.textContent = i.value + unit; applyTheme(); });
      i.addEventListener('change', function () { S.save(); render(); });
      f.append(i, v); return f;
    }
    function toggleField(label, key) {
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

    form.append(
      el('div', 'sec', 'Giao diện'),
      accent,
      rangeField('Kích thước ô', 'cellSize', 36, 96, 'px'),
      rangeField('Khoảng cách', 'gap', 0, 12, 'px'),
      rangeField('Cỡ chữ', 'fontSize', 9, 14, 'px'),
      toggleField('Hiện tên tool', 'showLabels'),
      toggleField('Thanh hướng dẫn (helptips)', 'helptips'),
      toggleField('Theo màu nền After Effects', 'followHost'),
      el('div', 'sec', 'Dữ liệu')
    );
    var data = el('div', 'row wrap');
    var exp = el('button', 'btn', 'Export…'), imp = el('button', 'btn', 'Import…'), rst = el('button', 'btn danger', 'Reset mặc định');
    exp.addEventListener('click', exportSettings);
    imp.addEventListener('click', importSettings);
    rst.addEventListener('click', function () {
      U.dialog('Reset?', el('p', null, 'Khôi phục toàn bộ layout và cài đặt về mặc định?'), [
        { label: 'Hủy' }, { label: 'Reset', danger: true, onClick: function () { S.reset(); render(); } }]);
    });
    data.append(exp, imp, rst);
    form.appendChild(data);
    if (S.file) form.appendChild(el('div', 'muted small', 'File cài đặt: ' + esc(S.file)));
    U.dialog('Cài đặt', form, [{ label: 'Đóng', primary: true }]);
  }
  document.getElementById('settingsBtn').addEventListener('click', openSettings);

  function exportSettings() {
    var json = S.exportJSON();
    if (B.fs.available) {
      var p = B.fs.saveDialog('Export cài đặt MenMen', 'menmen-workflow-settings.json', ['json']);
      if (p) { B.fs.write(p, json); U.toast('Đã export → ' + p, true); }
      return;
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = 'menmen-workflow-settings.json'; a.click();
  }
  function importSettings() {
    function apply(txt) {
      try { S.importJSON(txt); render(); U.toast('Đã import cài đặt', true); }
      catch (e) { U.toast('File không hợp lệ: ' + e.message, false); }
    }
    if (B.fs.available) {
      var p = B.fs.openDialog('Import cài đặt MenMen', ['json']);
      if (p) apply(B.fs.read(p));
      return;
    }
    var i = document.createElement('input'); i.type = 'file'; i.accept = '.json';
    i.onchange = function () { var r = new FileReader(); r.onload = function () { apply(r.result); }; r.readAsText(i.files[0]); };
    i.click();
  }

  // ---------------- hamburger ----------------
  document.getElementById('menuBtn').addEventListener('click', function (e) {
    var r = e.currentTarget.getBoundingClientRect();
    U.menu(r.right - 200, r.bottom + 4, [
      { label: 'Thêm tool…', onClick: openLibrary },
      { label: 'Export cài đặt…', onClick: exportSettings },
      { label: 'Import cài đặt…', onClick: importSettings },
      { label: 'Nạp lại host scripts', onClick: loadHost },
      '-',
      { label: 'About MenMen Workflow', onClick: about }
    ], { minWidth: 200 });
  });

  function about() {
    var box = el('div', 'about');
    box.innerHTML = '<div class="about-logo">M</div><h3>MenMen Workflow</h3><p class="muted">v0.1.0 · Panel ' + esc(B.panelNo) +
      '</p><p>Bộ công cụ tăng tốc workflow cho After Effects: script, widget và expression trong các panel dạng lưới.</p>' +
      '<p class="muted small" id="hostInfo">Đang kiểm tra host…</p>';
    U.dialog('About', box, [{ label: 'Đóng', primary: true }]);
    B.run('hostInfo').then(function (r) { var n = document.getElementById('hostInfo'); if (n) n.textContent = r.msg; });
  }

  // ---------------- host ----------------
  function loadHost() {
    return B.loadHost().then(function (r) {
      state.hostOk = r.ok; state.hostMsg = r.msg;
      if (!r.ok) U.toast('Không nạp được host: ' + r.msg, false);
      else if (B.inCEP) U.toast('Host sẵn sàng · v' + r.msg, true);
      setTip();
    });
  }

  // ---------------- init ----------------
  S.load();
  S.onExternalChange(render);
  if (B.inCEP) B.on('com.adobe.csxs.events.ThemeColorChanged', applyTheme);
  render();
  loadHost();
  window.MMWApp = { render: render, state: state };
})();

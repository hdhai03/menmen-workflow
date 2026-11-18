/* ui.js - các thành phần UI dùng chung: popover menu, modal dialog, toast. */
(function () {
  var overlay = document.getElementById('overlay');

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function closeAll() { overlay.innerHTML = ''; overlay.className = ''; }
  overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) closeAll(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });

  // Menu nổi: items = [{label, hint, danger, disabled, onClick} | '-' | {header}]
  function menu(x, y, items, opts) {
    closeAll();
    overlay.className = 'show clear';
    var m = el('div', 'menu');
    if (opts && opts.minWidth) m.style.minWidth = opts.minWidth + 'px';
    items.forEach(function (it) {
      if (it === '-') { m.appendChild(el('div', 'menu-sep')); return; }
      if (it.header) { m.appendChild(el('div', 'menu-header', esc(it.header))); return; }
      if (it.node) { m.appendChild(it.node); return; }
      var row = el('button', 'menu-item' + (it.danger ? ' danger' : '') + (it.active ? ' active' : ''));
      row.disabled = !!it.disabled;
      row.innerHTML = '<span class="mi-label">' + esc(it.label) + '</span>' + (it.hint ? '<span class="mi-hint">' + esc(it.hint) + '</span>' : '');
      row.addEventListener('click', function (e) { closeAll(); it.onClick && it.onClick(e); });
      m.appendChild(row);
    });
    overlay.appendChild(m);
    var r = m.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;
    m.style.left = Math.max(4, Math.min(x, vw - r.width - 4)) + 'px';
    m.style.top = Math.max(4, Math.min(y, vh - r.height - 4)) + 'px';
    return m;
  }

  // Hộp thoại: body là HTMLElement, buttons = [{label, primary, danger, onClick -> false để giữ mở}]
  function dialog(title, body, buttons) {
    closeAll();
    overlay.className = 'show';
    var d = el('div', 'dialog');
    var h = el('div', 'dlg-head', '<span>' + esc(title) + '</span>');
    var x = el('button', 'icon-btn dlg-x', '<svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg>');
    x.addEventListener('click', closeAll);
    h.appendChild(x);
    var b = el('div', 'dlg-body'); b.appendChild(body);
    d.append(h, b);
    if (buttons && buttons.length) {
      var f = el('div', 'dlg-foot');
      buttons.forEach(function (bt) {
        var btn = el('button', 'btn' + (bt.primary ? ' primary' : '') + (bt.danger ? ' danger' : ''), esc(bt.label));
        btn.addEventListener('click', function () { if (!bt.onClick || bt.onClick() !== false) closeAll(); });
        f.appendChild(btn);
      });
      d.appendChild(f);
    }
    overlay.appendChild(d);
    var first = d.querySelector('input, textarea, select');
    if (first) setTimeout(function () { first.focus(); }, 30);
    return d;
  }

  function prompt(title, label, value, onOk) {
    var wrap = el('div', 'form');
    var lab = el('label', 'field', '<span>' + esc(label) + '</span>');
    var inp = el('input', 'input'); inp.value = value || '';
    lab.appendChild(inp); wrap.appendChild(lab);
    var ok = function () { var v = inp.value.trim(); if (v) onOk(v); };
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { ok(); closeAll(); } });
    dialog(title, wrap, [{ label: 'Hủy' }, { label: 'OK', primary: true, onClick: ok }]);
  }

  var toastEl = document.getElementById('toast'), toastTimer = null;
  function toast(msg, ok) {
    toastEl.textContent = msg;
    toastEl.className = 'toast show ' + (ok === false ? 'err' : 'ok');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'toast'; }, ok === false ? 5000 : 2200);
  }

  window.UI = { el: el, esc: esc, menu: menu, dialog: dialog, prompt: prompt, toast: toast, close: closeAll };
})();

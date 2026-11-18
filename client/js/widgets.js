/* widgets.js - các tool có giao diện riêng bên trong ô lưới.
 * Mỗi widget: function(cell, ctx) -> HTMLElement. ctx.run(hostId, opts, event), ctx.save(), ctx.tip(text) */
(function () {
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function stop(e) { e.stopPropagation(); }

  var W = {};

  // ---------- Easy Keyframes ----------
  W.easyKeyframes = function (cell, ctx) {
    var d = cell.data;
    if (d.inInf == null) d.inInf = 70;
    if (d.outInf == null) d.outInf = 70;
    var root = el('div', 'w w-easy');
    var curve = el('div', 'w-curve');
    var sliders = el('div', 'w-sliders');

    function draw() {
      var x1 = d.outInf / 100, x2 = 1 - d.inInf / 100;
      curve.innerHTML = '<svg viewBox="0 0 100 60" preserveAspectRatio="none">' +
        '<path class="grid-l" d="M0 59.5H100M0 .5H100"/>' +
        '<path class="handle" d="M2 58L' + (2 + x1 * 96) + ' 58M98 2L' + (2 + x2 * 96) + ' 2"/>' +
        '<path class="curve" d="M2 58C' + (2 + x1 * 96) + ' 58 ' + (2 + x2 * 96) + ' 2 98 2"/>' +
        '<circle cx="' + (2 + x1 * 96) + '" cy="58" r="2.6"/><circle cx="' + (2 + x2 * 96) + '" cy="2" r="2.6"/></svg>';
    }
    function slider(label, key) {
      var row = el('label', 'w-slider');
      var name = el('span', 'w-lbl', label);
      var input = el('input'); input.type = 'range'; input.min = 1; input.max = 100; input.value = d[key];
      var val = el('span', 'w-val', Math.round(d[key]) + '%');
      input.addEventListener('input', function () { d[key] = Number(input.value); val.textContent = input.value + '%'; draw(); });
      input.addEventListener('change', function () { ctx.save(); });
      row.append(name, input, val);
      return row;
    }
    sliders.append(slider('Out', 'outInf'), slider('In', 'inInf'));

    var btns = el('div', 'w-btns');
    [['ease', 'Ease'], ['in', 'In'], ['out', 'Out'], ['linear', 'Lin'], ['hold', 'Hold']].forEach(function (b) {
      var x = el('button', 'w-btn', b[1]);
      x.title = { ease: 'Ease cả 2 phía', in: 'Chỉ ease vào', out: 'Chỉ ease ra', linear: 'Linear', hold: 'Hold' }[b[0]];
      x.addEventListener('click', function (e) {
        stop(e);
        ctx.run('easyKeyframes', { mode: b[0], inInf: d.inInf, outInf: d.outInf }, e);
      });
      btns.appendChild(x);
    });
    var top = el('div', 'w-easy-top');
    top.append(curve, sliders);
    root.append(top, btns);
    draw();
    return root;
  };

  // ---------- Easings Manager ----------
  W.easings = function (cell, ctx) {
    var root = el('div', 'w w-row');
    var c = el('button', 'w-btn w-big', '<span>Copy</span>');
    var p = el('button', 'w-btn w-big w-accent', '<span>Paste</span>');
    c.addEventListener('click', function (e) { stop(e); ctx.run('easingsCopy', {}, e); });
    p.addEventListener('click', function (e) { stop(e); ctx.run('easingsPaste', {}, e); });
    root.append(c, p);
    return root;
  };

  // ---------- Sequencer ----------
  W.sequencer = function (cell, ctx) {
    var d = cell.data;
    if (d.step == null) d.step = 2;
    if (!d.order) d.order = 'down';
    var root = el('div', 'w w-row w-seq');
    var num = el('input', 'w-num'); num.type = 'number'; num.min = 0; num.step = 1; num.value = d.step;
    num.title = 'Số frame giữa các phần tử';
    num.addEventListener('click', stop);
    num.addEventListener('change', function () { d.step = Math.max(0, Number(num.value) || 0); ctx.save(); });
    var seg = el('div', 'w-seg');
    [['down', '↓', 'Từ trên xuống'], ['up', '↑', 'Từ dưới lên'], ['random', '⤨', 'Ngẫu nhiên']].forEach(function (o) {
      var b = el('button', 'w-segbtn' + (d.order === o[0] ? ' on' : ''), o[1]);
      b.title = o[2];
      b.addEventListener('click', function (e) {
        stop(e); d.order = o[0]; ctx.save();
        seg.querySelectorAll('.w-segbtn').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      });
      seg.appendChild(b);
    });
    var go = el('button', 'w-btn w-accent', '▶');
    go.title = 'Sequence';
    go.addEventListener('click', function (e) { stop(e); ctx.run('sequencer', { step: d.step, order: d.order }, e); });
    var f = el('span', 'w-unit', 'f');
    root.append(num, f, seg, go);
    return root;
  };

  // ---------- Move Anchor ----------
  W.moveAnchor = function (cell, ctx) {
    var root = el('div', 'w w-anchor');
    for (var y = 0; y < 3; y++) {
      for (var x = 0; x < 3; x++) {
        (function (fx, fy) {
          var b = el('button', 'w-dot' + (fx === 0.5 && fy === 0.5 ? ' center' : ''));
          b.title = 'Anchor → ' + ['trái', 'giữa', 'phải'][fx * 2] + ' / ' + ['trên', 'giữa', 'dưới'][fy * 2];
          b.addEventListener('click', function (e) { stop(e); ctx.run('moveAnchor', { x: fx, y: fy }, e); });
          root.appendChild(b);
        })(x / 2, y / 2);
      }
    }
    return root;
  };

  window.Widgets = W;
})();

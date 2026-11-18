/* widgets.js - các tool có giao diện riêng bên trong ô lưới.
 * Mỗi widget: function(data, ctx) -> HTMLElement. data = object lưu trạng thái (được lưu lại), ctx.run(hostId, opts, event), ctx.save() */
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
  W.easyKeyframes = function (d, ctx) {
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
  W.easings = function (d, ctx) {
    var root = el('div', 'w w-row');
    var c = el('button', 'w-btn w-big', '<span>Copy</span>');
    var p = el('button', 'w-btn w-big w-accent', '<span>Paste</span>');
    c.addEventListener('click', function (e) { stop(e); ctx.run('easingsCopy', {}, e); });
    p.addEventListener('click', function (e) { stop(e); ctx.run('easingsPaste', {}, e); });
    root.append(c, p);
    return root;
  };

  // ---------- Sequencer ----------
  W.sequencer = function (d, ctx) {
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
  W.moveAnchor = function (d, ctx) {
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

  // ---------- Easing Presets ----------
  var FAMS = ['sine', 'quad', 'cubic', 'quart', 'quint', 'expo', 'circ', 'back'];
  var BZ = {
    sineIn: [0.12, 0, 0.39, 0], sineOut: [0.61, 1, 0.88, 1], sineInOut: [0.37, 0, 0.63, 1],
    quadIn: [0.11, 0, 0.5, 0], quadOut: [0.5, 1, 0.89, 1], quadInOut: [0.45, 0, 0.55, 1],
    cubicIn: [0.32, 0, 0.67, 0], cubicOut: [0.33, 1, 0.68, 1], cubicInOut: [0.65, 0, 0.35, 1],
    quartIn: [0.5, 0, 0.75, 0], quartOut: [0.25, 1, 0.5, 1], quartInOut: [0.76, 0, 0.24, 1],
    quintIn: [0.64, 0, 0.78, 0], quintOut: [0.22, 1, 0.36, 1], quintInOut: [0.83, 0, 0.17, 1],
    expoIn: [0.7, 0, 0.84, 0], expoOut: [0.16, 1, 0.3, 1], expoInOut: [0.87, 0, 0.13, 1],
    circIn: [0.55, 0, 1, 0.45], circOut: [0, 0.55, 0.45, 1], circInOut: [0.85, 0, 0.15, 1],
    backIn: [0.36, 0, 0.66, -0.56], backOut: [0.34, 1.56, 0.64, 1], backInOut: [0.68, -0.6, 0.32, 1.6]
  };
  function thumb(b) {
    var y = function (v) { return 34 - v * 26; };
    return '<svg viewBox="0 0 40 40"><path class="grid-l" d="M4 34H36M4 8H36"/>' +
      '<path class="curve" d="M4 ' + y(0) + 'C' + (4 + b[0] * 32) + ' ' + y(b[1]) + ' ' + (4 + b[2] * 32) + ' ' + y(b[3]) + ' 36 ' + y(1) + '"/></svg>';
  }
  W.easingPresets = function (d, ctx) {
    var root = el('div', 'w w-presets');
    var head = el('div', 'w-pre-row w-pre-head', '<span></span><span>In</span><span>Out</span><span>In-Out</span>');
    root.appendChild(head);
    FAMS.forEach(function (f) {
      var row = el('div', 'w-pre-row');
      row.appendChild(el('span', 'w-pre-name', f.charAt(0).toUpperCase() + f.slice(1)));
      ['In', 'Out', 'InOut'].forEach(function (k) {
        var id = f + k, b = el('button', 'w-pre' + (d.last === id ? ' on' : ''), thumb(BZ[id]));
        b.title = f + ' ' + k;
        b.addEventListener('click', function (e) {
          stop(e); d.last = id; ctx.save();
          root.querySelectorAll('.w-pre').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          ctx.run('easingPreset', { curve: id }, e);
        });
        row.appendChild(b);
      });
      root.appendChild(row);
    });
    return root;
  };

  window.Widgets = W;
})();

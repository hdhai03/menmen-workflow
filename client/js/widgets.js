/* widgets.js - tools with their own UI (shown in a dialog).
 * Each widget: function(data, ctx) -> HTMLElement. data = persisted state object, ctx.run(hostId, opts, event), ctx.save() */
(function () {
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function stop(e) { e.stopPropagation(); }

  var W = {};

  // ---------- Speed graph helpers ----------
  // Value curve = cubic bezier P0(0,0) P1(x1,y1) P2(x2,y2) P3(1,1).
  // Speed (relative to the segment average) = y'(t) / x'(t).
  function speedSamples(x1, y1, x2, y2, n) {
    var out = [];
    n = n || 120;
    for (var i = 0; i <= n; i++) {
      var t = i / n, u = 1 - t;
      var x = 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t;
      var dx = 3 * u * u * x1 + 6 * u * t * (x2 - x1) + 3 * t * t * (1 - x2);
      var dy = 3 * u * u * y1 + 6 * u * t * (y2 - y1) + 3 * t * t * (1 - y2);
      var v = dx > 1e-6 ? dy / dx : (dy >= 0 ? 50 : -50);
      out.push([x, Math.max(-50, Math.min(50, v))]);
    }
    return out;
  }
  function speedRange(samples, extra) {
    var lo = 0, hi = 1;
    samples.forEach(function (p) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); });
    (extra || []).forEach(function (v) { hi = Math.max(hi, v); });
    hi = Math.min(hi, 12);
    return { lo: lo, hi: hi * 1.12 + 0.05 };
  }
  // Path through the samples, clamped to the visible speed range.
  function pathOf(samples, map, range) {
    return samples.map(function (p, i) {
      var v = range ? Math.max(range.lo, Math.min(range.hi, p[1])) : p[1];
      var q = map(p[0], v); return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
    }).join('');
  }

  // ---------- Keyframe Assistant (speed graph editor) ----------
  W.easyKeyframes = function (d, ctx) {
    if (d.inInf == null) d.inInf = 70;
    if (d.outInf == null) d.outInf = 70;
    if (d.inSpeed == null) d.inSpeed = 0;
    if (d.outSpeed == null) d.outSpeed = 0;
    var root = el('div', 'w w-easy');
    var box = el('div', 'w-speed');
    var read = el('div', 'w-read');
    var PAD = 10, range = null, drag = null, W_ = 300, H_ = 160;

    function bez() {
      var xo = d.outInf / 100, xi = d.inInf / 100;
      return [xo, xo * d.outSpeed, 1 - xi, 1 - xi * d.inSpeed];
    }
    function map(x, v) {
      return [PAD + x * (W_ - 2 * PAD), H_ - PAD - (v - range.lo) / (range.hi - range.lo) * (H_ - 2 * PAD)];
    }
    function unmap(px, py) {
      return [(px - PAD) / (W_ - 2 * PAD), range.lo + (H_ - PAD - py) / (H_ - 2 * PAD) * (range.hi - range.lo)];
    }
    function draw() {
      var r = box.getBoundingClientRect();
      W_ = Math.max(120, Math.round(r.width) || 300); H_ = Math.max(80, Math.round(r.height) || 160);
      var b = bez(), smp = speedSamples(b[0], b[1], b[2], b[3]);
      if (!drag) range = speedRange(smp, [d.outSpeed, d.inSpeed]);
      var base = map(0, 0), avg = map(0, 1);
      var ko = map(d.outInf / 100, d.outSpeed), ki = map(1 - d.inInf / 100, d.inSpeed);
      var so = map(0, d.outSpeed), si = map(1, d.inSpeed);
      box.innerHTML = '<svg width="' + W_ + '" height="' + H_ + '" viewBox="0 0 ' + W_ + ' ' + H_ + '">' +
        '<path class="sg-grid" d="M0 ' + base[1] + 'H' + W_ + '"/>' +
        '<path class="sg-avg" d="M0 ' + avg[1] + 'H' + W_ + '"/>' +
        '<path class="sg-curve" d="' + pathOf(smp, map, range) + '"/>' +
        '<path class="sg-handle" d="M' + so[0] + ' ' + so[1] + 'L' + ko[0] + ' ' + ko[1] + 'M' + si[0] + ' ' + si[1] + 'L' + ki[0] + ' ' + ki[1] + '"/>' +
        '<rect class="sg-knob" x="' + (ko[0] - 4) + '" y="' + (ko[1] - 4) + '" width="8" height="8"/>' +
        '<rect class="sg-knob" x="' + (ki[0] - 4) + '" y="' + (ki[1] - 4) + '" width="8" height="8"/>' +
        '</svg>';
      read.innerHTML = '<span>Out <b>' + Math.round(d.outInf) + '%</b> · ' + d.outSpeed.toFixed(2) + '×</span>' +
        '<span>In <b>' + Math.round(d.inInf) + '%</b> · ' + d.inSpeed.toFixed(2) + '×</span>';
    }
    function local(e) { var r = box.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    box.addEventListener('mousedown', function (e) {
      e.preventDefault();
      var p = local(e);
      var ko = map(d.outInf / 100, d.outSpeed), ki = map(1 - d.inInf / 100, d.inSpeed);
      var dOut = Math.hypot(p[0] - ko[0], p[1] - ko[1]), dIn = Math.hypot(p[0] - ki[0], p[1] - ki[1]);
      drag = dOut <= dIn ? 'out' : 'in';
      var mv = function (ev) {
        var q = unmap.apply(null, local(ev));
        var spd = ev.shiftKey ? (drag === 'out' ? d.outSpeed : d.inSpeed) : Math.max(0, q[1]);
        if (spd < (range.hi - range.lo) * 0.04) spd = 0;            // snap to full ease
        if (drag === 'out') { d.outInf = Math.max(0.1, Math.min(100, q[0] * 100)); d.outSpeed = spd; }
        else { d.inInf = Math.max(0.1, Math.min(100, (1 - q[0]) * 100)); d.inSpeed = spd; }
        draw();
      };
      var up = function () {
        document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
        drag = null; draw(); ctx.save();
      };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
      mv(e);
    });
    box.addEventListener('dblclick', function () {
      d.outInf = d.inInf = 33.33; d.outSpeed = d.inSpeed = 0; draw(); ctx.save();
    });
    box.title = 'Drag a handle: left/right = influence, up/down = speed. Shift = influence only. Double-click to reset.';

    var btns = el('div', 'w-btns');
    [['ease', 'Apply'], ['in', 'In only'], ['out', 'Out only'], ['linear', 'Linear'], ['hold', 'Hold']].forEach(function (b) {
      var x = el('button', 'w-btn' + (b[0] === 'ease' ? ' w-primary' : ''), b[1]);
      x.title = { ease: 'Apply both handles to the selected keys', in: 'Apply only the incoming (right) handle', out: 'Apply only the outgoing (left) handle', linear: 'Linear', hold: 'Hold' }[b[0]];
      x.addEventListener('click', function (e) {
        stop(e);
        ctx.run('easyKeyframes', { mode: b[0], inInf: d.inInf, outInf: d.outInf, inSpeed: d.inSpeed, outSpeed: d.outSpeed }, e);
      });
      btns.appendChild(x);
    });
    root.append(box, read, btns);
    draw();
    requestAnimationFrame(draw);
    if (window.ResizeObserver) new ResizeObserver(function () { if (!drag) draw(); }).observe(box);
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
    num.title = 'Frames between items';
    num.addEventListener('click', stop);
    num.addEventListener('change', function () { d.step = Math.max(0, Number(num.value) || 0); ctx.save(); });
    var seg = el('div', 'w-seg');
    [['down', '↓', 'Top to bottom'], ['up', '↑', 'Bottom to top'], ['random', '⤨', 'Random']].forEach(function (o) {
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
          b.title = 'Anchor → ' + ['left', 'center', 'right'][fx * 2] + ' / ' + ['top', 'middle', 'bottom'][fy * 2];
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
    var smp = speedSamples(b[0], b[1], b[2], b[3], 48), r = speedRange(smp);
    var map = function (x, v) { return [3 + x * 54, 27 - (v - r.lo) / (r.hi - r.lo) * 24]; };
    var z = map(0, 0)[1];
    return '<svg viewBox="0 0 60 30" preserveAspectRatio="none"><path class="grid-l" d="M0 ' + z + 'H60"/><path class="curve" d="' + pathOf(smp, map, r) + '"/></svg>';
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

  // ---------- Compact versions for Layout panels ----------
  var MINI = {
    ease: '<path d="M2 13C8 13 8 3 14 3"/>',
    linear: '<path d="M2 13L14 3"/>',
    hold: '<path d="M2 13H8V3h6"/>'
  };
  W.easyKeyframesCompact = function (d, ctx) {
    if (d.inInf == null) d.inInf = 70;
    if (d.outInf == null) d.outInf = 70;
    if (d.inSpeed == null) d.inSpeed = 0;
    if (d.outSpeed == null) d.outSpeed = 0;
    var root = el('div', 'w wc-easy');
    function slider(label, key, tip) {
      var row = el('label', 'wc-slider');
      row.title = tip;
      var input = el('input'); input.type = 'range'; input.min = 1; input.max = 100; input.value = d[key];
      var val = el('span', 'wc-val', String(Math.round(d[key])));
      input.addEventListener('input', function () { d[key] = Number(input.value); val.textContent = input.value; });
      input.addEventListener('change', function () { ctx.save(); });
      row.append(el('span', 'wc-lbl', label), input, val);
      return row;
    }
    root.append(slider('Out', 'outInf', 'Outgoing influence %'), slider('In', 'inInf', 'Incoming influence %'));
    var btns = el('div', 'wc-btns');
    [['ease', 'Ease (Alt: in only, Shift: out only)'], ['linear', 'Linear'], ['hold', 'Hold']].forEach(function (b) {
      var x = el('button', 'w-btn wc-ico' + (b[0] === 'ease' ? ' w-primary' : ''), '<svg viewBox="0 0 16 16">' + MINI[b[0]] + '</svg>');
      x.title = b[1];
      x.addEventListener('click', function (e) {
        stop(e);
        var mode = b[0] === 'ease' ? (e.altKey ? 'in' : (e.shiftKey ? 'out' : 'ease')) : b[0];
        ctx.run('easyKeyframes', { mode: mode, inInf: d.inInf, outInf: d.outInf, inSpeed: d.inSpeed, outSpeed: d.outSpeed, alt: false, shift: false }, e);
      });
      btns.appendChild(x);
    });
    root.appendChild(btns);
    return root;
  };
  W.sequencerCompact = function (d, ctx) {
    if (d.step == null) d.step = 2;
    if (!d.order) d.order = 'down';
    var ORD = { down: ['↓', 'Top to bottom'], up: ['↑', 'Bottom to top'], random: ['⤨', 'Random'] }, NEXT = { down: 'up', up: 'random', random: 'down' };
    var root = el('div', 'w wc-seq');
    var num = el('input', 'w-num'); num.type = 'number'; num.min = 0; num.value = d.step; num.title = 'Frames between items';
    num.addEventListener('click', stop);
    num.addEventListener('change', function () { d.step = Math.max(0, Number(num.value) || 0); ctx.save(); });
    var ord = el('button', 'w-btn wc-ord', ORD[d.order][0]); ord.title = ORD[d.order][1] + ' (click to change)';
    ord.addEventListener('click', function (e) { stop(e); d.order = NEXT[d.order]; ord.textContent = ORD[d.order][0]; ord.title = ORD[d.order][1]; ctx.save(); });
    var go = el('button', 'w-btn w-primary', '▶'); go.title = 'Offset layers / keys';
    go.addEventListener('click', function (e) { stop(e); ctx.run('sequencer', { step: d.step, order: d.order }, e); });
    root.append(num, ord, go);
    return root;
  };

  window.Widgets = W;
})();

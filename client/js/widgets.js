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

  // ---------- Graph Editor (value graph + speed graph, shared curve) ----------
  // The curve is stored as a cubic-bezier value graph d.bz = [x1, y1, x2, y2] between two keys:
  // outgoing handle P1 (influence = x1, speed = y1/x1 × average) and incoming handle P2.
  var BUILTIN_CURVES = [
    ['Easy Ease', [0.333, 0, 0.667, 1]], ['In', [0.42, 0, 1, 1]], ['Out', [0, 0, 0.58, 1]],
    ['Strong In-Out', [0.8, 0, 0.2, 1]], ['Strong In', [0.7, 0, 0.84, 0]], ['Strong Out', [0.16, 1, 0.3, 1]],
    ['Back In-Out', [0.68, -0.6, 0.32, 1.6]], ['Back Out', [0.34, 1.56, 0.64, 1]], ['Linear', [0.333, 0.333, 0.667, 0.667]]
  ];
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function initCurve(d) {
    if (d.auto == null) d.auto = true;  // apply on release is the default
    if (!d.bz) {
      if (d.outInf != null) {
        var xo = d.outInf / 100, xi = d.inInf / 100;
        d.bz = [xo, xo * (d.outSpeed || 0), 1 - xi, 1 - xi * (d.inSpeed || 0)];
      } else d.bz = [0.333, 0, 0.667, 1];
    }
    if (!d.view) d.view = 'value';
  }
  function valueThumb(bz) {
    var x = function (v) { return 4 + v * 52; }, y = function (v) { return 25 - v * 20; };
    return '<svg viewBox="0 0 60 30" preserveAspectRatio="none"><path class="grid-l" d="M0 25H60M0 5H60"/>' +
      '<path class="curve" d="M' + x(0) + ' ' + y(0) + 'C' + x(bz[0]) + ' ' + y(bz[1]) + ' ' + x(bz[2]) + ' ' + y(bz[3]) + ' ' + x(1) + ' ' + y(1) + '"/></svg>';
  }
  function fmt(v) { return String(Math.round(v * 100) / 100); }

  // Interaction
  //  Value view: the two bezier handles - grab one (it keeps its offset) or click the graph to move the
  //    nearest; Shift = lock axis, Ctrl/Cmd = fine, Alt or Link = mirror, soft snap to flat ease;
  //    past the top/bottom edge the view grows for overshoot; arrows nudge, Tab switches handle.
  //  Speed view: no handles - drag the curve itself: sideways = move the peak, up/down = stronger /
  //    softer ease (both keys stay at speed 0); Shift = one axis, Ctrl = fine, Alt or Link = symmetric.
  //  Both: the drag continues anywhere in the panel and ends on release, leaving the panel or blur;
  //  double-click resets; release applies when Auto is on.
  // Detail strip under the graph: [Out ›] [‹ In]; Apply / In / Out / Linear / Hold buttons at the bottom.
  // One set of window/document listeners for all graph editors: they forward to the one being dragged.
  var activeGE = null;
  document.addEventListener('pointerlockchange', function () { if (activeGE) activeGE.lock(); });
  window.addEventListener('blur', function () { if (activeGE) activeGE.end(); });
  function graphEditor(d, ctx) {
    initCurve(d);
    var root = el('div', 'w ge');
    var box = el('div', 'ge-graph'), svgHost = el('div', 'ge-svg'), tip = el('div', 'ge-tip');
    box.append(svgHost, tip);
    box.tabIndex = 0;
    var W_ = 300, H_ = 180, PX = 14, PY = 12, range = null, drag = null, ghost = null;

    // ---- curve helpers: influences o (out) / i (in) in 0..1, speeds kept from the curve ----
    function speedOf(b) {
      b = b || d.bz;
      return [b[1] / Math.max(0.001, b[0]), (1 - b[3]) / Math.max(0.001, 1 - b[2])];
    }
    function infl() { return [d.bz[0], 1 - d.bz[2]]; }
    function setInfl(o, i) {
      o = clamp(o, 0.01, 1); i = clamp(i, 0.01, 1);
      if (d.link) i = o;
      var sp = speedOf();
      if (d.view === 'speed') sp = [0, 0];  // speed view: keys always at speed 0 (pure ease)
      d.bz = [o, o * sp[0], 1 - i, 1 - i * sp[1]];
    }
    function computeRange() {
      var b = d.bz;
      if (d.view === 'value') return { lo: Math.min(-0.15, b[1] - 0.12, b[3] - 0.12), hi: Math.max(1.15, b[1] + 0.12, b[3] + 0.12) };
      var sp = speedOf();
      return speedRange(speedSamples(b[0], b[1], b[2], b[3]), [sp[0], sp[1]]);
    }
    function map(x, v) { return [PX + x * (W_ - 2 * PX), H_ - PY - (v - range.lo) / (range.hi - range.lo) * (H_ - 2 * PY)]; }
    function bezPath(b) {
      var p0 = map(0, 0), p3 = map(1, 1), c1 = map(b[0], b[1]), c2 = map(b[2], b[3]);
      return 'M' + p0[0] + ' ' + p0[1] + 'C' + c1[0] + ' ' + c1[1] + ' ' + c2[0] + ' ' + c2[1] + ' ' + p3[0] + ' ' + p3[1];
    }

    // ---- Value view: the two bezier handles (as before) ----
    if (d.sel == null) d.sel = 0;
    var hover = null, HIT = 14;
    function unmap(px, py) { return [(px - PX) / (W_ - 2 * PX), range.lo + (H_ - PY - py) / (H_ - 2 * PY) * (range.hi - range.lo)]; }
    function pxPerV() { return (H_ - 2 * PY) / (range.hi - range.lo); }
    function handleVal(i) { var b = d.bz; return i ? [b[2], b[3]] : [b[0], b[1]]; }
    function knobs() { return [0, 1].map(function (i) { var h = handleVal(i); return map(h[0], h[1]); }); }
    function setHandle(i, x, v, mirror) {
      var b = d.bz;
      v = clamp(v, -1.5, 2.5);
      if (i === 0) { b[0] = clamp(x, 0, 1); b[1] = v; } else { b[2] = clamp(x, 0, 1); b[3] = v; }
      if (mirror) { if (i === 0) { b[2] = 1 - b[0]; b[3] = 1 - b[1]; } else { b[0] = 1 - b[2]; b[1] = 1 - b[3]; } }
    }
    function local(e) { var r = box.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function nearest(p) {
      var k = knobs(), d0 = Math.hypot(p[0] - k[0][0], p[1] - k[0][1]), d1 = Math.hypot(p[0] - k[1][0], p[1] - k[1][1]);
      return { i: d0 <= d1 ? 0 : 1, dist: Math.min(d0, d1) };
    }

    // ---- drawing ----
    // during a drag, many mouse events can arrive per frame (1000 Hz mice): draw once per frame
    var drawQueued = false;
    function drawSoon() {
      if (drawQueued) return;
      drawQueued = true;
      requestAnimationFrame(function () { drawQueued = false; draw(); });
    }
    function draw() {
      var r = box.getBoundingClientRect();
      W_ = Math.max(80, Math.round(r.width) || 300); H_ = Math.max(50, Math.round(r.height) || 180);
      PX = W_ < 160 ? 8 : 14; PY = H_ < 100 ? 7 : 12;
      if (!range || !(drag && drag.handle)) range = computeRange();  // handle drags keep (and grow) the view
      var b = d.bz, svg = '<svg width="' + W_ + '" height="' + H_ + '" viewBox="0 0 ' + W_ + ' ' + H_ + '">', gx = '';
      for (var q = 1; q < 4; q++) { var gp = map(q / 4, 0)[0]; gx += 'M' + gp.toFixed(1) + ' 0V' + H_; }
      svg += '<path class="ge-gridl" d="' + gx + '"/>';
      var f = infl(), sp = speedOf();
      if (d.view === 'value') {
        var p0 = map(0, 0), p3 = map(1, 1), c1 = map(b[0], b[1]), c2 = map(b[2], b[3]), k = knobs();
        svg += '<rect class="ge-unit" x="' + p0[0] + '" y="' + p3[1] + '" width="' + (p3[0] - p0[0]) + '" height="' + (p0[1] - p3[1]) + '"/>';
        if (ghost) svg += '<path class="ge-ghost" d="' + bezPath(ghost) + '"/>';
        svg += '<path class="ge-handle" d="M' + p0[0] + ' ' + p0[1] + 'L' + c1[0] + ' ' + c1[1] + 'M' + p3[0] + ' ' + p3[1] + 'L' + c2[0] + ' ' + c2[1] + '"/>' +
          '<path class="ge-curve" d="' + bezPath(b) + '"/>' +
          '<rect class="ge-key" x="' + (p0[0] - 3) + '" y="' + (p0[1] - 3) + '" width="6" height="6"/><rect class="ge-key" x="' + (p3[0] - 3) + '" y="' + (p3[1] - 3) + '" width="6" height="6"/>';
        k.forEach(function (pt, i) {
          var on = drag && drag.handle && drag.i === i, ks = on || hover === i ? 11 : 9;
          svg += '<rect class="ge-knob' + (on ? ' on' : '') + (hover === i ? ' hov' : '') + (d.sel === i ? ' sel' : '') +
            '" x="' + (pt[0] - ks / 2) + '" y="' + (pt[1] - ks / 2) + '" width="' + ks + '" height="' + ks + '"/>';
        });
      } else {
        var base = map(0, 0), avg = map(0, 1), end = map(1, 0);
        svg += '<path class="sg-grid" d="M0 ' + base[1] + 'H' + W_ + '"/><path class="sg-avg" d="M0 ' + avg[1] + 'H' + W_ + '"/>';
        if (ghost) svg += '<path class="ge-ghost" d="' + pathOf(speedSamples(ghost[0], ghost[1], ghost[2], ghost[3]), map, range) + '"/>';
        svg += '<path class="ge-curve" d="' + pathOf(speedSamples(b[0], b[1], b[2], b[3]), map, range) + '"/>';
        svg += '<rect class="ge-key" x="' + (base[0] - 3) + '" y="' + (base[1] - 3) + '" width="6" height="6"/><rect class="ge-key" x="' + (end[0] - 3) + '" y="' + (end[1] - 3) + '" width="6" height="6"/>';
      }
      svgHost.innerHTML = svg + '</svg>';
      if (drag && drag.handle) {  // value view: readout next to the dragged handle
        var hi = drag.i, kp = knobs()[hi];
        tip.textContent = (hi ? 'In ' + Math.round(f[1] * 100) : 'Out ' + Math.round(f[0] * 100)) + '%  ' + fmt(sp[hi]) + '×' + (drag.fine ? '  fine' : '') + (drag.axis ? '  ' + drag.axis : '');
        tip.className = 'ge-tip show';
        var tw = tip.offsetWidth || 80;
        tip.style.left = clamp(kp[0] + (hi ? -tw - 10 : 10), 2, W_ - tw - 2) + 'px';
        tip.style.top = clamp(kp[1] - 24, 2, H_ - 20) + 'px';
      } else if (drag) {  // speed view: shape drag readout
        tip.textContent = 'Out ' + Math.round(f[0] * 100) + '%  ·  In ' + Math.round(f[1] * 100) + '%' + (drag.fine ? '  fine' : '');
        tip.className = 'ge-tip show';
        tip.style.left = Math.max(2, (W_ - (tip.offsetWidth || 120)) / 2) + 'px'; tip.style.top = '4px';
      } else tip.className = 'ge-tip';
      paintStrip();
      if (bzInput && !typing) bzInput.value = b.map(fmt).join(', ');
    }

    // ---- dragging: Value view = handles, Speed view = the curve's shape ----
    // Mouse events on the document while the button is down (reliable in AE's embedded Chromium);
    // the drag continues anywhere in the panel and ends on release, leaving the panel or blur.
    var docMove = null, docUp = null;
    function onDown(e) {
      if (e.button !== 0 || drag) return;
      e.preventDefault();
      try { box.focus({ preventScroll: true }); } catch (x) { /* keyboard only */ }
      ghost = d.bz.slice();
      if (d.view === 'value') {
        var p = local(e), n = nearest(p), ptr = unmap(p[0], p[1]);
        drag = { handle: true, i: n.i, moved: false, fine: false, axis: null };
        d.sel = n.i;
        // on the knob: keep the grab offset; on empty graph: the handle jumps to the pointer
        drag.start = n.dist <= HIT ? handleVal(n.i) : ptr;
        drag.ptr0 = ptr; drag.px0 = p;
        if (n.dist > HIT) { setHandle(n.i, ptr[0], ptr[1], d.link || e.altKey); drag.moved = true; }
      } else {
        var f = infl();
        // vx / vy = how far the mouse travelled since the (re)base point
        drag = { x: e.clientX, y: e.clientY, vx: 0, vy: 0, o: f[0], i: f[1], moved: false, fine: false, locked: false };
        // Pointer lock: unlimited drag - the cursor never leaves the panel and the release always
        // arrives. Where AE's Chromium refuses it, the drag ends when the pointer leaves the panel.
        try { if (box.requestPointerLock) box.requestPointerLock(); } catch (x) { /* unsupported */ }
      }
      document.body.classList.add('ge-dragging');
      activeGE = { lock: onLockChange, end: function () { if (drag) endDrag(); } };
      docMove = function (ev) { onMove(ev); };
      docUp = function () { endDrag(); };
      document.addEventListener('mousemove', docMove, true);
      document.addEventListener('mouseup', docUp, true);
      document.documentElement.addEventListener('mouseleave', docUp);
      draw();
    }
    function onMove(e) {
      var fine = e.ctrlKey || e.metaKey;
      if (drag.handle) {
        var p = local(e);
        p = [clamp(p[0], 0, W_), p[1]];
        // past the top / bottom edge: the view grows a little per move (overshoot), the pointer is clamped to it
        var over = p[1] < 4 ? 1 : (p[1] > H_ - 4 ? -1 : 0);
        if (over) {
          var g = (range.hi - range.lo) * 0.03;
          if (over > 0) range.hi = Math.min(2.7, range.hi + g); else range.lo = Math.max(-1.7, range.lo - g);
          p = [p[0], clamp(p[1], 0, H_)];
        }
        var ptr = unmap(p[0], p[1]);
        if (fine !== drag.fine) { drag.start = handleVal(drag.i); drag.ptr0 = ptr; drag.px0 = p; drag.fine = fine; }
        var fk = fine ? 0.2 : 1;
        var x = drag.start[0] + (ptr[0] - drag.ptr0[0]) * fk, v = drag.start[1] + (ptr[1] - drag.ptr0[1]) * fk;
        drag.axis = null;
        if (e.shiftKey) {  // lock the axis the pointer moved most along
          var adx = Math.abs(p[0] - drag.px0[0]), ady = Math.abs(p[1] - drag.px0[1]);
          if (adx >= ady) { v = drag.start[1]; drag.axis = 'H'; } else { x = drag.start[0]; drag.axis = 'V'; }
        }
        if (!fine) {  // soft snap to flat ease (0 / 1) and to 1/3, 2/3
          var tol = 5 / pxPerV(), tx = 4 / (W_ - 2 * PX);
          [0, 1].forEach(function (s) { if (Math.abs(v - s) < tol) v = s; });
          [0, 1 / 3, 2 / 3, 1].forEach(function (s) { if (Math.abs(x - s) < tx) x = s; });
        }
        setHandle(drag.i, x, v, d.link || e.altKey);
        drag.moved = true;
        return drawSoon();
      }
      // incremental: each move adds its own delta to the current curve, so hitting 0 % / 100 % has no
      // dead zone - reversing the mouse responds at once (locked: movementX/Y, else client deltas)
      var mx, my;
      if (drag.locked) { mx = e.movementX || 0; my = e.movementY || 0; }
      else { mx = e.clientX - drag.x; my = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; }
      drag.fine = fine;
      var k = fine ? 0.2 : 1, gw = Math.max(60, W_ - 2 * PX), gh = Math.max(40, H_ - 2 * PY);
      drag.tx = (drag.tx || 0) + Math.abs(mx); drag.ty = (drag.ty || 0) + Math.abs(my);  // for Shift: dominant axis so far
      // sensitive like Motion: ~60 % of the graph width sweeps the peak end to end, ~80 % of its height the strength
      var dx = mx / gw * 1.6 * k, dy = -my / gh * 1.25 * k;
      if (e.shiftKey) { if (drag.tx * gh >= drag.ty * gw) dy = 0; else dx = 0; }
      if (e.altKey || d.link) dx = 0;  // symmetric: strength only
      var cur = infl();
      setInfl(cur[0] + dx + dy, cur[1] - dx + dy);
      drag.moved = true;
      drawSoon();
    }
    function endDrag() {
      if (document.pointerLockElement === box) { try { document.exitPointerLock(); } catch (x) { /* ignore */ } }
      if (docMove) { document.removeEventListener('mousemove', docMove, true); document.removeEventListener('mouseup', docUp, true); }
      document.documentElement.removeEventListener('mouseleave', docUp);
      docMove = docUp = null;
      document.body.classList.remove('ge-dragging');
      if (!drag) return;
      var moved = drag.moved;
      drag = null; ghost = null; activeGE = null;
      draw(); ctx.save();
      if (moved && d.auto) autoApply();
    }
    box.addEventListener('mousedown', onDown);
    // pointer lock granted: the pointer can no longer leave the panel, so leaving is not an end;
    // lock lost while dragging (Esc, focus change): end the drag. (Called by the shared listener below.)
    function onLockChange() {
      if (!drag || drag.handle) return;
      if (document.pointerLockElement === box) {
        drag.locked = true; drag.vx = drag.vy = 0; drag.x = drag.y = 0;
        var cur = infl(); drag.o = cur[0]; drag.i = cur[1];
        document.documentElement.removeEventListener('mouseleave', docUp);
      } else if (drag.locked) endDrag();
    }
    box.addEventListener('mousemove', function (e) {  // value view: hover a handle
      if (drag || d.view !== 'value') { if (!drag) box.style.cursor = ''; return; }
      var n = nearest(local(e)), h = n.dist <= HIT ? n.i : null;
      box.style.cursor = h != null ? 'grab' : 'crosshair';
      if (h !== hover) { hover = h; draw(); }
    });
    box.addEventListener('mouseleave', function () { if (!drag && hover != null) { hover = null; draw(); } });
    box.addEventListener('dblclick', function () { d.bz = [0.333, 0, 0.667, 1]; if (d.view === 'speed') setInfl(0.333, 0.333); draw(); ctx.save(); if (d.auto) autoApply(); });
    box.addEventListener('keydown', function (e) {
      var key = e.key;
      if (d.view === 'value') {  // arrows nudge the active handle (Shift x10), Tab switches handle
        if (key === 'Tab') { e.preventDefault(); d.sel = 1 - d.sel; draw(); return; }
        var h = handleVal(d.sel), x = h[0], v = h[1], st = e.shiftKey ? 0.1 : 0.01;
        if (key === 'ArrowLeft') x -= st; else if (key === 'ArrowRight') x += st;
        else if (key === 'ArrowUp') v += st; else if (key === 'ArrowDown') v -= st;
        else if (key === 'Enter') { apply('both', e); return; }
        else return;
        e.preventDefault(); e.stopPropagation();
        setHandle(d.sel, x, v, d.link || e.altKey);
      } else {
        var f = infl(), s = e.shiftKey ? 0.1 : 0.01;
        if (key === 'ArrowLeft') setInfl(f[0] - s, f[1] + s);
        else if (key === 'ArrowRight') setInfl(f[0] + s, f[1] - s);
        else if (key === 'ArrowUp') setInfl(f[0] + s, f[1] + s);
        else if (key === 'ArrowDown') setInfl(f[0] - s, f[1] - s);
        else if (key === 'Enter') { apply('both', e); return; }
        else return;
        e.preventDefault(); e.stopPropagation();
      }
      range = null; draw(); ctx.save();
      if (d.auto) { clearTimeout(autoT); autoT = setTimeout(autoApply, 350); }
    });
    function setTitle() {
      box.title = d.view === 'value'
        ? 'Drag a handle (or click the graph). Shift = lock axis, Ctrl/Cmd = fine, Alt = mirror, double-click = reset. Arrows nudge, Tab switches handle, Enter applies.'
        : 'Drag the curve: sideways = move the peak, up/down = stronger/softer ease. Shift = one axis, Ctrl = fine, Alt = symmetric, double-click = reset. Arrow keys work too.';
    }
    setTitle();

    function apply(side, e) { return ctx.run('easingPreset', { bezier: d.bz, side: side, alt: false, shift: false }, e); }
    // Auto: applied quietly - a small note in the graph, no popup when no keyframes are selected
    var status = el('div', 'ge-status'), statusT = null, autoT = null;
    box.appendChild(status);
    function note(msg, ok) {
      status.textContent = msg; status.className = 'ge-status show ' + (ok ? 'ok' : 'warn');
      clearTimeout(statusT); statusT = setTimeout(function () { status.className = 'ge-status'; }, ok ? 900 : 2200);
    }
    function autoApply() {
      clearTimeout(autoT);
      autoT = setTimeout(function () {
        (ctx.query || ctx.run)('easingPreset', { bezier: d.bz.slice(), side: 'both', alt: false, shift: false }).then(function (r) {
          if (!r) return;
          if (r.ok) note('Applied', true);
          else note(/select|keyframe/i.test(r.msg) ? 'Select keyframes to apply' : r.msg, false);
        });
      }, 60);
    }
    function setCurve(bz) {
      d.bz = bz.slice();
      if (d.view === 'speed') { var f = infl(); setInfl(f[0], f[1]); }
      draw(); ctx.save(); if (d.auto) autoApply();
    }

    // ---- toolbar ----
    var bzInput = null, typing = false;
    var bar = el('div', 'ge-bar');
    var tabs = el('div', 'seg ge-tabs');
    [['value', 'Value'], ['speed', 'Speed']].forEach(function (v) {
      var t = el('button', 'seg-btn' + (d.view === v[0] ? ' on' : ''), v[1]);
      t.addEventListener('click', function () {
        d.view = v[0];
        ctx.save();
        tabs.querySelectorAll('.seg-btn').forEach(function (x) { x.classList.remove('on'); }); t.classList.add('on'); hover = null; setTitle(); draw();
      });
      tabs.appendChild(t);
    });
    var tool = function (label, key, title, onOn) {
      var b = el('button', 'w-btn ge-tool' + (d[key] ? ' on' : ''), label);
      b.title = title;
      b.addEventListener('click', function () { d[key] = !d[key]; b.classList.toggle('on', !!d[key]); if (d[key] && onOn) onOn(); ctx.save(); });
      return b;
    };
    var link = tool('Link', 'link', 'Keep Out and In equal (symmetric curve)', function () { var f = infl(); setInfl(f[0], f[0]); draw(); if (d.auto) autoApply(); });
    var auto = tool('Auto', 'auto', 'On: applied to the selected keys as soon as you release, pick a preset or change a value. Off: use Apply / In / Out.');
    var rd = el('button', 'w-btn ge-tool ge-act', 'Read');  // an action, not a toggle
    rd.title = 'Read the curve from the selected keyframes';
    rd.addEventListener('click', function (e) {
      ctx.run('readEase', {}, e).then(function (r) {
        if (!r || !r.ok) return;
        var v = String(r.msg).split(',').map(Number);
        if (v.length === 4 && v.every(function (x) { return !isNaN(x); })) { d.bz = v; draw(); ctx.save(); }
      });
    });
    bar.append(tabs, el('span', 'spacer'), link, auto, rd);
    root.append(bar, box);

    // ---- detail strip: [Out ›] [‹ In] ----
    var strip = el('div', 'ge-strip');
    function scrubBox(cls, label, arrow, side) {
      var wrap = el('div', 'ge-sb ' + cls);
      var inp = el('input', 'ge-sb-val'); inp.type = 'text'; inp.spellcheck = false;
      var arr = el('button', 'ge-sb-arr', arrow);
      arr.title = (side === 'o' ? 'Out' : 'In') + ' influence +1 (Shift +10, Alt −)';
      inp.title = (side === 'o' ? 'Out' : 'In') + ' influence % – drag sideways to scrub, click to type';
      if (side === 'o') wrap.append(inp, arr); else wrap.append(arr, inp);
      var get = function () { return Math.round(infl()[side === 'o' ? 0 : 1] * 100); };
      var set = function (v) {
        var f = infl(), n = clamp(v, 1, 100) / 100;
        if (side === 'o') setInfl(n, d.link ? n : f[1]); else setInfl(d.link ? n : f[0], n);
        draw(); ctx.save();
      };
      arr.addEventListener('click', function (e) { stop(e); set(get() + (e.altKey ? -1 : 1) * (e.shiftKey ? 10 : 1)); if (d.auto) autoApply(); });
      // scrub: drag sideways on the number (1 % per 2 px, Shift x5); a click without moving types
      inp.addEventListener('mousedown', function (e) {
        if (document.activeElement === inp) return;
        e.preventDefault();
        var x0 = e.clientX, v0 = get(), moved = false;
        var mv = function (ev) {
          var dv = Math.round((ev.clientX - x0) / 2) * (ev.shiftKey ? 5 : 1);
          if (Math.abs(ev.clientX - x0) > 2) moved = true;
          if (moved) set(v0 + dv);
        };
        var up = function () {
          document.removeEventListener('mousemove', mv, true); document.removeEventListener('mouseup', up, true);
          if (!moved) { inp.focus(); inp.select(); } else if (d.auto) autoApply();
        };
        document.addEventListener('mousemove', mv, true); document.addEventListener('mouseup', up, true);
      });
      inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = get(); inp.blur(); } });
      inp.addEventListener('change', function () { var v = parseFloat(inp.value); if (!isNaN(v)) { set(v); if (d.auto) autoApply(); } else inp.value = get(); });
      wrap.inp = inp;
      return wrap;
    }
    var outBox = scrubBox('ge-sb-out', 'Out', '<svg viewBox="0 0 8 12"><path d="M2 2l4 4-4 4"/></svg>', 'o');
    var inBox = scrubBox('ge-sb-in', 'In', '<svg viewBox="0 0 8 12"><path d="M6 2L2 6l4 4"/></svg>', 'i');
    strip.append(outBox, inBox);
    function paintStrip() {
      var f = infl();
      if (document.activeElement !== outBox.inp) outBox.inp.value = Math.round(f[0] * 100);
      if (document.activeElement !== inBox.inp) inBox.inp.value = Math.round(f[1] * 100);
    }
    root.append(strip);

    // ---- cubic-bezier text + presets ----
    bzInput = el('input', 'input ge-bz'); bzInput.spellcheck = false; bzInput.title = 'cubic-bezier(x1, y1, x2, y2) - edit or paste, then press Enter';
    bzInput.addEventListener('input', function () { typing = true; });
    bzInput.addEventListener('blur', function () { typing = false; draw(); });
    bzInput.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key !== 'Enter') return;
      typing = false;
      var v = bzInput.value.replace(/cubic-bezier|[()]/g, '').split(/[\s,]+/).filter(Boolean).map(Number);
      if (v.length === 4 && v.every(function (x) { return !isNaN(x); })) { v[0] = clamp(v[0], 0, 1); v[2] = clamp(v[2], 0, 1); setCurve(v); bzInput.blur(); }
    });
    root.appendChild(bzInput);
    var pres = el('div', 'ge-presets');
    var fillPresets = function () {
      pres.innerHTML = '';
      var add = function (name, bz, idx) {
        var b = el('button', 'ge-pre' + (idx != null ? ' user' : ''), valueThumb(bz));
        b.title = name + (idx != null ? ' (right-click to delete)' : '') + ' - click to load' + (d.auto ? ' and apply' : ', double-click to apply');
        b.addEventListener('click', function () { setCurve(bz); });
        b.addEventListener('dblclick', function (e) { if (!d.auto) apply('both', e); });
        if (idx != null) b.addEventListener('contextmenu', function (e) { e.preventDefault(); ctx.lib.remove(idx); fillPresets(); });
        pres.appendChild(b);
      };
      BUILTIN_CURVES.forEach(function (c) { add(c[0], c[1]); });
      ctx.lib.list().forEach(function (c, i) { add(c.name, c.bz, i); });
      var sv = el('button', 'ge-pre ge-save', '+');
      sv.title = 'Save the current curve';
      sv.addEventListener('click', function () { ctx.lib.save(d.bz.slice(), fillPresets); });
      pres.appendChild(sv);
    };
    if (ctx.lib) { fillPresets(); root.appendChild(pres); }

    var btns = el('div', 'w-btns ge-btns');
    [['apply', 'Apply', 'Apply the curve to the selected keys'], ['in', 'In', 'Incoming side only'], ['out', 'Out', 'Outgoing side only'],
     ['linear', 'Linear', 'Linear keyframes'], ['hold', 'Hold', 'Hold keyframes']].forEach(function (b) {
      var x = el('button', 'w-btn' + (b[0] === 'apply' ? ' w-primary' : ''), b[1]);
      x.title = b[2];
      x.addEventListener('click', function (e) {
        stop(e);
        if (b[0] === 'linear' || b[0] === 'hold') return ctx.run('easyKeyframes', { mode: b[0] }, e);
        apply(b[0] === 'apply' ? 'both' : b[0], e);
      });
      btns.appendChild(x);
    });
    root.appendChild(btns);

    draw();
    requestAnimationFrame(draw);
    if (window.ResizeObserver) new ResizeObserver(function () { if (!drag) draw(); }).observe(box);
    return root;
  }
  W.easyKeyframes = function (d, ctx) { return graphEditor(d, ctx); };

  // ---------- Easings Manager ----------
  // "N keys copied" + Copy (dashed diamond) / Paste (filled diamond with a check) icon buttons
  W.easings = function (d, ctx) {
    if (d.copied == null) d.copied = 0;
    var root = el('div', 'w w-row w-ease-cp');
    var lbl = el('div', 'ecp-lbl');
    var paint = function () { lbl.textContent = d.copied + (d.copied === 1 ? ' key' : ' keys') + ' copied'; root.classList.toggle('has', d.copied > 0); };
    var c = el('button', 'ecp-btn ecp-copy', '<svg viewBox="0 0 16 16"><path d="M8 1.8L14.2 8 8 14.2 1.8 8z"/></svg>');
    var p = el('button', 'ecp-btn ecp-paste', '<svg viewBox="0 0 16 16"><path class="ecp-fill" d="M8 1.2L14.8 8 8 14.8 1.2 8z"/><path class="ecp-check" d="M5.2 8.2l1.9 1.9 3.8-3.9"/></svg>');
    c.title = 'Copy keyframes (easing + values) · Alt: easing only · Shift: values only';
    p.title = 'Paste onto the selected keyframes · Alt: easing only · Shift: values only';
    c.addEventListener('click', function (e) {
      stop(e);
      ctx.run('easingsCopy', {}, e).then(function (r) {
        var m = r && r.ok && /(\d+)/.exec(r.msg || '');
        if (m) { d.copied = Number(m[1]); ctx.save(); paint(); }
      });
    });
    p.addEventListener('click', function (e) { stop(e); ctx.run('easingsPaste', {}, e); });
    root.append(lbl, c, p);
    paint();
    return root;
  };

  // ---------- Sequencer ----------
  // [Num: n] [Step: n] + align to playhead / top -> bottom / bottom -> top / random (click = run)
  // Num = frames between steps, Step = layers per step (every Step layers move on by Num frames)
  function scrubField(label, get, set, title) {
    var w = el('label', 'stg-f', '<span>' + label + ':</span>');
    var inp = el('input', 'stg-in'); inp.type = 'text'; inp.spellcheck = false; inp.title = title + ' – drag sideways or click to type';
    inp.value = get();
    w.appendChild(inp);
    inp.addEventListener('click', stop);
    inp.addEventListener('mousedown', function (e) {
      if (document.activeElement === inp) return;
      e.preventDefault(); e.stopPropagation();
      var x0 = e.clientX, v0 = get(), moved = false;
      var mv = function (ev) {
        if (Math.abs(ev.clientX - x0) > 2) moved = true;
        if (moved) { set(v0 + Math.round((ev.clientX - x0) / 6)); inp.value = get(); }
      };
      var up = function () {
        document.removeEventListener('mousemove', mv, true); document.removeEventListener('mouseup', up, true);
        if (!moved) { inp.focus(); inp.select(); }
      };
      document.addEventListener('mousemove', mv, true); document.addEventListener('mouseup', up, true);
    });
    inp.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') inp.blur();
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); set(get() + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)); inp.value = get(); }
    });
    inp.addEventListener('change', function () { var v = parseInt(inp.value, 10); if (!isNaN(v)) set(v); inp.value = get(); });
    return w;
  }
  var STAGGER = [
    ['align', 'Align the layers (or their first keys) to the playhead', '<path d="M2.5 1.5v13" stroke-dasharray="1.6 1.4"/><path d="M5 4h8M5 8h5.5M5 12h7"/>'],
    ['down', 'Offset from top to bottom', '<path d="M1.5 3.5h5M5 8h5M8.5 12.5h6"/>'],
    ['up', 'Offset from bottom to top', '<path d="M8.5 3.5h6M5 8h5M1.5 12.5h5"/>'],
    ['random', 'Offset in random order', '<path d="M6 3.5h6M1.5 8h5M8 12.5h6.5"/>']
  ];
  W.sequencer = function (d, ctx) {
    if (d.step == null) d.step = 1;
    if (d.group == null) d.group = 1;
    var root = el('div', 'w w-stagger');
    var fields = el('div', 'stg-fields');
    fields.append(
      scrubField('Num', function () { return d.step; }, function (v) { d.step = Math.max(0, Math.min(999, v)); ctx.save(); }, 'Frames between steps'),
      scrubField('Step', function () { return d.group; }, function (v) { d.group = Math.max(1, Math.min(999, v)); ctx.save(); }, 'Layers per step (every Step layers move on by Num frames)'));
    var btns = el('div', 'stg-btns');
    STAGGER.forEach(function (o) {
      var b = el('button', 'stg-btn stg-' + o[0], '<svg viewBox="0 0 16 16">' + o[2] + '</svg>');
      b.title = o[1];
      b.addEventListener('click', function (e) { stop(e); ctx.run('sequencer', { step: d.step, group: d.group, order: o[0] }, e); });
      btns.appendChild(b);
    });
    root.append(fields, btns);
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
  W.sequencerCompact = function (d, ctx) { return W.sequencer(d, ctx); };  // same layout in MenMen Tools

  // ---------- Align / Distribute ----------
  // icons drawn like After Effects' Align panel: a 1 px guide line and solid layer bars
  var AL = {
    left: '<g fill="currentColor" stroke="none"><rect x="2" y="2" width="1" height="12"/><rect x="4" y="4" width="4" height="3"/><rect x="4" y="9" width="9" height="3"/></g>',
    hcenter: '<g fill="currentColor" stroke="none"><rect x="7.5" y="2" width="1" height="12"/><rect x="5" y="4" width="6" height="3"/><rect x="3" y="9" width="10" height="3"/></g>',
    right: '<g fill="currentColor" stroke="none"><rect x="13" y="2" width="1" height="12"/><rect x="8" y="4" width="4" height="3"/><rect x="3" y="9" width="9" height="3"/></g>',
    top: '<g fill="currentColor" stroke="none"><rect x="2" y="2" width="12" height="1"/><rect x="4" y="4" width="3" height="9"/><rect x="9" y="4" width="3" height="5"/></g>',
    vcenter: '<g fill="currentColor" stroke="none"><rect x="2" y="7.5" width="12" height="1"/><rect x="4" y="3" width="3" height="10"/><rect x="9" y="5" width="3" height="6"/></g>',
    bottom: '<g fill="currentColor" stroke="none"><rect x="2" y="13" width="12" height="1"/><rect x="4" y="3" width="3" height="9"/><rect x="9" y="7" width="3" height="5"/></g>',
    dh: '<path d="M2 3v10M14 3v10"/><path d="M6 5v6M10 5v6"/>', dv: '<path d="M3 2h10M3 14h10"/><path d="M5 6h6M5 10h6"/>',
    dtop: '<g fill="currentColor" stroke="none"><rect x="2" y="2" width="12" height="1"/><rect x="5" y="3.5" width="6" height="3"/><rect x="2" y="8" width="12" height="1"/><rect x="3.5" y="9.5" width="9" height="4"/></g>',
    dvcenter: '<g fill="currentColor" stroke="none"><rect x="2" y="4.5" width="12" height="1"/><rect x="5" y="3" width="6" height="4"/><rect x="2" y="10.5" width="12" height="1"/><rect x="3.5" y="8.5" width="9" height="5"/></g>',
    dbottom: '<g fill="currentColor" stroke="none"><rect x="5" y="2.5" width="6" height="3"/><rect x="2" y="6.5" width="12" height="1"/><rect x="3.5" y="8.5" width="9" height="4"/><rect x="2" y="13.5" width="12" height="1"/></g>',
    dleft: '<g fill="currentColor" stroke="none"><rect x="2" y="2" width="1" height="12"/><rect x="3.5" y="3.5" width="4" height="9"/><rect x="9" y="2" width="1" height="12"/><rect x="10.5" y="5" width="3" height="6"/></g>',
    dhcenter: '<g fill="currentColor" stroke="none"><rect x="4.5" y="2" width="1" height="12"/><rect x="3" y="3.5" width="4" height="9"/><rect x="10.5" y="2" width="1" height="12"/><rect x="9" y="5" width="3" height="6"/></g>',
    dright: '<g fill="currentColor" stroke="none"><rect x="2.5" y="3.5" width="4" height="9"/><rect x="7" y="2" width="1" height="12"/><rect x="10" y="5" width="3" height="6"/><rect x="13.5" y="2" width="1" height="12"/></g>'
  };
  W.align = function (d, ctx) {
    if (!d.to) d.to = 'selection';
    var root = el('div', 'w w-align');
    var mk = function (key, title, fn) {
      var b = el('button', 'w-btn wc-ico', '<svg viewBox="0 0 16 16">' + AL[key] + '</svg>');
      b.title = title;
      b.addEventListener('click', function (e) { stop(e); fn(e); });
      root.appendChild(b);
    };
    [['left', 'Align left'], ['hcenter', 'Align horizontal centers'], ['right', 'Align right'],
     ['top', 'Align top'], ['vcenter', 'Align vertical centers'], ['bottom', 'Align bottom']].forEach(function (a) {
      mk(a[0], a[1] + ' (to ' + d.to + ')', function (e) { ctx.run('alignLayers', { where: a[0], to: d.to }, e); });
    });
    mk('dh', 'Distribute horizontally (3+ layers)', function (e) { ctx.run('distributeLayers', { axis: 'h' }, e); });
    mk('dv', 'Distribute vertically (3+ layers)', function (e) { ctx.run('distributeLayers', { axis: 'v' }, e); });
    var to = el('button', 'w-btn wa-to', d.to === 'comp' ? 'Comp' : 'Sel');
    to.title = 'Align to the selection or to the comp (click to switch)';
    to.addEventListener('click', function (e) {
      stop(e); d.to = d.to === 'comp' ? 'selection' : 'comp'; to.textContent = d.to === 'comp' ? 'Comp' : 'Sel'; ctx.save();
      root.querySelectorAll('.wc-ico').forEach(function (b, i) { if (i < 6) b.title = b.title.replace(/\(to \w+\)/, '(to ' + d.to + ')'); });
    });
    root.appendChild(to);
    return root;
  };


  // ---------- Slim rows for MenMen Tools (one full-width line each) ----------
  // Labels show when the row is wide enough, otherwise icons only (title = name).
  function autoCompact(root, minW) {
    var fit = function () { var w = root.clientWidth; if (w) root.classList.toggle('icons', w < minW); };
    requestAnimationFrame(fit);
    if (window.ResizeObserver) new ResizeObserver(fit).observe(root);
  }
  function fmtBytes(b) {
    if (!b) return '0 GB';
    var gb = b / 1073741824;
    return gb >= 10 ? Math.round(gb) + ' GB' : gb >= 1 ? gb.toFixed(1) + ' GB' : Math.round(b / 1048576) + ' MB';
  }

  // Disk cache usage + Purge. Click the meter to refresh; Purge = memory, Alt+Purge = disk cache too.
  var diskState = { t: 0, used: null, max: 0, path: '' }, diskViews = [];
  function diskPaint() {
    diskViews = diskViews.filter(function (v) { return document.body.contains(v.root) || !v.seen; });
    diskViews.forEach(function (v) {
      v.seen = true;
      var s = diskState, pct = s.used != null && s.max ? Math.min(999, Math.round(s.used / s.max * 100)) : null;
      v.val.textContent = pct != null ? pct + '%' : (s.used != null ? fmtBytes(s.used) : '–');
      v.bar.style.width = (pct != null ? Math.min(100, pct) : 0) + '%';
      v.root.classList.toggle('warn', pct != null && pct >= 80);
      v.root.classList.toggle('full', pct != null && pct >= 95);
      v.meter.title = 'Disk cache: ' + (s.used != null ? fmtBytes(s.used) : 'unknown') + (s.max ? ' of ' + fmtBytes(s.max) : '') +
        (s.path ? '\n' + s.path : '') + '\nClick to refresh';
    });
  }
  // Folder size measured by a separate process (du / PowerShell) so After Effects never waits.
  // Without cep.process (very old CEP), only a click measures, through the host.
  function measureAsync(path, done) {
    var P = window.cep && window.cep.process;
    if (!P || !P.createProcess || !path) return false;
    var win = navigator.platform.indexOf('Win') === 0, out = '', r;
    try {
      r = win
        ? P.createProcess('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', '-NoProfile', '-NonInteractive', '-Command',
          "(Get-ChildItem -LiteralPath '" + path.replace(/'/g, "''") + "' -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum")
        : P.createProcess('/usr/bin/du', '-sk', path);
    } catch (e) { return false; }
    if (!r || r.err !== 0) return false;
    var pid = r.data;
    P.stdout(pid, function (chunk) { out += chunk; });
    P.onquit(pid, function () {
      var n = win ? Number(String(out).replace(/[^\d]/g, '')) : Number((/^\s*(\d+)/.exec(out) || [])[1]) * 1024;
      done(isNaN(n) ? null : n);
    });
    return true;
  }
  function diskRefresh(ctx, force) {
    if (diskState.busy) return;
    if (!force && Date.now() - diskState.t < 120000 && diskState.used != null) return diskPaint();
    diskState.t = Date.now();
    var busy = function (on) { diskState.busy = on; diskViews.forEach(function (v) { v.root.classList.toggle('busy', on); }); };
    busy(true);
    // 1) fast: cache folder + max size from AE's prefs (no folder walk on AE's thread)
    (ctx.query || ctx.run)('diskCacheInfo', { noSize: true }).then(function (r) {
      var p = r && r.ok ? String(r.msg).split('|') : [];
      if (p.length >= 2) { diskState.max = Number(p[1]) || 0; diskState.path = p.slice(2).join('|'); }
      if (p.length >= 2 && Number(p[0]) >= 0) diskState.used = Number(p[0]);  // preview / mock values
      diskPaint();
      // 2) size in the background
      var started = measureAsync(diskState.path, function (bytes) { if (bytes != null) diskState.used = bytes; busy(false); diskPaint(); });
      if (started) return;
      if (force) {  // no background process available: measure through AE only when asked
        (ctx.query || ctx.run)('diskCacheInfo', {}).then(function (r2) {
          var q = r2 && r2.ok ? String(r2.msg).split('|') : [];
          if (q.length >= 2 && Number(q[0]) >= 0) diskState.used = Number(q[0]);
          busy(false); diskPaint();
        });
      } else { busy(false); diskPaint(); }
    });
  }
  W.diskCache = function (d, ctx) {
    var root = el('div', 'w w-row w-disk');
    var meter = el('button', 'wd-meter', '<span class="wd-dot"></span><span class="wd-lbl">Disk cache</span><span class="wd-val">–</span><span class="wd-track"><i></i></span>');
    var purge = el('button', 'w-btn wd-purge', '<svg viewBox="0 0 16 16"><path d="M8.5 1.5L3.5 9h4l-1 5.5 5-7.5h-4z"/></svg><span>Purge</span>');
    purge.title = 'Purge all memory caches · Alt: also empty the disk cache (After Effects asks to confirm)';
    var v = { root: root, meter: meter, val: meter.querySelector('.wd-val'), bar: meter.querySelector('i'), ctx: ctx };
    diskViews.push(v);
    meter.addEventListener('click', function (e) { stop(e); diskRefresh(ctx, true); });
    purge.addEventListener('click', function (e) {
      stop(e);
      ctx.run('purgeCache', {}, e).then(function () { setTimeout(function () { diskRefresh(ctx, true); }, 1500); });
    });
    root.append(meter, purge);
    autoCompact(root, 170);
    setTimeout(function () { diskRefresh(ctx, false); }, 50);
    return root;
  };

  // Add: Solid / Adjustment / Null / Camera / Light / Text / Shape (above the top selected layer)
  var ADD = [
    ['solid', 'Solid', 'Solid: opens Solid Settings (name, size, color) · Alt: instant solid in the last color', '<rect x="2.5" y="3.5" width="11" height="9" fill="currentColor" stroke="none" opacity=".85"/>'],
    ['adjustment', 'Adj', 'Adjustment layer', '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11A5.5 5.5 0 0 0 8 2.5z" fill="currentColor"/>'],
    ['null', 'Null', 'Null object', '<rect x="3" y="3" width="10" height="10"/><path d="M3 3l10 10"/>'],
    ['camera', 'Cam', '3D camera · Alt: with a control null (rig)', '<rect x="1.5" y="5" width="9" height="7"/><path d="M10.5 7.5l4-2v6l-4-2"/>'],
    ['light', 'Light', 'Point light', '<circle cx="8" cy="7" r="3.5"/><path d="M6.5 12.5h3M7 14.5h2"/>'],
    ['text', 'Text', 'Text layer: centered, anchor in the middle, at the comp center', '<path d="M3 4V3h10v1M8 3v10M6 13h4"/>'],
    ['shape', 'Shape', 'Shape layer with a rectangle · Alt: empty shape layer', '<path d="M8 2l6 10H2z"/>']
  ];
  W.addRow = function (d, ctx) {
    var root = el('div', 'w w-row w-add');
    root.appendChild(el('span', 'wr-lbl', 'Add'));
    ADD.forEach(function (a) {
      var b = el('button', 'w-btn wr-btn wa-' + a[0] + (/^(solid|adjustment|camera)$/.test(a[0]) ? ' wr-main' : ''), '<svg viewBox="0 0 16 16">' + a[3] + '</svg><span>' + a[1] + '</span>');
      b.title = a[2];
      b.addEventListener('click', function (e) { stop(e); ctx.run('addLayer', { kind: a[0] }, e); });
      root.appendChild(b);
    });
    // wide: every label · medium: Solid / Adj / Cam keep labels · narrow: icons only
    var fit = function () {
      var w = root.clientWidth; if (!w) return;
      root.classList.toggle('mid', w < 400 && w >= 230);
      root.classList.toggle('icons', w < 230);
    };
    requestAnimationFrame(fit);
    if (window.ResizeObserver) new ResizeObserver(fit).observe(root);
    return root;
  };

  // Split text row: "Split text by:" label, Line / Word / Char choice (the lit one is used), Split button
  W.splitRow = function (d, ctx) {
    if (!d.by) d.by = 'word';
    var NAMES = { line: 'Line', word: 'Word', char: 'Char' };
    var root = el('div', 'w w-row w-split');
    var by = el('div', 'wr-by');
    var opts = el('div', 'wr-seg');
    var paint = function () {
      by.textContent = 'Split text by:';  // the lit button shows the choice
      opts.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.by === d.by); });
    };
    [['line', 'Line', 'One layer per line'], ['word', 'Word', 'One layer per word'], ['char', 'Char', 'One layer per character']].forEach(function (o) {
      var b = el('button', 'w-btn wr-opt', '<span>' + o[1] + '</span>');
      b.dataset.by = o[0]; b.title = o[2];
      b.addEventListener('click', function (e) { stop(e); d.by = o[0]; paint(); ctx.save(); });
      opts.appendChild(b);
    });
    var go = el('button', 'w-btn w-primary wr-go', '<svg viewBox="0 0 16 16"><path d="M5 3v10M11 3v10M2 8h3M11 8h3"/></svg><span>Split</span>');
    go.title = 'Split the selected text layer(s) into separate layers; the original is hidden. Alt: keep anchors on the baseline';
    go.addEventListener('click', function (e) { stop(e); ctx.run('splitText', { by: d.by }, e); });
    root.append(by, opts, go);
    paint();
    var fit = function () { var w = root.clientWidth; if (w) root.classList.toggle('narrow', w < 230); };
    requestAnimationFrame(fit);
    if (window.ResizeObserver) new ResizeObserver(fit).observe(root);
    return root;
  };

  // Align row: To: Comp / To: Sel switch + 6 align buttons
  W.alignRow = function (d, ctx) {
    if (!d.to) d.to = 'comp';
    var root = el('div', 'w w-row w-alrow');
    var to = el('button', 'w-btn wr-to');
    var paint = function () {
      to.innerHTML = '<span class="wr-to-k">To:</span> ' + (d.to === 'comp' ? 'Comp' : 'Sel');
      to.classList.toggle('on', d.to === 'comp');
      to.title = 'Aligning to the ' + (d.to === 'comp' ? 'composition' : 'selection bounds') + ' – click to switch';
    };
    paint();
    to.addEventListener('click', function (e) { stop(e); d.to = d.to === 'comp' ? 'selection' : 'comp'; paint(); ctx.save(); });
    root.appendChild(to);
    [['left', 'Align left'], ['hcenter', 'Align horizontal centers'], ['right', 'Align right'],
     ['top', 'Align top'], ['vcenter', 'Align vertical centers'], ['bottom', 'Align bottom']].forEach(function (a) {
      var b = el('button', 'w-btn wr-btn wr-ico', '<svg viewBox="0 0 16 16">' + AL[a[0]] + '</svg>');
      b.title = a[1];
      b.addEventListener('click', function (e) { stop(e); ctx.run('alignLayers', { where: a[0], to: d.to }, e); });
      root.appendChild(b);
    });
    autoCompact(root, 150);
    return root;
  };

  // One line: After Effects' Distribute Layers buttons (3+ layers; first and last stay in place)
  W.distributeRow = function (d, ctx) {
    var root = el('div', 'w w-row w-distrow');
    root.appendChild(el('span', 'wr-lbl wr-dist-lbl', 'Distribute:'));
    [['top', 'dtop', 'Distribute top edges'], ['vcenter', 'dvcenter', 'Distribute vertical centers'], ['bottom', 'dbottom', 'Distribute bottom edges'],
     ['left', 'dleft', 'Distribute left edges'], ['hcenter', 'dhcenter', 'Distribute horizontal centers'], ['right', 'dright', 'Distribute right edges']].forEach(function (a) {
      var b = el('button', 'w-btn wr-btn wr-ico', '<svg viewBox="0 0 16 16">' + AL[a[1]] + '</svg>');
      b.title = a[2] + ' (3+ layers)';
      b.addEventListener('click', function (e) { stop(e); ctx.run('distributeLayers', { where: a[0] }, e); });
      root.appendChild(b);
    });
    autoCompact(root, 150);
    return root;
  };

  window.Widgets = W;
})();

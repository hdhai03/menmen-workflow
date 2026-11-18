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

  // Interaction (Motion-style):
  //  - grab a handle (generous hit area) and it keeps its offset to the pointer: no jump on click
  //  - click on empty graph = the nearest handle jumps to the pointer
  //  - the graph only reacts inside its box: leaving it or releasing the button ends the drag
  //  - Shift = lock to the dominant axis, Ctrl/Cmd = fine (1/5 speed), Alt or Link = mirror
  //  - soft snapping to flat ease (0 / 1) and to the key level, view grows while dragging past the edge
  //  - ghost of the previous curve + live readout while dragging, Auto = apply on release
  //  - arrow keys nudge the active handle (Shift = x10), Tab switches handle, double-click resets
  function graphEditor(d, ctx) {
    initCurve(d);
    var root = el('div', 'w ge');
    var box = el('div', 'ge-graph'), svgHost = el('div', 'ge-svg'), tip = el('div', 'ge-tip');
    box.append(svgHost, tip);
    box.tabIndex = 0;
    var W_ = 300, H_ = 180, PX = 14, PY = 12, range = null, drag = null, hover = null, ghost = null;
    if (d.sel == null) d.sel = 0;

    // ---- coordinate systems ----
    function speedOf(b) {
      b = b || d.bz;
      return [b[1] / Math.max(0.001, b[0]), (1 - b[3]) / Math.max(0.001, 1 - b[2])];
    }
    function computeRange() {
      var b = d.bz;
      if (d.view === 'value') {
        return { lo: Math.min(-0.15, b[1] - 0.12, b[3] - 0.12), hi: Math.max(1.15, b[1] + 0.12, b[3] + 0.12) };
      }
      var sp = speedOf();
      return speedRange(speedSamples(b[0], b[1], b[2], b[3]), [sp[0], sp[1]]);
    }
    function map(x, v) { return [PX + x * (W_ - 2 * PX), H_ - PY - (v - range.lo) / (range.hi - range.lo) * (H_ - 2 * PY)]; }
    function unmap(px, py) { return [(px - PX) / (W_ - 2 * PX), range.lo + (H_ - PY - py) / (H_ - 2 * PY) * (range.hi - range.lo)]; }
    function pxPerV() { return (H_ - 2 * PY) / (range.hi - range.lo); }
    // handle position in graph units: value view = (x, value), speed view = (x, speed)
    function handleVal(i) {
      var b = d.bz, sp = speedOf();
      if (d.view === 'value') return i ? [b[2], b[3]] : [b[0], b[1]];
      return i ? [b[2], sp[1]] : [b[0], sp[0]];
    }
    function knobs() { return [0, 1].map(function (i) { var h = handleVal(i); return map(h[0], h[1]); }); }

    // set handle i from graph units, then mirror if linked
    function setHandle(i, x, v, mirror) {
      var b = d.bz;
      if (d.view === 'value') {
        v = clamp(v, -1.5, 2.5);
        if (i === 0) { b[0] = clamp(x, 0, 1); b[1] = v; } else { b[2] = clamp(x, 0, 1); b[3] = v; }
      } else {
        var s = Math.max(0, v);
        if (i === 0) { b[0] = clamp(x, 0.001, 1); b[1] = b[0] * s; } else { b[2] = clamp(x, 0, 0.999); b[3] = 1 - (1 - b[2]) * s; }
      }
      if (mirror) {
        if (i === 0) { b[2] = 1 - b[0]; b[3] = 1 - b[1]; } else { b[0] = 1 - b[2]; b[1] = 1 - b[3]; }
      }
    }

    // ---- drawing ----
    function bezPath(b) {
      var p0 = map(0, 0), p3 = map(1, 1), c1 = map(b[0], b[1]), c2 = map(b[2], b[3]);
      return 'M' + p0[0] + ' ' + p0[1] + 'C' + c1[0] + ' ' + c1[1] + ' ' + c2[0] + ' ' + c2[1] + ' ' + p3[0] + ' ' + p3[1];
    }
    function draw() {
      var r = box.getBoundingClientRect();
      W_ = Math.max(80, Math.round(r.width) || 300); H_ = Math.max(50, Math.round(r.height) || 180);
      PX = W_ < 160 ? 8 : 14; PY = H_ < 100 ? 7 : 12;
      if (!range || !drag) range = computeRange();
      var b = d.bz, svg = '<svg width="' + W_ + '" height="' + H_ + '" viewBox="0 0 ' + W_ + ' ' + H_ + '">', k = knobs();
      // grid: quarters in x
      var gx = '';
      for (var q = 1; q < 4; q++) { var gp = map(q / 4, 0)[0]; gx += 'M' + gp.toFixed(1) + ' 0V' + H_; }
      svg += '<path class="ge-gridl" d="' + gx + '"/>';
      if (d.view === 'value') {
        var p0 = map(0, 0), p3 = map(1, 1), c1 = map(b[0], b[1]), c2 = map(b[2], b[3]);
        svg += '<rect class="ge-unit" x="' + p0[0] + '" y="' + p3[1] + '" width="' + (p3[0] - p0[0]) + '" height="' + (p0[1] - p3[1]) + '"/>';
        if (ghost) svg += '<path class="ge-ghost" d="' + bezPath(ghost) + '"/>';
        svg += '<path class="ge-handle" d="M' + p0[0] + ' ' + p0[1] + 'L' + c1[0] + ' ' + c1[1] + 'M' + p3[0] + ' ' + p3[1] + 'L' + c2[0] + ' ' + c2[1] + '"/>' +
          '<path class="ge-curve" d="' + bezPath(b) + '"/>' +
          '<rect class="ge-key" x="' + (p0[0] - 3) + '" y="' + (p0[1] - 3) + '" width="6" height="6"/><rect class="ge-key" x="' + (p3[0] - 3) + '" y="' + (p3[1] - 3) + '" width="6" height="6"/>';
      } else {
        var sp = speedOf(), smp = speedSamples(b[0], b[1], b[2], b[3]), base = map(0, 0), avg = map(0, 1);
        var so = map(0, sp[0]), si = map(1, sp[1]);
        svg += '<path class="sg-grid" d="M0 ' + base[1] + 'H' + W_ + '"/><path class="sg-avg" d="M0 ' + avg[1] + 'H' + W_ + '"/>';
        if (ghost) svg += '<path class="ge-ghost" d="' + pathOf(speedSamples(ghost[0], ghost[1], ghost[2], ghost[3]), map, range) + '"/>';
        svg += '<path class="ge-curve" d="' + pathOf(smp, map, range) + '"/>' +
          '<path class="ge-handle" d="M' + so[0] + ' ' + so[1] + 'L' + k[0][0] + ' ' + k[0][1] + 'M' + si[0] + ' ' + si[1] + 'L' + k[1][0] + ' ' + k[1][1] + '"/>';
      }
      k.forEach(function (p, i) {
        var big = drag && drag.i === i || hover === i, ks = big ? 11 : 9;
        svg += '<rect class="ge-knob' + (drag && drag.i === i ? ' on' : '') + (hover === i ? ' hov' : '') + (d.sel === i ? ' sel' : '') +
          '" x="' + (p[0] - ks / 2) + '" y="' + (p[1] - ks / 2) + '" width="' + ks + '" height="' + ks + '"/>';
      });
      svgHost.innerHTML = svg + '</svg>';
      var s2 = speedOf();
      if (read) read.innerHTML = '<span>Out <b>' + Math.round(b[0] * 100) + '%</b> · ' + fmt(s2[0]) + '×</span><span>In <b>' + Math.round((1 - b[2]) * 100) + '%</b> · ' + fmt(s2[1]) + '×</span>';
      if (bzInput && !typing) bzInput.value = b.map(fmt).join(', ');
      if (drag) {
        var i = drag.i, kp = k[i];
        tip.textContent = (i ? 'In ' + Math.round((1 - b[2]) * 100) : 'Out ' + Math.round(b[0] * 100)) + '%  ' + fmt(s2[i]) + '×' + (drag.fine ? '  fine' : '') + (drag.axis ? '  ' + drag.axis : '');
        tip.className = 'ge-tip show';
        var tw = tip.offsetWidth || 80;
        tip.style.left = clamp(kp[0] + (i ? -tw - 10 : 10), 2, W_ - tw - 2) + 'px';
        tip.style.top = clamp(kp[1] - 24, 2, H_ - 20) + 'px';
      } else tip.className = 'ge-tip';
    }

    // ---- interaction ----
    function local(e) { var r = box.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function nearest(p) {
      var k = knobs(), d0 = Math.hypot(p[0] - k[0][0], p[1] - k[0][1]), d1 = Math.hypot(p[0] - k[1][0], p[1] - k[1][1]);
      return { i: d0 <= d1 ? 0 : 1, dist: Math.min(d0, d1) };
    }
    var HIT = 14;
    function onDown(e) {
      if (e.button !== 0) return;
      e.preventDefault();
      try { box.focus({ preventScroll: true }); } catch (x) { /* keyboard nudging only */ }
      var p = local(e), n = nearest(p);
      ghost = d.bz.slice();
      drag = { i: n.i, moved: false, fine: false, axis: null };
      d.sel = n.i;
      var ptr = unmap(p[0], p[1]);
      // on the knob: keep the grab offset; on empty graph: the handle jumps to the pointer
      drag.start = n.dist <= HIT ? handleVal(n.i) : ptr;
      drag.ptr0 = ptr; drag.px0 = p;
      if (n.dist > HIT) { setHandle(n.i, ptr[0], ptr[1], d.link || e.altKey); drag.moved = true; }
      draw();
    }
    function onMove(e) {
      var p = local(e);
      if (!drag) {
        var n = nearest(p), h = n.dist <= HIT ? n.i : null;
        box.style.cursor = h != null ? 'grab' : 'crosshair';
        if (h !== hover) { hover = h; draw(); }
        return;
      }
      box.style.cursor = 'grabbing';
      var fine = e.ctrlKey || e.metaKey;
      // past the top / bottom edge: the view grows a little per move (no runaway), the pointer is clamped to it
      var over = p[1] < 4 ? 1 : (p[1] > H_ - 4 ? -1 : 0);
      if (over) {
        var g = (range.hi - range.lo) * 0.03;
        if (d.view === 'value') { if (over > 0) range.hi = Math.min(2.7, range.hi + g); else range.lo = Math.max(-1.7, range.lo - g); }
        else if (over > 0) range.hi = Math.min(14, range.hi + g);
        p = [p[0], clamp(p[1], 0, H_)];
      }
      var ptr = unmap(p[0], p[1]);
      if (fine !== drag.fine) {  // re-base so toggling fine mode never jumps
        drag.start = handleVal(drag.i); drag.ptr0 = ptr; drag.px0 = p; drag.fine = fine;
      }
      var f = fine ? 0.2 : 1;
      var x = drag.start[0] + (ptr[0] - drag.ptr0[0]) * f, v = drag.start[1] + (ptr[1] - drag.ptr0[1]) * f;
      // Shift: lock the axis the pointer moved most along
      drag.axis = null;
      if (e.shiftKey) {
        var dx = Math.abs(p[0] - drag.px0[0]), dy = Math.abs(p[1] - drag.px0[1]);
        if (dx >= dy) { v = drag.start[1]; drag.axis = 'H'; } else { x = drag.start[0]; drag.axis = 'V'; }
      }
      // soft snap (not in fine mode): value view -> 0 and 1, speed view -> 0 and the average speed
      if (!fine) {
        var tol = 5 / pxPerV(), tx = 4 / (W_ - 2 * PX);
        [0, 1].forEach(function (s) { if (Math.abs(v - s) < tol) v = s; });
        [0, 1 / 3, 2 / 3, 1].forEach(function (s) { if (Math.abs(x - s) < tx) x = s; });
      }
      setHandle(drag.i, x, v, d.link || e.altKey);
      drag.moved = true;
      draw();
    }
    function onUp(e) {
      if (!drag) return;
      var moved = drag.moved;
      drag = null; ghost = null; box.style.cursor = 'grab';
      draw(); ctx.save();
      if (moved && d.auto) autoApply();
    }
    // The graph only reacts inside its own box: leaving the box or releasing the button ends the
    // drag. (Listening on the whole document kept a drag alive when the button was released outside
    // the panel - AE never sends that mouseup - and every move anywhere then edited the curve.)
    box.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      onDown(e);
    });
    box.addEventListener('mousemove', function (e) {
      if (drag && !(e.buttons & 1)) { onUp(e); return; }  // button already released (missed mouseup)
      onMove(e);
    });
    box.addEventListener('mouseup', function (e) { if (drag) onUp(e); });
    box.addEventListener('mouseleave', function (e) {
      if (drag) onUp(e);
      if (hover != null) { hover = null; draw(); }
    });
    window.addEventListener('blur', function () { if (drag) onUp({}); });
    box.addEventListener('dblclick', function () { d.bz = [0.333, 0, 0.667, 1]; draw(); ctx.save(); });
    box.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'Tab') { e.preventDefault(); d.sel = 1 - d.sel; draw(); return; }
      var step = e.shiftKey ? 0.1 : 0.01, h = handleVal(d.sel), x = h[0], v = h[1];
      if (d.view === 'speed') step *= Math.max(1, range.hi - range.lo) / 2;
      if (k === 'ArrowLeft') x -= e.shiftKey ? 0.1 : 0.01;
      else if (k === 'ArrowRight') x += e.shiftKey ? 0.1 : 0.01;
      else if (k === 'ArrowUp') v += step;
      else if (k === 'ArrowDown') v -= step;
      else if (k === 'Enter') { apply('both', e); return; }
      else return;
      e.preventDefault(); e.stopPropagation();
      setHandle(d.sel, x, v, d.link || e.altKey);
      range = null; draw(); ctx.save();
      if (d.auto) { clearTimeout(autoT); autoT = setTimeout(autoApply, 350); }
    });
    box.title = 'Drag a handle (or click the graph). Shift = lock axis, Ctrl/Cmd = fine, Alt = mirror, double-click = reset. Arrows nudge, Tab switches handle, Enter applies.';

    function setCurve(bz) { d.bz = bz.slice(); range = null; draw(); ctx.save(); if (d.auto) autoApply(); }
    function apply(side, e) { return ctx.run('easingPreset', { bezier: d.bz, side: side, alt: false, shift: false }, e); }
    // Auto: applied quietly on every release - a small note in the graph instead of a toast,
    // and no error popup when no keyframes are selected.
    var status = el('div', 'ge-status'), statusT = null, autoT = null;
    box.appendChild(status);
    function note(msg, ok) {
      status.textContent = msg; status.className = 'ge-status show ' + (ok ? 'ok' : 'warn');
      clearTimeout(statusT); statusT = setTimeout(function () { status.className = 'ge-status'; }, ok ? 900 : 2200);
    }
    function autoApply() {
      clearTimeout(autoT);
      autoT = setTimeout(function () {
        var q = ctx.query || ctx.run;
        q('easingPreset', { bezier: d.bz.slice(), side: 'both', alt: false, shift: false }).then(function (r) {
          if (!r) return;
          if (r.ok) note('Applied', true);
          else note(/select|keyframe/i.test(r.msg) ? 'Select keyframes to apply' : r.msg, false);
        });
      }, 60);
    }

    // ---- toolbar ----
    var read = null, bzInput = null, typing = false;
    var bar = el('div', 'ge-bar');
    var tabs = el('div', 'seg ge-tabs');
    [['value', 'Value'], ['speed', 'Speed']].forEach(function (v) {
      var t = el('button', 'seg-btn' + (d.view === v[0] ? ' on' : ''), v[1]);
      t.addEventListener('click', function () {
        d.view = v[0]; range = null; ctx.save();
        tabs.querySelectorAll('.seg-btn').forEach(function (x) { x.classList.remove('on'); }); t.classList.add('on'); draw();
      });
      tabs.appendChild(t);
    });
    var tool = function (label, key, title, onOn) {
      var b = el('button', 'w-btn ge-tool' + (d[key] ? ' on' : ''), label);
      b.title = title;
      b.addEventListener('click', function () { d[key] = !d[key]; b.classList.toggle('on', !!d[key]); if (d[key] && onOn) onOn(); ctx.save(); });
      return b;
    };
    var link = tool('Link', 'link', 'Mirror the two handles (symmetric curve)', function () { d.bz[2] = 1 - d.bz[0]; d.bz[3] = 1 - d.bz[1]; draw(); });
    var auto = tool('Auto', 'auto', 'On: the curve is applied to the selected keys as soon as you release a handle or pick a preset (no need to click Apply). Off: only Apply / In / Out apply.');
    var rd = el('button', 'w-btn ge-tool', 'Read');
    rd.title = 'Read the curve from the selected keyframes';
    rd.addEventListener('click', function (e) {
      ctx.run('readEase', {}, e).then(function (r) {
        if (!r || !r.ok) return;
        var v = String(r.msg).split(',').map(Number);
        if (v.length === 4 && v.every(function (x) { return !isNaN(x); })) { d.bz = v; range = null; draw(); ctx.save(); }
      });
    });
    bar.append(tabs, el('span', 'spacer'), link, auto, rd);
    root.append(bar, box);

    var info = el('div', 'ge-info');
    read = el('div', 'w-read ge-read');
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
    info.append(read, bzInput);
    root.appendChild(info);

    // presets: built-in + saved curves (click = load, double-click = load & apply, right-click saved = delete)
    var pres = el('div', 'ge-presets');
    var fillPresets = function () {
      pres.innerHTML = '';
      var add = function (name, bz, idx) {
        var b = el('button', 'ge-pre' + (idx != null ? ' user' : ''), valueThumb(bz));
        b.title = name + (idx != null ? ' (right-click to delete)' : '') + ' - click to load, double-click to apply';
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

    // ---- apply buttons ----
    var btns = el('div', 'w-btns ge-btns');
    [['apply', 'Apply', 'Apply the curve to the selected keys'], ['in', 'In', 'Incoming side only'], ['out', 'Out', 'Outgoing side only'],
     ['linear', 'Linear', 'Linear'], ['hold', 'Hold', 'Hold']].forEach(function (b) {
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

  // ---------- Align / Distribute ----------
  var AL = {
    left: '<path d="M2.5 2v12"/><path d="M5 5h8M5 11h5"/>', hcenter: '<path d="M8 2v12"/><path d="M3 5h10M5 11h6"/>', right: '<path d="M13.5 2v12"/><path d="M3 5h8M6 11h5"/>',
    top: '<path d="M2 2.5h12"/><path d="M5 5v8M11 5v5"/>', vcenter: '<path d="M2 8h12"/><path d="M5 3v10M11 5v6"/>', bottom: '<path d="M2 13.5h12"/><path d="M5 3v8M11 6v5"/>',
    dh: '<path d="M2 3v10M14 3v10"/><path d="M6 5v6M10 5v6"/>', dv: '<path d="M3 2h10M3 14h10"/><path d="M5 6h6M5 10h6"/>'
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
  function diskRefresh(ctx, force) {
    if (!force && Date.now() - diskState.t < 60000 && diskState.used != null) return diskPaint();
    diskState.t = Date.now();
    diskViews.forEach(function (v) { v.root.classList.add('busy'); });
    (ctx.query || ctx.run)('diskCacheInfo', {}).then(function (r) {
      diskViews.forEach(function (v) { v.root.classList.remove('busy'); });
      var p = r && r.ok ? String(r.msg).split('|') : [];
      if (p.length >= 2 && !isNaN(Number(p[0]))) { diskState.used = Number(p[0]); diskState.max = Number(p[1]) || 0; diskState.path = p.slice(2).join('|'); }
      diskPaint();
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
  setInterval(function () { if (diskViews.length && diskViews[0].ctx) diskRefresh(diskViews[0].ctx, true); }, 300000);

  // Add: Solid / Adjustment / Null / Camera / Light / Text / Shape (above the top selected layer)
  var ADD = [
    ['solid', 'Solid', 'Solid (comp size) · Alt: pick the color', '<rect x="2.5" y="3.5" width="11" height="9" fill="currentColor" stroke="none" opacity=".85"/>'],
    ['adjustment', 'Adj', 'Adjustment layer', '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11A5.5 5.5 0 0 0 8 2.5z" fill="currentColor"/>'],
    ['null', 'Null', 'Null object', '<rect x="3" y="3" width="10" height="10"/><path d="M3 3l10 10"/>'],
    ['camera', 'Cam', '3D camera · Alt: with a control null (rig)', '<rect x="1.5" y="5" width="9" height="7"/><path d="M10.5 7.5l4-2v6l-4-2"/>'],
    ['light', 'Light', 'Point light', '<circle cx="8" cy="7" r="3.5"/><path d="M6.5 12.5h3M7 14.5h2"/>'],
    ['text', 'Text', 'Text layer', '<path d="M3 4V3h10v1M8 3v10M6 13h4"/>'],
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

  // Split text row: "By: …" readout, Line / Word / Char choice, Split button
  W.splitRow = function (d, ctx) {
    if (!d.by) d.by = 'word';
    var NAMES = { line: 'Line', word: 'Word', char: 'Char' };
    var root = el('div', 'w w-row w-split');
    var by = el('div', 'wr-by');
    var opts = el('div', 'wr-seg');
    var paint = function () {
      by.innerHTML = '<span class="wr-to-k">By:</span> ' + NAMES[d.by];
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

  window.Widgets = W;
})();

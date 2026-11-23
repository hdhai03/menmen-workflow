/* exportui.js - Export PNG (current frame) and the Export GIF dialog.
 * AE renders PNG frames (host/lib/export.jsx); the panel scales them on a canvas and encodes the GIF (gif.js). */
(function () {
  var B = window.Bridge, W = window.Widgets;
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function stop(e) { e.stopPropagation(); }
  function kb(n) { return n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : Math.round(n / 1024) + ' KB'; }
  function info(ctx) {
    return ctx.query('exportInfo', {}).then(function (r) {
      if (!r || !r.ok) throw new Error(r ? r.msg : 'No host');
      try { return JSON.parse(r.msg); } catch (e) {  // preview mode: sample comp
        return { name: 'Comp 1', w: 1920, h: 1080, fps: 25, duration: 4, time: 1, frame: 25, workStart: 0, workDuration: 2, bg: [0.1, 0.1, 0.12], dir: '', temp: '' };
      }
    });
  }

  // ---------- Export PNG: save dialog, then AE writes the current frame ----------
  W.exportPngRun = function (ctx, e) {
    return info(ctx).then(function (c) {
      var name = c.name.replace(/[\\/:*?"<>|]/g, '_') + '_f' + c.frame + '.png';
      var path = B.fs.available ? B.fs.saveDialog('Export PNG', (c.dir ? c.dir + '/' : '') + name, ['png']) : null;
      if (B.fs.available && !path) return;  // cancelled
      return ctx.run('exportPng', { path: path || '' }, e);
    }).catch(function (err) { window.UI.toast('Export PNG: ' + err.message, false); });
  };

  // ---------- Export GIF ----------
  var PRESETS = {
    high:     { label: 'High',     width: 800, fps: 30, colors: 256, dither: 100, tolerance: 0 },
    balanced: { label: 'Balanced', width: 640, fps: 25, colors: 128, dither: 50,  tolerance: 3 },
    small:    { label: 'Small',    width: 480, fps: 15, colors: 64,  dither: 0,   tolerance: 6 },
    tiny:     { label: 'Tiny',     width: 320, fps: 12, colors: 32,  dither: 0,   tolerance: 10 }
  };
  var MAX_PIXELS = 150e6;  // frames x width x height kept in memory

  W.gifExport = function (d, ctx) {
    if (!d.preset) d.preset = 'balanced';
    if (!d.opts) d.opts = Object.assign({}, PRESETS[d.preset]);
    if (!d.range) d.range = 'work';
    if (d.loop == null) d.loop = true;
    var o = d.opts, comp = null, busy = false, cancel = false;
    var root = el('div', 'w gx');

    // presets
    var seg = el('div', 'seg gx-presets');
    Object.keys(PRESETS).forEach(function (k) {
      var b = el('button', 'seg-btn' + (d.preset === k ? ' on' : ''), PRESETS[k].label);
      b.addEventListener('click', function () {
        d.preset = k; d.opts = o = Object.assign({}, PRESETS[k]);
        seg.querySelectorAll('.seg-btn').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on');
        fill(); ctx.save(); estimate();
      });
      seg.appendChild(b);
    });
    root.appendChild(seg);

    // fields
    var form = el('div', 'gx-grid');
    var F = {};
    function field(key, label, input) {
      var f = el('label', 'gx-f', '<span>' + label + '</span>');
      f.appendChild(input); form.appendChild(f); F[key] = input;
      input.addEventListener('change', function () {
        if (key === 'range') d.range = input.value;
        else if (key === 'loop') d.loop = input.checked;
        else o[key] = Number(input.value);
        if (key !== 'range' && key !== 'loop') { d.preset = 'custom'; seg.querySelectorAll('.seg-btn').forEach(function (x) { x.classList.remove('on'); }); }
        ctx.save(); estimate();
      });
    }
    function select(opts) { var s = el('select', 'input'); opts.forEach(function (v) { var op = el('option', null, v[1]); op.value = v[0]; s.appendChild(op); }); return s; }
    function num(min, max, step) { var i = el('input', 'input'); i.type = 'number'; i.min = min; i.max = max; i.step = step || 1; return i; }
    field('width', 'Width', select([[0, 'Comp size'], [1080, '1080 px'], [800, '800 px'], [640, '640 px'], [480, '480 px'], [320, '320 px'], [240, '240 px']]));
    field('fps', 'FPS', num(1, 60));
    field('colors', 'Colors', select([[256, '256'], [128, '128'], [64, '64'], [32, '32'], [16, '16']]));
    field('dither', 'Dither %', num(0, 100, 10));
    field('tolerance', 'Tolerance', num(0, 30));
    field('range', 'Range', select([['work', 'Work area'], ['comp', 'Whole comp']]));
    var loop = el('input'); loop.type = 'checkbox';
    field('loop', 'Loop', loop);
    root.appendChild(form);
    function fill() {
      F.width.value = o.width; F.fps.value = o.fps; F.colors.value = o.colors; F.dither.value = o.dither; F.tolerance.value = o.tolerance;
      F.range.value = d.range; F.loop.checked = !!d.loop;
    }
    fill();

    var est = el('div', 'gx-est muted small');
    var bar = el('div', 'gx-bar', '<i></i>'), status = el('div', 'gx-status small');
    var go = el('button', 'w-btn w-primary gx-go', 'Export GIF…');
    var result = el('div', 'gx-result');
    root.append(est, bar, status, go, result);
    root.title = 'Tolerance: colors that changed less than this are kept from the previous frame (smaller file). Dither: smoother gradients, bigger file.';

    function plan() {
      if (!comp) return null;
      var start = d.range === 'work' ? comp.workStart : 0, dur = d.range === 'work' ? comp.workDuration : comp.duration;
      var fps = Math.max(1, Math.min(60, o.fps || 15)), n = Math.max(1, Math.floor(dur * fps + 1e-6));
      var w = o.width && o.width < comp.w ? o.width : comp.w, h = Math.max(1, Math.round(comp.h * w / comp.w)), capped = false;
      // too many pixels to keep in memory: scale the GIF down until it fits (instead of refusing to export)
      if (n * w * h > MAX_PIXELS) {
        w = Math.max(16, Math.floor(Math.sqrt(MAX_PIXELS / n * comp.w / comp.h)));
        h = Math.max(1, Math.round(comp.h * w / comp.w));
        capped = true;
      }
      return { start: start, fps: fps, n: n, w: w, h: h, capped: capped };
    }
    function estimate() {
      var p = plan();
      if (!p) { est.textContent = 'Reading the active comp…'; return; }
      est.textContent = comp.name + ' · ' + p.n + ' frames · ' + p.w + '×' + p.h + ' · ' + (p.n / p.fps).toFixed(2) + ' s';
      go.disabled = false;
      if (p.capped) est.textContent += ' (scaled down to fit in memory)';
    }
    function progress(f, text) { bar.firstChild.style.width = Math.round(f * 100) + '%'; status.textContent = text; }
    info(ctx).then(function (c) { comp = c; estimate(); }).catch(function (e) { est.textContent = e.message; });

    // PNG file -> scaled RGBA over the comp background
    var canvas = document.createElement('canvas'), g = canvas.getContext('2d', { willReadFrequently: true });
    // Newer AE writes saveFrameToPng's file only after the script returns: wait until AE reports the PNG
    // complete (depthReady: ends with IEND), then load it straight from disk (Depth.waitPng).
    function loadFrame(path, p) {
      var done = function (f) { return ctx.query('depthReady', { path: f }).then(function (r) { return !!(r && r.ok && r.msg === '1'); }); };
      return window.Depth.waitPng(path, function () { if (cancel) throw new Error('Cancelled'); }, done).then(function (img) {
        canvas.width = p.w; canvas.height = p.h;
        var bg = comp.bg || [0, 0, 0];
        g.fillStyle = 'rgb(' + bg.map(function (v) { return Math.round(v * 255); }).join(',') + ')';
        g.fillRect(0, 0, p.w, p.h);
        // step down by halves for a clean downscale, then draw at the final size
        var src = img, sw = img.width, sh = img.height;
        while (sw / 2 >= p.w * 1.01) {
          var t = document.createElement('canvas'); t.width = Math.round(sw / 2); t.height = Math.round(sh / 2);
          var tg = t.getContext('2d'); tg.imageSmoothingQuality = 'high'; tg.drawImage(src, 0, 0, t.width, t.height);
          src = t; sw = t.width; sh = t.height;
        }
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(src, 0, 0, p.w, p.h);
        B.fs.remove(path);
        return g.getImageData(0, 0, p.w, p.h).data;
      });
    }
    // preview mode (browser): a moving test pattern instead of AE frames
    function fakeFrame(i, p) {
      canvas.width = p.w; canvas.height = p.h;
      var gr = g.createLinearGradient(0, 0, p.w, p.h); gr.addColorStop(0, '#20304a'); gr.addColorStop(1, '#5a2a4a');
      g.fillStyle = gr; g.fillRect(0, 0, p.w, p.h);
      g.fillStyle = '#ffb347'; g.beginPath(); g.arc(p.w * (0.1 + 0.8 * i / Math.max(1, p.n - 1)), p.h / 2, p.h / 6, 0, 7); g.fill();
      return g.getImageData(0, 0, p.w, p.h).data;
    }
    function toB64(bytes) {
      var s = '', CH = 0x8000;
      for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
      return btoa(s);
    }
    var wait = function () { return new Promise(function (r) { setTimeout(r, 0); }); };

    // GIF encoding in a Web Worker built from client/js/gif.js (read through cep.fs); the frames are
    // transferred, not copied. Without CEP file access or Worker it runs on the panel thread.
    var encoder = null;
    var WORKER = 'self.onmessage=function(e){try{var m=e.data,fr=m.frames.map(function(b){return new Uint8ClampedArray(b)});' +
      'var r=GIF.encode(fr,m.w,m.h,m.o);postMessage({bytes:r.bytes,frames:r.frames,colors:r.colors},[r.bytes.buffer]);}' +
      'catch(err){postMessage({error:String(err&&err.message||err)})}};';
    function encodeAsync(frames, w, h, opts) {
      var src = B.fs.available && B.extPath ? B.fs.read(B.extPath.replace(/\\/g, '/') + '/client/js/gif.js') : (window.__mmwGifSource || null);
      var worker = null;
      if (src && typeof Worker !== 'undefined') {
        try { worker = new Worker(URL.createObjectURL(new Blob(['var window=self;\n', src, '\n;', WORKER], { type: 'text/javascript' }))); } catch (e) { worker = null; }
      }
      if (!worker) return wait().then(function () { return window.GIF.encode(frames, w, h, opts); });
      encoder = worker;
      return new Promise(function (res, rej) {
        worker.onmessage = function (e) { worker.terminate(); encoder = null; if (e.data.error) rej(new Error(e.data.error)); else res(e.data); };
        worker.onerror = function (e) { worker.terminate(); encoder = null; rej(new Error(e.message || 'GIF encoder failed')); };
        worker.__reject = rej;
        worker.postMessage({ frames: frames.map(function (f) { return f.buffer; }), w: w, h: h, o: opts }, frames.map(function (f) { return f.buffer; }));
      });
    }

    go.addEventListener('click', function (e) {
      stop(e);
      if (busy) {
        cancel = true;
        if (encoder) { encoder.terminate(); if (encoder.__reject) encoder.__reject(new Error('Cancelled')); encoder = null; }
        return;
      }
      var p = plan(); if (!p) return;
      var name = comp.name.replace(/[\\/:*?"<>|]/g, '_') + '.gif', out = null;
      if (B.fs.available) {
        out = B.fs.saveDialog('Export GIF', (comp.dir ? comp.dir + '/' : '') + name, ['gif']);
        if (!out) return;
        if (!/\.gif$/i.test(out)) out += '.gif';
      }
      busy = true; cancel = false; go.textContent = 'Cancel'; result.innerHTML = '';
      var base = out ? out.replace(/[\\/][^\\/]*$/, '') : (comp.dir || comp.temp);
      var dir = base ? base + '/MenMenGIF_' + Date.now() : '', frames = [], i = 0, asked = {}, t0 = Date.now();
      // AE renders one frame per call; the next frame is already asked for while the panel reads this one
      var ask = function (k) {
        if (k >= p.n || asked[k]) return;
        asked[k] = ctx.query('gifFrames', { dir: dir, start: p.start, fps: p.fps, from: k, to: k }).then(function (r) {
          if (!r || !r.ok) throw new Error(r ? r.msg : 'Render failed');
        });
        asked[k].catch(function () {});
      };
      var step = function () {
        if (cancel) throw new Error('Cancelled');
        if (i >= p.n) return null;
        var eta = i ? ', ' + Math.round((Date.now() - t0) / i * (p.n - i) / 1000) + ' s left' : '';
        progress(i / p.n * 0.7, 'Rendering frame ' + (i + 1) + ' / ' + p.n + eta);
        var job;
        if (B.inCEP) {
          ask(i); ask(i + 1);
          job = asked[i].then(function () { return loadFrame(dir + '/f' + ('00000' + i).slice(-5) + '.png', p); })
            .then(function (px) { frames[i] = new Uint8ClampedArray(px); delete asked[i]; });
        } else job = wait().then(function () { frames[i] = new Uint8ClampedArray(fakeFrame(i, p)); });
        return job.then(function () { i++; return step(); });
      };
      Promise.resolve().then(step).then(function () {
        progress(0.75, 'Encoding ' + p.n + ' frames…');
        return wait();
      }).then(function () {
        t0 = Date.now();
        return encodeAsync(frames, p.w, p.h, { colors: o.colors, dither: (o.dither || 0) / 100, tolerance: o.tolerance || 0, fps: p.fps, loop: d.loop ? 0 : 1 });
      }).then(function (r) {
        frames = null;
        if (cancel) throw new Error('Cancelled');
        progress(0.95, 'Saving…');
        var msg = kb(r.bytes.length) + ' · ' + p.w + '×' + p.h + ' · ' + p.n + ' frames (' + r.frames + ' written) · ' + r.colors + ' colors · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s';
        if (out) {
          if (!B.fs.writeBase64(out, toB64(r.bytes))) throw new Error('Cannot write ' + out);
          result.innerHTML = '<div class="gx-ok">Saved: ' + msg + '</div><div class="muted small gx-path"></div>';
          result.querySelector('.gx-path').textContent = out;
          var rv = el('button', 'w-btn', 'Reveal');
          rv.addEventListener('click', function (ev) { stop(ev); ctx.query('revealFile', { path: out }); });
          result.appendChild(rv);
        } else {  // preview: offer a download
          var url = URL.createObjectURL(new Blob([r.bytes], { type: 'image/gif' }));
          result.innerHTML = '<div class="gx-ok">Preview: ' + msg + '</div><a class="gx-dl" download="' + name + '" href="' + url + '">Download test GIF</a>';
        }
        progress(1, 'Done');
      }).catch(function (err) {
        progress(0, err.message);
      }).then(function () {
        busy = false; go.textContent = 'Export GIF…'; frames = [];
        if (dir) ctx.query('removeFolder', { dir: dir });
      });
    });
    estimate();
    return root;
  };
})();

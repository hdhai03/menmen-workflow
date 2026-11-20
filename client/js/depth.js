/* depth.js - Depth Map: Depth Anything V2 Small (Apache-2.0) running in the panel with ONNX Runtime Web.
 * AE renders the selected layer's frames to PNG (host/lib/depth.jsx), the panel turns each one into a
 * grayscale depth map (near = white) and AE imports the result right above the layer.
 * The model and the WebAssembly runtime are downloaded once to <userData>/MenMenWorkflow/depth. */
(function () {
  var B = window.Bridge, W = window.Widgets;
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function stop(e) { e.stopPropagation(); }

  var ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/';
  var HF = 'https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/';
  var MODELS = {
    fast: { file: 'model_quantized.onnx', save: 'da2-small-q8.onnx', mb: 27, label: 'Fast' },
    best: { file: 'model.onnx', save: 'da2-small-fp32.onnx', mb: 99, label: 'Best' }
  };
  var DETAIL = { low: 364, normal: 518, high: 742 };  // model input (short side), multiples of 14
  var DIR = B.userData ? B.userData.replace(/\\/g, '/') + '/MenMenWorkflow/depth' : null;

  // ---------- files ----------
  function b64ToBytes(b64) {
    var s = atob(b64), n = s.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = s.charCodeAt(i);
    return u;
  }
  function bytesToB64(bytes) {
    var parts = [], CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CH)));
    return btoa(parts.join(''));
  }
  function download(url, onProgress) {
    return new Promise(function (res, rej) {
      var x = new XMLHttpRequest();
      x.open('GET', url); x.responseType = 'arraybuffer';
      x.onprogress = function (e) { if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total); };
      x.onload = function () { if (x.status >= 200 && x.status < 300 && x.response) res(new Uint8Array(x.response)); else rej(new Error('Download failed (' + x.status + '): ' + url)); };
      x.onerror = function () { rej(new Error('No connection to ' + url.split('/')[2])); };
      x.send();
    });
  }
  // cached file -> bytes; missing -> download and keep a copy
  function getFile(name, url, onProgress) {
    if (DIR) {
      var b64 = B.fs.readBase64(DIR + '/' + name);
      if (b64) return Promise.resolve(b64ToBytes(b64));
    }
    return download(url, onProgress).then(function (u) {
      if (DIR && !B.fs.writeBase64(DIR + '/' + name, bytesToB64(u))) console.warn('[depth] could not cache ' + name);
      return u;
    });
  }
  function have(name) { return !!(DIR && window.cep && window.cep.fs.stat(DIR + '/' + name).err === 0); }

  // ---------- runtime ----------
  var SIMD = (function () {  // the probe ONNX Runtime uses: i8x16 splat
    try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; }
  })();
  var WASM = SIMD ? 'ort-wasm-simd.wasm' : 'ort-wasm.wasm';
  var runtime = null, sessions = {};
  function ensureRuntime(onProgress) {
    if (runtime) return runtime;
    runtime = getFile('ort-1.17.3-' + WASM, ORT_CDN + WASM, onProgress).then(function (bytes) {
      var ort = window.ort;
      if (!ort) throw new Error('ONNX Runtime did not load');
      var paths = {}; paths[WASM] = URL.createObjectURL(new Blob([bytes], { type: 'application/wasm' }));
      ort.env.wasm.wasmPaths = paths;
      ort.env.wasm.numThreads = 1;  // CEP pages are not cross-origin isolated: no threads
      ort.env.wasm.simd = SIMD;
      ort.env.wasm.proxy = false;
      return ort;
    });
    runtime.catch(function () { runtime = null; });
    return runtime;
  }
  function session(key, onProgress) {
    if (sessions[key]) return sessions[key];
    var m = MODELS[key];
    sessions[key] = ensureRuntime(function (f) { onProgress(f * 0.1, 'Downloading runtime'); }).then(function (ort) {
      return getFile(m.save, HF + m.file, function (f) { onProgress(0.1 + f * 0.9, 'Downloading model (' + m.mb + ' MB, once)'); }).then(function (bytes) {
        onProgress(1, 'Loading model…');
        return ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      });
    });
    sessions[key].catch(function () { delete sessions[key]; });
    return sessions[key];
  }

  // ---------- inference ----------
  var MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];
  var cIn = document.createElement('canvas'), gIn = cIn.getContext('2d', { willReadFrequently: true });
  function inputSize(w, h, short) {  // keep aspect, both sides >= short, multiples of 14, long side capped
    var s = short / Math.min(w, h), cap = short * 2.5;
    var tw = w * s, th = h * s;
    if (Math.max(tw, th) > cap) { var k = cap / Math.max(tw, th); tw *= k; th *= k; }
    return { w: Math.max(14, Math.round(tw / 14) * 14), h: Math.max(14, Math.round(th / 14) * 14) };
  }
  // image (img/canvas) -> { data: Float32Array (relative inverse depth, bigger = nearer), w, h }
  function predict(sess, img, short) {
    var sz = inputSize(img.width, img.height, short), n = sz.w * sz.h;
    cIn.width = sz.w; cIn.height = sz.h;
    gIn.fillStyle = '#000'; gIn.fillRect(0, 0, sz.w, sz.h);
    gIn.imageSmoothingEnabled = true; gIn.imageSmoothingQuality = 'high';
    gIn.drawImage(img, 0, 0, sz.w, sz.h);
    var px = gIn.getImageData(0, 0, sz.w, sz.h).data, t = new Float32Array(3 * n);
    for (var i = 0, p = 0; i < n; i++, p += 4) {
      t[i] = (px[p] / 255 - MEAN[0]) / STD[0];
      t[n + i] = (px[p + 1] / 255 - MEAN[1]) / STD[1];
      t[2 * n + i] = (px[p + 2] / 255 - MEAN[2]) / STD[2];
    }
    var ort = window.ort, feeds = {};
    feeds[sess.inputNames[0]] = new ort.Tensor('float32', t, [1, 3, sz.h, sz.w]);
    return sess.run(feeds).then(function (out) {
      var o = out[sess.outputNames[0]], d = o.dims;
      return { data: o.data, w: d[d.length - 1], h: d[d.length - 2] };
    });
  }
  // 0.5% / 99.5% percentiles: a few extreme pixels do not wash the map out
  function range(data) {
    var step = Math.max(1, Math.floor(data.length / 20000)), s = [];
    for (var i = 0; i < data.length; i += step) s.push(data[i]);
    s.sort(function (a, b) { return a - b; });
    var lo = s[Math.floor(s.length * 0.005)], hi = s[Math.min(s.length - 1, Math.floor(s.length * 0.995))];
    return { lo: lo, hi: hi > lo ? hi : lo + 1e-6 };
  }
  var cD = document.createElement('canvas'), gD = cD.getContext('2d');
  var cOut = document.createElement('canvas'), gOut = cOut.getContext('2d');
  // depth -> grayscale PNG (base64) at outW x outH
  function toPng(dep, r, outW, outH, invert) {
    cD.width = dep.w; cD.height = dep.h;
    var im = gD.createImageData(dep.w, dep.h), px = im.data, k = 255 / (r.hi - r.lo);
    for (var i = 0, p = 0; i < dep.data.length; i++, p += 4) {
      var v = (dep.data[i] - r.lo) * k;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      if (invert) v = 255 - v;
      px[p] = px[p + 1] = px[p + 2] = v; px[p + 3] = 255;
    }
    gD.putImageData(im, 0, 0);
    cOut.width = outW; cOut.height = outH;
    gOut.imageSmoothingEnabled = true; gOut.imageSmoothingQuality = 'high';
    gOut.drawImage(cD, 0, 0, outW, outH);
    return cOut.toDataURL('image/png').split(',')[1];
  }
  function loadImage(src) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error('Cannot read the rendered frame')); };
      img.src = src;
    });
  }

  window.Depth = { MODELS: MODELS, DETAIL: DETAIL, session: session, predict: predict, range: range, toPng: toPng, loadImage: loadImage, inputSize: inputSize, have: have, SIMD: SIMD };

  // ---------- dialog ----------
  var MODES = [['first', 'First frame'], ['current', 'Current frame'], ['all', 'Whole layer']];
  var MAX_FRAMES = 3000;

  W.depthMap = function (d, ctx) {
    if (!d.mode) d.mode = 'current';
    if (!d.model) d.model = 'fast';
    if (!d.detail) d.detail = 'normal';
    var info = null, busy = false, cancel = false;
    var root = el('div', 'w gx dm');
    var head = el('div', 'dm-layer small', 'Reading the selected layer…');
    root.appendChild(head);

    function seg(label, list, key, onPick) {
      var f = el('div', 'gx-f', '<span>' + label + '</span>'), s = el('div', 'seg');
      list.forEach(function (it) {
        var b = el('button', 'seg-btn' + (d[key] === it[0] ? ' on' : ''), it[1]);
        b.dataset.v = it[0];
        b.addEventListener('click', function (e) {
          stop(e); if (busy || b.disabled) return;
          d[key] = it[0]; s.querySelectorAll('.seg-btn').forEach(function (x) { x.classList.toggle('on', x === b); });
          ctx.save(); if (onPick) onPick(); plan();
        });
        s.appendChild(b);
      });
      f.appendChild(s); root.appendChild(f);
      return s;
    }
    var modeSeg = seg('Frames', MODES, 'mode');
    var modelSeg = seg('Model', Object.keys(MODELS).map(function (k) { return [k, MODELS[k].label]; }), 'model');
    seg('Detail', [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']], 'detail');
    var inv = el('label', 'dm-check small', '<input type="checkbox"> Invert (near = black)');
    var invBox = inv.firstChild; invBox.checked = !!d.invert;
    invBox.addEventListener('change', function () { d.invert = invBox.checked; ctx.save(); });
    root.appendChild(inv);

    var est = el('div', 'gx-est muted small');
    var bar = el('div', 'gx-bar', '<i></i>'), status = el('div', 'gx-status small');
    var go = el('button', 'w-btn w-primary gx-go', 'Generate Depth Map');
    var result = el('div', 'gx-result');
    root.append(est, bar, status, go, result);
    root.title = 'Depth Anything V2 Small runs on this computer. Near is white, far is black. The result is imported right above the selected layer.';

    function modelNote() {
      modelSeg.querySelectorAll('.seg-btn').forEach(function (b) {
        var m = MODELS[b.dataset.v];
        b.title = m.label + ' model, ' + m.mb + ' MB' + (have(m.save) ? ' (downloaded)' : ' (downloaded on first use)');
      });
    }
    modelNote();

    function times() {
      if (!info) return [];
      if (d.mode === 'first') return [info.inPoint];
      if (d.mode === 'current') return [info.time];
      var a = [], f0 = Math.ceil(info.inPoint * info.fps - 1e-6), f1 = Math.ceil(info.outPoint * info.fps - 1e-6) - 1;
      for (var f = f0; f <= f1; f++) a.push(f / info.fps);
      return a;
    }
    function plan() {
      if (!info) return;
      var all = modeSeg.querySelector('[data-v="all"]');
      all.disabled = info.still;
      all.title = info.still ? 'The layer is a still image' : '';
      if (info.still && d.mode === 'all') { d.mode = 'current'; modeSeg.querySelectorAll('.seg-btn').forEach(function (x) { x.classList.toggle('on', x.dataset.v === 'current'); }); }
      var t = times(), sz = inputSize(info.w, info.h, DETAIL[d.detail]);
      est.textContent = t.length + (t.length === 1 ? ' frame' : ' frames') + ' · output ' + info.w + '×' + info.h + ' · model input ' + sz.w + '×' + sz.h;
      go.disabled = !t.length || t.length > MAX_FRAMES;
      if (t.length > MAX_FRAMES) est.textContent += ' – too long: trim the layer (max ' + MAX_FRAMES + ' frames)';
      else if (!t.length) est.textContent = 'The layer is not inside the comp duration';
    }
    function readInfo() {
      return ctx.query('depthInfo', {}).then(function (r) {
        if (!r || !r.ok) throw new Error(r ? r.msg : 'No host');
        try { return JSON.parse(r.msg); } catch (e) {  // preview mode
          return { name: 'Footage.mp4', index: 1, kind: 'source', w: 1280, h: 720, fps: 25, inPoint: 0, outPoint: 2, time: 1, still: false, dir: '', temp: '' };
        }
      }).then(function (i) {
        info = i;
        head.innerHTML = '';
        var n = el('b'); n.textContent = i.name;
        head.append(n, document.createTextNode(' · ' + i.w + '×' + i.h + (i.kind === 'comp' ? ' (comp render)' : '')));
        plan();
      }).catch(function (e) { head.textContent = e.message; go.disabled = true; });
    }
    readInfo();

    function progress(f, text) { bar.firstChild.style.width = Math.round(f * 100) + '%'; status.textContent = text; }
    // preview mode: a synthetic frame (near ball, far gradient) instead of an AE render
    function fakeFrame(i, n) {
      var c = document.createElement('canvas'); c.width = info.w; c.height = info.h;
      var g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, c.height);
      gr.addColorStop(0, '#8fb8e8'); gr.addColorStop(0.55, '#d9e4ec'); gr.addColorStop(0.56, '#6b8f4e'); gr.addColorStop(1, '#3d5a2a');
      g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#c0392b'; g.beginPath(); g.arc(c.width * (0.25 + 0.5 * i / Math.max(1, n - 1)), c.height * 0.7, c.height * 0.2, 0, 7); g.fill();
      return Promise.resolve(c);
    }

    go.addEventListener('click', function (e) {
      stop(e);
      if (busy) { cancel = true; go.textContent = 'Cancelling…'; return; }
      if (!info) return;
      var t = times(); if (!t.length) return;
      busy = true; cancel = false; go.textContent = 'Cancel'; result.innerHTML = '';
      root.classList.add('busy');
      var stamp = Date.now(), tmp = info.temp ? info.temp + '/MenMenDepth_' + stamp : '';
      var out = info.dir ? info.dir + '/' + info.safe + '_' + stamp : '';
      var short = DETAIL[d.detail], invert = !!d.invert, sess, prev = null, done = 0, t0 = Date.now(), BATCH = 4, preview = [];
      var ids = { compId: info.compId, index: info.index, kind: info.kind }, tempId = 0, prepped = false;
      var hostOk = function (r, what) { if (!r || !r.ok) throw new Error(r ? r.msg : what + ' failed'); return r.msg; };
      var cleanup = function () { if (!prepped) return Promise.resolve(); prepped = false; return ctx.query('depthCleanup', ids); };
      var check = function () { if (cancel) throw new Error('Cancelled'); };

      session(d.model, function (f, text) { progress(f * 0.1, text); }).then(function (s) {
        sess = s; modelNote();
        check();
        if (!B.inCEP) return;
        progress(0.1, 'Preparing the render…');
        return ctx.query('depthPrep', ids).then(function (r) { tempId = Number(hostOk(r, 'Prepare')) || 0; prepped = true; });
      }).then(function () {
        var i = 0;
        var step = function () {
          check();
          if (i >= t.length) return null;
          var to = Math.min(t.length - 1, i + BATCH - 1), slice = t.slice(i, to + 1);
          var render = B.inCEP ? ctx.query('depthFrames', Object.assign({ tempId: tempId, dir: tmp, from: i, times: slice }, ids)).then(function (r) { hostOk(r, 'Render'); }) : Promise.resolve();
          return render.then(function () {
            var chain = Promise.resolve();
            slice.forEach(function (tt, k) {
              var idx = i + k, name = 'f' + ('00000' + idx).slice(-5) + '.png';
              chain = chain.then(function () {
                check();
                var eta = done ? ' · ' + Math.round((Date.now() - t0) / done * (t.length - done) / 1000) + ' s left' : '';
                progress(0.1 + 0.85 * done / t.length, 'Depth ' + (idx + 1) + ' / ' + t.length + eta);
                var src = B.inCEP ? loadImage('data:image/png;base64,' + B.fs.readBase64(tmp + '/' + name)) : fakeFrame(idx, t.length);
                return src.then(function (img) { return predict(sess, img, short); }).then(function (dep) {
                  var r = range(dep.data);
                  if (prev) {  // video: ease the range from frame to frame so the map does not flicker
                    r = { lo: prev.lo + (r.lo - prev.lo) * 0.25, hi: prev.hi + (r.hi - prev.hi) * 0.25 };
                    if (r.hi <= r.lo) r.hi = r.lo + 1e-6;
                  }
                  prev = r;
                  var png = toPng(dep, r, info.w, info.h, invert);
                  if (out) {
                    if (!B.fs.writeBase64(out + '/depth_' + ('00000' + idx).slice(-5) + '.png', png)) throw new Error('Cannot write ' + out);
                    B.fs.remove(tmp + '/' + name);
                  } else if (preview.length < 1) preview.push(png);
                  done++;
                });
              });
            });
            return chain;
          }).then(function () { i = to + 1; return step(); });
        };
        return step();
      }).then(function () {
        var secs = ((Date.now() - t0) / 1000).toFixed(1);
        if (!out) {  // preview: show the first map
          result.innerHTML = '<div class="gx-ok">Preview: ' + done + ' frame(s) · ' + secs + ' s</div>';
          var im = el('img', 'dm-preview'); im.src = 'data:image/png;base64,' + preview[0]; result.appendChild(im);
          progress(1, 'Done'); return;
        }
        progress(0.97, 'Importing…');
        return cleanup().then(function () {  // restore solo switches before the import shifts layer indices
          return ctx.run('depthImport', Object.assign({ dir: out, count: t.length, start: t[0], seq: !info.still && d.mode === 'all' }, ids));
        }).then(function (r) {
          hostOk(r, 'Import');
          result.innerHTML = '<div class="gx-ok">Imported ' + done + ' frame(s) · ' + secs + ' s</div>';
          progress(1, 'Done');
        });
      }).catch(function (err) {
        progress(0, err.message);
        if (out && cancel) ctx.query('removeFolder', { dir: out });
        return cleanup();
      }).then(function () {
        busy = false; go.textContent = 'Generate Depth Map'; root.classList.remove('busy');
        if (tmp) ctx.query('removeFolder', { dir: tmp });
      });
    });
    return root;
  };
})();

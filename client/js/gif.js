/* gif.js - GIF encoder tuned for small files (no dependencies).
 *
 *  1. One global palette from Xiaolin Wu's color quantizer (variance-minimizing box splits),
 *     built from pixels sampled across all frames.
 *  2. Optional Floyd-Steinberg dithering (serpentine) - better gradients, bigger files.
 *  3. Inter-frame delta: pixels that did not change since they were last written (within a
 *     tolerance) become the transparent index, so LZW sees long runs of one code.
 *  4. Each frame is cropped to the bounding box of its changed pixels.
 *  5. Frames with no change are merged into the previous frame's delay.
 *  6. LZW with variable code size (2-12 bits), 255-byte sub-blocks, NETSCAPE2.0 looping.
 *
 * API: GIF.encode(frames, w, h, opts) -> Uint8Array
 *   frames: [Uint8ClampedArray RGBA (w*h*4)], opts: { colors, dither, tolerance, fps, loop }
 */
(function () {
  // ---------------------------------------------------------------- Wu quantizer
  var SIDE = 33, SIZE = SIDE * SIDE * SIDE;
  function idx(r, g, b) { return (r * SIDE + g) * SIDE + b; }

  function wuQuantize(samples, maxColors) {
    var wt = new Float64Array(SIZE), mr = new Float64Array(SIZE), mg = new Float64Array(SIZE), mb = new Float64Array(SIZE), m2 = new Float64Array(SIZE);
    var i, r, g, b;
    // histogram on 5 bits per channel (+1: index 0 is the zero border used by the moment sums)
    for (i = 0; i < samples.length; i += 3) {
      r = samples[i]; g = samples[i + 1]; b = samples[i + 2];
      var k = idx((r >> 3) + 1, (g >> 3) + 1, (b >> 3) + 1);
      wt[k]++; mr[k] += r; mg[k] += g; mb[k] += b; m2[k] += r * r + g * g + b * b;
    }
    // cumulative moments
    var area = new Float64Array(SIDE), ar = new Float64Array(SIDE), ag = new Float64Array(SIDE), ab = new Float64Array(SIDE), a2 = new Float64Array(SIDE);
    for (r = 1; r < SIDE; r++) {
      area.fill(0); ar.fill(0); ag.fill(0); ab.fill(0); a2.fill(0);
      for (g = 1; g < SIDE; g++) {
        var line = 0, lr = 0, lg = 0, lb = 0, l2 = 0;
        for (b = 1; b < SIDE; b++) {
          var j = idx(r, g, b);
          line += wt[j]; lr += mr[j]; lg += mg[j]; lb += mb[j]; l2 += m2[j];
          area[b] += line; ar[b] += lr; ag[b] += lg; ab[b] += lb; a2[b] += l2;
          var p = idx(r - 1, g, b);
          wt[j] = wt[p] + area[b]; mr[j] = mr[p] + ar[b]; mg[j] = mg[p] + ag[b]; mb[j] = mb[p] + ab[b]; m2[j] = m2[p] + a2[b];
        }
      }
    }
    function vol(c, m) {
      return m[idx(c.r1, c.g1, c.b1)] - m[idx(c.r1, c.g1, c.b0)] - m[idx(c.r1, c.g0, c.b1)] + m[idx(c.r1, c.g0, c.b0)] -
        m[idx(c.r0, c.g1, c.b1)] + m[idx(c.r0, c.g1, c.b0)] + m[idx(c.r0, c.g0, c.b1)] - m[idx(c.r0, c.g0, c.b0)];
    }
    function bottom(c, dir, m) {
      if (dir === 0) return -m[idx(c.r0, c.g1, c.b1)] + m[idx(c.r0, c.g1, c.b0)] + m[idx(c.r0, c.g0, c.b1)] - m[idx(c.r0, c.g0, c.b0)];
      if (dir === 1) return -m[idx(c.r1, c.g0, c.b1)] + m[idx(c.r1, c.g0, c.b0)] + m[idx(c.r0, c.g0, c.b1)] - m[idx(c.r0, c.g0, c.b0)];
      return -m[idx(c.r1, c.g1, c.b0)] + m[idx(c.r1, c.g0, c.b0)] + m[idx(c.r0, c.g1, c.b0)] - m[idx(c.r0, c.g0, c.b0)];
    }
    function top(c, dir, pos, m) {
      if (dir === 0) return m[idx(pos, c.g1, c.b1)] - m[idx(pos, c.g1, c.b0)] - m[idx(pos, c.g0, c.b1)] + m[idx(pos, c.g0, c.b0)];
      if (dir === 1) return m[idx(c.r1, pos, c.b1)] - m[idx(c.r1, pos, c.b0)] - m[idx(c.r0, pos, c.b1)] + m[idx(c.r0, pos, c.b0)];
      return m[idx(c.r1, c.g1, pos)] - m[idx(c.r1, c.g0, pos)] - m[idx(c.r0, c.g1, pos)] + m[idx(c.r0, c.g0, pos)];
    }
    function variance(c) {
      var dr = vol(c, mr), dg = vol(c, mg), db = vol(c, mb), xx = vol(c, m2), w = vol(c, wt);
      return w ? xx - (dr * dr + dg * dg + db * db) / w : 0;
    }
    function maximize(c, dir, first, last, cut, wr, wg, wb, ww) {
      var br = bottom(c, dir, mr), bg = bottom(c, dir, mg), bb = bottom(c, dir, mb), bw = bottom(c, dir, wt), max = 0;
      cut[0] = -1;
      for (var i = first; i < last; i++) {
        var hr = br + top(c, dir, i, mr), hg = bg + top(c, dir, i, mg), hb = bb + top(c, dir, i, mb), hw = bw + top(c, dir, i, wt);
        if (!hw) continue;
        var t = (hr * hr + hg * hg + hb * hb) / hw;
        hr = wr - hr; hg = wg - hg; hb = wb - hb; hw = ww - hw;
        if (!hw) continue;
        t += (hr * hr + hg * hg + hb * hb) / hw;
        if (t > max) { max = t; cut[0] = i; }
      }
      return max;
    }
    function cut(s1, s2) {
      var wr = vol(s1, mr), wg = vol(s1, mg), wb = vol(s1, mb), ww = vol(s1, wt);
      var cr = [0], cg = [0], cb = [0];
      var maxr = maximize(s1, 0, s1.r0 + 1, s1.r1, cr, wr, wg, wb, ww);
      var maxg = maximize(s1, 1, s1.g0 + 1, s1.g1, cg, wr, wg, wb, ww);
      var maxb = maximize(s1, 2, s1.b0 + 1, s1.b1, cb, wr, wg, wb, ww);
      var dir;
      if (maxr >= maxg && maxr >= maxb) { dir = 0; if (cr[0] < 0) return false; }
      else if (maxg >= maxr && maxg >= maxb) dir = 1;
      else dir = 2;
      s2.r1 = s1.r1; s2.g1 = s1.g1; s2.b1 = s1.b1;
      if (dir === 0) { s2.r0 = s1.r1 = cr[0]; s2.g0 = s1.g0; s2.b0 = s1.b0; }
      else if (dir === 1) { s2.g0 = s1.g1 = cg[0]; s2.r0 = s1.r0; s2.b0 = s1.b0; }
      else { s2.b0 = s1.b1 = cb[0]; s2.r0 = s1.r0; s2.g0 = s1.g0; }
      s1.vol = (s1.r1 - s1.r0) * (s1.g1 - s1.g0) * (s1.b1 - s1.b0);
      s2.vol = (s2.r1 - s2.r0) * (s2.g1 - s2.g0) * (s2.b1 - s2.b0);
      return true;
    }
    var cubes = [], vv = new Float64Array(maxColors), n, next = 0;
    for (i = 0; i < maxColors; i++) cubes.push({ r0: 0, g0: 0, b0: 0, r1: 0, g1: 0, b1: 0, vol: 0 });
    cubes[0].r1 = cubes[0].g1 = cubes[0].b1 = SIDE - 1;
    for (n = 1; n < maxColors; n++) {
      if (cut(cubes[next], cubes[n])) {
        vv[next] = cubes[next].vol > 1 ? variance(cubes[next]) : 0;
        vv[n] = cubes[n].vol > 1 ? variance(cubes[n]) : 0;
      } else { vv[next] = 0; n--; }
      next = 0;
      var tmp = vv[0];
      for (i = 1; i <= n; i++) if (vv[i] > tmp) { tmp = vv[i]; next = i; }
      if (tmp <= 0) { n++; break; }
    }
    var pal = [];
    for (i = 0; i < Math.min(n, maxColors); i++) {
      var w = vol(cubes[i], wt);
      if (w > 0) pal.push([Math.round(vol(cubes[i], mr) / w), Math.round(vol(cubes[i], mg) / w), Math.round(vol(cubes[i], mb) / w)]);
    }
    if (!pal.length) pal.push([0, 0, 0]);
    return pal;
  }

  // ---------------------------------------------------------------- palette mapping
  function Mapper(pal) {
    var cache = new Int16Array(1 << 18).fill(-1);  // 6 bits per channel
    var n = pal.length;
    this.pal = pal;
    this.nearest = function (r, g, b) {
      var key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2), c = cache[key];
      if (c >= 0) return c;
      var best = 0, bd = 1e9;
      for (var i = 0; i < n; i++) {
        var p = pal[i], dr = p[0] - r, dg = p[1] - g, db = p[2] - b;
        // weighted distance (eye is most sensitive to green)
        var d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
        if (d < bd) { bd = d; best = i; }
      }
      cache[key] = best;
      return best;
    };
  }
  // RGBA -> palette indices (optionally Floyd-Steinberg, serpentine)
  function mapFrame(rgba, w, h, m, dither) {
    var out = new Uint8Array(w * h), pal = m.pal;
    if (!dither) {
      for (var i = 0, j = 0; i < out.length; i++, j += 4) out[i] = m.nearest(rgba[j], rgba[j + 1], rgba[j + 2]);
      return out;
    }
    var er = new Float32Array((w + 2) * 2), eg = new Float32Array((w + 2) * 2), eb = new Float32Array((w + 2) * 2);
    var s = dither;  // strength 0..1
    for (var y = 0; y < h; y++) {
      var cur = (y & 1) * (w + 2), nxt = ((y + 1) & 1) * (w + 2), ltr = !(y & 1);
      for (var q = 0; q < w + 2; q++) { er[nxt + q] = 0; eg[nxt + q] = 0; eb[nxt + q] = 0; }
      for (var xx = 0; xx < w; xx++) {
        var x = ltr ? xx : w - 1 - xx, p = (y * w + x) * 4, e = cur + x + 1;
        var r = Math.max(0, Math.min(255, rgba[p] + er[e])), g = Math.max(0, Math.min(255, rgba[p + 1] + eg[e])), b = Math.max(0, Math.min(255, rgba[p + 2] + eb[e]));
        var k = m.nearest(r | 0, g | 0, b | 0), c = pal[k];
        out[y * w + x] = k;
        var dr = (r - c[0]) * s, dg = (g - c[1]) * s, db = (b - c[2]) * s, d = ltr ? 1 : -1;
        er[e + d] += dr * 7 / 16; eg[e + d] += dg * 7 / 16; eb[e + d] += db * 7 / 16;
        var n0 = nxt + x + 1;
        er[n0 - d] += dr * 3 / 16; eg[n0 - d] += dg * 3 / 16; eb[n0 - d] += db * 3 / 16;
        er[n0] += dr * 5 / 16; eg[n0] += dg * 5 / 16; eb[n0] += db * 5 / 16;
        er[n0 + d] += dr / 16; eg[n0 + d] += dg / 16; eb[n0 + d] += db / 16;
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- byte writer + LZW
  function Writer() {
    var buf = new Uint8Array(1 << 16), len = 0;
    function grow(n) { if (len + n <= buf.length) return; var nb = new Uint8Array(Math.max(buf.length * 2, len + n)); nb.set(buf); buf = nb; }
    this.byte = function (v) { grow(1); buf[len++] = v; };
    this.word = function (v) { grow(2); buf[len++] = v & 255; buf[len++] = (v >> 8) & 255; };
    this.bytes = function (a) { grow(a.length); buf.set(a, len); len += a.length; };
    this.str = function (s) { for (var i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); };
    this.result = function () { return buf.slice(0, len); };
  }
  // LZW (same code-size rules as omggif / giflib decoders)
  function lzw(w, indices, minCode) {
    var clear = 1 << minCode, eoi = clear + 1, size = minCode + 1, next = eoi + 1;
    var dict = new Map();
    var block = new Uint8Array(255), bl = 0, acc = 0, bits = 0;
    w.byte(minCode);
    function emit(code) {
      acc |= code << bits; bits += size;
      while (bits >= 8) {
        block[bl++] = acc & 255; acc >>>= 8; bits -= 8;
        if (bl === 255) { w.byte(255); w.bytes(block); bl = 0; }
      }
    }
    emit(clear);
    var prefix = indices[0];
    for (var i = 1; i < indices.length; i++) {
      var k = indices[i], key = (prefix << 8) | k, code = dict.get(key);
      if (code !== undefined) { prefix = code; continue; }
      emit(prefix);
      if (next === 4096) { emit(clear); dict.clear(); size = minCode + 1; next = eoi + 1; }
      else { if (next >= (1 << size)) size++; dict.set(key, next++); }
      prefix = k;
    }
    emit(prefix);
    emit(eoi);
    if (bits > 0) { block[bl++] = acc & 255; if (bl === 255) { w.byte(255); w.bytes(block); bl = 0; } }
    if (bl) { w.byte(bl); w.bytes(block.subarray(0, bl)); }
    w.byte(0);
  }

  // ---------------------------------------------------------------- encoder
  function encode(frames, W, H, o) {
    o = o || {};
    var maxColors = Math.max(2, Math.min(256, o.colors || 256));
    var tol = o.tolerance || 0, tol2 = tol * tol * 3;
    var useDelta = frames.length > 1;
    // 1) palette from pixels sampled over all frames (~ 400k samples max)
    var total = frames.length * W * H, stepPx = Math.max(1, Math.floor(total / 400000));
    var samples = [], f, i, j;
    for (f = 0; f < frames.length; f++) {
      var fr = frames[f];
      for (i = (f * 7) % stepPx; i < W * H; i += stepPx) { j = i * 4; samples.push(fr[j], fr[j + 1], fr[j + 2]); }
    }
    var pal = wuQuantize(samples, useDelta ? maxColors - 1 : maxColors);  // keep one slot for transparency
    var m = new Mapper(pal);
    var TRANS = pal.length;
    var tableBits = 1; while ((1 << tableBits) < pal.length + (useDelta ? 1 : 0)) tableBits++;
    var minCode = Math.max(2, tableBits);

    // 2) frames -> {x, y, w, h, data, delay} with delta + crop + merge
    var cs = 100 / (o.fps || 25), carry = 0;
    var ref = new Uint8ClampedArray(W * H * 3);  // source color of each pixel when it was last written
    var out = [];
    for (f = 0; f < frames.length; f++) {
      carry += cs; var delay = Math.round(carry); carry -= delay;
      var src = frames[f], ix = mapFrame(src, W, H, m, o.dither || 0);
      if (f === 0 || !useDelta) {
        for (i = 0; i < W * H; i++) { ref[i * 3] = src[i * 4]; ref[i * 3 + 1] = src[i * 4 + 1]; ref[i * 3 + 2] = src[i * 4 + 2]; }
        out.push({ x: 0, y: 0, w: W, h: H, data: ix, delay: delay });
        continue;
      }
      var x0 = W, y0 = H, x1 = -1, y1 = -1, changed = new Uint8Array(W * H);
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        i = y * W + x; j = i * 4;
        var dr = src[j] - ref[i * 3], dg = src[j + 1] - ref[i * 3 + 1], db = src[j + 2] - ref[i * 3 + 2];
        if (dr * dr + dg * dg + db * db > tol2) {
          changed[i] = 1;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      if (x1 < 0) { out[out.length - 1].delay += delay; continue; }  // nothing changed: hold previous frame longer
      var cw = x1 - x0 + 1, ch = y1 - y0 + 1, data = new Uint8Array(cw * ch);
      for (y = 0; y < ch; y++) for (x = 0; x < cw; x++) {
        i = (y + y0) * W + (x + x0);
        if (changed[i]) {
          data[y * cw + x] = ix[i];
          j = i * 4; ref[i * 3] = src[j]; ref[i * 3 + 1] = src[j + 1]; ref[i * 3 + 2] = src[j + 2];
        } else data[y * cw + x] = TRANS;
      }
      out.push({ x: x0, y: y0, w: cw, h: ch, data: data, delay: delay, trans: true });
    }

    // 3) write the file
    var w = new Writer();
    w.str('GIF89a'); w.word(W); w.word(H);
    w.byte(0x80 | (7 << 4) | (tableBits - 1)); w.byte(0); w.byte(0);
    for (i = 0; i < (1 << tableBits); i++) { var c = pal[i] || [0, 0, 0]; w.byte(c[0]); w.byte(c[1]); w.byte(c[2]); }
    if (out.length > 1) {  // NETSCAPE2.0: loop count (0 = forever)
      w.byte(0x21); w.byte(0xFF); w.byte(11); w.str('NETSCAPE2.0'); w.byte(3); w.byte(1); w.word(o.loop == null ? 0 : o.loop); w.byte(0);
    }
    for (f = 0; f < out.length; f++) {
      var fr2 = out[f];
      // graphic control: disposal 1 (keep) so delta frames draw over the previous one
      w.byte(0x21); w.byte(0xF9); w.byte(4); w.byte((1 << 2) | (fr2.trans ? 1 : 0)); w.word(Math.max(2, fr2.delay)); w.byte(fr2.trans ? TRANS : 0); w.byte(0);
      w.byte(0x2C); w.word(fr2.x); w.word(fr2.y); w.word(fr2.w); w.word(fr2.h); w.byte(0);
      lzw(w, fr2.data, minCode);
    }
    w.byte(0x3B);
    return { bytes: w.result(), frames: out.length, colors: pal.length };
  }

  window.GIF = { encode: encode, quantize: wuQuantize };
})();

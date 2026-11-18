/* store.js - lưu cài đặt + layout vào <userData>/MenMenWorkflow/settings.json, đồng bộ giữa 4 panel. */
(function () {
  var B = window.Bridge;
  var FILE = B.userData ? B.userData.replace(/\\/g, '/') + '/MenMenWorkflow/settings.json' : null;
  var LS_KEY = 'mmw:settings';
  var SYNC = 'com.menmen.workflow.sync';

  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  var cell = function (tool, w, h, extra) {
    var t = window.Tools.get(tool), s = (t && t.size) || [1, 1];
    return Object.assign({ id: uid(), tool: tool, w: w || s[0], h: h || s[1], data: {} }, extra || {});
  };

  function defaults() {
    var L = {};
    L.animation = { id: 'animation', name: 'Animation', cells: [
      cell('easyKeyframes'), cell('clone'), cell('easings'), cell('loop'), cell('fixKeysTime'),
      cell('elastic'), cell('bounce'), cell('sequencer')
    ] };
    L.shapes = { id: 'shapes', name: 'Shapes & Rig', cells: [
      cell('extractShapes'), cell('mergeShapes'), cell('nullsToPoint'), cell('selector'),
      cell('shapesFromVector'), cell('removeArtboards'), cell('createLimb'), cell('positionTrace')
    ] };
    L.layers = { id: 'layers', name: 'Layers', cells: [
      cell('moveAnchor'), cell('addNull'), cell('getColors'), cell('sequencer')
    ] };
    L.comp = { id: 'comp', name: 'Comp & Render', cells: [
      cell('cropComp'), cell('compDuplicator'), cell('unPreComp'), cell('simpleProxy'),
      cell('customScript'), cell('customExpression', 1, 1, { label: 'Wiggle', data: { code: 'wiggle(2, 30)' } })
    ] };
    return {
      version: 1,
      theme: { accent: '#4f8cff', cellSize: 56, gap: 4, fontSize: 11, showLabels: true, helptips: true, followHost: true },
      layouts: L,
      order: ['animation', 'shapes', 'layers', 'comp'],
      panels: {
        'com.menmen.workflow.panel1': { layout: 'animation' },
        'com.menmen.workflow.panel2': { layout: 'shapes' },
        'com.menmen.workflow.panel3': { layout: 'layers' },
        'com.menmen.workflow.panel4': { layout: 'comp' }
      }
    };
  }

  function readRaw() {
    var raw = null;
    if (FILE && B.fs.available) raw = B.fs.read(FILE);
    if (!raw) { try { raw = localStorage.getItem(LS_KEY); } catch (e) { /* ignore */ } }
    return raw;
  }

  function normalize(s) {
    var d = defaults();
    if (!s || typeof s !== 'object' || !s.layouts) return d;
    s.theme = Object.assign({}, d.theme, s.theme || {});
    s.panels = s.panels || {};
    s.order = (s.order || Object.keys(s.layouts)).filter(function (id) { return s.layouts[id]; });
    Object.keys(s.layouts).forEach(function (id) { if (s.order.indexOf(id) < 0) s.order.push(id); });
    if (!s.order.length) return d;
    return s;
  }

  var S = { data: null, listeners: [] };

  S.load = function () {
    var parsed = null, raw = readRaw();
    if (raw) { try { parsed = JSON.parse(raw); } catch (e) { console.warn('settings.json hỏng, dùng mặc định', e); } }
    S.data = normalize(parsed);
    return S.data;
  };

  var timer = null;
  S.save = function (immediate) {
    clearTimeout(timer);
    var go = function () {
      var json = JSON.stringify(S.data, null, 2);
      if (FILE && B.fs.available) B.fs.write(FILE, json);
      try { localStorage.setItem(LS_KEY, json); } catch (e) { /* ignore */ }
      B.emit(SYNC, { from: B.extId, t: Date.now() });
    };
    if (immediate) go(); else timer = setTimeout(go, 250);
  };

  S.onExternalChange = function (fn) {
    B.on(SYNC, function (d) { if (!d || d.from !== B.extId) { S.load(); fn(); } });
  };

  // ----- layout helpers -----
  S.panel = function () {
    var p = S.data.panels[B.extId];
    if (!p || !S.data.layouts[p.layout]) {
      p = S.data.panels[B.extId] = { layout: S.data.order[(Number(B.panelNo) - 1) % S.data.order.length] || S.data.order[0] };
    }
    return p;
  };
  S.layout = function () { return S.data.layouts[S.panel().layout]; };
  S.setLayout = function (id) { S.panel().layout = id; S.save(); };
  S.newLayout = function (name, cells) {
    var id = 'l' + uid();
    S.data.layouts[id] = { id: id, name: name, cells: cells || [] };
    S.data.order.push(id);
    return id;
  };
  S.duplicateLayout = function (id) {
    var src = S.data.layouts[id];
    var cells = JSON.parse(JSON.stringify(src.cells)).map(function (c) { c.id = uid(); return c; });
    return S.newLayout(src.name + ' copy', cells);
  };
  S.deleteLayout = function (id) {
    if (S.data.order.length <= 1) return false;
    delete S.data.layouts[id];
    S.data.order = S.data.order.filter(function (x) { return x !== id; });
    Object.keys(S.data.panels).forEach(function (k) {
      if (S.data.panels[k].layout === id) S.data.panels[k].layout = S.data.order[0];
    });
    return true;
  };
  S.newCell = cell;
  S.reset = function () { S.data = defaults(); S.save(true); };
  S.importJSON = function (txt) { S.data = normalize(JSON.parse(txt)); S.save(true); };
  S.exportJSON = function () { return JSON.stringify(S.data, null, 2); };
  S.file = FILE;

  window.Store = S;
})();

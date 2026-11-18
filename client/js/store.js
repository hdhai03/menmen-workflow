/* store.js - settings shared by the main panel + 4 sub panels.
 * Saved to <userData>/MenMenWorkflow/settings.json and synced between panels via CEP events. */
(function () {
  var B = window.Bridge;
  var FILE = B.userData ? B.userData.replace(/\\/g, '/') + '/MenMenWorkflow/settings.json' : null;
  var LS_KEY = 'mmw:settings:v2';
  var SYNC = 'com.menmen.workflow.sync';
  var SLOTS = ['com.menmen.workflow.panel1', 'com.menmen.workflow.panel2', 'com.menmen.workflow.panel3', 'com.menmen.workflow.panel4'];

  var TOOLS_NAME = 'MenMen Tools', TOOLS_SLOT = 'com.menmen.workflow.panel1';
  var uid = function () { return Math.random().toString(36).slice(2, 9); };

  // Default contents of MenMen Tools (Panel 1, Layout view): slim rows, inline widgets, one-click tools.
  // Also used for new quick panels and for "Reset to default".
  function quickItems() {
    var it = function (tool, w, h) { var o = { id: uid(), type: 'tool', tool: tool }; if (w) { o.w = w; o.h = h; } return o; };
    return [
      it('diskCache'), it('easyKeyframes', 2, 2), { id: uid(), type: 'quickAccess' }, it('addRow'), it('alignRow'), it('splitRow'),
      it('easings', 2, 1), it('sequencer', 2, 1), it('moveAnchor', 2, 2), it('addNull'), it('clone'), it('cloneMirror'), it('loop'),
      it('elastic'), it('bounce'), it('fixKeysTime'), it('easingPresets'),
      it('extractShapes'), it('mergeShapes'), it('nullsToPoint'), it('selectPaths'),
      it('cropComp'), it('preCompose'), it('unPreComp'), it('positionTrace')
    ];
  }

  function defaults() {
    return {
      version: 2,
      theme: { style: 'color', iconSize: 'm', tooltips: true, followHost: true, native: false, accent: '#4f8cff' },
      favorites: ['clone', 'easyKeyframes', 'addNull', 'moveAnchor', 'sequencer'],
      userPanels: {
        quick: { id: 'quick', name: TOOLS_NAME, items: quickItems(), fixed: true },
        up1: { id: 'up1', name: 'User Panel 1', items: [
          { id: uid(), type: 'tool', tool: 'easingPresets' },
          { id: uid(), type: 'tool', tool: 'loop' },
          { id: uid(), type: 'divider' },
          { id: uid(), type: 'expression', label: 'Wiggle 2/30', code: 'wiggle(2, 30)' },
          { id: uid(), type: 'command', label: 'Pre-compose…', command: 'Pre-compose...' },
          { id: uid(), type: 'effect', label: 'Gaussian Blur', effect: 'ADBE Gaussian Blur 2' }
        ] }
      },
      upOrder: ['up1'],  // user panels only - MenMen Tools ('quick') is listed on its own
      hidden: {},        // { catId: [toolId,...] } - tools hidden in category panels
      params: {},        // { toolId: {...} } - last used parameters
      slots: { 'com.menmen.workflow.panel1': { kind: 'user', id: 'quick', view: 'layout' } },  // { extId: { kind, id, view: 'list'|'grid'|'layout' } }
      quickAdded: true,
      curves: [],        // saved Graph Editor curves [{ name, bz: [x1,y1,x2,y2] }]
      usage: {},         // { toolId: { n: run count, t: last run } } - feeds Quick Access
      qaAdded: true,
      rowsAdded: true,
      splitAdded: true,
      main: { collapsedFav: false, iconsOnly: false, together: true }
    };
  }

  function normalize(s) {
    var d = defaults();
    if (!s || typeof s !== 'object' || s.version !== 2) return d;
    s.theme = Object.assign({}, d.theme, s.theme || {});
    ['favorites', 'upOrder'].forEach(function (k) { if (!Array.isArray(s[k])) s[k] = d[k]; });
    if (!Array.isArray(s.curves)) s.curves = [];
    if (!s.usage || typeof s.usage !== 'object') s.usage = {};
    ['userPanels', 'hidden', 'params', 'slots', 'main'].forEach(function (k) { if (!s[k] || typeof s[k] !== 'object') s[k] = d[k]; });
    s.upOrder = s.upOrder.filter(function (id) { return s.userPanels[id] && id !== 'quick'; });
    Object.keys(s.userPanels).forEach(function (id) { if (id !== 'quick' && s.upOrder.indexOf(id) < 0) s.upOrder.push(id); });
    // script:* favorites are registered later, once the host has listed the script library
    if (!s.quickAdded && !s.userPanels.quick) {  // older settings: add the Quick Panel once
      s.userPanels.quick = { id: 'quick', name: TOOLS_NAME, items: quickItems(), fixed: true };
      s.quickAdded = true;
    }
    if (!s.userPanels.quick) s.userPanels.quick = { id: 'quick', name: TOOLS_NAME, items: quickItems(), fixed: true };
    var tp = s.userPanels.quick;
    tp.fixed = true;
    if (!tp.name || tp.name === 'Quick Panel') tp.name = TOOLS_NAME;
    if (!s.rowsAdded) {  // older settings: add the slim rows (disk cache, add layer, align) once
      var has = function (tool) { return tp.items.some(function (x) { return x.type === 'tool' && x.tool === tool; }); };
      var after = 0;
      tp.items.forEach(function (x, i) { if (x.type === 'quickAccess' || (x.type === 'tool' && x.tool === 'easyKeyframes')) after = i + 1; });
      var add = [];
      if (!has('addRow')) add.push({ id: uid(), type: 'tool', tool: 'addRow' });
      if (!has('alignRow')) add.push({ id: uid(), type: 'tool', tool: 'alignRow' });
      if (!has('splitRow')) add.push({ id: uid(), type: 'tool', tool: 'splitRow' });
      tp.items.splice.apply(tp.items, [after, 0].concat(add));
      if (!has('diskCache')) tp.items.unshift({ id: uid(), type: 'tool', tool: 'diskCache' });
      if (!s.slots[TOOLS_SLOT]) s.slots[TOOLS_SLOT] = { kind: 'user', id: 'quick', view: 'layout' };
    }
    s.rowsAdded = true;
    if (!s.splitAdded) {  // the Split Text row came later: add it under the Align row once
      var hasSplit = tp.items.some(function (x) { return x.tool === 'splitRow'; });
      if (!hasSplit) {
        var at = tp.items.length;
        tp.items.forEach(function (x, i) { if (x.tool === 'alignRow') at = i + 1; });
        tp.items.splice(at, 0, { id: uid(), type: 'tool', tool: 'splitRow' });
      }
    }
    s.splitAdded = true;
    if (!s.qaAdded && s.userPanels.quick) {  // older settings: add Quick Access under the Graph Editor once
      var qi = s.userPanels.quick.items, at = 0;
      for (var i = 0; i < qi.length; i++) if (qi[i].type === 'tool' && qi[i].tool === 'easyKeyframes') { at = i + 1; break; }
      if (!qi.some(function (x) { return x.type === 'quickAccess'; })) qi.splice(at, 0, { id: uid(), type: 'quickAccess' });
    }
    s.qaAdded = true;
    s.favorites = s.favorites.filter(function (id) { return window.Tools.get(id) || /^script:/.test(id); });
    return s;
  }

  function readRaw() {
    var raw = null;
    if (FILE && B.fs.available) raw = B.fs.read(FILE);
    if (!raw) { try { raw = localStorage.getItem(LS_KEY); } catch (e) { /* ignore */ } }
    return raw;
  }

  var S = { data: null, SLOTS: SLOTS, file: FILE, uid: uid };

  S.load = function () {
    var parsed = null, raw = readRaw();
    if (raw) { try { parsed = JSON.parse(raw); } catch (e) { console.warn('settings.json is corrupt, using defaults', e); } }
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
    if (immediate) go(); else timer = setTimeout(go, 200);
  };
  // Another panel saved. fn(onlyUsage): onlyUsage = nothing but run counts changed, so the panel
  // can refresh Quick Access instead of rebuilding everything (graph, widgets, disk meter...).
  var snap = function () { var u = S.data.usage; S.data.usage = null; var j = JSON.stringify(S.data); S.data.usage = u; return j; };
  S.onExternalChange = function (fn) {
    B.on(SYNC, function (d) {
      if (d && d.from === B.extId) return;
      var before = snap();
      S.load();
      fn(snap() === before);
    });
  };

  // ----- favorites -----
  S.isFav = function (id) { return S.data.favorites.indexOf(id) >= 0; };
  S.toggleFav = function (id) {
    var f = S.data.favorites, i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1); else f.push(id);
    S.save();
  };

  // ----- hidden tools in category panels -----
  S.isHidden = function (cat, id) { return (S.data.hidden[cat] || []).indexOf(id) >= 0; };
  S.toggleHidden = function (cat, id) {
    var h = S.data.hidden[cat] = S.data.hidden[cat] || [], i = h.indexOf(id);
    if (i >= 0) h.splice(i, 1); else h.push(id);
    S.save();
  };

  // ----- params -----
  S.params = function (tool) {
    var saved = S.data.params[tool.id] || {}, out = {};
    (tool.params || []).forEach(function (p) { out[p.key] = saved[p.key] !== undefined ? saved[p.key] : p.def; });
    Object.keys(saved).forEach(function (k) { if (out[k] === undefined) out[k] = saved[k]; });
    return out;
  };
  S.setParams = function (id, v) { S.data.params[id] = v; S.save(); };
  S.widgetData = function (id) { return (S.data.params[id] = S.data.params[id] || {}); };

  // ----- user panels -----
  S.newUserPanel = function (name) {
    var id = 'up' + uid();
    S.data.userPanels[id] = { id: id, name: name, items: [] };
    S.data.upOrder.push(id);
    S.save();
    return id;
  };
  S.deleteUserPanel = function (id) {
    delete S.data.userPanels[id];
    S.data.upOrder = S.data.upOrder.filter(function (x) { return x !== id; });
    Object.keys(S.data.slots).forEach(function (k) {
      var sl = S.data.slots[k];
      if (sl && sl.kind === 'user' && sl.id === id) delete S.data.slots[k];
    });
    S.save();
  };

  // ----- slots (sub panels) -----
  S.slot = function (extId) { return S.data.slots[extId] || null; };
  S.setSlot = function (extId, kind, id) {
    var prev = S.data.slots[extId] || {};
    S.data.slots[extId] = { kind: kind, id: id, view: prev.view || 'list' };
    S.save(true);
  };
  S.clearSlot = function (extId) { delete S.data.slots[extId]; S.save(true); };
  // The slot already showing this content, or the first empty slot.
  S.findSlot = function (kind, id) {
    var i;
    for (i = 0; i < SLOTS.length; i++) {
      var s = S.data.slots[SLOTS[i]];
      if (s && s.kind === kind && s.id === id) return { ext: SLOTS[i], existing: true };
    }
    if (kind === 'user' && id === 'quick') return { ext: TOOLS_SLOT, existing: false };
    for (i = 0; i < SLOTS.length; i++) if (SLOTS[i] !== TOOLS_SLOT && !S.data.slots[SLOTS[i]]) return { ext: SLOTS[i], existing: false };
    return null;
  };
  S.contentName = function (slot) {
    if (!slot) return null;
    if (slot.kind === 'category') { var c = window.Tools.cat(slot.id); return c ? c.name : null; }
    var u = S.data.userPanels[slot.id];
    return u ? u.name : null;
  };

  S.quickItems = quickItems;
  S.TOOLS_NAME = TOOLS_NAME; S.TOOLS_SLOT = TOOLS_SLOT;
  S.panelIds = function () { return (S.data.userPanels.quick ? ['quick'] : []).concat(S.data.upOrder); };
  S.resetTools = function () { S.data.userPanels.quick.items = quickItems(); S.save(true); };
  // ----- usage (Quick Access) -----
  S.track = function (id) {
    if (!id || !window.Tools.get(id)) return;
    var u = S.data.usage[id] || (S.data.usage[id] = { n: 0, t: 0 });
    u.n++; u.t = Date.now();
    S.save();
  };
  // Most used tools: run count, then most recent. exclude = { toolId: true }
  S.topUsed = function (limit, exclude) {
    return Object.keys(S.data.usage).filter(function (id) { return window.Tools.get(id) && !(exclude && exclude[id]) && S.data.usage[id].n > 0; })
      .sort(function (a, b) { var x = S.data.usage[a], y = S.data.usage[b]; return (y.n - x.n) || (y.t - x.t); })
      .slice(0, limit);
  };
  S.forget = function (id) { if (id) delete S.data.usage[id]; else S.data.usage = {}; S.save(); };
  S.reset = function () { S.data = defaults(); S.save(true); };
  S.importJSON = function (txt) { S.data = normalize(JSON.parse(txt)); S.save(true); };
  S.exportJSON = function () { return JSON.stringify(S.data, null, 2); };

  window.Store = S;
})();

/* store.js - settings shared by the main panel + 4 sub panels.
 * Saved to <userData>/MenMenWorkflow/settings.json and synced between panels via CEP events. */
(function () {
  var B = window.Bridge;
  var FILE = B.userData ? B.userData.replace(/\\/g, '/') + '/MenMenWorkflow/settings.json' : null;
  var LS_KEY = 'mmw:settings:v2';
  var SYNC = 'com.menmen.workflow.sync';
  var SLOTS = ['com.menmen.workflow.panel1', 'com.menmen.workflow.panel2', 'com.menmen.workflow.panel3', 'com.menmen.workflow.panel4'];

  var uid = function () { return Math.random().toString(36).slice(2, 9); };

  function defaults() {
    return {
      version: 2,
      theme: { style: 'color', iconSize: 'm', tooltips: true, followHost: true, accent: '#4f8cff' },
      favorites: ['clone', 'easyKeyframes', 'addNull', 'moveAnchor', 'sequencer'],
      userPanels: {
        up1: { id: 'up1', name: 'User Panel 1', items: [
          { id: uid(), type: 'tool', tool: 'easingPresets' },
          { id: uid(), type: 'tool', tool: 'loop' },
          { id: uid(), type: 'divider' },
          { id: uid(), type: 'expression', label: 'Wiggle 2/30', code: 'wiggle(2, 30)' },
          { id: uid(), type: 'command', label: 'Pre-compose…', command: 'Pre-compose...' },
          { id: uid(), type: 'effect', label: 'Gaussian Blur', effect: 'ADBE Gaussian Blur 2' }
        ] }
      },
      upOrder: ['up1'],
      hidden: {},        // { catId: [toolId,...] } - tools hidden in category panels
      params: {},        // { toolId: {...} } - last used parameters
      slots: {},         // { extId: { kind: 'category'|'user', id, view: 'list'|'grid' } }
      main: { collapsedFav: false }
    };
  }

  function normalize(s) {
    var d = defaults();
    if (!s || typeof s !== 'object' || s.version !== 2) return d;
    s.theme = Object.assign({}, d.theme, s.theme || {});
    ['favorites', 'upOrder'].forEach(function (k) { if (!Array.isArray(s[k])) s[k] = d[k]; });
    ['userPanels', 'hidden', 'params', 'slots', 'main'].forEach(function (k) { if (!s[k] || typeof s[k] !== 'object') s[k] = d[k]; });
    s.upOrder = s.upOrder.filter(function (id) { return s.userPanels[id]; });
    Object.keys(s.userPanels).forEach(function (id) { if (s.upOrder.indexOf(id) < 0) s.upOrder.push(id); });
    // script:* favorites are registered later, once the host has listed the script library
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
  S.onExternalChange = function (fn) {
    B.on(SYNC, function (d) { if (!d || d.from !== B.extId) { S.load(); fn(); } });
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
    for (i = 0; i < SLOTS.length; i++) if (!S.data.slots[SLOTS[i]]) return { ext: SLOTS[i], existing: false };
    return null;
  };
  S.contentName = function (slot) {
    if (!slot) return null;
    if (slot.kind === 'category') { var c = window.Tools.cat(slot.id); return c ? c.name : null; }
    var u = S.data.userPanels[slot.id];
    return u ? u.name : null;
  };

  S.reset = function () { S.data = defaults(); S.save(true); };
  S.importJSON = function (txt) { S.data = normalize(JSON.parse(txt)); S.save(true); };
  S.exportJSON = function () { return JSON.stringify(S.data, null, 2); };

  window.Store = S;
})();

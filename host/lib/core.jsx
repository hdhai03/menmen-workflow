// core.jsx - helpers shared by all tools (ES3, ExtendScript).
MMW.VERSION = "0.6.2";

MMW.fail = function (msg) { throw new Error(msg); };

// Read-only calls: they change nothing in the project, so they skip the undo group.
MMW.READ_ONLY = { diskCacheInfo: 1, exportInfo: 1, readEase: 1, hostInfo: 1, listLibrary: 1, openScriptsFolder: 1,
    revealFile: 1, removeFolder: 1, gifFrames: 1, exportPng: 1, purgeCache: 1, revealProjectFolder: 1, revealLayerSource: 1,
    depthInfo: 1, depthFrames: 1, depthReady: 1,
    pathVisualizer: 1 };  // Path Visualizer opens its own undo groups

// Runs a tool inside an undo group and returns "OK|msg" or "ERR|msg" to the panel.
MMW.run = function (id, opts) {
    var fn = MMW.tools[id];
    if (!fn) return "ERR|Tool not found: " + id;
    opts = opts || {};
    if (MMW.READ_ONLY[id]) {
        try { var q = fn(opts); return "OK|" + (q === undefined || q === null ? "" : q); }
        catch (e0) { return "ERR|" + e0.message + (e0.line ? " (line " + e0.line + ")" : ""); }
    }
    app.beginUndoGroup("MenMen: " + id);
    try {
        var r = fn(opts);
        return "OK|" + (r === undefined || r === null ? "" : r);
    } catch (e) {
        return "ERR|" + e.message + (e.line ? " (line " + e.line + ")" : "");
    } finally {
        app.endUndoGroup();
    }
};

// The comp to work on. app.project.activeItem can be empty while a CEP panel has focus,
// so fall back to the active viewer, then to a single comp selected in the Project panel.
MMW.comp = function () {
    var c = app.project.activeItem;
    if (c && c instanceof CompItem) return c;
    try {
        var v = app.activeViewer;
        if (v && v.type === ViewerType.VIEWER_COMPOSITION) {
            v.setActive();
            c = app.project.activeItem;
            if (c && c instanceof CompItem) return c;
        }
    } catch (e) {}
    var sel = app.project.selection, found = null;
    for (var i = 0; i < sel.length; i++) {
        if (sel[i] instanceof CompItem) { if (found) { found = null; break; } found = sel[i]; }
    }
    if (found) return found;
    MMW.fail("Open (activate) a composition first.");
};

MMW.selLayers = function (c, min) {
    var s = c.selectedLayers, out = [];
    min = min || 1;
    if (s.length < min) MMW.fail("Select at least " + min + " layer(s).");
    for (var i = 0; i < s.length; i++) out.push(s[i]);
    return out;
};

MMW.sortByIndex = function (arr) {
    arr.sort(function (a, b) { return a.index - b.index; });
    return arr;
};

MMW.indexOf = function (arr, v) {
    for (var i = 0; i < arr.length; i++) if (arr[i] === v) return i;
    return -1;
};

MMW.quote = function (s) {
    return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
};

MMW.isProp = function (p) { return p && p.propertyType === PropertyType.PROPERTY; };

// Selected Properties (not groups) on the selected layers.
MMW.selProps = function (c) {
    var out = [], L = c.selectedLayers;
    for (var i = 0; i < L.length; i++) {
        var sp = L[i].selectedProperties;
        for (var j = 0; j < sp.length; j++) {
            if (MMW.isProp(sp[j])) out.push({ layer: L[i], prop: sp[j] });
        }
    }
    return out;
};

// Properties with selected keyframes: [{layer, prop, keys:[index...]}]
MMW.keyProps = function (c, need) {
    var out = [], all = MMW.selProps(c);
    for (var i = 0; i < all.length; i++) {
        var p = all[i].prop;
        if (p.numKeys > 0 && p.selectedKeys && p.selectedKeys.length) {
            var ks = [];
            for (var k = 0; k < p.selectedKeys.length; k++) ks.push(p.selectedKeys[k]);
            ks.sort(function (a, b) { return a - b; });
            out.push({ layer: all[i].layer, prop: p, keys: ks });
        }
    }
    if (need !== false && !out.length) MMW.fail("Select some keyframes.");
    return out;
};

// ---- Read / write all data of a keyframe ----
MMW.readKey = function (p, k) {
    var d = { t: p.keyTime(k), v: p.keyValue(k), inI: p.keyInInterpolationType(k), outI: p.keyOutInterpolationType(k) };
    try { d.inE = p.keyInTemporalEase(k); d.outE = p.keyOutTemporalEase(k); } catch (e1) {}
    try { d.tc = p.keyTemporalContinuous(k); d.tab = p.keyTemporalAutoBezier(k); } catch (e2) {}
    if (p.isSpatial) {
        try {
            d.inT = p.keyInSpatialTangent(k); d.outT = p.keyOutSpatialTangent(k);
            d.sc = p.keySpatialContinuous(k); d.sab = p.keySpatialAutoBezier(k); d.rov = p.keyRoving(k);
        } catch (e3) {}
    }
    try { d.label = p.keyLabel(k); } catch (e4) {}
    return d;
};

MMW.writeKey = function (p, d, t, opt) {
    opt = opt || {};
    var k = p.addKey(t);
    if (opt.noValue !== true) { try { p.setValueAtKey(k, d.v); } catch (e0) {} }
    if (opt.noEase !== true) {
        if (d.inE && d.outE) { try { p.setTemporalEaseAtKey(k, MMW.fitEase(p, k, d.inE), MMW.fitEase(p, k, d.outE)); } catch (e1) {} }
        try { p.setInterpolationTypeAtKey(k, d.inI, d.outI); } catch (e2) {}
        try { if (d.tc !== undefined) { p.setTemporalContinuousAtKey(k, d.tc); p.setTemporalAutoBezierAtKey(k, d.tab); } } catch (e3) {}
    }
    if (d.inT && p.isSpatial) {
        try {
            p.setSpatialContinuousAtKey(k, d.sc); p.setSpatialAutoBezierAtKey(k, d.sab);
            p.setSpatialTangentsAtKey(k, d.inT, d.outT);
            if (d.rov) p.setRovingAtKey(k, true);
        } catch (e4) {}
    }
    if (d.label !== undefined) { try { p.setLabelAtKey(k, d.label); } catch (e5) {} }
    return k;
};

// Adapts a KeyframeEase array to the target property's dimensions.
MMW.fitEase = function (p, k, ease) {
    var n = 1;
    try { n = p.keyInTemporalEase(k).length; } catch (e) {}
    var out = [];
    for (var i = 0; i < n; i++) {
        var s = ease[Math.min(i, ease.length - 1)];
        out.push(new KeyframeEase(s.speed, Math.max(0.1, Math.min(100, s.influence))));
    }
    return out;
};

// Average speed of the segment between keys a and b for ease dimension d (signed; spatial = path length / time).
MMW.segAvgSpeed = function (p, a, b, d) {
    var dt = p.keyTime(b) - p.keyTime(a);
    if (dt <= 0) return 0;
    var va = p.keyValue(a), vb = p.keyValue(b), dims = p.keyOutTemporalEase(a).length;
    if (!(va instanceof Array)) return (vb - va) / dt;
    if (dims === 1) {
        var sum = 0;
        for (var i = 0; i < va.length; i++) sum += (vb[i] - va[i]) * (vb[i] - va[i]);
        return Math.sqrt(sum) / dt;
    }
    return (vb[d] - va[d]) / dt;
};

// Moves keys (indices) to new times: fnTime(keyData, i) => time
MMW.moveKeys = function (p, keys, fnTime) {
    var data = [], i;
    for (i = 0; i < keys.length; i++) data.push(MMW.readKey(p, keys[i]));
    for (i = keys.length - 1; i >= 0; i--) p.removeKey(keys[i]);
    var newKeys = [];
    for (i = 0; i < data.length; i++) newKeys.push(MMW.writeKey(p, data[i], fnTime(data[i], i)));
    return newKeys;
};

MMW.addVec = function (a, b) {
    if (!(a instanceof Array)) return a + b;
    var r = [];
    for (var i = 0; i < a.length; i++) r.push(a[i] + (i < b.length ? b[i] : 0));
    return r;
};

// Adds an offset to a property (all keyframes or the static value).
MMW.offsetProp = function (p, delta) {
    if (p.numKeys > 0) {
        for (var k = 1; k <= p.numKeys; k++) p.setValueAtKey(k, MMW.addVec(p.keyValue(k), delta));
    } else {
        p.setValue(MMW.addVec(p.value, delta));
    }
};

// Recursively walks every Property inside a group/layer.
MMW.walkProps = function (group, fn) {
    for (var i = 1; i <= group.numProperties; i++) {
        var p = group.property(i);
        if (!p) continue;
        if (p.propertyType === PropertyType.PROPERTY) fn(p);
        else MMW.walkProps(p, fn);
    }
};

MMW.removeLayerAndSource = function (layer) {
    var src = null;
    try { src = layer.source; } catch (e) {}
    layer.remove();
    try { if (src && src.usedIn && src.usedIn.length === 0) src.remove(); } catch (e2) {}
};

// Helper layer used to ask AE for the value of an expression (toComp, sourceRectAtTime...).
MMW.helper = function (comp) {
    var h = comp.layers.addNull();
    h.name = "__mmw_helper__";
    h.enabled = false;
    var fx = h.property("ADBE Effect Parade");
    fx.addProperty("ADBE Point3D Control");
    fx.addProperty("ADBE Point3D Control");
    return {
        layer: h,
        evalAt: function (expr, t, slot) {
            var p = h.property("ADBE Effect Parade").property(slot || 1).property(1);
            p.expression = expr;
            return p.valueAtTime(t, false);
        },
        remove: function () { MMW.removeLayerAndSource(h); }
    };
};

// Expression reference to a property (uses index/matchName so it is language independent).
MMW.exprRef = function (prop) {
    var chain = [], p = prop;
    while (p.parentProperty) { chain.unshift(p); p = p.parentProperty; }
    var layer = p;
    var s = "thisComp.layer(" + MMW.quote(layer.name) + ")";
    for (var i = 0; i < chain.length; i++) {
        var c = chain[i], parent = chain[i].parentProperty;
        if (parent.propertyType === PropertyType.INDEXED_GROUP) s += "(" + c.propertyIndex + ")";
        else s += "(" + MMW.quote(c.matchName) + ")";
    }
    return s;
};

// Gets a property by an index path from the layer: [i1, i2, ...]. Always re-resolved to avoid invalid objects.
MMW.resolve = function (layer, path) {
    var p = layer;
    for (var i = 0; i < path.length; i++) p = p.property(path[i]);
    return p;
};

// Copies value / keyframes / expression from one Property to another.
MMW.copyPropValue = function (sp, dp) {
    try {
        if (sp.propertyValueType === PropertyValueType.NO_VALUE) return;
        if (sp.numKeys > 0) {
            for (var k = 1; k <= sp.numKeys; k++) MMW.writeKey(dp, MMW.readKey(sp, k), sp.keyTime(k));
        } else if (!sp.isTimeVarying || sp.numKeys === 0) {
            dp.setValue(sp.value);
        }
    } catch (e) {}
    try { if (sp.canSetExpression && sp.expression !== "") { dp.expression = sp.expression; dp.expressionEnabled = sp.expressionEnabled; } } catch (e2) {}
};

// Recursively copies shape contents between 2 layers using index paths.
MMW.copyGroup = function (srcLayer, srcPath, dstLayer, dstPath) {
    var src = MMW.resolve(srcLayer, srcPath);
    var n = src.numProperties;
    for (var i = 1; i <= n; i++) {
        src = MMW.resolve(srcLayer, srcPath);
        var sp = src.property(i);
        var dst = MMW.resolve(dstLayer, dstPath);
        if (sp.propertyType === PropertyType.PROPERTY) {
            var dp = dst.property(sp.matchName);
            if (dp) MMW.copyPropValue(sp, dp);
            continue;
        }
        var newIdx;
        if (dst.propertyType === PropertyType.INDEXED_GROUP) {
            if (!dst.canAddProperty(sp.matchName)) continue;
            var added = dst.addProperty(sp.matchName);
            newIdx = added.propertyIndex;
            try { added.name = sp.name; } catch (e) {}
        } else {
            var ex = dst.property(sp.matchName);
            if (!ex) continue;
            newIdx = ex.propertyIndex;
        }
        try {
            var sEnabled = sp.enabled;
            MMW.copyGroup(srcLayer, srcPath.concat([i]), dstLayer, dstPath.concat([newIdx]));
            if (!sEnabled) MMW.resolve(dstLayer, dstPath.concat([newIdx])).enabled = false;
        } catch (e3) {}
    }
};

MMW.newNull = function (comp, name) {
    var n = comp.layers.addNull();
    n.name = name;
    n.transform.anchorPoint.setValue([50, 50]);
    return n;
};

MMW.addEffect = function (layer, matchName, name) {
    var fx = layer.property("ADBE Effect Parade").addProperty(matchName);
    fx.name = name;
    return layer.property("ADBE Effect Parade").property(fx.propertyIndex);
};

MMW.uniqueLayerName = function (comp, base) {
    var name = base, n = 1, taken = {};
    for (var i = 1; i <= comp.numLayers; i++) taken[comp.layer(i).name] = true;
    while (taken[name]) { n++; name = base + " " + n; }
    return name;
};

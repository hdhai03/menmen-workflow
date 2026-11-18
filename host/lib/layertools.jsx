// layertools.jsx - parent, rename, label colors, lock, shy/solo, reset, trim, duplicate
(function () {
    var T = MMW.tools;

    function withUnlock(L, fn) { var lk = L.locked; L.locked = false; try { fn(); } finally { L.locked = lk; } }

    // ---------- Parent ----------
    // All selected layers become children of the first selected layer.
    T.parentToFirst = function () {
        var c = MMW.comp(), s = MMW.selLayers(c, 2), p = s[0], n = 0;
        for (var i = 1; i < s.length; i++) { (function (L) { withUnlock(L, function () { L.parent = p; }); })(s[i]); n++; }
        return n + " layer(s) → parented to \"" + p.name + "\".";
    };
    // Each layer becomes a child of the layer directly above it.
    T.parentToAbove = function () {
        var c = MMW.comp(), s = MMW.sortByIndex(MMW.selLayers(c)), n = 0;
        for (var i = 0; i < s.length; i++) {
            if (s[i].index === 1) continue;
            (function (L) { withUnlock(L, function () { L.parent = c.layer(L.index - 1); }); })(s[i]);
            n++;
        }
        return "Parented " + n + " layer(s) to the layer above.";
    };
    // Parent chain in selection order: 2 → 1, 3 → 2, ...
    T.parentChain = function () {
        var c = MMW.comp(), s = MMW.selLayers(c, 2);
        for (var i = 1; i < s.length; i++) (function (L, P) { withUnlock(L, function () { L.parent = P; }); })(s[i], s[i - 1]);
        return "Chained " + s.length + " layers.";
    };
    T.unparent = function () {
        var c = MMW.comp(), s = MMW.selLayers(c);
        for (var i = 0; i < s.length; i++) (function (L) { withUnlock(L, function () { L.parent = null; }); })(s[i]);
        return "Unparented " + s.length + " layer(s).";
    };

    // ---------- Duplicate ----------
    // o.count: copies per layer.
    T.duplicateLayers = function (o) {
        var c = MMW.comp(), s = MMW.selLayers(c), n = Math.max(1, Math.min(200, parseInt(o.count, 10) || 1)), made = 0;
        for (var i = 0; i < s.length; i++) for (var k = 0; k < n; k++) { s[i].duplicate(); made++; }
        return "Created " + made + " duplicate(s).";
    };

    // ---------- Rename ----------
    // o.name (new name + number), o.start, o.prefix, o.suffix, o.find, o.replace
    T.renameLayers = function (o) {
        var c = MMW.comp(), s = MMW.sortByIndex(MMW.selLayers(c)), num = parseInt(o.start, 10);
        if (isNaN(num)) num = 1;
        for (var i = 0; i < s.length; i++) {
            var L = s[i], name = L.name;
            if (o.name) name = o.name + " " + (num + i);
            if (o.find) name = name.split(o.find).join(o.replace || "");
            name = (o.prefix || "") + name + (o.suffix || "");
            L.name = name;
        }
        return "Renamed " + s.length + " layer(s).";
    };

    // ---------- Label colors ----------
    // o.mode: "type" (by layer type) | "random" | "1".."16" (single label)
    T.setLayerColors = function (o) {
        var c = MMW.comp(), s = c.selectedLayers.length ? c.selectedLayers : null, mode = String(o.mode || "type"), n = 0;
        for (var i = 1; i <= c.numLayers; i++) {
            var L = c.layer(i);
            if (s && !L.selected) continue;
            var lab;
            if (mode === "random") lab = 1 + Math.floor(Math.random() * 16);
            else if (mode === "type") {
                lab = L instanceof TextLayer ? 1 : L instanceof ShapeLayer ? 8 : L instanceof CameraLayer ? 4 :
                    L instanceof LightLayer ? 6 : L.nullLayer ? 2 : L.adjustmentLayer ? 5 :
                    (L.source instanceof CompItem) ? 13 : (L.hasAudio && !L.hasVideo) ? 11 : 9;
            } else lab = Math.max(0, Math.min(16, parseInt(mode, 10) || 0));
            L.label = lab; n++;
        }
        return "Recolored " + n + " layer(s).";
    };

    // ---------- Lock / Shy / Solo ----------
    // Locks or unlocks all layers. Alt: selected layers only.
    T.lockToggle = function (o) {
        var c = MMW.comp(), list = [], i;
        for (i = 1; i <= c.numLayers; i++) if (!o.alt || c.layer(i).selected) list.push(c.layer(i));
        var anyUnlocked = false;
        for (i = 0; i < list.length; i++) if (!list[i].locked) anyUnlocked = true;
        for (i = 0; i < list.length; i++) list[i].locked = anyUnlocked;
        return (anyUnlocked ? "Locked " : "Unlocked ") + list.length + " layer(s).";
    };
    // Click: toggle shy on the selected layers. Alt: toggle the comp's "Hide Shy Layers".
    T.shyToggle = function (o) {
        var c = MMW.comp();
        if (o.alt) { c.hideShyLayers = !c.hideShyLayers; return "Hide Shy Layers: " + (c.hideShyLayers ? "on" : "off"); }
        var s = MMW.selLayers(c);
        for (var i = 0; i < s.length; i++) s[i].shy = !s[i].shy;
        return "Toggled shy on " + s.length + " layer(s).";
    };
    // Shows only the selected layers in the timeline (via shy). Run again to show all.
    T.soloTimeline = function () {
        var c = MMW.comp(), i;
        if (c.hideShyLayers && $.global.__mmwSoloShy) {
            for (i = 1; i <= c.numLayers; i++) c.layer(i).shy = false;
            c.hideShyLayers = false; $.global.__mmwSoloShy = false;
            return "All layers visible again.";
        }
        var s = MMW.selLayers(c);
        for (i = 1; i <= c.numLayers; i++) c.layer(i).shy = !c.layer(i).selected;
        c.hideShyLayers = true; $.global.__mmwSoloShy = true;
        return "Timeline shows " + s.length + " layer(s) only (run again to show all).";
    };
    // Click: toggle Solo on the selected layers. Alt: unsolo all layers.
    T.soloViewer = function (o) {
        var c = MMW.comp(), i;
        if (o.alt) { for (i = 1; i <= c.numLayers; i++) try { c.layer(i).solo = false; } catch (e) {} return "Solo cleared."; }
        var s = MMW.selLayers(c);
        for (i = 0; i < s.length; i++) s[i].solo = !s[i].solo;
        return "Toggled solo on " + s.length + " layer(s).";
    };
    T.toggleVisibility = function () {
        var c = MMW.comp(), s = MMW.selLayers(c);
        for (var i = 0; i < s.length; i++) s[i].enabled = !s[i].enabled;
        return "Toggled visibility of " + s.length + " layer(s).";
    };

    // ---------- Reset ----------
    // Resets the transform (removes keyframes). Alt: keep Position.
    T.resetTransform = function (o) {
        var c = MMW.comp(), s = MMW.selLayers(c);
        for (var i = 0; i < s.length; i++) {
            (function (L) {
                withUnlock(L, function () {
                    var tr = L.transform;
                    var reset = [["ADBE Scale", [100, 100, 100]], ["ADBE Rotate Z", 0], ["ADBE Opacity", 100]];
                    if (!o.alt) reset.push(["ADBE Position", [c.width / 2, c.height / 2, 0]]);
                    if (L.threeDLayer) reset = reset.concat([["ADBE Orientation", [0, 0, 0]], ["ADBE Rotate X", 0], ["ADBE Rotate Y", 0]]);
                    for (var r = 0; r < reset.length; r++) {
                        var p = tr.property(reset[r][0]);
                        if (!p) continue;
                        if (p.dimensionsSeparated) continue;
                        while (p.numKeys) p.removeKey(1);
                        try { p.expression = ""; } catch (e) {}
                        var v = reset[r][1];
                        if (v instanceof Array && !L.threeDLayer) v = [v[0], v[1]];
                        try { p.setValue(v); } catch (e2) {}
                    }
                });
            })(s[i]);
        }
        return "Reset the transform of " + s.length + " layer(s).";
    };

    // ---------- Trim ----------
    // Click: trim Out point to the playhead. Alt: In point to the playhead. Shift: to the work area.
    T.trimLayers = function (o) {
        var c = MMW.comp(), s = MMW.selLayers(c), t = c.time;
        for (var i = 0; i < s.length; i++) {
            (function (L) {
                withUnlock(L, function () {
                    if (o.shift) { L.inPoint = c.workAreaStart; L.outPoint = c.workAreaStart + c.workAreaDuration; }
                    else if (o.alt) L.inPoint = t;
                    else L.outPoint = t;
                });
            })(s[i]);
        }
        return "Trimmed " + s.length + " layer(s).";
    };
})();

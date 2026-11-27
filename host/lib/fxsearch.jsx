// fxsearch.jsx - FX Search: the list of installed effects and applying one (to the selected layers or
// to a new adjustment layer). The search box itself lives in the panel (client/js/fxsearch.js).
(function () {
    var T = MMW.tools;

    function q(s) { return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]/g, " ") + '"'; }

    // [{n: display name, m: match name, c: category}] of every effect After Effects knows (JSON)
    T.listEffects = function () {
        var fx = app.effects, out = [];
        for (var i = 0; i < fx.length; i++) {
            var e = fx[i];
            if (!e.displayName || !e.category) continue;  // hidden / obsolete entries have no category
            out.push("{" + '"n":' + q(e.displayName) + ',"m":' + q(e.matchName) + ',"c":' + q(e.category) + "}");
        }
        return "[" + out.join(",") + "]";
    };

    // Copies hotkey/MenMen FX Search.jsx into After Effects' Scripts folder (needed for a global shortcut).
    // Returns JSON {ok, path, src}: ok false when the folder is not writable (the panel then asks for admin rights).
    T.installFxHotkey = function () {
        var src = new File(MMW.root + "/hotkey/MenMen FX Search.jsx");
        if (!src.exists) MMW.fail("Script not found: " + src.fsName);
        var app0 = Folder.appPackage, dirs = [new Folder(app0.fsName + "/Scripts"), new Folder(app0.parent.fsName + "/Scripts")], dir = null;
        for (var i = 0; i < dirs.length; i++) if (dirs[i].exists) { dir = dirs[i]; break; }
        if (!dir) MMW.fail("After Effects' Scripts folder was not found next to " + app0.fsName);
        var dest = new File(dir.fsName + "/MenMen FX Search.jsx"), ok = false;
        try { ok = src.copy(dest.fsName); } catch (e) { ok = false; }
        return "{" + '"ok":' + (ok ? "true" : "false") + ',"path":' + q(dest.fsName) + ',"src":' + q(src.fsName) + "}";
    };

    function canTakeEffects(L) {
        return L instanceof AVLayer && L.property("ADBE Effect Parade") !== null;  // AV, text, shape layers
    }

    // o.match: effect match name; o.name: display name (messages)
    // o.adjust (or nothing selected): on a new adjustment layer above the top selected layer
    T.applyEffect = function (o) {
        var c = MMW.comp(), sel = c.selectedLayers, targets = [], i, adj = null;
        for (i = 0; i < sel.length; i++) if (canTakeEffects(sel[i])) targets.push(sel[i]);
        if (o.adjust || !targets.length) {
            var top = null;
            for (i = 0; i < sel.length; i++) if (!top || sel[i].index < top.index) top = sel[i];
            adj = c.layers.addSolid([1, 1, 1], MMW.uniqueLayerName(c, o.name || "Adjustment Layer"), c.width, c.height, c.pixelAspect, c.duration);
            adj.adjustmentLayer = true;
            adj.label = 5;
            if (top) { adj.moveBefore(top); adj.inPoint = top.inPoint; adj.outPoint = top.outPoint; }
            targets = [adj];
        }
        var n = 0, added = [];
        for (i = 0; i < targets.length; i++) {
            var P = targets[i].property("ADBE Effect Parade");
            if (!P.canAddProperty(o.match)) continue;
            var e = P.addProperty(o.match);
            added.push(e);
            n++;
        }
        if (!n) MMW.fail((o.name || o.match) + " cannot be applied to the selected layer(s).");
        // select the new effect(s) so Effect Controls shows them, keep the layers selected
        for (i = 0; i < c.selectedLayers.length; i++) c.selectedLayers[i].selected = false;
        for (i = 0; i < targets.length; i++) targets[i].selected = true;
        for (i = 0; i < added.length; i++) { try { added[i].selected = true; } catch (e2) {} }
        return (o.name || o.match) + " applied to " + (adj ? "a new adjustment layer" : n + " layer(s)") + ".";
    };
})();

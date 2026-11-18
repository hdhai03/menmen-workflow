// selection.jsx - select layers by type / position / pattern
(function () {
    var T = MMW.tools;

    // Selects layers matching fn (deselects the rest).
    function selectWhere(fn, label) {
        var c = MMW.comp(), n = 0;
        for (var i = 1; i <= c.numLayers; i++) {
            var L = c.layer(i), m = !!fn(L, i);
            L.selected = m;
            if (m) n++;
        }
        return "Selected " + n + " " + (label || "layer") + "(s).";
    }

    // The selected layers (>=2) or the whole comp.
    function pool(c) {
        var s = c.selectedLayers, out = [];
        if (s.length >= 2) { for (var i = 0; i < s.length; i++) out.push(s[i]); return MMW.sortByIndex(out); }
        for (var j = 1; j <= c.numLayers; j++) out.push(c.layer(j));
        return out;
    }
    function selectList(c, list) {
        for (var i = 1; i <= c.numLayers; i++) c.layer(i).selected = false;
        for (var j = 0; j < list.length; j++) list[j].selected = true;
        return "Selected " + list.length + " layer(s).";
    }

    T.selectNulls = function () { return selectWhere(function (L) { return L.nullLayer; }, "null"); };
    T.select3D = function () { return selectWhere(function (L) { return L.threeDLayer; }, "3D layer"); };
    T.selectLights = function (o) {
        return selectWhere(function (L) { return o.alt ? L instanceof CameraLayer : L instanceof LightLayer; }, o.alt ? "camera" : "light");
    };
    T.selectPrecomps = function () { return selectWhere(function (L) { return L.source instanceof CompItem; }, "precomp"); };
    T.selectShapeLayers = function () { return selectWhere(function (L) { return L instanceof ShapeLayer; }, "shape layer"); };
    T.selectTextLayers = function () { return selectWhere(function (L) { return L instanceof TextLayer; }, "text layer"); };
    T.selectAudioLayers = function () {
        return selectWhere(function (L) { return L instanceof AVLayer && L.hasAudio && !L.hasVideo; }, "audio layer");
    };
    T.selectGuideLayers = function () { return selectWhere(function (L) { return L.guideLayer; }, "guide layer"); };
    T.selectAdjustment = function () { return selectWhere(function (L) { return L.adjustmentLayer; }, "adjustment layer"); };

    T.inverseSelection = function () {
        var c = MMW.comp(), n = 0;
        for (var i = 1; i <= c.numLayers; i++) { var L = c.layer(i); L.selected = !L.selected; if (L.selected) n++; }
        return "Selection inverted, " + n + " layer(s) selected.";
    };

    // o.n: step, o.offset: index to start from (1-based)
    T.selectEveryNth = function (o) {
        var c = MMW.comp(), list = pool(c), n = Math.max(1, parseInt(o.n, 10) || 2), off = Math.max(1, parseInt(o.offset, 10) || 1), out = [];
        for (var i = 0; i < list.length; i++) if ((i - (off - 1)) >= 0 && (i - (off - 1)) % n === 0) out.push(list[i]);
        return selectList(c, out);
    };

    // Click: odd, Alt: even
    T.selectOddEven = function (o) {
        var c = MMW.comp(), list = pool(c), out = [];
        for (var i = 0; i < list.length; i++) if ((i % 2 === 0) !== !!o.alt) out.push(list[i]);
        return selectList(c, out);
    };

    // Click: layers above; Alt: include the selected layers
    T.selectAbove = function (o) {
        var c = MMW.comp(), s = MMW.sortByIndex(MMW.selLayers(c)), top = s[0].index;
        return selectWhere(function (L) { return o.alt ? L.index <= top : L.index < top; });
    };
    T.selectBelow = function (o) {
        var c = MMW.comp(), s = MMW.sortByIndex(MMW.selLayers(c)), bot = s[s.length - 1].index;
        return selectWhere(function (L) { return o.alt ? L.index >= bot : L.index > bot; });
    };

    function isDescendant(L, set) {
        var p = L.parent;
        while (p) { if (set[p.index]) return true; p = p.parent; }
        return false;
    }
    T.selectChildren = function (o) {
        var c = MMW.comp(), s = MMW.selLayers(c), set = {};
        for (var i = 0; i < s.length; i++) set[s[i].index] = true;
        return selectWhere(function (L) { return isDescendant(L, set) || (o.alt && set[L.index]); }, "child layer");
    };
    T.selectParents = function (o) {
        var c = MMW.comp(), s = MMW.selLayers(c), set = {};
        for (var i = 0; i < s.length; i++) {
            if (o.alt) set[s[i].index] = true;
            var p = s[i].parent;
            var g = 0; while (p && g++ < 2000) { set[p.index] = true; p = p.parent; }
        }
        return selectWhere(function (L) { return !!set[L.index]; }, "parent layer");
    };
    // The whole parent tree (parents + children) of the selected layers
    T.selectHierarchy = function () {
        var c = MMW.comp(), s = MMW.selLayers(c), roots = {};
        for (var i = 0; i < s.length; i++) { var r = s[i], g2 = 0; while (r.parent && g2++ < 2000) r = r.parent; roots[r.index] = true; }
        return selectWhere(function (L) { return roots[L.index] || isDescendant(L, roots); });
    };

    // o.percent: % of layers randomly selected
    T.randomSelect = function (o) {
        var c = MMW.comp(), list = pool(c), pct = Math.max(0, Math.min(100, Number(o.percent) || 50)), out = [];
        for (var i = 0; i < list.length; i++) if (Math.random() * 100 < pct) out.push(list[i]);
        return selectList(c, out);
    };

    T.selectAtFrame = function () {
        var c = MMW.comp(), t = c.time;
        return selectWhere(function (L) { return L.inPoint <= t && t < L.outPoint; });
    };

    // Selects properties matching the selected one (matchName) on the selected layers / all layers
    T.selectMatchingProperty = function (o) {
        var c = MMW.comp(), sel = MMW.selProps(c);
        if (!sel.length) MMW.fail("Select a sample property.");
        var want = {};
        for (var i = 0; i < sel.length; i++) want[sel[i].prop.matchName] = true;
        var layers = c.selectedLayers.length > 1 && !o.alt ? c.selectedLayers : null, n = 0;
        for (var j = 1; j <= c.numLayers; j++) {
            var L = c.layer(j);
            if (layers && !L.selected) continue;
            L.selected = true;
            MMW.walkProps(L, function (p) { if (want[p.matchName]) { p.selected = true; n++; } });
        }
        return "Selected " + n + " propert(ies).";
    };
})();

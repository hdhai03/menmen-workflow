// motiontools.jsx - Align, Distribute, Arrange Grid, Crop Comp to Layer, Trash, Stare, Orbit
(function () {
    var T = MMW.tools;
    var q = function (s) { return MMW.quote(s); };

    // Comp-space bounding boxes {l,t,r,b,cx,cy} of layers at the current time.
    function boxes(c, layers) {
        var h = MMW.helper(c), out = [];
        for (var i = 0; i < layers.length; i++) {
            var body = "var L=thisComp.layer(" + layers[i].index + ");var r=L.sourceRectAtTime(time,false);" +
                "var c=[L.toComp([r.left,r.top]),L.toComp([r.left+r.width,r.top]),L.toComp([r.left,r.top+r.height]),L.toComp([r.left+r.width,r.top+r.height])];" +
                "var mn=[1e9,1e9],mx=[-1e9,-1e9];for(var j=0;j<4;j++){mn[0]=Math.min(mn[0],c[j][0]);mn[1]=Math.min(mn[1],c[j][1]);mx[0]=Math.max(mx[0],c[j][0]);mx[1]=Math.max(mx[1],c[j][1]);}";
            var mn = h.evalAt(body + "[mn[0],mn[1],0]", c.time, 1), mx = h.evalAt(body + "[mx[0],mx[1],0]", c.time, 2);
            out.push({ l: mn[0], t: mn[1], r: mx[0], b: mx[1], cx: (mn[0] + mx[0]) / 2, cy: (mn[1] + mx[1]) / 2 });
        }
        h.remove();
        return out;
    }

    // Moves a layer by a comp-space delta, converting into its parent's space; shifts every Position key.
    function moveBy(c, L, dx, dy) {
        if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return;
        var d = [dx, dy];
        if (L.parent) {
            var h = MMW.helper(c);
            var e = "var L=thisComp.layer(" + L.index + "),P=L.parent,a=L.toComp(L.anchorPoint);" +
                "var p0=P.fromComp(a),p1=P.fromComp([a[0]+" + dx + ",a[1]+" + dy + "]);[p1[0]-p0[0],p1[1]-p0[1],0]";
            var r = h.evalAt(e, c.time, 1);
            h.remove();
            d = [r[0], r[1]];
        }
        var lk = L.locked; L.locked = false;
        var pos = L.transform.position;
        if (pos.dimensionsSeparated) {
            MMW.offsetProp(L.transform.property("ADBE Position_0"), d[0]);
            MMW.offsetProp(L.transform.property("ADBE Position_1"), d[1]);
        } else {
            MMW.offsetProp(pos, [d[0], d[1], 0]);
        }
        L.locked = lk;
    }

    function movable(c) {
        var s = MMW.selLayers(c), out = [];
        for (var i = 0; i < s.length; i++) if (!(s[i] instanceof CameraLayer) && !(s[i] instanceof LightLayer)) out.push(s[i]);
        if (!out.length) MMW.fail("Select layers to move.");
        return out;
    }

    // o.where: left | hcenter | right | top | vcenter | bottom
    // o.to: "selection" (default) | "comp". With one layer selected, aligns to the comp.
    T.alignLayers = function (o) {
        var c = MMW.comp(), L = movable(c), B = boxes(c, L), w = o.where || "left", i;
        var useComp = o.to === "comp" || L.length === 1;
        var R = useComp ? { l: 0, t: 0, r: c.width, b: c.height } : { l: 1e9, t: 1e9, r: -1e9, b: -1e9 };
        if (!useComp) for (i = 0; i < B.length; i++) { R.l = Math.min(R.l, B[i].l); R.t = Math.min(R.t, B[i].t); R.r = Math.max(R.r, B[i].r); R.b = Math.max(R.b, B[i].b); }
        for (i = 0; i < L.length; i++) {
            var b = B[i], dx = 0, dy = 0;
            if (w === "left") dx = R.l - b.l;
            else if (w === "right") dx = R.r - b.r;
            else if (w === "hcenter") dx = (R.l + R.r) / 2 - b.cx;
            else if (w === "top") dy = R.t - b.t;
            else if (w === "bottom") dy = R.b - b.b;
            else if (w === "vcenter") dy = (R.t + R.b) / 2 - b.cy;
            moveBy(c, L[i], dx, dy);
        }
        return "Aligned " + L.length + " layer(s) " + w + " to " + (useComp ? "comp" : "selection") + ".";
    };

    // o.axis: "h" | "v" - equal gaps between layers (first and last stay in place).
    T.distributeLayers = function (o) {
        var c = MMW.comp(), L = movable(c);
        if (L.length < 3) MMW.fail("Select at least 3 layers.");
        var B = boxes(c, L), h = o.axis !== "v", idx = [], i;
        for (i = 0; i < L.length; i++) idx.push(i);
        idx.sort(function (a, b) { return h ? B[a].cx - B[b].cx : B[a].cy - B[b].cy; });
        var first = B[idx[0]], last = B[idx[idx.length - 1]], total = 0;
        for (i = 0; i < idx.length; i++) total += h ? B[idx[i]].r - B[idx[i]].l : B[idx[i]].b - B[idx[i]].t;
        var span = h ? last.r - first.l : last.b - first.t, gap = (span - total) / (idx.length - 1), cur = h ? first.l : first.t;
        for (i = 0; i < idx.length; i++) {
            var b = B[idx[i]];
            if (h) { moveBy(c, L[idx[i]], cur - b.l, 0); cur += (b.r - b.l) + gap; }
            else { moveBy(c, L[idx[i]], 0, cur - b.t); cur += (b.b - b.t) + gap; }
        }
        return "Distributed " + L.length + " layers " + (h ? "horizontally" : "vertically") + ".";
    };

    // o.cols, o.gap: grid of equal cells (largest layer size), centered in the comp, in layer order.
    T.arrangeGrid = function (o) {
        var c = MMW.comp(), L = MMW.sortByIndex(movable(c)), B = boxes(c, L), i;
        var cols = Math.max(1, parseInt(o.cols, 10) || Math.ceil(Math.sqrt(L.length))), gap = Number(o.gap) || 0;
        var cw = 0, ch = 0;
        for (i = 0; i < B.length; i++) { cw = Math.max(cw, B[i].r - B[i].l); ch = Math.max(ch, B[i].b - B[i].t); }
        var rows = Math.ceil(L.length / cols);
        var gw = cols * cw + (cols - 1) * gap, gh = rows * ch + (rows - 1) * gap;
        var x0 = (c.width - gw) / 2, y0 = (c.height - gh) / 2;
        for (i = 0; i < L.length; i++) {
            var col = i % cols, row = Math.floor(i / cols);
            var tx = x0 + col * (cw + gap) + cw / 2, ty = y0 + row * (ch + gap) + ch / 2;
            moveBy(c, L[i], tx - B[i].cx, ty - B[i].cy);
        }
        return "Arranged " + L.length + " layers in " + cols + " column(s).";
    };

    // Crops the active comp to the bounds of the selected layer(s); layers using this comp are compensated.
    T.cropToLayer = function (o) {
        var c = MMW.comp(), L = movable(c), B = boxes(c, L), i;
        var l = 1e9, t = 1e9, r = -1e9, b = -1e9;
        for (i = 0; i < B.length; i++) { l = Math.min(l, B[i].l); t = Math.min(t, B[i].t); r = Math.max(r, B[i].r); b = Math.max(b, B[i].b); }
        l = Math.floor(l); t = Math.floor(t);
        var w = Math.max(4, Math.ceil(r) - l), hgt = Math.max(4, Math.ceil(b) - t);
        MMW.shiftLayers(c, -l, -t);
        c.width = Math.min(30000, w); c.height = Math.min(30000, hgt);
        var used = c.usedIn;
        for (var u = 0; u < used.length; u++) {
            for (var k = 1; k <= used[u].numLayers; k++) {
                var ol = used[u].layer(k);
                if (ol.source && ol.source.id === c.id) {
                    var lk = ol.locked; ol.locked = false;
                    MMW.offsetProp(ol.transform.anchorPoint, [-l, -t, 0]);
                    ol.locked = lk;
                }
            }
        }
        return "Comp cropped to " + c.width + "x" + c.height + ".";
    };

    // Removes disabled effects and disabled expressions (selected layers; Alt or nothing selected = whole comp).
    T.trash = function (o) {
        var c = MMW.comp(), all = o.alt || !c.selectedLayers.length, fx = 0, ex = 0;
        for (var i = 1; i <= c.numLayers; i++) {
            var L = c.layer(i);
            if (!all && !L.selected) continue;
            var lk = L.locked; L.locked = false;
            var parade = L.property("ADBE Effect Parade");
            if (parade) for (var e = parade.numProperties; e >= 1; e--) if (!parade.property(e).enabled) { parade.property(e).remove(); fx++; }
            MMW.walkProps(L, function (p) {
                if (p.canSetExpression && p.expression !== "" && !p.expressionEnabled) { p.expression = ""; ex++; }
            });
            L.locked = lk;
        }
        return "Removed " + fx + " disabled effect(s) and " + ex + " disabled expression(s).";
    };

    // Selected layers always face a target: the last selected layer, or a new "Stare Target" null.
    // The layer's own Rotation is kept as an offset. Shift: remove.
    T.stare = function (o) {
        var c = MMW.comp(), s = MMW.selLayers(c), i, tag = "// MenMen Stare";
        if (o.shift) {
            var n0 = 0;
            for (i = 0; i < s.length; i++) if (s[i].transform.rotation.expression.indexOf(tag) === 0) { s[i].transform.rotation.expression = ""; n0++; }
            return "Removed Stare from " + n0 + " layer(s).";
        }
        var target, layers = [];
        if (s.length > 1) { target = s[s.length - 1]; for (i = 0; i < s.length - 1; i++) layers.push(s[i]); }
        else {
            target = MMW.newNull(c, MMW.uniqueLayerName(c, "Stare Target"));
            target.transform.position.setValue([c.width * 0.75, c.height / 2]);
            layers = s;
        }
        for (i = 0; i < layers.length; i++) {
            layers[i].transform.rotation.expression = tag + "\nvar T=thisComp.layer(" + q(target.name) + ");\n" +
                "var a=toComp(anchorPoint), b=T.toComp(T.anchorPoint);\n" +
                "value + radiansToDegrees(Math.atan2(b[1]-a[1], b[0]-a[0]));";
        }
        return layers.length + " layer(s) now face \"" + target.name + "\" (Rotation = offset).";
    };

    // Selected layers orbit around a new "Orbit Center" null (speed in degrees per second). Shift: remove.
    T.orbit = function (o) {
        var c = MMW.comp(), s = MMW.selLayers(c), i, tag = "// MenMen Orbit";
        if (o.shift) {
            var n0 = 0;
            for (i = 0; i < s.length; i++) {
                if (s[i].transform.position.expression.indexOf(tag) === 0) { s[i].transform.position.expression = ""; n0++; }
                if (s[i].transform.rotation.expression.indexOf(tag) === 0) s[i].transform.rotation.expression = "";
            }
            return "Removed Orbit from " + n0 + " layer(s).";
        }
        var ctr = MMW.newNull(c, MMW.uniqueLayerName(c, "Orbit Center"));
        ctr.transform.position.setValue([c.width / 2, c.height / 2]);
        var sp = MMW.addEffect(ctr, "ADBE Slider Control", "Speed (deg/s)");
        sp.property(1).setValue(Number(o.speed) || 45);
        MMW.addEffect(ctr, "ADBE Checkbox Control", "Face Center");
        var n = 0;
        for (i = 0; i < s.length; i++) {
            var L = s[i];
            if (L.parent || L.transform.position.dimensionsSeparated) continue;
            L.transform.position.expression = tag + "\nvar C=thisComp.layer(" + q(ctr.name) + "), c=C.toComp(C.anchorPoint);\n" +
                "var a=degreesToRadians(C.effect(\"Speed (deg/s)\")(1)*(time-inPoint)), dx=value[0]-c[0], dy=value[1]-c[1];\n" +
                "var p=[c[0]+dx*Math.cos(a)-dy*Math.sin(a), c[1]+dx*Math.sin(a)+dy*Math.cos(a)];\n" +
                "value.length>2?[p[0],p[1],value[2]]:p;";
            L.transform.rotation.expression = "// MenMen Orbit\nvar C=thisComp.layer(" + q(ctr.name) + ");\n" +
                "C.effect(\"Face Center\")(1)==1 ? value + C.effect(\"Speed (deg/s)\")(1)*(time-inPoint) : value;";
            n++;
        }
        return n + " layer(s) orbit \"" + ctr.name + "\" (parented layers are skipped).";
    };
})();

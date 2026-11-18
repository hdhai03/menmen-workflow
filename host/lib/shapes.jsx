// shapes.jsx - Extract Shapes, Merge Shapes, Nulls To Point, Selector, Shapes From Vector, Remove Artboards
(function () {
    var T = MMW.tools;
    var ROOT = "ADBE Root Vectors Group";

    function shapeLayers(c) {
        var out = [], L = MMW.selLayers(c);
        for (var i = 0; i < L.length; i++) if (L[i] instanceof ShapeLayer) out.push(L[i]);
        if (!out.length) MMW.fail("Hãy chọn shape layer.");
        return out;
    }

    // ---------------- Extract Shapes ----------------
    // Click: tách mỗi group cấp 1 thành một layer riêng và xóa layer gốc
    //        (nếu đang chọn vài group thì chỉ tách các group đó và xóa chúng khỏi layer gốc).
    // Alt: giữ nguyên layer gốc / group gốc.
    T.extractShapes = function (o) {
        var c = MMW.comp(), layers = shapeLayers(c), made = 0;
        for (var i = 0; i < layers.length; i++) {
            var L = layers[i], contents = L.property(ROOT), picked = [];
            for (var g = 1; g <= contents.numProperties; g++) if (contents.property(g).selected) picked.push(g);
            var partial = picked.length > 0;
            if (!partial) for (g = 1; g <= contents.numProperties; g++) picked.push(g);
            if (picked.length < 1) continue;

            // duplicate() đặt bản sao ngay trên layer gốc -> duyệt từ group trên cùng để giữ thứ tự xếp lớp.
            for (var p = 0; p < picked.length; p++) {
                var keep = picked[p];
                var d = L.duplicate();
                var dc = d.property(ROOT);
                d.name = L.name + " - " + dc.property(keep).name;
                for (var r = dc.numProperties; r >= 1; r--) if (r !== keep) dc.property(r).remove();
                made++;
            }
            if (!o.alt) {
                if (partial) {
                    for (var q = picked.length - 1; q >= 0; q--) L.property(ROOT).property(picked[q]).remove();
                } else {
                    L.remove();
                }
            }
        }
        return "Đã tách " + made + " shape layer.";
    };

    // ---------------- Merge Shapes ----------------
    // Gộp các shape layer đang chọn vào layer trên cùng (mỗi layer nguồn thành một group).
    // Click: xóa layer nguồn. Alt: giữ layer nguồn (tắt hiển thị).
    // Lưu ý: transform của layer nguồn được quy đổi tĩnh tại thời điểm hiện tại (2D).
    T.mergeShapes = function (o) {
        var c = MMW.comp(), layers = MMW.sortByIndex(shapeLayers(c));
        if (layers.length < 2) MMW.fail("Hãy chọn ít nhất 2 shape layer.");
        var target = layers[0], h = MMW.helper(c), merged = 0;
        for (var i = 1; i < layers.length; i++) {
            var S = layers[i];
            var tRoot = target.property(ROOT);
            var grp = tRoot.addProperty("ADBE Vector Group");
            grp.name = S.name;
            var gi = grp.propertyIndex;
            MMW.copyGroup(S, [ROOT], target, [ROOT, gi, "ADBE Vectors Group"]);

            // Quy đổi transform của layer nguồn về không gian của layer đích.
            var expr = "var S=thisComp.layer(" + S.index + "),D=thisComp.layer(" + target.index + ");" +
                "var p=D.fromComp(S.toComp(S.anchorPoint));[p[0],p[1],0]";
            var pos = h.evalAt(expr, c.time, 1);
            var tr = target.property(ROOT).property(gi).property("ADBE Vector Transform Group");
            var sa = S.transform.anchorPoint.value, ss = S.transform.scale.value, ts = target.transform.scale.value;
            tr.property("ADBE Vector Anchor").setValue([sa[0], sa[1]]);
            tr.property("ADBE Vector Position").setValue([pos[0], pos[1]]);
            tr.property("ADBE Vector Scale").setValue([ss[0] / ts[0] * 100, ss[1] / ts[1] * 100]);
            tr.property("ADBE Vector Rotation").setValue(S.transform.rotation.value - target.transform.rotation.value);
            tr.property("ADBE Vector Group Opacity").setValue(S.transform.opacity.value);
            merged++;
        }
        h.remove();
        for (var k = layers.length - 1; k >= 1; k--) {
            if (o.alt) layers[k].enabled = false; else layers[k].remove();
        }
        return "Đã gộp " + merged + " layer vào \"" + target.name + "\".";
    };

    // ---------------- Selector ----------------
    // Click: chọn mọi Path. Alt: chọn mọi Fill. Shift: chọn mọi Stroke. (trên shape layer đang chọn)
    T.selector = function (o) {
        var c = MMW.comp(), layers = shapeLayers(c), n = 0;
        var want = o.alt ? "ADBE Vector Graphic - Fill" : (o.shift ? "ADBE Vector Graphic - Stroke" : "ADBE Vector Shape");
        function walk(g) {
            for (var i = 1; i <= g.numProperties; i++) {
                var p = g.property(i);
                if (p.matchName === want) { p.selected = true; n++; }
                else if (p.propertyType !== PropertyType.PROPERTY) walk(p);
            }
        }
        for (var i = 0; i < layers.length; i++) walk(layers[i].property(ROOT));
        return "Đã chọn " + n + (o.alt ? " fill" : (o.shift ? " stroke" : " path")) + ".";
    };

    // ---------------- Nulls To Point ----------------
    // Chọn một property Path (shape) hoặc Mask Path.
    // Click: tạo null bám theo từng điểm của path. Alt: tạo null và điểm path đi theo null.
    // Lưu ý: với path nằm trong group có transform khác mặc định, vị trí có thể lệch.
    T.nullsToPoint = function (o) {
        var c = MMW.comp(), sel = MMW.selProps(c), target = null, layer = null;
        for (var i = 0; i < sel.length && !target; i++) {
            var mn = sel[i].prop.matchName;
            if (mn === "ADBE Vector Shape" || mn === "ADBE Mask Shape") { target = sel[i].prop; layer = sel[i].layer; }
        }
        if (!target) {
            var L = c.selectedLayers;
            for (var a = 0; a < L.length && !target; a++) {
                var sp = L[a].selectedProperties;
                for (var b = 0; b < sp.length; b++) {
                    var cand = sp[b].property ? (sp[b].property("ADBE Vector Shape") || sp[b].property("ADBE Mask Shape")) : null;
                    if (cand) { target = cand; layer = L[a]; break; }
                }
            }
        }
        if (!target) MMW.fail("Hãy chọn một Path (shape) hoặc Mask Path.");
        var ref = MMW.exprRef(target);
        var shape = target.valueAtTime(c.time, false);
        var count = shape.vertices.length;
        if (!count) MMW.fail("Path không có điểm nào.");
        var base = layer.name, nulls = [], h = MMW.helper(c);

        for (var v = 0; v < count; v++) {
            var nl = MMW.newNull(c, MMW.uniqueLayerName(c, base + " Pt " + (v + 1)));
            nl.moveBefore(layer);
            nl.label = 2;
            nulls.push(nl);
            var lyr = "thisComp.layer(" + MMW.quote(layer.name) + ")";
            if (!o.alt) {
                nl.transform.position.expression = "var L=" + lyr + ";L.toComp(" + ref + ".points(time)[" + v + "]);";
            } else {
                var pt = h.evalAt("var L=" + lyr + ";var p=L.toComp(" + ref + ".points(time)[" + v + "]);[p[0],p[1],0]", c.time, 1);
                nl.transform.position.setValue([pt[0], pt[1]]);
            }
        }
        h.remove();
        if (o.alt) {
            var names = [];
            for (var q = 0; q < nulls.length; q++) names.push(MMW.quote(nulls[q].name));
            target.expression =
                "// MenMen Nulls To Point\nvar ns=[" + names.join(",") + "];var pts=[];\n" +
                "for(var i=0;i<ns.length;i++){var n=thisComp.layer(ns[i]);pts.push(fromComp(n.toComp(n.anchorPoint)));}\n" +
                "createPath(pts, thisProperty.inTangents(), thisProperty.outTangents(), thisProperty.isClosed());";
        }
        return "Đã tạo " + count + " null" + (o.alt ? " (path đi theo null)." : " (null bám theo path).");
    };

    // ---------------- Shapes From Vector ----------------
    // Click: Create Shapes from Vector Layer. Alt: xóa layer nguồn. Shift: thêm bước xóa artboard.
    T.shapesFromVector = function (o) {
        var c = MMW.comp(), layers = MMW.selLayers(c), made = [];
        var cmd = app.findMenuCommandId("Create Shapes from Vector Layer");
        if (!cmd) cmd = 3973;
        for (var i = 0; i < layers.length; i++) {
            var L = layers[i];
            if (!(L instanceof AVLayer) || !(L.source instanceof FootageItem)) continue;
            var before = {};
            for (var b = 1; b <= c.numLayers; b++) before[c.layer(b).id] = true;
            for (var s = 1; s <= c.numLayers; s++) c.layer(s).selected = false;
            L.selected = true;
            app.executeCommand(cmd);
            for (var f = 1; f <= c.numLayers; f++) if (!before[c.layer(f).id]) { made.push(c.layer(f)); break; }
            if (o.alt) L.remove();
        }
        if (!made.length) MMW.fail("Hãy chọn layer vector (Illustrator/PDF/EPS).");
        var removed = 0;
        if (o.shift) for (var m = 0; m < made.length; m++) removed += removeArtboardGroups(made[m]);
        for (var z = 0; z < made.length; z++) made[z].selected = true;
        return "Đã tạo " + made.length + " shape layer" + (o.shift ? ", xóa " + removed + " artboard" : "") + ".";
    };

    // ---------------- Remove Artboards ----------------
    // Xóa các group có tên chứa "Artboard" (cách Illustrator đặt tên) trong shape layer đang chọn.
    function removeArtboardGroups(L) {
        var root = L.property(ROOT), n = 0;
        for (var g = root.numProperties; g >= 1; g--) {
            if (/artboard/i.test(root.property(g).name)) { root.property(g).remove(); n++; }
        }
        return n;
    }
    T.removeArtboards = function (o) {
        var c = MMW.comp(), layers = shapeLayers(c), n = 0;
        for (var i = 0; i < layers.length; i++) n += removeArtboardGroups(layers[i]);
        return "Đã xóa " + n + " artboard group.";
    };
})();

// shapetools.jsx - cap/join, fill/stroke, reset transform shape, rect/circle wizard, trim paths, mask → shape
(function () {
    var T = MMW.tools;
    var ROOT = "ADBE Root Vectors Group";

    function shapeLayers(c) {
        var out = [], s = MMW.selLayers(c);
        for (var i = 0; i < s.length; i++) if (s[i] instanceof ShapeLayer) out.push(s[i]);
        if (!out.length) MMW.fail("Hãy chọn shape layer.");
        return out;
    }
    function walkMatch(group, matchName, fn) {
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.matchName === matchName) fn(p);
            if (p.propertyType !== PropertyType.PROPERTY) walkMatch(p, matchName, fn);
        }
    }

    // o.cap: 1 butt / 2 round / 3 projecting; o.join: 1 miter / 2 round / 3 bevel
    T.capJoin = function (o) {
        var c = MMW.comp(), list = shapeLayers(c), n = 0;
        for (var i = 0; i < list.length; i++) {
            walkMatch(list[i].property(ROOT), "ADBE Vector Graphic - Stroke", function (st) {
                st.property("ADBE Vector Stroke Line Cap").setValue(o.cap || 2);
                st.property("ADBE Vector Stroke Line Join").setValue(o.join || 2);
                n++;
            });
        }
        return "Đã đổi cap/join cho " + n + " stroke.";
    };
    // Click: bật/tắt Fill. Alt: bật/tắt Stroke.
    T.toggleFillStroke = function (o) {
        var c = MMW.comp(), list = shapeLayers(c), n = 0;
        var mn = o.alt ? "ADBE Vector Graphic - Stroke" : "ADBE Vector Graphic - Fill";
        for (var i = 0; i < list.length; i++) walkMatch(list[i].property(ROOT), mn, function (p) { p.enabled = !p.enabled; n++; });
        return "Đã bật/tắt " + n + (o.alt ? " stroke." : " fill.");
    };
    // Đảo hướng path (dùng thuộc tính Shape Direction của mỗi path).
    T.reversePathDirection = function () {
        var c = MMW.comp(), list = shapeLayers(c), n = 0;
        var kinds = ["ADBE Vector Shape - Group", "ADBE Vector Shape - Rect", "ADBE Vector Shape - Ellipse", "ADBE Vector Shape - Star"];
        for (var i = 0; i < list.length; i++) {
            for (var k = 0; k < kinds.length; k++) {
                walkMatch(list[i].property(ROOT), kinds[k], function (g) {
                    var d = g.property("ADBE Vector Shape Direction");
                    if (d) { d.setValue(d.value === 3 ? 2 : 3); n++; }
                });
            }
        }
        return "Đã đảo hướng " + n + " path.";
    };
    // Reset transform của mọi group trong shape layer (xóa keyframe).
    T.resetShapeTransforms = function () {
        var c = MMW.comp(), list = shapeLayers(c), n = 0;
        var defs = [["ADBE Vector Anchor", [0, 0]], ["ADBE Vector Position", [0, 0]], ["ADBE Vector Scale", [100, 100]],
            ["ADBE Vector Skew", 0], ["ADBE Vector Skew Axis", 0], ["ADBE Vector Rotation", 0], ["ADBE Vector Group Opacity", 100]];
        for (var i = 0; i < list.length; i++) {
            walkMatch(list[i].property(ROOT), "ADBE Vector Transform Group", function (tr) {
                for (var d = 0; d < defs.length; d++) {
                    var p = tr.property(defs[d][0]);
                    if (!p) continue;
                    while (p.numKeys) p.removeKey(1);
                    try { p.expression = ""; p.setValue(defs[d][1]); } catch (e) {}
                }
                n++;
            });
        }
        return "Đã reset " + n + " transform group.";
    };

    function newShape(c, name, kind, size, color, round) {
        var L = c.layers.addShape();
        L.name = MMW.uniqueLayerName(c, name);
        L.property(ROOT).addProperty("ADBE Vector Group");
        var v = function () { return L.property(ROOT).property(1).property("ADBE Vectors Group"); };
        v().addProperty(kind);
        v().addProperty("ADBE Vector Graphic - Fill");
        var shp = v().property(kind);
        if (kind === "ADBE Vector Shape - Rect") {
            shp.property("ADBE Vector Rect Size").setValue(size);
            shp.property("ADBE Vector Rect Roundness").setValue(round || 0);
        } else {
            shp.property("ADBE Vector Ellipse Size").setValue(size);
        }
        v().property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(color || [1, 1, 1]);
        L.property(ROOT).property(1).name = name;
        return L;
    }
    // o.width, o.height, o.round
    T.rectangleWizard = function (o) {
        var c = MMW.comp();
        newShape(c, "Rectangle", "ADBE Vector Shape - Rect", [Number(o.width) || 400, Number(o.height) || 240], o.color, Number(o.round) || 0);
        return "Đã tạo hình chữ nhật.";
    };
    // o.size: đường kính
    T.circleWizard = function (o) {
        var c = MMW.comp(), d = Number(o.size) || 300;
        newShape(c, "Circle", "ADBE Vector Shape - Ellipse", [d, d], o.color);
        return "Đã tạo hình tròn " + d + "px.";
    };

    // Thêm Trim Paths + slider Start / End / Offset trên layer.
    T.trimPathsController = function () {
        var c = MMW.comp(), list = shapeLayers(c);
        for (var i = 0; i < list.length; i++) {
            var L = list[i];
            L.property(ROOT).addProperty("ADBE Vector Filter - Trim");
            var fxp = L.property("ADBE Effect Parade");
            if (!fxp.property("Trim Start")) MMW.addEffect(L, "ADBE Slider Control", "Trim Start").property(1).setValue(0);
            if (!fxp.property("Trim End")) MMW.addEffect(L, "ADBE Slider Control", "Trim End").property(1).setValue(100);
            if (!fxp.property("Trim Offset")) MMW.addEffect(L, "ADBE Angle Control", "Trim Offset");
            var root = L.property(ROOT), tr = null;
            for (var k = root.numProperties; k >= 1; k--) if (root.property(k).matchName === "ADBE Vector Filter - Trim") { tr = root.property(k); break; }
            tr.property("ADBE Vector Trim Start").expression = "clamp(effect(\"Trim Start\")(1),0,100)";
            tr.property("ADBE Vector Trim End").expression = "clamp(effect(\"Trim End\")(1),0,100)";
            tr.property("ADBE Vector Trim Offset").expression = "effect(\"Trim Offset\")(1)";
        }
        return "Trim Paths controller → " + list.length + " layer.";
    };

    // Chuyển mask thành shape layer (giữ transform & keyframe của mask). Alt: xóa mask gốc.
    T.maskToShape = function (o) {
        var c = MMW.comp(), s = MMW.selLayers(c), made = 0;
        for (var i = 0; i < s.length; i++) {
            var L = s[i], masks = L.property("ADBE Mask Parade");
            if (!masks || !masks.numProperties) continue;
            var sh = c.layers.addShape();
            sh.name = MMW.uniqueLayerName(c, L.name + " Shapes");
            sh.moveBefore(L);
            sh.threeDLayer = L.threeDLayer;
            var props = ["ADBE Anchor Point", "ADBE Position", "ADBE Scale", "ADBE Rotate Z", "ADBE Opacity"];
            for (var p = 0; p < props.length; p++) MMW.copyPropValue(L.transform.property(props[p]), sh.transform.property(props[p]));
            if (L.parent) sh.setParentWithJump(L.parent);
            for (var m = 1; m <= masks.numProperties; m++) {
                var mk = masks.property(m);
                sh.property(ROOT).addProperty("ADBE Vector Group");
                var gi = sh.property(ROOT).numProperties;
                sh.property(ROOT).property(gi).name = mk.name;
                sh.property(ROOT).property(gi).property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Group");
                sh.property(ROOT).property(gi).property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
                var path = sh.property(ROOT).property(gi).property("ADBE Vectors Group").property("ADBE Vector Shape - Group").property("ADBE Vector Shape");
                MMW.copyPropValue(mk.property("ADBE Mask Shape"), path);
                try { sh.property(ROOT).property(gi).property("ADBE Vectors Group").property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(mk.color); } catch (e) {}
            }
            if (o.alt) for (var r = masks.numProperties; r >= 1; r--) masks.property(r).remove();
            made++;
        }
        if (!made) MMW.fail("Hãy chọn layer có mask.");
        return "Đã chuyển mask của " + made + " layer thành shape.";
    };
})();

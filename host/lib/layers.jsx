// layers.jsx - Add Null To Layers, Get Colors, Move Anchor Point, Sequencer
(function () {
    var T = MMW.tools;

    // ---------------- Add Null To Layers ----------------
    // Click: 1 null ở giữa các layer đang chọn. Alt: null mặc định của AE (không căn giữa).
    // Shift: mỗi layer một null riêng.
    T.addNull = function (o) {
        var c = MMW.comp(), layers = MMW.sortByIndex(MMW.selLayers(c)), i;
        var any3D = false;
        for (i = 0; i < layers.length; i++) if (layers[i].threeDLayer) any3D = true;

        if (o.shift) {
            for (i = 0; i < layers.length; i++) {
                var L = layers[i];
                var n = MMW.newNull(c, MMW.uniqueLayerName(c, L.name + " Null"));
                n.threeDLayer = L.threeDLayer;
                n.moveBefore(L);
                if (L.parent) n.setParentWithJump(L.parent);
                n.transform.position.setValue(L.transform.position.valueAtTime(c.time, false));
                var lk = L.locked; L.locked = false; L.parent = n; L.locked = lk;
            }
            return "Đã tạo " + layers.length + " null.";
        }

        var nul = o.alt ? c.layers.addNull() : MMW.newNull(c, "");
        nul.name = MMW.uniqueLayerName(c, "Null Control");
        nul.threeDLayer = any3D;
        nul.moveBefore(layers[0]);
        if (!o.alt) {
            // Trung bình vị trí (không gian comp) của các layer đang chọn.
            var h = MMW.helper(c), sum = [0, 0, 0];
            for (i = 0; i < layers.length; i++) {
                var p = h.evalAt("var L=thisComp.layer(" + layers[i].index + ");L.toComp(L.anchorPoint)", c.time, 1);
                sum[0] += p[0]; sum[1] += p[1]; sum[2] += (p.length > 2 ? p[2] : 0);
            }
            h.remove();
            var avg = [sum[0] / layers.length, sum[1] / layers.length, sum[2] / layers.length];
            nul.transform.position.setValue(any3D ? avg : [avg[0], avg[1]]);
        }
        for (i = 0; i < layers.length; i++) {
            var l = layers[i];
            if (l.parent && MMW.indexOf(layers, l.parent) >= 0) continue; // giữ cây parent bên trong nhóm
            var lck = l.locked; l.locked = false; l.parent = nul; l.locked = lck;
        }
        return "Đã thêm null \"" + nul.name + "\".";
    };

    // ---------------- Get Colors ----------------
    // Gom mọi màu (fill, stroke, effect color...) trên layer đang chọn vào 1 controller.
    // Màu trùng nhau dùng chung 1 Color Control (liên kết bằng expression).
    T.getColors = function (o) {
        var c = MMW.comp(), layers = MMW.selLayers(c), found = [], uniq = {}, order = [];
        function hex(v) {
            var s = "#";
            for (var i = 0; i < 3; i++) {
                var x = Math.round(Math.max(0, Math.min(1, v[i])) * 255).toString(16);
                s += (x.length < 2 ? "0" : "") + x;
            }
            return s;
        }
        for (var i = 0; i < layers.length; i++) {
            MMW.walkProps(layers[i], function (p) {
                if (p.propertyValueType !== PropertyValueType.COLOR) return;
                if (!p.canSetExpression || p.numKeys > 0 || p.expression !== "") return;
                var h = hex(p.value);
                if (!uniq[h]) { uniq[h] = p.value; order.push(h); }
                found.push({ prop: p, hex: h });
            });
        }
        if (!found.length) MMW.fail("Không tìm thấy màu tĩnh nào trên layer đã chọn.");

        var ctrl = c.layers.addNull();
        ctrl.name = MMW.uniqueLayerName(c, "Colors Controller");
        ctrl.guideLayer = true;
        ctrl.label = 9;
        for (var k = 0; k < order.length; k++) {
            var fx = MMW.addEffect(ctrl, "ADBE Color Control", order[k]);
            fx.property(1).setValue(uniq[order[k]]);
        }
        var ref = "thisComp.layer(" + MMW.quote(ctrl.name) + ")";
        for (var f = 0; f < found.length; f++) {
            found[f].prop.expression = ref + ".effect(" + MMW.quote(found[f].hex) + ")(1)";
        }
        return order.length + " màu duy nhất, đã liên kết " + found.length + " property.";
    };

    // ---------------- Move Anchor Point ----------------
    // o.x, o.y trong [0..1] - vị trí anchor trong khung nội dung (0,0 = trên trái; 0.5,0.5 = giữa).
    // Giữ nguyên vị trí hiển thị của layer.
    T.moveAnchor = function (o) {
        var c = MMW.comp(), layers = MMW.selLayers(c), n = 0;
        var fx = (o.x === undefined) ? 0.5 : Number(o.x), fy = (o.y === undefined) ? 0.5 : Number(o.y);
        for (var i = 0; i < layers.length; i++) {
            var L = layers[i];
            if (L instanceof CameraLayer || L instanceof LightLayer) continue;
            if (o.shift && L.threeDLayer) {
                // Shift + giữa: dùng lệnh gốc của AE để căn giữa nội dung (phù hợp layer 3D).
                for (var s = 1; s <= c.numLayers; s++) c.layer(s).selected = false;
                L.selected = true;
                app.executeCommand(app.findMenuCommandId("Center Anchor Point in Layer Content") || 10312);
                n++;
                continue;
            }
            var r = L.sourceRectAtTime(c.time, false);
            var ap = L.transform.anchorPoint, a = ap.valueAtTime(c.time, false);
            var na = [r.left + r.width * fx, r.top + r.height * fy];
            var d = [na[0] - a[0], na[1] - a[1]];
            if (Math.abs(d[0]) < 1e-4 && Math.abs(d[1]) < 1e-4) continue;
            var sc = L.transform.scale.valueAtTime(c.time, false);
            var rot = L.transform.rotation.valueAtTime(c.time, false) * Math.PI / 180;
            var sx = d[0] * sc[0] / 100, sy = d[1] * sc[1] / 100;
            var pd = [sx * Math.cos(rot) - sy * Math.sin(rot), sx * Math.sin(rot) + sy * Math.cos(rot)];

            var lk = L.locked; L.locked = false;
            MMW.offsetProp(ap, [d[0], d[1], 0]);
            var pos = L.transform.position;
            if (pos.dimensionsSeparated) {
                MMW.offsetProp(L.transform.property("ADBE Position_0"), pd[0]);
                MMW.offsetProp(L.transform.property("ADBE Position_1"), pd[1]);
            } else {
                MMW.offsetProp(pos, [pd[0], pd[1], 0]);
            }
            L.locked = lk;
            n++;
        }
        return "Đã dời anchor cho " + n + " layer.";
    };

    // ---------------- Sequencer ----------------
    // o.step: số frame giữa các phần tử; o.order: "down" | "up" | "random".
    // Nếu có keyframe đang chọn -> dàn keyframe theo từng layer, ngược lại -> dàn layer.
    T.sequencer = function (o) {
        var c = MMW.comp(), layers = MMW.sortByIndex(MMW.selLayers(c));
        var step = (o.step === undefined ? 2 : Number(o.step)) * c.frameDuration;
        var order = o.order || "down";
        if (order === "up") layers.reverse();
        if (order === "random") {
            for (var r = layers.length - 1; r > 0; r--) {
                var j = Math.floor(Math.random() * (r + 1)), tmp = layers[r];
                layers[r] = layers[j]; layers[j] = tmp;
            }
        }
        var keyed = MMW.keyProps(c, false);
        if (keyed.length) {
            var minT = {}, i, base = 1e9;
            for (i = 0; i < keyed.length; i++) base = Math.min(base, keyed[i].prop.keyTime(keyed[i].keys[0]));
            var nk = 0;
            for (i = 0; i < keyed.length; i++) {
                var pos = MMW.indexOf(layers, keyed[i].layer);
                var target = base + pos * step;
                // giữ khoảng cách giữa các property của cùng layer
                var lid = keyed[i].layer.index;
                if (minT[lid] === undefined) {
                    minT[lid] = 1e9;
                    for (var q = 0; q < keyed.length; q++) if (keyed[q].layer.index === lid) minT[lid] = Math.min(minT[lid], keyed[q].prop.keyTime(keyed[q].keys[0]));
                }
                var delta = target - minT[lid];
                MMW.moveKeys(keyed[i].prop, keyed[i].keys, function (d) { return d.t + delta; });
                nk += keyed[i].keys.length;
            }
            return "Đã dàn " + nk + " keyframe trên " + layers.length + " layer.";
        }
        if (layers.length < 2) MMW.fail("Hãy chọn ít nhất 2 layer (hoặc chọn keyframe).");
        var start = 1e9;
        for (var a = 0; a < layers.length; a++) start = Math.min(start, layers[a].inPoint);
        for (var b = 0; b < layers.length; b++) {
            var L = layers[b], lk = L.locked;
            L.locked = false;
            L.startTime += (start + b * step) - L.inPoint;
            L.locked = lk;
        }
        return "Đã dàn " + layers.length + " layer, mỗi bước " + (o.step === undefined ? 2 : o.step) + " frame.";
    };
})();

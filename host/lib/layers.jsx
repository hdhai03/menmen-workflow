// layers.jsx - Add Null To Layers, Get Colors, Move Anchor Point, Sequencer
(function () {
    var T = MMW.tools;

    // ---------------- Add Null To Layers ----------------
    // Click: one null centered on the selected layers. Alt: AE default null (not centered).
    // Shift: one null per layer.
    // Click: one null in the middle of the selected layers (they are parented to it);
    //        nothing selected: one null in the middle of the comp.
    // Alt:   a classic null (AE default, no centering).  Shift: one null per selected layer.
    T.addNull = function (o) {
        var c = MMW.comp(), i;
        if (!c.selectedLayers.length) {
            var solo = o.alt ? c.layers.addNull() : MMW.newNull(c, "");
            solo.name = MMW.uniqueLayerName(c, "Null Control");
            if (!o.alt) solo.transform.position.setValue([c.width / 2, c.height / 2]);
            return o.alt ? "Added classic null \"" + solo.name + "\"." : "Added null \"" + solo.name + "\" in the middle of the comp.";
        }
        var layers = MMW.sortByIndex(MMW.selLayers(c));
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
            return "Created " + layers.length + " null(s).";
        }

        var nul = o.alt ? c.layers.addNull() : MMW.newNull(c, "");
        nul.name = MMW.uniqueLayerName(c, "Null Control");
        nul.threeDLayer = any3D;
        nul.moveBefore(layers[0]);
        if (!o.alt) {
            // Average comp-space position of the selected layers.
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
            if (l.parent && MMW.indexOf(layers, l.parent) >= 0) continue; // keep parenting inside the selection
            var lck = l.locked; l.locked = false; l.parent = nul; l.locked = lck;
        }
        return "Added null \"" + nul.name + "\".";
    };

    // ---------------- Get Colors ----------------
    // Collects every color (fill, stroke, effect color...) on the selected layers into one controller.
    // Identical colors share one Color Control (linked by expression).
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
        if (!found.length) MMW.fail("No static colors found on the selected layers.");

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
        return order.length + " unique color(s), linked " + found.length + " propert(ies).";
    };

    // ---------------- Move Anchor Point ----------------
    // o.x, o.y in [0..1] - anchor position inside the content bounds (0,0 = top-left; 0.5,0.5 = center).
    // The layer stays visually in place.
    T.moveAnchor = function (o) {
        var c = MMW.comp(), layers = MMW.selLayers(c), n = 0;
        var fx = (o.x === undefined) ? 0.5 : Number(o.x), fy = (o.y === undefined) ? 0.5 : Number(o.y);
        for (var i = 0; i < layers.length; i++) {
            var L = layers[i];
            if (L instanceof CameraLayer || L instanceof LightLayer) continue;
            if (o.shift && L.threeDLayer) {
                // Shift + center: use AE's native command to center on content (works for 3D layers).
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
        return "Moved the anchor of " + n + " layer(s).";
    };

    // ---------------- Sequencer ----------------
    // o.step: frames between items; o.order: "down" | "up" | "random".
    // With selected keyframes -> offsets keyframes per layer, otherwise -> offsets layers.
    // Stagger. o.step = Num (frames between steps), o.group = Step (layers per step: every Step layers
    // move on by Num frames), o.order = "down" | "up" | "random" | "align" (align = to the playhead).
    // Cumulative: each click shifts the n-th step by another n * Num frames from where it is now, so
    // clicking again spreads further (3 layers, Num 2: 0 0 0 -> 0 2 4 -> 0 4 8).
    // With keyframes selected the keys move, otherwise the layers (in points).
    T.sequencer = function (o) {
        var c = MMW.comp(), layers = MMW.sortByIndex(MMW.selLayers(c));
        var num = o.step === undefined ? 1 : Number(o.step), step = num * c.frameDuration;
        var group = Math.max(1, Math.round(Number(o.group) || 1));
        var order = o.order || "down", align = order === "align";
        if (order === "up") layers.reverse();
        if (order === "random") {
            for (var r = layers.length - 1; r > 0; r--) {
                var j = Math.floor(Math.random() * (r + 1)), tmp = layers[r];
                layers[r] = layers[j]; layers[j] = tmp;
            }
        }
        function slot(pos) { return Math.floor(pos / group); }
        // Selected keyframes are staggered instead of layers. What gets its own offset depends on the selection:
        //  keys on several layers -> per layer; on one layer but several properties -> per property;
        //  several keys of one property -> per keyframe (each key moves Num x its place, so they spread out).
        var keyed = MMW.keyProps(c, false);
        if (keyed.length) {
            var shuffle = function (a) { for (var r2 = a.length - 1; r2 > 0; r2--) { var j2 = Math.floor(Math.random() * (r2 + 1)), t2 = a[r2]; a[r2] = a[j2]; a[j2] = t2; } return a; };
            var ordered = function (n) {  // unit positions 0..n-1 in the chosen order
                var a = []; for (var i0 = 0; i0 < n; i0++) a.push(i0);
                if (order === "up") a.reverse(); else if (order === "random") shuffle(a);
                var pos = []; for (var i1 = 0; i1 < a.length; i1++) pos[a[i1]] = i1;
                return pos;
            };
            var lids = {}, nl = 0, nk = 0, i;
            for (i = 0; i < keyed.length; i++) if (!lids[keyed[i].layer.index]) { lids[keyed[i].layer.index] = true; nl++; }
            if (nl > 1) {  // per layer, in timeline order (top -> bottom), keeping each layer's own key spacing
                var ls = [], seen = {};
                for (i = 0; i < keyed.length; i++) { var li = keyed[i].layer.index; if (!seen[li]) { seen[li] = true; ls.push(li); } }
                ls.sort(function (x, y) { return x - y; });
                var lpos = ordered(ls.length), minT = {};
                for (i = 0; i < keyed.length; i++) {
                    var lid = keyed[i].layer.index, t0 = keyed[i].prop.keyTime(keyed[i].keys[0]);
                    minT[lid] = minT[lid] === undefined ? t0 : Math.min(minT[lid], t0);
                }
                for (i = 0; i < keyed.length; i++) {
                    var L0 = keyed[i].layer.index, k = MMW.indexOf(ls, L0);
                    var dl = align ? c.time - minT[L0] : slot(lpos[k]) * step;
                    MMW.moveKeys(keyed[i].prop, keyed[i].keys, function (d) { return d.t + dl; });
                    nk += keyed[i].keys.length;
                }
                return align ? "Aligned " + nk + " keyframe(s) of " + nl + " layers to the playhead." : "Offset the keyframes of " + nl + " layers by " + num + " frame(s)" + (group > 1 ? " every " + group : " each") + ".";
            }
            if (keyed.length > 1) {  // one layer, several properties: per property (top -> bottom)
                var ppos = ordered(keyed.length);
                for (i = 0; i < keyed.length; i++) {
                    var p0 = keyed[i].prop.keyTime(keyed[i].keys[0]);
                    var dp = align ? c.time - p0 : slot(ppos[i]) * step;
                    MMW.moveKeys(keyed[i].prop, keyed[i].keys, function (d) { return d.t + dp; });
                    nk += keyed[i].keys.length;
                }
                return align ? "Aligned " + keyed.length + " properties to the playhead." : "Offset " + keyed.length + " properties by " + num + " frame(s)" + (group > 1 ? " every " + group : " each") + ".";
            }
            // one property: per keyframe
            var K = keyed[0], kpos = ordered(K.keys.length);
            if (align) {
                var first = K.prop.keyTime(K.keys[0]);
                MMW.moveKeys(K.prop, K.keys, function (d) { return d.t + c.time - first; });
                return "Moved " + K.keys.length + " keyframe(s) to the playhead.";
            }
            if (K.keys.length < 2) MMW.fail("Select at least 2 keyframes (or keys on several properties / layers).");
            MMW.moveKeys(K.prop, K.keys, function (d, idx) { return d.t + slot(kpos[idx]) * step; });
            return "Spread " + K.keys.length + " keyframes by " + num + " frame(s)" + (group > 1 ? " every " + group : " each") + ".";
        }
        if (!align && layers.length < 2) MMW.fail("Select at least 2 layers (or some keyframes).");
        for (var b = 0; b < layers.length; b++) {
            var L = layers[b], lk = L.locked;
            L.locked = false;
            L.startTime += align ? c.time - L.inPoint : slot(b) * step;
            L.locked = lk;
        }
        if (align) return "Aligned " + layers.length + " layer(s) to the playhead.";
        return "Offset " + layers.length + " layer(s) by " + num + " frame(s)" + (group > 1 ? " every " + group + " layers." : " each.");
    };
})();

// keyframes.jsx - align, offset, reverse, clean keyframes; easing presets
(function () {
    var T = MMW.tools;

    function bounds(list) {
        var a = 1e9, b = -1e9;
        for (var i = 0; i < list.length; i++) {
            a = Math.min(a, list[i].prop.keyTime(list[i].keys[0]));
            b = Math.max(b, list[i].prop.keyTime(list[i].keys[list[i].keys.length - 1]));
        }
        return { first: a, last: b };
    }
    function shiftAll(list, deltaFn) {
        var n = 0;
        for (var i = 0; i < list.length; i++) {
            var d = deltaFn(list[i]);
            if (Math.abs(d) < 1e-9) continue;
            MMW.moveKeys(list[i].prop, list[i].keys, function (k) { return k.t + d; });
            n += list[i].keys.length;
        }
        return n;
    }

    // Moves the selected keys to the playhead. Alt: align each property separately (its first key to the playhead).
    T.alignKeysToTime = function (o) {
        var c = MMW.comp(), list = MMW.keyProps(c), b = bounds(list);
        var n = shiftAll(list, function (it) { return c.time - (o.alt ? it.prop.keyTime(it.keys[0]) : b.first); });
        return "Moved " + n + " keyframe(s) to the playhead.";
    };
    // First key to the layer In point. Alt: last key to the Out point.
    T.alignKeysToInOut = function (o) {
        var c = MMW.comp(), list = MMW.keyProps(c);
        var n = shiftAll(list, function (it) {
            return o.alt ? it.layer.outPoint - c.frameDuration - it.prop.keyTime(it.keys[it.keys.length - 1])
                         : it.layer.inPoint - it.prop.keyTime(it.keys[0]);
        });
        return "Aligned " + n + " keyframe(s) to the " + (o.alt ? "Out" : "In") + " point.";
    };
    // Click: left align (first keys line up). Alt: right align (last keys line up).
    T.alignKeysLeftRight = function (o) {
        var c = MMW.comp(), list = MMW.keyProps(c), b = bounds(list);
        var n = shiftAll(list, function (it) {
            return o.alt ? b.last - it.prop.keyTime(it.keys[it.keys.length - 1]) : b.first - it.prop.keyTime(it.keys[0]);
        });
        return (o.alt ? "Right" : "Left") + "-aligned " + n + " keyframe(s).";
    };

    // o.frames: number of frames (negative = earlier). Alt: earlier.
    T.offsetKeys = function (o) {
        var c = MMW.comp(), list = MMW.keyProps(c), f = Number(o.frames) || 0;
        if (o.alt) f = -f;
        var n = shiftAll(list, function () { return f * c.frameDuration; });
        return "Offset " + n + " keyframe(s) by " + f + " frame(s).";
    };

    // Time-reverses the selected keys (within the same range).
    T.timeReverseKeys = function () {
        var c = MMW.comp(), list = MMW.keyProps(c), n = 0;
        for (var i = 0; i < list.length; i++) {
            var p = list[i].prop, ks = list[i].keys;
            if (ks.length < 2) continue;
            var a = p.keyTime(ks[0]), b = p.keyTime(ks[ks.length - 1]);
            var data = [], j;
            for (j = 0; j < ks.length; j++) data.push(MMW.readKey(p, ks[j]));
            for (j = ks.length - 1; j >= 0; j--) p.removeKey(ks[j]);
            for (j = 0; j < data.length; j++) {
                var d = data[j], r = {}, k;
                for (k in d) if (d.hasOwnProperty(k)) r[k] = d[k];
                r.inI = d.outI; r.outI = d.inI; r.inE = d.outE; r.outE = d.inE;
                if (d.inT) { r.inT = d.outT; r.outT = d.inT; }
                MMW.writeKey(p, r, a + b - d.t);
            }
            n += ks.length;
        }
        return "Reversed " + n + " keyframe(s).";
    };

    function same(a, b) {
        if (a instanceof Array) {
            for (var i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-6) return false;
            return true;
        }
        if (typeof a === "number") return Math.abs(a - b) < 1e-6;
        try { return a.toString() === b.toString(); } catch (e) { return false; }
    }
    // Removes redundant keys: keys whose value equals both neighbours (on the selected properties).
    T.cleanKeyframes = function (o) {
        var c = MMW.comp(), props = MMW.selProps(c), n = 0;
        if (!props.length) MMW.fail("Select properties with keyframes.");
        for (var i = 0; i < props.length; i++) {
            var p = props[i].prop;
            if (p.numKeys < 3 || p.propertyValueType === PropertyValueType.SHAPE) continue;
            for (var k = p.numKeys - 1; k >= 2; k--) {
                if (same(p.keyValue(k), p.keyValue(k - 1)) && same(p.keyValue(k), p.keyValue(k + 1))) { p.removeKey(k); n++; }
            }
        }
        return "Removed " + n + " redundant keyframe(s).";
    };

    // ---------------- Easing ----------------
    // Reverses easing: outgoing ease of key A <-> incoming ease of key B (for each selected key pair).
    T.reverseKeyEasing = function () {
        var c = MMW.comp(), list = MMW.keyProps(c), n = 0;
        for (var i = 0; i < list.length; i++) {
            var p = list[i].prop, ks = list[i].keys;
            if (ks.length === 1) {
                var k0 = ks[0];
                p.setTemporalEaseAtKey(k0, p.keyOutTemporalEase(k0), p.keyInTemporalEase(k0));
                n++; continue;
            }
            for (var j = 0; j < ks.length - 1; j++) {
                var a = ks[j], b = ks[j + 1];
                var aOut = p.keyOutTemporalEase(a), bIn = p.keyInTemporalEase(b);
                var flipA = [], flipB = [];
                for (var d = 0; d < aOut.length; d++) {
                    flipA.push(new KeyframeEase(bIn[d].speed, bIn[d].influence));
                    flipB.push(new KeyframeEase(aOut[d].speed, aOut[d].influence));
                }
                p.setTemporalEaseAtKey(a, p.keyInTemporalEase(a), flipA);
                p.setTemporalEaseAtKey(b, flipB, p.keyOutTemporalEase(b));
                n++;
            }
        }
        return "Reversed easing on " + n + " segment(s).";
    };

    // Cubic-bezier (x1,y1,x2,y2) of the classic easings.
    var CURVES = {
        sineIn: [0.12, 0, 0.39, 0], sineOut: [0.61, 1, 0.88, 1], sineInOut: [0.37, 0, 0.63, 1],
        quadIn: [0.11, 0, 0.5, 0], quadOut: [0.5, 1, 0.89, 1], quadInOut: [0.45, 0, 0.55, 1],
        cubicIn: [0.32, 0, 0.67, 0], cubicOut: [0.33, 1, 0.68, 1], cubicInOut: [0.65, 0, 0.35, 1],
        quartIn: [0.5, 0, 0.75, 0], quartOut: [0.25, 1, 0.5, 1], quartInOut: [0.76, 0, 0.24, 1],
        quintIn: [0.64, 0, 0.78, 0], quintOut: [0.22, 1, 0.36, 1], quintInOut: [0.83, 0, 0.17, 1],
        expoIn: [0.7, 0, 0.84, 0], expoOut: [0.16, 1, 0.3, 1], expoInOut: [0.87, 0, 0.13, 1],
        circIn: [0.55, 0, 1, 0.45], circOut: [0, 0.55, 0.45, 1], circInOut: [0.85, 0, 0.15, 1],
        backIn: [0.36, 0, 0.66, -0.56], backOut: [0.34, 1.56, 0.64, 1], backInOut: [0.68, -0.6, 0.32, 1.6]
    };
    MMW.EASE_CURVES = CURVES;

    // o.curve: a CURVES name, or o.bezier = [x1,y1,x2,y2]. Applied to each selected key pair.
    T.easingPreset = function (o) {
        var bz = o.bezier || CURVES[o.curve];
        if (!bz) MMW.fail("Unknown easing: " + o.curve);
        var x1 = Math.max(0.001, bz[0]), y1 = bz[1], x2 = Math.min(0.999, bz[2]), y2 = bz[3];
        var s1 = y1 / x1, s2 = (1 - y2) / (1 - x2);
        var inf1 = Math.max(0.1, Math.min(100, x1 * 100)), inf2 = Math.max(0.1, Math.min(100, (1 - x2) * 100));
        var c = MMW.comp(), list = MMW.keyProps(c), n = 0;
        for (var i = 0; i < list.length; i++) {
            var p = list[i].prop, ks = list[i].keys;
            if (ks.length < 2) continue;
            for (var j = 0; j < ks.length - 1; j++) {
                var a = ks[j], b = ks[j + 1];
                var dt = p.keyTime(b) - p.keyTime(a);
                if (dt <= 0) continue;
                var va = p.keyValue(a), vb = p.keyValue(b), dims = p.keyOutTemporalEase(a).length;
                var outE = [], inE = [];
                for (var d = 0; d < dims; d++) {
                    var avg;
                    if (dims === 1 && va instanceof Array) {
                        var sum = 0;
                        for (var q = 0; q < va.length; q++) sum += (vb[q] - va[q]) * (vb[q] - va[q]);
                        avg = Math.sqrt(sum) / dt;               // spatial: speed along the path
                    } else {
                        avg = ((va instanceof Array) ? (vb[d] - va[d]) : (vb - va)) / dt;
                    }
                    outE.push(new KeyframeEase(avg * s1, inf1));
                    inE.push(new KeyframeEase(avg * s2, inf2));
                }
                p.setTemporalEaseAtKey(a, p.keyInTemporalEase(a), outE);
                p.setTemporalEaseAtKey(b, inE, p.keyOutTemporalEase(b));
                p.setInterpolationTypeAtKey(a, p.keyInInterpolationType(a), KeyframeInterpolationType.BEZIER);
                p.setInterpolationTypeAtKey(b, KeyframeInterpolationType.BEZIER, p.keyOutInterpolationType(b));
                n++;
            }
        }
        if (!n) MMW.fail("Select at least 2 consecutive keyframes on the same property.");
        return "Easing " + (o.curve || "custom") + " -> " + n + " segment(s).";
    };
})();

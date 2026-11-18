// animation.jsx - Easy Keyframes, Clone, Easings Manager, Fix Keys Time, Loop, Elastic, Bounce
(function () {
    var T = MMW.tools;

    // ---------------- Easy Keyframes ----------------
    // o.mode: "ease" | "in" | "out" | "linear" | "hold"; o.inInf / o.outInf: influence 0.1-100
    T.easyKeyframes = function (o) {
        var c = MMW.comp(), list = MMW.keyProps(c), n = 0;
        var mode = o.mode || "ease";
        var inInf = Math.max(0.1, Math.min(100, Number(o.inInf) || 33.33));
        var outInf = Math.max(0.1, Math.min(100, Number(o.outInf) || 33.33));
        for (var i = 0; i < list.length; i++) {
            var p = list[i].prop;
            for (var j = 0; j < list[i].keys.length; j++) {
                var k = list[i].keys[j];
                if (mode === "linear") {
                    p.setInterpolationTypeAtKey(k, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
                } else if (mode === "hold") {
                    p.setInterpolationTypeAtKey(k, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
                } else {
                    var dims = p.keyInTemporalEase(k).length, ein = [], eout = [];
                    var curIn = p.keyInTemporalEase(k), curOut = p.keyOutTemporalEase(k);
                    for (var d = 0; d < dims; d++) {
                        ein.push(mode === "out" ? curIn[d] : new KeyframeEase(0, inInf));
                        eout.push(mode === "in" ? curOut[d] : new KeyframeEase(0, outInf));
                    }
                    p.setTemporalEaseAtKey(k, ein, eout);
                    var tIn = mode === "out" ? p.keyInInterpolationType(k) : KeyframeInterpolationType.BEZIER;
                    var tOut = mode === "in" ? p.keyOutInterpolationType(k) : KeyframeInterpolationType.BEZIER;
                    p.setInterpolationTypeAtKey(k, tIn, tOut);
                }
                n++;
            }
        }
        return "Applied to " + n + " keyframe(s).";
    };

    // ---------------- Clone ----------------
    // Copies the selected keys to the playhead. Alt: select the new keys. Shift: reversed clone.
    T.clone = function (o) {
        var c = MMW.comp(), list = MMW.keyProps(c), total = 0, i, j;
        var first = 1e9, last = -1e9;
        for (i = 0; i < list.length; i++) {
            first = Math.min(first, list[i].prop.keyTime(list[i].keys[0]));
            last = Math.max(last, list[i].prop.keyTime(list[i].keys[list[i].keys.length - 1]));
        }
        for (i = 0; i < list.length; i++) {
            var p = list[i].prop, data = [];
            var layerTime = c.time; // keyTime/addKey use comp time
            for (j = 0; j < list[i].keys.length; j++) data.push(MMW.readKey(p, list[i].keys[j]));
            var created = [];
            for (j = 0; j < data.length; j++) {
                var d = data[j], t;
                if (o.shift) {
                    t = layerTime + (last - d.t);
                    d = swapInOut(d);
                } else {
                    t = layerTime + (d.t - first);
                }
                created.push(t);
                MMW.writeKey(p, d, t);
            }
            if (o.alt) {
                for (j = 1; j <= p.numKeys; j++) p.setSelectedAtKey(j, false);
                for (j = 0; j < created.length; j++) p.setSelectedAtKey(p.nearestKeyIndex(created[j]), true);
            }
            total += data.length;
        }
        return "Cloned " + total + " keyframe(s).";
    };

    function swapInOut(d) {
        var r = {}, k;
        for (k in d) if (d.hasOwnProperty(k)) r[k] = d[k];
        r.inI = d.outI; r.outI = d.inI;
        r.inE = d.outE; r.outE = d.inE;
        if (d.inT) { r.inT = d.outT; r.outT = d.inT; }
        return r;
    }

    // ---------------- Easings Manager ----------------
    // copy: Alt = easing only, Shift = values only. paste: same.
    T.easingsCopy = function (o) {
        var c = MMW.comp(), list = MMW.keyProps(c), clip = [];
        for (var i = 0; i < list.length; i++) {
            for (var j = 0; j < list[i].keys.length; j++) clip.push(MMW.readKey(list[i].prop, list[i].keys[j]));
        }
        $.global.__mmwEaseClip = { keys: clip, mode: o.alt ? "ease" : (o.shift ? "value" : "both") };
        return "Copied " + clip.length + " keyframe(s)" + (o.alt ? " (easing)" : (o.shift ? " (values)" : "")) + ".";
    };

    T.easingsPaste = function (o) {
        var clip = $.global.__mmwEaseClip;
        if (!clip || !clip.keys.length) MMW.fail("Nothing copied yet.");
        var mode = o.alt ? "ease" : (o.shift ? "value" : clip.mode);
        var c = MMW.comp(), list = MMW.keyProps(c), n = 0;
        for (var i = 0; i < list.length; i++) {
            var p = list[i].prop;
            for (var j = 0; j < list[i].keys.length; j++) {
                var k = list[i].keys[j], src = clip.keys[j % clip.keys.length];
                if (mode !== "ease") { try { p.setValueAtKey(k, src.v); } catch (e) {} }
                if (mode !== "value") {
                    try {
                        if (src.inE && src.outE) p.setTemporalEaseAtKey(k, MMW.fitEase(p, k, src.inE), MMW.fitEase(p, k, src.outE));
                        p.setInterpolationTypeAtKey(k, src.inI, src.outI);
                    } catch (e2) {}
                }
                n++;
            }
        }
        return "Pasted onto " + n + " keyframe(s).";
    };

    // ---------------- Fix Keys Time ----------------
    // Snaps keyframes to whole frames (comp frame rate). No keys selected = all keys of the selected properties.
    T.fixKeysTime = function (o) {
        var c = MMW.comp(), fd = c.frameDuration, fixed = 0;
        var list = MMW.keyProps(c, false);
        if (!list.length) {
            var all = MMW.selProps(c);
            for (var a = 0; a < all.length; a++) {
                if (all[a].prop.numKeys > 0) {
                    var ks = [];
                    for (var q = 1; q <= all[a].prop.numKeys; q++) ks.push(q);
                    list.push({ layer: all[a].layer, prop: all[a].prop, keys: ks });
                }
            }
        }
        if (!list.length) MMW.fail("Select keyframes or properties with keyframes.");
        for (var i = 0; i < list.length; i++) {
            var p = list[i].prop, off = 0, bad = [];
            for (var j = 0; j < list[i].keys.length; j++) {
                var t = p.keyTime(list[i].keys[j]) + off;
                var snapped = Math.round(t / fd) * fd;
                if (Math.abs(snapped - t) > 1e-6) bad.push(list[i].keys[j]);
            }
            if (!bad.length) continue;
            MMW.moveKeys(p, bad, function (d) { return Math.round((d.t + off) / fd) * fd - off; });
            fixed += bad.length;
        }
        return fixed ? "Snapped " + fixed + " off-frame keyframe(s)." : "All keyframes are already on frames.";
    };

    // ---------------- Loop In/Out ----------------
    // Click: cycle, Alt: pingpong, Ctrl: continue, Shift: offset.
    T.loop = function (o) {
        var c = MMW.comp(), props = MMW.selProps(c), n = 0;
        var type = o.alt ? "pingpong" : (o.ctrl ? "continue" : (o.shift ? "offset" : "cycle"));
        if (!props.length) MMW.fail("Select properties (e.g. Position, Rotation...).");
        for (var i = 0; i < props.length; i++) {
            var p = props[i].prop;
            if (!p.canSetExpression) continue;
            p.expression = 'loopOut("' + type + '")';
            n++;
        }
        return "loopOut(\"" + type + "\") → " + n + " property.";
    };

    var VEC_HELPERS =
        "function mmwMul(a,s){if(a instanceof Array){var r=[];for(var i=0;i<a.length;i++)r.push(a[i]*s);return r;}return a*s;}\n" +
        "function mmwAdd(a,b){if(a instanceof Array){var r=[];for(var i=0;i<a.length;i++)r.push(a[i]+b[i]);return r;}return a+b;}\n" +
        "function mmwLen(a){if(a instanceof Array){var s=0;for(var i=0;i<a.length;i++)s+=a[i]*a[i];return Math.sqrt(s);}return Math.abs(a);}\n" +
        "var n=0;if(numKeys>0){n=nearestKey(time).index;if(key(n).time>time)n--;}\n";

    // ---------------- Elastic ----------------
    function elasticExpr(amp, freq, decay) {
        return "// MenMen Elastic\nvar amp=" + amp + ", freq=" + freq + ", decay=" + decay + ";\n" + VEC_HELPERS +
            "if(n>0 && time>key(n).time){var t=time-key(n).time;var v=velocityAtTime(key(n).time-thisComp.frameDuration/10);\n" +
            "mmwAdd(value, mmwMul(v, amp*Math.sin(freq*t*2*Math.PI)/Math.exp(decay*t)));}else{value;}";
    }
    T.elastic = function (o) {
        return applyExpr(elasticExpr(o.amp || 0.06, o.freq || 2.5, o.decay || 5), "Elastic");
    };

    // ---------------- Bounce ----------------
    function bounceExpr(elastic, gravity, maxB) {
        return "// MenMen Bounce\nvar e=" + elastic + ", g=" + gravity + ", nMax=" + maxB + ";\n" + VEC_HELPERS +
            "if(n>0 && time>key(n).time){var t=time-key(n).time;var v=mmwMul(velocityAtTime(key(n).time-.001),-e);var vl=mmwLen(v);\n" +
            "var vu=(value instanceof Array)?(vl>0?mmwMul(v,1/vl):mmwMul(v,0)):(v<0?-1:1);\n" +
            "var tCur=0,seg=2*vl/g,tNext=seg,nb=1;\n" +
            "while(tNext<t && nb<=nMax){vl*=e;seg*=e;tCur=tNext;tNext+=seg;nb++;}\n" +
            "if(nb<=nMax){var dt=t-tCur;mmwAdd(value, mmwMul(vu, dt*(vl-g*dt/2)));}else{value;}}else{value;}";
    }
    T.bounce = function (o) {
        return applyExpr(bounceExpr(o.elasticity || 0.7, o.gravity || 5000, o.maxBounces || 9), "Bounce");
    };

    function applyExpr(code, label) {
        var c = MMW.comp(), props = MMW.selProps(c), n = 0;
        for (var i = 0; i < props.length; i++) {
            var p = props[i].prop;
            if (!p.canSetExpression || p.numKeys < 2) continue;
            p.expression = code;
            n++;
        }
        if (!n) MMW.fail("Select properties with at least 2 keyframes.");
        return label + " → " + n + " property.";
    }
})();

// expression.jsx - enable/disable/remove/bake/find-replace expressions + expression-driven animation
(function () {
    var T = MMW.tools;

    // Properties with expressions: selected -> selected layers -> (Alt) whole comp
    function exprTargets(c, o, includeEmpty) {
        var out = [], i, sel = MMW.selProps(c);
        for (i = 0; i < sel.length; i++) if (sel[i].prop.canSetExpression && (includeEmpty || sel[i].prop.expression !== "")) out.push(sel[i].prop);
        if (out.length && !o.alt) return out;
        out = [];
        for (i = 1; i <= c.numLayers; i++) {
            var L = c.layer(i);
            if (!o.alt && !L.selected) continue;
            MMW.walkProps(L, function (p) { if (p.canSetExpression && p.expression !== "") out.push(p); });
        }
        if (!out.length) MMW.fail("No expressions found (select properties/layers, or hold Alt for the whole comp).");
        return out;
    }

    T.enableExpressions = function (o) {
        var c = MMW.comp(), ps = exprTargets(c, o);
        for (var i = 0; i < ps.length; i++) ps[i].expressionEnabled = true;
        return "Enabled " + ps.length + " expression(s).";
    };
    T.disableExpressions = function (o) {
        var c = MMW.comp(), ps = exprTargets(c, o);
        for (var i = 0; i < ps.length; i++) ps[i].expressionEnabled = false;
        return "Disabled " + ps.length + " expression(s).";
    };
    T.removeExpressions = function (o) {
        var c = MMW.comp(), ps = exprTargets(c, o);
        for (var i = 0; i < ps.length; i++) ps[i].expression = "";
        return "Removed " + ps.length + " expression(s).";
    };
    T.removeExpressionErrors = function (o) {
        var c = MMW.comp(), ps = exprTargets(c, { alt: true }), n = 0;
        for (var i = 0; i < ps.length; i++) {
            var err = "";
            try { err = ps[i].expressionError; } catch (e) {}
            if (err) { ps[i].expression = ""; n++; }
        }
        return "Removed " + n + " broken expression(s).";
    };
    // Bakes expressions into keyframes (every frame between the layer In-Out).
    T.bakeExpressions = function (o) {
        var c = MMW.comp(), ps = exprTargets(c, o), fd = c.frameDuration, n = 0;
        for (var i = 0; i < ps.length; i++) {
            var p = ps[i];
            if (p.propertyValueType === PropertyValueType.NO_VALUE || p.propertyValueType === PropertyValueType.CUSTOM_VALUE) continue;
            var L = p.propertyGroup(p.propertyDepth);
            var a = Math.max(0, L.inPoint), b = Math.min(c.duration, L.outPoint), times = [], vals = [];
            for (var t = a; t < b - fd / 2; t += fd) { times.push(t); vals.push(p.valueAtTime(t, false)); }
            if (!times.length) continue;
            p.expression = "";
            while (p.numKeys) p.removeKey(1);
            p.setValuesAtTimes(times, vals);
            n++;
        }
        return "Baked " + n + " expression(s) into keyframes.";
    };
    // o.find, o.replace - in the selected layers, or the whole comp if none selected / Alt held
    T.findReplaceExpressions = function (o) {
        if (!o.find) MMW.fail("Enter the text to find.");
        var c = MMW.comp(), all = o.alt || !c.selectedLayers.length, n = 0;
        for (var i = 1; i <= c.numLayers; i++) {
            if (!all && !c.layer(i).selected) continue;
            MMW.walkProps(c.layer(i), function (p) {
                if (!p.canSetExpression || p.expression.indexOf(o.find) < 0) return;
                p.expression = p.expression.split(o.find).join(o.replace || "");
                n++;
            });
        }
        return "Replaced in " + n + " expression(s).";
    };

    // ---------- Expression-driven animation (with controls to tweak later) ----------
    function ensureSlider(L, name, val) {
        var fx = L.property("ADBE Effect Parade"), ex = fx.property(name);
        if (ex) return ex;
        var s = MMW.addEffect(L, "ADBE Slider Control", name);
        s.property(1).setValue(val);
        return s;
    }
    function q(s) { return MMW.quote(s); }

    // Wiggle on the selected properties with Freq/Amp sliders per property.
    T.wiggleProperty = function (o) {
        var c = MMW.comp(), sel = MMW.selProps(c), n = 0;
        if (!sel.length) MMW.fail("Select properties (Position, Rotation, Scale...).");
        for (var i = 0; i < sel.length; i++) {
            var p = sel[i].prop, L = sel[i].layer;
            if (!p.canSetExpression) continue;
            var tag = p.name;
            ensureSlider(L, "Wiggle Freq - " + tag, Number(o.freq) || 2);
            ensureSlider(L, "Wiggle Amp - " + tag, Number(o.amp) || 30);
            p.expression = "wiggle(effect(" + q("Wiggle Freq - " + tag) + ")(1), effect(" + q("Wiggle Amp - " + tag) + ")(1))";
            n++;
        }
        return "Wiggle -> " + n + " property.";
    };
    // Continuous rotation (degrees/second) on the selected layers.
    T.spin = function (o) {
        var c = MMW.comp(), s = MMW.selLayers(c);
        for (var i = 0; i < s.length; i++) {
            ensureSlider(s[i], "Spin (deg/s)", Number(o.speed) || 90);
            s[i].transform.rotation.expression = "value + (time - inPoint) * effect(\"Spin (deg/s)\")(1)";
        }
        return "Spin -> " + s.length + " layer.";
    };
    // Automatic fade in/out based on the In/Out points.
    T.autoFader = function (o) {
        var c = MMW.comp(), s = MMW.selLayers(c);
        for (var i = 0; i < s.length; i++) {
            ensureSlider(s[i], "Fade In (frames)", Number(o.fadeIn) || 10);
            ensureSlider(s[i], "Fade Out (frames)", Number(o.fadeOut) || 10);
            s[i].transform.opacity.expression =
                "var fi=effect(\"Fade In (frames)\")(1)*thisComp.frameDuration, fo=effect(\"Fade Out (frames)\")(1)*thisComp.frameDuration;\n" +
                "var a=fi>0?linear(time,inPoint,inPoint+fi,0,1):1, b=fo>0?linear(time,outPoint-fo,outPoint,1,0):1;\nvalue*Math.min(a,b);";
        }
        return "Auto fade -> " + s.length + " layer.";
    };
    // Opacity blink/flicker.
    T.blinker = function (o) {
        var c = MMW.comp(), s = MMW.selLayers(c);
        for (var i = 0; i < s.length; i++) {
            ensureSlider(s[i], "Blink Freq", Number(o.freq) || 6);
            ensureSlider(s[i], "Blink Random %", Number(o.random) || 0);
            s[i].transform.opacity.expression =
                "var f=effect(\"Blink Freq\")(1), r=effect(\"Blink Random %\")(1)/100;\n" +
                "seedRandom(Math.floor(time*f),true);\nvar on=Math.sin(time*f*Math.PI*2)>=0;\nif(random()<r) on=!on;\non?value:0;";
        }
        return "Blinker -> " + s.length + " layer.";
    };
    // Stop-motion stepping (posterizeTime) on the selected properties, or every keyframed transform property.
    T.stopMotion = function (o) {
        var c = MMW.comp(), sel = MMW.selProps(c), list = [], i;
        for (i = 0; i < sel.length; i++) if (sel[i].prop.canSetExpression) list.push(sel[i]);
        if (!list.length) {
            var s = MMW.selLayers(c);
            for (i = 0; i < s.length; i++) (function (L) {
                MMW.walkProps(L.transform, function (p) { if (p.numKeys > 0 && p.canSetExpression) list.push({ layer: L, prop: p }); });
            })(s[i]);
        }
        if (!list.length) MMW.fail("Select properties or layers with keyframes.");
        for (i = 0; i < list.length; i++) {
            ensureSlider(list[i].layer, "Stop Motion FPS", Number(o.fps) || 12);
            var old = list[i].prop.expression;
            list[i].prop.expression = "posterizeTime(effect(\"Stop Motion FPS\")(1));\n" + (old ? old : "value");
        }
        return "Stop motion -> " + list.length + " property.";
    };
})();

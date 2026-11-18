// rigs.jsx - Area Effector, Spot Blur, Audio to Precomps
(function () {
    var T = MMW.tools;
    var q = function (s) { return MMW.quote(s); };

    function ensureFx(layer, matchName, name, value) {
        var fx = layer.property("ADBE Effect Parade"), e = fx.property(name);
        if (!e) {
            e = MMW.addEffect(layer, matchName, name);
            if (value !== undefined) e.property(1).setValue(value);
        }
        return layer.property("ADBE Effect Parade").property(name);
    }
    function avgPosition(c, layers) {
        var h = MMW.helper(c), s = [0, 0];
        for (var i = 0; i < layers.length; i++) {
            var p = h.evalAt("var L=thisComp.layer(" + layers[i].index + ");var p=L.toComp(L.anchorPoint);[p[0],p[1],0]", c.time, 1);
            s[0] += p[0]; s[1] += p[1];
        }
        h.remove();
        return [s[0] / layers.length, s[1] / layers.length];
    }

    // ===================== Area Effector =====================
    // Layers near the controller are affected (inside Radius = full, fades out over Falloff).
    // o.mode: "opacity" | "scale" | "position" | "rotation" | "color"
    // Alt: new controller. Shift: remove the effect of this mode from the selected layers.
    var AREA_TAG = "// MenMen Area Effector";

    function isAreaCtrl(L) { return /^Area Effector( \d+)?$/.test(L.name); }

    function fieldExpr(ctrlName, posSrc) {
        return AREA_TAG + "\n" +
            "var C=thisComp.layer(" + q(ctrlName) + ");\n" +
            "var r=Math.max(0,C.effect(\"Radius\")(1)), fo=Math.max(0.001,C.effect(\"Falloff\")(1));\n" +
            "var p=" + posSrc + ";\n" +
            "var w=hasParent?parent.toWorld(p):p, cw=C.toWorld(C.anchorPoint);\n" +
            "var d=length([w[0],w[1]],[cw[0],cw[1]]);\n" +
            "var f=1-clamp((d-r)/fo,0,1); f=f*f*(3-2*f);\n" +
            "if(C.effect(\"Invert Field\")(1)==1) f=1-f;\n";
    }

    function areaFieldGuide(c, ctrl) {
        var name = ctrl.name + " Field";
        for (var i = 1; i <= c.numLayers; i++) if (c.layer(i).name === name) return;
        var g = c.layers.addShape();
        g.name = name;
        g.guideLayer = true;
        g.label = 10;
        g.transform.anchorPoint.setValue([0, 0]);
        var R = "ADBE Root Vectors Group";
        var specs = [["Radius", "C.effect(\"Radius\")(1)"], ["Falloff", "C.effect(\"Radius\")(1)+C.effect(\"Falloff\")(1)"]];
        for (var s = 0; s < specs.length; s++) {
            g.property(R).addProperty("ADBE Vector Group");
            var gi = g.property(R).numProperties;
            g.property(R).property(gi).name = specs[s][0];
            g.property(R).property(gi).property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Ellipse");
            g.property(R).property(gi).property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Stroke");
            var v = g.property(R).property(gi).property("ADBE Vectors Group");
            v.property("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").expression =
                "var C=thisComp.layer(" + q(ctrl.name) + ");var r=" + specs[s][1] + ";[r*2,r*2];";
            var st = v.property("ADBE Vector Graphic - Stroke");
            st.property("ADBE Vector Stroke Width").setValue(s === 0 ? 2 : 1);
            st.property("ADBE Vector Stroke Color").setValue([0.3, 0.75, 1]);
            try {
                var dash = st.property("ADBE Vector Stroke Dashes");
                dash.addProperty("ADBE Vector Stroke Dash 1").setValue(s === 0 ? 12 : 4);
                dash.addProperty("ADBE Vector Stroke Gap 1").setValue(6);
            } catch (e) {}
        }
        g.transform.position.expression = "var C=thisComp.layer(" + q(ctrl.name) + ");C.toComp(C.anchorPoint);";
        g.transform.opacity.expression = "thisComp.layer(" + q(ctrl.name) + ").effect(\"Show Field\")(1)==1?100:0;";
        g.moveAfter(ctrl);
        g.locked = true;
    }

    function getAreaCtrl(c, layers, makeNew) {
        var i, found = null;
        if (!makeNew) {
            for (i = 0; i < layers.length; i++) if (isAreaCtrl(layers[i])) return layers[i];
            for (i = 1; i <= c.numLayers; i++) if (isAreaCtrl(c.layer(i))) { found = c.layer(i); break; }
            if (found) return found;
        }
        var name = "Area Effector", n = 1;
        var taken = {};
        for (i = 1; i <= c.numLayers; i++) taken[c.layer(i).name] = true;
        while (taken[name]) { n++; name = "Area Effector " + n; }
        var ctrl = MMW.newNull(c, name);
        ctrl.label = 10;
        var pos = avgPosition(c, layers);
        ctrl.transform.position.setValue(pos);
        ensureFx(ctrl, "ADBE Slider Control", "Radius", 200);
        ensureFx(ctrl, "ADBE Slider Control", "Falloff", 150);
        ensureFx(ctrl, "ADBE Checkbox Control", "Invert Field", 0);
        ensureFx(ctrl, "ADBE Checkbox Control", "Show Field", 1);
        ctrl.moveToBeginning();
        areaFieldGuide(c, ctrl);
        return ctrl;
    }

    function areaTargets(c) {
        var s = MMW.selLayers(c), out = [];
        for (var i = 0; i < s.length; i++) {
            if (isAreaCtrl(s[i]) || / Field$/.test(s[i].name) && s[i].guideLayer) continue;
            if (s[i] instanceof CameraLayer || s[i] instanceof LightLayer) continue;
            out.push(s[i]);
        }
        if (!out.length) MMW.fail("Select the layers to affect.");
        return out;
    }

    T.areaEffector = function (o) {
        var c = MMW.comp(), mode = o.mode || "opacity";
        var layers = areaTargets(c), i, L;

        if (o.shift) {
            var removed = 0;
            for (i = 0; i < layers.length; i++) {
                L = layers[i];
                if (mode === "color") {
                    var fx = L.property("ADBE Effect Parade").property("Area Color");
                    if (fx) { fx.remove(); removed++; }
                    continue;
                }
                var props = mode === "rotation" ? [L.transform.rotation] : [L.transform.property(
                    { opacity: "ADBE Opacity", scale: "ADBE Scale", position: "ADBE Position" }[mode])];
                for (var p = 0; p < props.length; p++) {
                    if (props[p] && props[p].expression.indexOf(AREA_TAG) === 0) { props[p].expression = ""; removed++; }
                }
            }
            return "Removed the " + mode + " effect from " + removed + " layer(s).";
        }

        var ctrl = getAreaCtrl(c, layers, o.alt), cn = ctrl.name, n = 0;
        if (mode === "opacity") ensureFx(ctrl, "ADBE Slider Control", "Opacity Outside %", 0);
        if (mode === "scale") { ensureFx(ctrl, "ADBE Slider Control", "Scale Outside %", 0); ensureFx(ctrl, "ADBE Slider Control", "Scale Inside %", 100); }
        if (mode === "position") { ensureFx(ctrl, "ADBE Slider Control", "Offset X", 0); ensureFx(ctrl, "ADBE Slider Control", "Offset Y", -100); ensureFx(ctrl, "ADBE Slider Control", "Offset Z", 0); }
        if (mode === "rotation") ensureFx(ctrl, "ADBE Slider Control", "Rotation", 90);
        if (mode === "color") { ensureFx(ctrl, "ADBE Color Control", "Color Outside", [1, 1, 1]); ensureFx(ctrl, "ADBE Color Control", "Color Inside", [1, 0.25, 0.3]); }

        for (i = 0; i < layers.length; i++) {
            L = layers[i];
            if (mode === "opacity") {
                L.transform.opacity.expression = fieldExpr(cn, "transform.position") +
                    "value*linear(f,0,1,C.effect(\"Opacity Outside %\")(1)/100,1);";
            } else if (mode === "scale") {
                L.transform.scale.expression = fieldExpr(cn, "transform.position") +
                    "var a=C.effect(\"Scale Outside %\")(1)/100, b=C.effect(\"Scale Inside %\")(1)/100;\n" +
                    "var k=a+(b-a)*f, out=[];for(var i=0;i<value.length;i++)out.push(value[i]*k);out;";
            } else if (mode === "position") {
                if (L.transform.position.dimensionsSeparated) continue;
                L.transform.position.expression = fieldExpr(cn, "value") +
                    "var o=[C.effect(\"Offset X\")(1)*f, C.effect(\"Offset Y\")(1)*f, C.effect(\"Offset Z\")(1)*f];\n" +
                    "value.length>2?[value[0]+o[0],value[1]+o[1],value[2]+o[2]]:[value[0]+o[0],value[1]+o[1]];";
            } else if (mode === "rotation") {
                L.transform.rotation.expression = fieldExpr(cn, "transform.position") +
                    "value+C.effect(\"Rotation\")(1)*f;";
            } else if (mode === "color") {
                var fill = L.property("ADBE Effect Parade").property("Area Color");
                if (!fill) fill = MMW.addEffect(L, "ADBE Fill", "Area Color");
                L.property("ADBE Effect Parade").property("Area Color").property("ADBE Fill-0002").expression = fieldExpr(cn, "transform.position") +
                    "var a=C.effect(\"Color Outside\")(1), b=C.effect(\"Color Inside\")(1);\n" +
                    "[a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f, a[2]+(b[2]-a[2])*f, 1];";
            }
            n++;
        }
        ctrl.selected = true;
        return "Area " + mode + " -> " + n + " layer(s), controlled by \"" + cn + "\".";
    };

    // ===================== Spot Blur =====================
    // Draggable focus spots: everything outside the spots is blurred (Compound Blur driven by a map comp).
    // o.spots, o.maxBlur, o.size, o.feather
    T.spotBlur = function (o) {
        var c = MMW.comp(), W = c.width, H = c.height;
        var nSpots = Math.max(1, Math.min(12, parseInt(o.spots, 10) || 4));
        var base = MMW.uniqueLayerName(c, "Spot Blur");

        var ctrl = MMW.newNull(c, base + " Controller");
        ctrl.label = 11;
        ctrl.transform.position.setValue([60, H - 60]);
        ensureFx(ctrl, "ADBE Slider Control", "Max Blur", Number(o.maxBlur) || 40);
        ensureFx(ctrl, "ADBE Slider Control", "Spot Size", Number(o.size) || 240);
        ensureFx(ctrl, "ADBE Slider Control", "Feather", Number(o.feather) || 120);
        ensureFx(ctrl, "ADBE Checkbox Control", "Blur Inside Spots", 0);

        var spots = [], i;
        for (i = 0; i < nSpots; i++) {
            var a = (i / nSpots) * Math.PI * 2 - Math.PI / 2, rad = nSpots === 1 ? 0 : Math.min(W, H) * 0.18;
            var s = MMW.newNull(c, base + " " + (i < 9 ? "0" : "") + (i + 1));
            s.label = 11;
            s.transform.position.setValue([W / 2 + Math.cos(a) * rad, H / 2 + Math.sin(a) * rad]);
            spots.push(s);
        }

        // Map comp: black background, white feathered ellipses following the spot nulls.
        var mapComp = app.project.items.addComp(c.name + " - " + base + " Map", W, H, c.pixelAspect, c.duration, c.frameRate);
        mapComp.parentFolder = c.parentFolder;
        var sh = mapComp.layers.addShape();
        sh.name = "Spots";
        sh.transform.anchorPoint.setValue([0, 0]);
        sh.transform.position.setValue([0, 0]);
        var R = "ADBE Root Vectors Group", main = "comp(" + q(c.name) + ")", ctl = main + ".layer(" + q(ctrl.name) + ")";
        for (i = 0; i < nSpots; i++) {
            sh.property(R).addProperty("ADBE Vector Group");
            var gi = sh.property(R).numProperties;
            sh.property(R).property(gi).name = spots[i].name;
            sh.property(R).property(gi).property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Ellipse");
            sh.property(R).property(gi).property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
            var v = sh.property(R).property(gi).property("ADBE Vectors Group");
            v.property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue([1, 1, 1]);
            var el = v.property("ADBE Vector Shape - Ellipse");
            el.property("ADBE Vector Ellipse Size").expression = "var s=" + ctl + ".effect(\"Spot Size\")(1);[s,s];";
            el.property("ADBE Vector Ellipse Position").expression =
                "var L=" + main + ".layer(" + q(spots[i].name) + ");L.toComp(L.anchorPoint);";
        }
        sh.property(R).addProperty("ADBE Vector Group");
        var bg = sh.property(R).numProperties;
        sh.property(R).property(bg).name = "Background";
        sh.property(R).property(bg).property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
        sh.property(R).property(bg).property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
        var bv = sh.property(R).property(bg).property("ADBE Vectors Group");
        bv.property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue([W * 3, H * 3]);
        bv.property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Position").setValue([W / 2, H / 2]);
        bv.property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue([0, 0, 0]);
        var gb = MMW.addEffect(sh, "ADBE Gaussian Blur 2", "Feather");
        gb.property(1).expression = ctl + ".effect(\"Feather\")(1);";
        try { sh.property("ADBE Effect Parade").property("Feather").property(3).setValue(1); } catch (e0) {} // repeat edge pixels

        var mapLayer = c.layers.add(mapComp);
        mapLayer.name = base + " Map";
        mapLayer.enabled = false;
        mapLayer.shy = true;

        var adj = c.layers.addSolid([0, 0, 0], base, W, H, c.pixelAspect, c.duration);
        adj.adjustmentLayer = true;
        adj.label = 11;
        var cb = MMW.addEffect(adj, "ADBE Compound Blur", "Spot Blur");
        cb.property(1).setValue(mapLayer.index);
        cb = adj.property("ADBE Effect Parade").property("Spot Blur");
        cb.property(2).expression = "thisComp.layer(" + q(ctrl.name) + ").effect(\"Max Blur\")(1);";
        cb.property(4).expression = "thisComp.layer(" + q(ctrl.name) + ").effect(\"Blur Inside Spots\")(1)==1?0:1;";

        adj.moveToBeginning();
        for (i = spots.length - 1; i >= 0; i--) spots[i].moveToBeginning();
        ctrl.moveToBeginning();
        mapLayer.moveToEnd();
        return "Spot Blur ready: move the \"" + base + " 01...\" nulls; settings on \"" + ctrl.name + "\".";
    };

    // ===================== Audio to Precomps =====================
    // Copies the selected audio layers into every nested precomp (recursively), offset so they stay in sync.
    // Shift: remove all audio added by this tool from the whole project.
    var AUDIO_TAG = "MenMen Audio";

    T.audioToPrecomps = function (o) {
        var i, k;
        if (o.shift) {
            var removed = 0;
            for (i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (!(it instanceof CompItem)) continue;
                for (k = it.numLayers; k >= 1; k--) {
                    var L0 = it.layer(k);
                    if (L0.comment === AUDIO_TAG) { L0.locked = false; L0.remove(); removed++; }
                }
            }
            return "Removed " + removed + " synced audio layer(s).";
        }
        var c = MMW.comp(), sel = MMW.selLayers(c), audio = [];
        for (i = 0; i < sel.length; i++) if (sel[i] instanceof AVLayer && sel[i].hasAudio) audio.push(sel[i]);
        if (!audio.length) MMW.fail("Select audio layers in the main comp.");

        var placed = 0, skipped = [], visited = {};
        // offset: comp-time of the target comp's 0 relative to the main comp
        function walk(comp, offset, depth) {
            if (depth > 20) return;
            for (var l = 1; l <= comp.numLayers; l++) {
                var P = comp.layer(l);
                if (!(P.source instanceof CompItem) || P.comment === AUDIO_TAG) continue;
                var sub = P.source;
                if (P.timeRemapEnabled || Math.abs(P.stretch - 100) > 0.001) { skipped.push(sub.name + " (time remap/stretch)"); continue; }
                if (visited[sub.id]) { skipped.push(sub.name + " (used more than once)"); continue; }
                visited[sub.id] = true;
                var subOffset = offset + P.startTime;
                for (var a = audio.length - 1; a >= 0; a--) {
                    var before = {};
                    for (var b = 1; b <= sub.numLayers; b++) before[sub.layer(b).id] = true;
                    audio[a].copyToComp(sub);
                    for (var f = 1; f <= sub.numLayers; f++) {
                        var nl = sub.layer(f);
                        if (before[nl.id]) continue;
                        nl.startTime = audio[a].startTime - subOffset;
                        nl.name = "\u266A " + audio[a].name;
                        nl.comment = AUDIO_TAG;
                        nl.label = 14;
                        nl.moveToEnd();
                        nl.locked = true;
                        placed++;
                        break;
                    }
                }
                walk(sub, subOffset, depth + 1);
            }
        }
        walk(c, 0, 0);
        var msg = "Synced " + audio.length + " audio layer(s) into precomps (" + placed + " copies).";
        if (skipped.length) msg += " Skipped: " + skipped.join(", ") + ".";
        return msg;
    };
})();

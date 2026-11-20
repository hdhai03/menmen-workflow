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
    // Same setup as spot.Blur: an adjustment layer "spot.Blur" with Compound Blur, driven by a
    // black & white "blur.Map" (white = sharp spots), "spot.Blur_01.." guide shapes you drag around,
    // and "spot.Blur_Controller" with the settings. Helper layers are shy (comp hides shy layers).
    // o.spots, o.maxBlur, o.size, o.feather
    T.spotBlur = function (o) {
        var c = MMW.comp(), W = c.width, H = c.height, i;
        var nSpots = Math.max(1, Math.min(12, parseInt(o.spots, 10) || 4));
        var R = "ADBE Root Vectors Group", V = "ADBE Vectors Group";
        var nm = function (b) { return MMW.uniqueLayerName(c, b); };

        // controller: guide shape (white square outline) + settings
        var ctrl = c.layers.addShape();
        ctrl.name = nm("spot.Blur_Controller");
        var cg = ctrl.property(R).addProperty("ADBE Vector Group");
        cg.property(V).addProperty("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue([50, 50]);
        var cs = ctrl.property(R).property(1).property(V).addProperty("ADBE Vector Graphic - Stroke");
        cs.property("ADBE Vector Stroke Color").setValue([1, 1, 1]);
        ctrl.property(R).property(1).property(V).property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Width").setValue(2);
        ctrl.transform.position.setValue([35, H - 35]);
        ctrl.label = 11;
        ctrl.guideLayer = true;
        ensureFx(ctrl, "ADBE Slider Control", "Blur Amount", Number(o.maxBlur) || 40);
        ensureFx(ctrl, "ADBE Slider Control", "Spot Size", Number(o.size) || 240);
        ensureFx(ctrl, "ADBE Slider Control", "Feather", Number(o.feather) || 120);
        ensureFx(ctrl, "ADBE Checkbox Control", "Invert (blur inside spots)", 0);
        ensureFx(ctrl, "ADBE Checkbox Control", "Show Spot Guides", 1);
        var CT = "thisComp.layer(" + q(ctrl.name) + ")";

        // spot points: guide shape layers with a circle showing the spot size
        var spots = [];
        for (i = 0; i < nSpots; i++) {
            var a = (i / nSpots) * Math.PI * 2 - Math.PI * 3 / 4, rad = nSpots === 1 ? 0 : Math.min(W, H) * 0.12;
            var s = c.layers.addShape();
            s.name = nm("spot.Blur_" + (i < 9 ? "0" : "") + (i + 1));
            var g = s.property(R).addProperty("ADBE Vector Group");
            s.property(R).property(1).property(V).addProperty("ADBE Vector Shape - Ellipse");
            s.property(R).property(1).property(V).addProperty("ADBE Vector Graphic - Stroke");
            var gv = s.property(R).property(1).property(V);
            gv.property("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").expression = "var z=" + CT + ".effect(\"Spot Size\")(1);[z,z];";
            gv.property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Color").setValue([1, 0.8, 0.2]);
            gv.property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Width").setValue(1.5);
            s.transform.opacity.expression = CT + ".effect(\"Show Spot Guides\")(1)*100;";
            s.transform.anchorPoint.setValue([0, 0]);
            s.transform.position.setValue([W / 2 + Math.cos(a) * rad, H / 2 + Math.sin(a) * rad]);
            s.label = 8;
            s.guideLayer = true;
            s.shy = true;
            spots.push(s);
        }

        // blur.Map: a white solid with one feathered round mask per spot (Add); the mask paths follow the
        // spot guides by expression, size and feather come from the controller.
        // Compound Blur must read the map with "Effects & Masks", a choice scripts cannot set: it comes from
        // the preset presets/Compound Blur (Effects & Masks).ffx (saved from AE with that choice). Without the
        // preset the masked solid goes into a precomp, whose "Source" already includes the masks.
        var preset = MMW.root ? new File(MMW.root + "/presets/Compound Blur (Effects & Masks).ffx") : null;
        var usePreset = !!(preset && preset.exists);
        function maskedSolid(comp, ref) {  // ref: expression for the comp holding the spots
            var L = comp.layers.addSolid([1, 1, 1], usePreset ? nm("blur.Map") : "blur.Map", W, H, c.pixelAspect, c.duration);
            var masks = L.property("ADBE Mask Parade");
            for (var j = 0; j < nSpots; j++) {
                var mk = masks.addProperty("ADBE Mask Atom");
                mk.name = spots[j].name;
                mk.maskMode = MaskMode.ADD;
                var shp = new Shape(), p = spots[j].transform.position.value, r = (Number(o.size) || 240) / 2, kk = r * 0.5523;
                shp.vertices = [[p[0], p[1] - r], [p[0] + r, p[1]], [p[0], p[1] + r], [p[0] - r, p[1]]];
                shp.inTangents = [[-kk, 0], [0, -kk], [kk, 0], [0, kk]];
                shp.outTangents = [[kk, 0], [0, kk], [-kk, 0], [0, -kk]];
                shp.closed = true;
                mk.property("ADBE Mask Shape").setValue(shp);
                mk.property("ADBE Mask Shape").expression =
                    "var L=" + ref + ".layer(" + q(spots[j].name) + "), C=" + ref + ".layer(" + q(ctrl.name) + ");\n" +
                    "var p=fromComp(L.toComp(L.anchorPoint)), r=Math.max(0.5, C.effect(\"Spot Size\")(1)/2), k=r*0.5523;\n" +
                    "createPath([[p[0],p[1]-r],[p[0]+r,p[1]],[p[0],p[1]+r],[p[0]-r,p[1]]], [[-k,0],[0,-k],[k,0],[0,k]], [[k,0],[0,k],[-k,0],[0,-k]], true);";
                mk.property("ADBE Mask Feather").expression = "var f=Math.max(0," + ref + ".layer(" + q(ctrl.name) + ").effect(\"Feather\")(1));[f,f];";
            }
            return L;
        }
        var map;
        if (usePreset) {
            map = maskedSolid(c, "thisComp");
        } else {
            var mapComp = app.project.items.addComp(c.name + " blur.Map", W, H, c.pixelAspect, c.duration, c.frameRate);
            mapComp.parentFolder = c.parentFolder;
            mapComp.bgColor = [0, 0, 0];
            maskedSolid(mapComp, "comp(" + q(c.name) + ")");
            map = c.layers.add(mapComp);
            map.name = nm("blur.Map");
        }
        map.enabled = false;
        map.label = 8;

        // spot.Blur: adjustment layer with Compound Blur reading blur.Map
        var adj = c.layers.addSolid([0, 0, 0], nm("spot.Blur"), W, H, c.pixelAspect, c.duration);
        adj.adjustmentLayer = true;
        adj.label = 8;
        var fx = null, parade = adj.property("ADBE Effect Parade");
        if (usePreset) {
            for (i = 1; i <= c.numLayers; i++) c.layer(i).selected = false;
            adj.selected = true;
            try { adj.applyPreset(preset); } catch (eP) {}
            for (i = 1; i <= parade.numProperties; i++) if (parade.property(i).matchName === "ADBE Compound Blur") fx = parade.property(i);
        }
        if (!fx) fx = parade.property(parade.addProperty("ADBE Compound Blur").propertyIndex);
        var fxIndex = fx.propertyIndex;
        fx.property(1).setValue(map.index);                                                    // Blur Layer
        fx.property(2).expression = CT + ".effect(\"Blur Amount\")(1);";                        // Maximum Blur
        fx.property(4).expression = CT + ".effect(\"Invert (blur inside spots)\")(1)==1?0:1;";  // Invert Blur: white = sharp

        // order (top -> bottom): controller, spots, spot.Blur, ... footage ..., blur.Map
        adj.moveToBeginning();
        for (i = spots.length - 1; i >= 0; i--) spots[i].moveToBeginning();
        ctrl.moveToBeginning();
        map.moveToEnd();
        // Compound Blur keeps its layer link through re-ordering; set it again by name to be safe
        try { adj.property("ADBE Effect Parade").property(fxIndex).property(1).setValue(c.layer(map.name).index); } catch (e1) {}
        map.locked = true; map.shy = true;
        adj.locked = true; adj.shy = true;
        c.hideShyLayers = true;
        return "spot.Blur ready: drag the spot.Blur_0x guides; settings on " + ctrl.name;
    };

    // ===================== Audio to Precomps (Universal Audio style) =====================
    // The selected audio layers go into one audio comp ("\u266A <comp> Audio"); that comp is added to
    // every precomp nested in the current comp (any depth) as a locked GUIDE layer with audio on,
    // offset so it plays in sync. Guide layers are heard in previews but never rendered from a parent.
    // Running it again refreshes the audio comp (all precomps follow) and adds it to new precomps.
    // Alt: also add it to every other comp in the project (starting at 0). Shift: remove everything.
    var AUDIO_TAG = "MenMen Audio";

    function audioFolder() {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof FolderItem && it.name === AUDIO_TAG) return it;
        }
        return app.project.items.addFolder(AUDIO_TAG);
    }
    function findAudioComp(master) {
        var key = AUDIO_TAG + ":" + master.id;
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof CompItem && it.comment === key) return it;
        }
        return null;
    }
    // one guide layer playing `ac` in `comp`, whose time 0 sits at `offset` in the master comp
    function placeAudio(comp, ac, offset) {
        for (var l = 1; l <= comp.numLayers; l++) {
            var E = comp.layer(l);
            if (E.source === ac) {  // already there: just re-sync
                var lk = E.locked; E.locked = false;
                E.startTime = -offset; E.audioEnabled = true;
                E.locked = lk;
                return false;
            }
        }
        var L = comp.layers.add(ac);
        L.startTime = -offset;
        L.name = ac.name;
        L.comment = AUDIO_TAG;
        L.guideLayer = true;      // heard in previews, never rendered from a parent comp
        L.audioEnabled = true;
        try { L.enabled = false; } catch (e) { /* audio-only source: no video switch */ }
        L.label = 14;
        L.moveToEnd();
        L.locked = true;
        return true;
    }

    T.audioToPrecomps = function (o) {
        var i, k;
        if (o.shift) {
            var removed = 0, comps = [];
            for (i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (!(it instanceof CompItem)) continue;
                if (String(it.comment).indexOf(AUDIO_TAG + ":") === 0) { comps.push(it); continue; }
                for (k = it.numLayers; k >= 1; k--) {
                    var L0 = it.layer(k);
                    if (L0.comment === AUDIO_TAG) { L0.locked = false; L0.remove(); removed++; }
                }
            }
            for (i = 0; i < comps.length; i++) comps[i].remove();
            return "Removed " + removed + " audio layer(s) and " + comps.length + " audio comp(s).";
        }
        var c = MMW.comp(), sel = c.selectedLayers, audio = [];
        for (i = 0; i < sel.length; i++) if (sel[i] instanceof AVLayer && sel[i].hasAudio && sel[i].comment !== AUDIO_TAG) audio.push(sel[i]);
        if (!audio.length) MMW.fail("Select the audio layer(s) to share (in the main comp).");

        // 1) the audio comp: same timing as the master, refreshed with the selected audio
        var ac = findAudioComp(c);
        if (!ac) {
            ac = app.project.items.addComp("\u266A " + c.name + " Audio", c.width, c.height, c.pixelAspect, c.duration, c.frameRate);
            ac.comment = AUDIO_TAG + ":" + c.id;
            ac.parentFolder = audioFolder();
        } else {
            for (k = ac.numLayers; k >= 1; k--) { ac.layer(k).locked = false; ac.layer(k).remove(); }
            ac.duration = c.duration;
        }
        for (i = audio.length - 1; i >= 0; i--) audio[i].copyToComp(ac);  // copyToComp keeps the timing
        for (k = 1; k <= ac.numLayers; k++) ac.layer(k).audioEnabled = true;

        // 2) every precomp nested in the master (any depth), offset so it plays in sync
        var added = 0, synced = 0, skipped = [], visited = {};
        visited[c.id] = true; visited[ac.id] = true;
        function walk(comp, offset, depth) {
            if (depth > 20) return;
            for (var l = 1; l <= comp.numLayers; l++) {
                var P = comp.layer(l);
                if (!(P.source instanceof CompItem) || P.source === ac || P.comment === AUDIO_TAG) continue;
                var sub = P.source;
                if (P.timeRemapEnabled || Math.abs(P.stretch - 100) > 0.001) { skipped.push(sub.name + " (time remap/stretch)"); continue; }
                if (visited[sub.id]) { skipped.push(sub.name + " (used more than once: synced to its first use)"); continue; }
                visited[sub.id] = true;
                var subOffset = offset + P.startTime;
                if (placeAudio(sub, ac, subOffset)) added++; else synced++;
                walk(sub, subOffset, depth + 1);
            }
        }
        walk(c, 0, 0);
        // 3) Alt: every other comp in the project too (no timing link: starts at 0)
        if (o.alt) {
            for (i = 1; i <= app.project.numItems; i++) {
                var cc = app.project.item(i);
                if (!(cc instanceof CompItem) || visited[cc.id] || String(cc.comment).indexOf(AUDIO_TAG + ":") === 0) continue;
                visited[cc.id] = true;
                if (placeAudio(cc, ac, 0)) added++; else synced++;
            }
        }
        var msg = ac.name + ": added to " + added + " comp(s)" + (synced ? ", updated in " + synced : "") + " as a guide layer with audio on.";
        if (!added && !synced) msg = ac.name + " is ready, but this comp has no precomps" + (o.alt ? " and no other comps exist." : " (Alt: add it to every comp in the project).");
        if (skipped.length) msg += " Skipped: " + skipped.join(", ") + ".";
        return msg;
    };

    // ===================== Metronome (beat-driven layer switching) =====================
    // Everything reads one "Metronome" controller: BPM, Beats per Bar, Start Time, Mode, step sizes.
    var MODES = ["BPM", "Frames", "Markers", "Keyframes"];

    function findMetronome(c) {
        for (var i = 1; i <= c.numLayers; i++) if (c.layer(i).name === "Metronome") return c.layer(i);
        return null;
    }
    function setFx(L, name, v) { try { L.property("ADBE Effect Parade").property(name).property(1).setValue(v); } catch (e) {} }

    // Creates (or returns) the controller; o.* values are applied when given.
    function metronome(c, o) {
        var m = findMetronome(c), isNew = !m;
        if (!m) {
            m = MMW.newNull(c, "Metronome");
            m.label = 14;
            m.transform.position.setValue([80, 80]);
            ensureFx(m, "ADBE Slider Control", "BPM", 120);
            ensureFx(m, "ADBE Slider Control", "Beats per Bar", 4);
            ensureFx(m, "ADBE Slider Control", "Start Time (s)", 0);
            ensureFx(m, "ADBE Slider Control", "Beats per Step", 1);
            ensureFx(m, "ADBE Slider Control", "Frames per Step", 6);
            ensureFx(m, "ADBE Slider Control", "Step (keyframe me)", 0);
            ensureFx(m, "ADBE Checkbox Control", "Random Order", 0);
            // Mode: dropdown when available (AE 2020+), slider 1-4 otherwise
            try {
                var di = MMW.addEffect(m, "ADBE Dropdown Control", "Mode").propertyIndex;
                // setPropertyParameters invalidates earlier references: re-resolve by index afterwards
                m.property("ADBE Effect Parade").property(di).property(1).setPropertyParameters(MODES);
                m.property("ADBE Effect Parade").property(di).name = "Mode";
            } catch (e) {
                var ex = m.property("ADBE Effect Parade").property("Mode");
                if (ex) ex.remove();
                ensureFx(m, "ADBE Slider Control", "Mode", 1);
            }
            m.moveToBeginning();
        }
        if (o.bpm !== undefined && o.bpm !== "") setFx(m, "BPM", Number(o.bpm));
        if (o.beatsPerBar !== undefined && o.beatsPerBar !== "") setFx(m, "Beats per Bar", Number(o.beatsPerBar));
        if (o.beatsPerStep !== undefined && o.beatsPerStep !== "") setFx(m, "Beats per Step", Number(o.beatsPerStep));
        if (o.framesPerStep !== undefined && o.framesPerStep !== "") setFx(m, "Frames per Step", Number(o.framesPerStep));
        if (o.random !== undefined) setFx(m, "Random Order", o.random ? 1 : 0);
        if (o.mode) setFx(m, "Mode", Math.max(1, MMW.indexOf(MODES, o.mode) + 1));
        if (isNew && o.start !== undefined && o.start !== "") setFx(m, "Start Time (s)", Number(o.start));
        return m;
    }
    MMW.metronome = metronome;

    var BEAT_TAG = "// MenMen Beat Switch";
    var M_REF = "thisComp.layer(\"Metronome\")";
    var BEAT_CORE =
        "var M=" + M_REF + ";\n" +
        "var bpm=Math.max(1,M.effect(\"BPM\")(1)), beat=60/bpm, t=time-M.effect(\"Start Time (s)\")(1);\n";

    // Selected layers take turns being visible: one layer per step.
    // o.mode, o.bpm, o.beatsPerStep, o.framesPerStep, o.random. Shift: remove the switching.
    T.beatSwitch = function (o) {
        var c = MMW.comp(), sel = MMW.sortByIndex(MMW.selLayers(c)), layers = [], i;
        for (i = 0; i < sel.length; i++) if (sel[i].name !== "Metronome" && !(sel[i] instanceof CameraLayer) && !(sel[i] instanceof LightLayer)) layers.push(sel[i]);
        if (o.shift) {
            var r = 0;
            for (i = 0; i < layers.length; i++) if (layers[i].transform.opacity.expression.indexOf(BEAT_TAG) === 0) { layers[i].transform.opacity.expression = ""; r++; }
            return "Removed beat switching from " + r + " layer(s).";
        }
        if (layers.length < 2) MMW.fail("Select at least 2 layers to switch between.");
        metronome(c, o);
        var n = layers.length;
        for (i = 0; i < n; i++) {
            layers[i].transform.opacity.expression = BEAT_TAG + "\n" + BEAT_CORE +
                "var mode=Math.round(M.effect(\"Mode\")(1)), k=0, idx=" + i + ", n=" + n + ";\n" +
                "if(mode==1){k=Math.floor(t/(beat*Math.max(0.01,M.effect(\"Beats per Step\")(1))));}\n" +
                "else if(mode==2){k=Math.floor(t/(Math.max(1,M.effect(\"Frames per Step\")(1))*thisComp.frameDuration));}\n" +
                "else if(mode==3){var mk=M.marker;k=0;for(var j=1;j<=mk.numKeys;j++){if(mk.key(j).time<=time)k=j;}}\n" +
                "else{k=Math.round(M.effect(\"Step (keyframe me)\")(1));}\n" +
                "if(mode<3&&t<0)k=0;\n" +
                "var pick=((k%n)+n)%n;\n" +
                "if(M.effect(\"Random Order\")(1)==1){seedRandom(k*31+7,true);pick=Math.floor(random(n));}\n" +
                "pick==idx?value:0;";
        }
        return "Beat switching on " + n + " layers (Metronome: " + (o.mode || "BPM") + ").";
    };

    // Beat markers on the Metronome layer across the work area ("bar.beat"). Shift: clear them.
    T.beatMarkers = function (o) {
        var c = MMW.comp(), m = metronome(c, o), mk = m.property("ADBE Marker"), i;
        if (o.shift) { var n0 = mk.numKeys; for (i = n0; i >= 1; i--) mk.removeKey(i); return "Removed " + n0 + " marker(s)."; }
        var fx = m.property("ADBE Effect Parade");
        var bpm = Math.max(1, fx.property("BPM").property(1).value), per = Math.max(1, Math.round(fx.property("Beats per Bar").property(1).value));
        var start = fx.property("Start Time (s)").property(1).value, beat = 60 / bpm;
        var a = c.workAreaStart, b = c.workAreaStart + c.workAreaDuration, count = 0;
        var first = Math.ceil((a - start) / beat - 1e-6);
        for (var k = first; start + k * beat < b && count < 5000; k++) {
            if (k < 0) continue;
            var tm = start + k * beat;
            var mv = new MarkerValue((Math.floor(k / per) + 1) + "." + (k % per + 1));
            if (o.alt && k % per !== 0) continue;   // Alt: bars only
            mk.setValueAtTime(tm, mv);
            count++;
        }
        return "Added " + count + " beat marker(s) on \"Metronome\".";
    };

    // Audible click track (Tone effect). Downbeats are higher. Alt: no accent.
    T.metronomeClick = function (o) {
        var c = MMW.comp(), m = metronome(c, o);
        var L = c.layers.addSolid([0, 0, 0], MMW.uniqueLayerName(c, "Metronome Click"), 16, 16, 1, c.duration);
        L.enabled = false;
        L.label = 14;
        var tone = L.property("ADBE Effect Parade").addProperty("ADBE Tone");
        tone = L.property("ADBE Effect Parade").property(tone.propertyIndex);
        var acc = o.alt ? "880" : "(Math.floor(t/beat+1e-6)%Math.max(1,Math.round(M.effect(\"Beats per Bar\")(1)))==0?1760:880)";
        for (var f = 2; f <= 6; f++) {
            try { tone.property(f).expression = BEAT_CORE + "t<0?0:" + acc + ";"; } catch (e) {}
        }
        try {
            tone.property(7).expression = BEAT_CORE +
                "if(t<0){0}else{var p=t%beat;p<0.035?100*(1-p/0.035):0}";
        } catch (e2) {}
        L.moveAfter(m);
        return "Click track added (\"" + L.name + "\"): turn on audio preview to hear it.";
    };

    // Text layer counting bars and beats. Alt: total beat count only.
    T.beatCounter = function (o) {
        var c = MMW.comp(), m = metronome(c, o);
        var L = c.layers.addText("1.1");
        L.name = MMW.uniqueLayerName(c, "Beat Counter");
        L.property("ADBE Text Properties").property("ADBE Text Document").expression = BEAT_CORE +
            "var per=Math.max(1,Math.round(M.effect(\"Beats per Bar\")(1)));\n" +
            "var k=Math.max(0,Math.floor(t/beat+1e-6));\n" +
            (o.alt ? "String(k+1);" : "\"BAR \"+(Math.floor(k/per)+1)+\"  BEAT \"+(k%per+1);");
        L.moveAfter(m);
        return "Beat counter added.";
    };

    // Just creates / updates the Metronome controller with the given settings.
    T.metronomeSetup = function (o) {
        var c = MMW.comp(), m = metronome(c, o);
        m.selected = true;
        return "Metronome ready: " + m.property("ADBE Effect Parade").property("BPM").property(1).value + " BPM.";
    };
})();

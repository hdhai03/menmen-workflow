// pathviz.jsx - Path Visualizer: a live overlay that draws the vertices, bezier handles and handle lines
// of the selected layers' paths (shape paths and masks), for tutorials and design breakdowns.
// The overlay is a shape layer at the comp origin; every dot follows its point through
// sourceLayer.toComp(), so parenting and animation of the source just work. Vector math uses add()/sub()
// so the expressions run in both the Legacy and the JavaScript expression engine.
//  click: create / replace overlays for the selected layers
//  Alt:   rebuild the selected overlays (or the overlays of the selected sources), keeping their settings
//  Shift: remove all overlays in the comp
(function () {
    var T = MMW.tools;
    var TAG = "MenMen PathViz|";
    var R = "ADBE Root Vectors Group", V = "ADBE Vectors Group", TR = "ADBE Vector Transform Group";

    function q(s) { return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'; }
    function isOverlay(L) { return String(L.comment).indexOf(TAG) === 0; }
    function sourceName(L) { return String(L.comment).slice(TAG.length); }

    // most vertices a path ever has (animated paths can change their point count)
    function maxVerts(prop) {
        var n = 0, i, v;
        try {
            if (prop.numKeys > 0) {
                for (i = 1; i <= prop.numKeys; i++) { v = prop.keyValue(i); if (v && v.vertices && v.vertices.length > n) n = v.vertices.length; }
            } else {
                v = prop.value; if (v && v.vertices) n = v.vertices.length;
            }
        } catch (e) {}
        return n;
    }
    // [{ expr: "<path expression>", n: <max vertices>, name }]
    function collectPaths(L) {
        var out = [], LE = "thisComp.layer(" + q(L.name) + ")";
        function walk(group, base) {
            for (var i = 1; i <= group.numProperties; i++) {
                var p = group.property(i);
                if (!p.enabled) continue;  // hidden groups / paths are skipped
                if (p.matchName === "ADBE Vector Group") walk(p.property(V), base + ".content(" + i + ")");
                else if (p.matchName === "ADBE Vector Shape - Group") {
                    var n = maxVerts(p.property("ADBE Vector Shape"));
                    if (n) out.push({ expr: LE + base + ".content(" + i + ").path", n: n, name: p.name });
                }
            }
        }
        if (L instanceof ShapeLayer) walk(L.property(R), "");
        var masks = L.property("ADBE Mask Parade");
        if (masks) for (var m = 1; m <= masks.numProperties; m++) {
            var mk = masks.property(m), nm = maxVerts(mk.property("ADBE Mask Shape"));
            if (nm) out.push({ expr: LE + ".mask(" + m + ").maskPath", n: nm, name: mk.name });
        }
        return out;
    }

    function fx(layer, matchName, name, value) {
        var e = layer.property("ADBE Effect Parade").property(name);
        if (!e) { e = MMW.addEffect(layer, matchName, name); if (value !== undefined) e.property(1).setValue(value); }
        return e;
    }
    function controls(ov, o) {
        fx(ov, "ADBE Color Control", "Vertex Color", [1, 1, 1]);
        fx(ov, "ADBE Color Control", "Handle Color", [1, 0.27, 0.27]);
        fx(ov, "ADBE Color Control", "Line Color", [1, 0.27, 0.27]);
        fx(ov, "ADBE Slider Control", "Vertex Size", Number(o.vertexSize) || 12);
        fx(ov, "ADBE Slider Control", "Handle Size", Number(o.handleSize) || 7);
        fx(ov, "ADBE Slider Control", "Line Width", Number(o.lineWidth) || 1.5);
        fx(ov, "ADBE Checkbox Control", "Show Vertices", 1);
        fx(ov, "ADBE Checkbox Control", "Show Handles", 1);
        fx(ov, "ADBE Checkbox Control", "Show Lines", 1);
        fx(ov, "ADBE Checkbox Control", "Scale With Layer", 0);
    }

    // one dot: a rect (square / circle via roundness / diamond via 45 deg) whose group follows `posExpr`
    // "Scale With Layer": dots grow / shrink with the source's own and its parents' scale
    function dot(parent, name, sizeFx, colorFx, shape, posExpr, showExpr, SRC) {
        var g = parent.addProperty("ADBE Vector Group");
        g.name = name;
        var c = g.property(V);
        var rect = c.addProperty("ADBE Vector Shape - Rect");
        var size = "var L=" + SRC + ";var s=effect(\"" + sizeFx + "\")(1)*(effect(\"Scale With Layer\")(1)==1?length(sub(L.toComp([100,0]),L.toComp([0,0])))/100:1);";
        rect.property("ADBE Vector Rect Size").expression = size + "[s,s];";
        rect.property("ADBE Vector Rect Roundness").expression = shape === "circle" ? size + "s/2;" : "0;";
        c.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").expression = "effect(\"" + colorFx + "\")(1);";
        var t = g.property(TR);
        if (shape === "diamond") t.property("ADBE Vector Rotation").setValue(45);
        t.property("ADBE Vector Position").expression = posExpr;
        t.property("ADBE Vector Group Opacity").expression = showExpr;
        return g;
    }

    function build(ov, L, o) {
        var paths = collectPaths(L), root = ov.property(R), i, k;
        for (k = root.numProperties; k >= 1; k--) root.property(k).remove();
        var SRC = "thisComp.layer(" + q(L.name) + ")";
        var vShape = o.vertexShape || "square", hShape = o.handleShape || "circle";
        for (i = 0; i < paths.length; i++) {
            var P = paths[i];
            var pg = root.addProperty("ADBE Vector Group");
            pg.name = (paths.length > 1 ? (i + 1) + ". " : "") + P.name;
            var pc = pg.property(V);
            // order inside a shape layer: first = on top -> vertices, handles, then lines underneath
            var gv = pc.addProperty("ADBE Vector Group"); gv.name = "Vertices";
            var gh = pc.addProperty("ADBE Vector Group"); gh.name = "Handles";
            var gl = pc.addProperty("ADBE Vector Group"); gl.name = "Lines";
            var head = "var L=" + SRC + ", P=" + P.expr + ", p=P.points(), I=P.inTangents(), O=P.outTangents();\n";
            for (k = 0; k < P.n; k++) {
                var at = "if(" + k + ">=p.length){[0,0]}else{var v=p[" + k + "];";
                // vertex
                dot(gv.property(V), "Vertex " + (k + 1), "Vertex Size", "Vertex Color", vShape,
                    "try{" + head + at + "L.toComp(v)}}catch(e){[0,0]}",
                    "try{" + head + "(" + k + "<p.length && effect(\"Show Vertices\")(1)==1)?100:0}catch(e){0}", SRC);
                // handles: hidden on corner points (zero-length tangents)
                var showH = function (T) {
                    return "try{" + head + "(" + k + "<p.length && effect(\"Show Handles\")(1)==1 && length(" + T + "[" + k + "])>0.01)?100:0}catch(e){0}";
                };
                dot(gh.property(V), "In " + (k + 1), "Handle Size", "Handle Color", hShape,
                    "try{" + head + at + "L.toComp(add(v,I[" + k + "]))}}catch(e){[0,0]}", showH("I"), SRC);
                dot(gh.property(V), "Out " + (k + 1), "Handle Size", "Handle Color", hShape,
                    "try{" + head + at + "L.toComp(add(v,O[" + k + "]))}}catch(e){[0,0]}", showH("O"), SRC);
                // handle line: in handle - vertex - out handle
                var lg = gl.property(V).addProperty("ADBE Vector Group");
                lg.name = "Line " + (k + 1);
                var lc = lg.property(V);
                lc.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").expression =
                    "try{" + head + "if(" + k + ">=p.length){createPath([[0,0],[0,0]],[],[],false)}else{var v=p[" + k + "];" +
                    "createPath([L.toComp(add(v,I[" + k + "])),L.toComp(v),L.toComp(add(v,O[" + k + "]))],[],[],false)}}catch(e){createPath([[0,0],[0,0]],[],[],false)}";
                var st = lc.addProperty("ADBE Vector Graphic - Stroke");
                st.property("ADBE Vector Stroke Color").expression = "effect(\"Line Color\")(1);";
                st.property("ADBE Vector Stroke Width").expression = "effect(\"Line Width\")(1);";
                lg.property(TR).property("ADBE Vector Group Opacity").expression =
                    "try{" + head + "(" + k + "<p.length && effect(\"Show Lines\")(1)==1 && (length(I[" + k + "])>0.01||length(O[" + k + "])>0.01))?100:0}catch(e){0}";
            }
        }
        return paths.length;
    }
    function overlayFor(c, L) {
        for (var i = 1; i <= c.numLayers; i++) if (isOverlay(c.layer(i)) && sourceName(c.layer(i)) === L.name) return c.layer(i);
        return null;
    }

    T.pathVisualizer = function (o) {
        var c = MMW.comp(), i, n = 0, made = [];
        if (o.shift) {
            for (i = c.numLayers; i >= 1; i--) if (isOverlay(c.layer(i))) { c.layer(i).locked = false; c.layer(i).remove(); n++; }
            return n ? "Removed " + n + " path overlay(s)." : "No path overlays in this comp.";
        }
        var sel = c.selectedLayers, jobs = [];
        if (!sel.length) MMW.fail("Select shape layers or layers with masks" + (o.alt ? ", or their path overlays." : "."));
        for (i = 0; i < sel.length; i++) {
            var S = sel[i];
            if (isOverlay(S)) {
                var src = null;
                for (var k = 1; k <= c.numLayers; k++) if (c.layer(k).name === sourceName(S) && !isOverlay(c.layer(k))) { src = c.layer(k); break; }
                if (src) jobs.push({ src: src, ov: S });
            } else jobs.push({ src: S, ov: overlayFor(c, S) });
        }
        for (i = 0; i < jobs.length; i++) {
            var J = jobs[i], L = J.src, ov = J.ov;
            if (!collectPaths(L).length) continue;
            if (ov && !o.alt) { ov.locked = false; ov.remove(); ov = null; }  // click: start fresh
            if (!ov) {
                ov = c.layers.addShape();
                ov.name = MMW.uniqueLayerName(c, "◇ " + L.name + " path");
                ov.comment = TAG + L.name;
                ov.label = 6;
                ov.moveBefore(L);
                var tr = ov.transform;
                tr.anchorPoint.setValue([0, 0]); tr.position.setValue([0, 0]);
                tr.opacity.expression = "thisComp.layer(" + q(L.name) + ").transform.opacity;";
                ov.inPoint = L.inPoint; ov.outPoint = L.outPoint;
                ov.guideLayer = o.render === false;  // not in the render: visible in the comp only
            } else ov.locked = false;
            controls(ov, o);
            n += build(ov, L, o);
            made.push(ov);
        }
        if (!made.length) MMW.fail("No paths found: select shape layers (with Path shapes) or layers with masks.");
        for (i = 1; i <= c.numLayers; i++) c.layer(i).selected = false;
        for (i = 0; i < made.length; i++) made[i].selected = true;
        return (o.alt ? "Rebuilt " : "Created ") + made.length + " overlay(s), " + n + " path(s). Colors, sizes and switches are in Effect Controls.";
    };
})();

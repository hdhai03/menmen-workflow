// ============================================================
//  PATH VISUALIZER  V2.1
//  for Adobe After Effects
// ============================================================
//
//  Created by   : Sheikh Sohel
//  Website      : www.sheikhsohel.com
//  Copyright (c) 2026 Sheikh Sohel. All rights reserved.
//
//  This script is part of the Path Visualizer toolset.
//  Unauthorized redistribution or resale is prohibited.
//  For updates and more tools visit www.sheikhsohel.com
//
//  ── HOW TO USE ──────────────────────────────────────────────
//  1. Select one or more Shape Layers in your comp
//  2. Set options in the script panel
//  3. Click "Create Path" — creates overlay for ALL selected
//  4. PATH_OVERLAY_ layer(s) appear — live, expression-driven
//  5. Render → handles visible in final video
//     To hide from render → toggle eye icon on overlay layer
//
//  ── EFFECT CONTROLS (live, no re-run needed) ────────────────
//  Vertex Color · Handle Color · Line Color
//  Vertex Size  · Handle Size  · Line Width
//  Show Vertex  · Show Handles · Show Lines
//
//  ── CHANGE SHAPE ────────────────────────────────────────────
//  Change dropdown → select PATH_OVERLAY_ layer → Update Path
//
//  ── CLEANUP ALL PATHS ───────────────────────────────────────
//  Click "Cleanup All Paths" — removes ALL PATH_OVERLAY_
//  path shape layers in the active comp. No selection needed.
// ============================================================
//
//  ── MenMen Workflow integration ─────────────────────────────
//  The code below is the original V2.1 code. Changes: the ScriptUI panel is replaced, and
//  "Vertex Shape" / "Handle Shape" dropdowns pick the dot shapes live (marked MenMen).
//  the settings come from the MenMen tool dialog (getSettings), and the three buttons are
//  the tool's click modes: click = Create Path, Alt = Update Path, Shift = Cleanup All Paths.
// ============================================================

(function pathVisualizerV21() {
    var T = MMW.tools;


    var OVERLAY_PREFIX = "PATH_OVERLAY_";
    var LABEL_OVERLAY  = 6;

    // ══════════════════════════════════════════════════════════
    //  COLOR HELPERS
    // ══════════════════════════════════════════════════════════
    function hexToRgb(str) {
        if (!str) return null;
        var s = String(str).replace(/\s+/g,"");
        if (s.charAt(0) === "#") s = s.substring(1);
        if (s.length === 3) s = s[0]+s[0]+s[1]+s[1]+s[2]+s[2];
        if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
        return [
            parseInt(s.substr(0,2),16)/255,
            parseInt(s.substr(2,2),16)/255,
            parseInt(s.substr(4,2),16)/255
        ];
    }

    function rgbToHex(rgb) {
        function h(v) {
            var s = Math.round(Math.min(Math.max(v,0),1)*255).toString(16);
            return s.length < 2 ? "0"+s : s;
        }
        return h(rgb[0]) + h(rgb[1]) + h(rgb[2]);
    }

    function esc(n) { return String(n).replace(/\\/g,"\\\\").replace(/"/g,'\\"'); }

    function shapeIdx(name) {
        if (name === "Circle")  return 1;
        if (name === "Diamond") return 2;
        return 0;
    }

    // ══════════════════════════════════════════════════════════
    //  GENERAL HELPERS
    // ══════════════════════════════════════════════════════════
    function getActiveComp() {
        var c = app.project.activeItem;
        if (!c || !(c instanceof CompItem)) {
            alert("Error: Please open and select a composition first.");
            return null;
        }
        return c;
    }

    function isShape(l)   { return l && (l instanceof ShapeLayer); }
    function isOverlay(l) { return l && l.name.indexOf(OVERLAY_PREFIX) === 0; }

    function getSource(overlay) {
        if (!isOverlay(overlay)) return null;
        var name = overlay.name.replace(OVERLAY_PREFIX,"");
        var comp = overlay.containingComp;
        if (!comp) return null;
        for (var i=1; i<=comp.numLayers; i++) {
            var l = comp.layer(i);
            if (l && l.name === name && !isOverlay(l)) return l;
        }
        return null;
    }

    function getPathProp(grp) {
        if (!grp || typeof grp.numProperties === "undefined") return null;
        for (var i=1; i<=grp.numProperties; i++) {
            var p = grp.property(i);
            if (p && p.matchName === "ADBE Vector Shape") return p;
        }
        return null;
    }

    function LE(l)        { return 'thisComp.layer("' + esc(l.name) + '")'; }
    function GE(l, names) {
        var e = LE(l);
        for (var i=0; i<names.length; i++) e += '.content("' + esc(names[i]) + '")';
        return e;
    }
    function PE(l, names, pName) {
        return GE(l, names) + '.content("' + esc(pName) + '").path';
    }

    // ══════════════════════════════════════════════════════════
    //  EFFECT CONTROLS
    // ══════════════════════════════════════════════════════════
    function setColor(fx, name, val) {
        var p; try { p = fx.property(name); } catch(e) { p = null; }
        if (!p || !p.active) { p = fx.addProperty("ADBE Color Control"); p.name = name; }
        try { p.property(1).setValue(val); } catch(e) {}
    }
    function setSlider(fx, name, val) {
        var p; try { p = fx.property(name); } catch(e) { p = null; }
        if (!p || !p.active) { p = fx.addProperty("ADBE Slider Control"); p.name = name; }
        try { p.property(1).setValue(val); } catch(e) {}
    }
    function setCheckbox(fx, name, val) {
        var p; try { p = fx.property(name); } catch(e) { p = null; }
        if (!p || !p.active) { p = fx.addProperty("ADBE Checkbox Control"); p.name = name; }
        try { p.property(1).setValue(val ? 1 : 0); } catch(e) {}
    }

    // Dropdown Menu Control (AE 17+): items are set with setPropertyParameters, which rebuilds the
    // effect, so it is looked up again by name afterwards. idx is 1-based.
    function setDropdown(fx, name, items, idx) {
        var p; try { p = fx.property(name); } catch(e) { p = null; }
        if (!p || !p.active) {
            p = fx.addProperty("ADBE Dropdown Control");
            p.name = name;
            try { p.property(1).setPropertyParameters(items); } catch(e) {}
            p = fx.property(name);
        }
        try { p.property(1).setValue(idx); } catch(e) {}
    }

    function setupControls(overlay, opts) {
        var fx = overlay.property("ADBE Effect Parade");
        setColor(fx,    "Vertex Color",  opts.anchorColor);
        setColor(fx,    "Handle Color",  opts.handleColor);
        setColor(fx,    "Line Color",    opts.lineColor);
        setSlider(fx,   "Vertex Size",   opts.anchorSize);
        setSlider(fx,   "Handle Size",   opts.handleSize);
        setSlider(fx,   "Line Width",    opts.lineWidth);
        // MenMen: dot shapes can be changed later from Effect Controls
        setDropdown(fx, "Vertex Shape",  ["Square", "Circle", "Diamond"], shapeIdx(opts.anchorShape) + 1);
        setDropdown(fx, "Handle Shape",  ["Square", "Circle", "Diamond"], shapeIdx(opts.handleShape) + 1);
        setCheckbox(fx, "Show Vertex",   true);
        setCheckbox(fx, "Show Handles",  true);
        setCheckbox(fx, "Show Lines",    true);
    }

    // ══════════════════════════════════════════════════════════
    //  TRANSFORM LINKS
    //  Overlay sits at comp origin [0,0] with no rotation/scale.
    //  All dot positions use sourceLayer.toComp() to convert
    //  path points from layer space → comp space directly.
    //  This handles parented layers, animated nulls, any case.
    // ══════════════════════════════════════════════════════════
    function linkLayerTr(overlay, source) {
        var tr = overlay.property("Transform");
        // Hard-zero the overlay transform so content coords = comp coords
        tr.property("Anchor Point").setValue([0, 0]);
        tr.property("Position").setValue([0, 0]);
        tr.property("Scale").setValue([100, 100]);
        tr.property("Rotation").setValue(0);
        // Only link opacity so overlay hides when source hides
        tr.property("Opacity").expression =
            LE(source) + ".transform.opacity";
    }

    function linkGroupTr(destGroup, source, names) {
        // No group transform link — positioning done via toComp() per dot
    }

    // ══════════════════════════════════════════════════════════
    //  DOT SHAPE BUILDER
    // ══════════════════════════════════════════════════════════
    function buildDot(contents, OE, sizeEff, shapeVal) {
        var rect = contents.addProperty("ADBE Vector Shape - Rect");
        rect.property("Size").expression =
            'var s = ' + OE + '.effect("' + sizeEff + '")("Slider"); [s, s];';
        // MenMen: the shape follows the "Vertex Shape" / "Handle Shape" menu (1 Square, 2 Circle, 3 Diamond)
        var shapeEff = sizeEff.replace("Size", "Shape");
        rect.property("Roundness").expression =
            'var s = ' + OE + '.effect("' + sizeEff + '")("Slider"); ' +
            'var m = ' + OE + '.effect("' + shapeEff + '")(1); m == 2 ? s / 2 : 0;';
        return rect;
    }

    function applyDotRotation(group, shapeVal, OE, sizeEff) {
        group.property("Transform").property("Rotation").expression =
            OE + '.effect("' + sizeEff.replace("Size", "Shape") + '")(1) == 3 ? 45 : 0;';
    }

    // ══════════════════════════════════════════════════════════
    //  ANCHOR DOTS
    // ══════════════════════════════════════════════════════════
    function addAnchors(dstC, source, overlay, pathGroup, pE, aShapeVal, pathIdx) {
        var pp = getPathProp(pathGroup);
        if (!pp) return;
        var pv; try { pv = pp.value; } catch(e) { return; }
        if (!pv || !pv.vertices || pv.vertices.length === 0) return;

        var OE = LE(overlay);

        var aSet  = dstC.addProperty("ADBE Vector Group");
        aSet.name = "_ANCHORS_path" + pathIdx;
        var aC    = aSet.property("Contents");

        aSet.property("Transform").property("Opacity").expression =
            OE + '.effect("Show Vertex")("Checkbox") == 1 ? 100 : 0;';

        for (var i=0; i<pv.vertices.length; i++) {
            var sq  = aC.addProperty("ADBE Vector Group");
            sq.name = "Anchor_" + i;
            var sqC = sq.property("Contents");

            buildDot(sqC, OE, "Vertex Size", aShapeVal);
            sqC.addProperty("ADBE Vector Graphic - Fill")
               .property("Color").expression =
                OE + '.effect("Vertex Color")("Color");';

            applyDotRotation(sq, aShapeVal, OE, "Vertex Size");

            sq.property("Transform").property("Position").expression =
                'try { ' +
                'var srcL = ' + LE(source) + '; ' +
                'var p = ' + pE + '; ' +
                'srcL.toComp(p.points()[' + i + ']); ' +
                '} catch(e) { [0,0]; }';
        }
    }

    // ══════════════════════════════════════════════════════════
    //  HANDLE DOTS + LINES
    // ══════════════════════════════════════════════════════════
    function addHandles(dstC, source, overlay, pathGroup, pE, hShapeVal, pathIdx) {
        var pp = getPathProp(pathGroup);
        if (!pp) return;
        var pv; try { pv = pp.value; } catch(e) { return; }
        if (!pv || !pv.vertices || pv.vertices.length === 0) return;

        var OE = LE(overlay);

        var hSet  = dstC.addProperty("ADBE Vector Group");
        hSet.name = "_HANDLES_path" + pathIdx;
        var hC    = hSet.property("Contents");

        hSet.property("Transform").property("Opacity").expression =
            OE + '.effect("Show Handles")("Checkbox") == 1 ? 100 : 0;';

        for (var i=0; i<pv.vertices.length; i++) {

            // ── Line ──────────────────────────────────────────
            var lineGrp  = hC.addProperty("ADBE Vector Group");
            lineGrp.name = "HandleLine_" + i;
            var lC       = lineGrp.property("Contents");

            lineGrp.property("Transform").property("Opacity").expression =
                OE + '.effect("Show Lines")("Checkbox") == 1 ? 100 : 0;';

            var linePath = lC.addProperty("ADBE Vector Shape - Group");
            linePath.property("Path").expression =
                'try { ' +
                'var srcL = ' + LE(source) + '; ' +
                'var p  = ' + pE + '; ' +
                'var v  = p.points()[' + i + ']; ' +
                'var it = p.inTangents()[' + i + ']; ' +
                'var ot = p.outTangents()[' + i + ']; ' +
                'var iH = srcL.toComp([v[0]+it[0], v[1]+it[1]]); ' +
                'var vc = srcL.toComp(v); ' +
                'var oH = srcL.toComp([v[0]+ot[0], v[1]+ot[1]]); ' +
                'createPath([iH, vc, oH],[],[],false); ' +
                '} catch(e) { createPath([],[],[],false); }';

            var lineStroke = lC.addProperty("ADBE Vector Graphic - Stroke");
            lineStroke.property("ADBE Vector Stroke Color").expression =
                OE + '.effect("Line Color")("Color");';
            lineStroke.property("ADBE Vector Stroke Width").expression =
                OE + '.effect("Line Width")("Slider");';

            // ── In handle ─────────────────────────────────────
            var inGrp  = hC.addProperty("ADBE Vector Group");
            inGrp.name = "InHandle_" + i;
            var iC     = inGrp.property("Contents");
            buildDot(iC, OE, "Handle Size", hShapeVal);
            iC.addProperty("ADBE Vector Graphic - Fill")
              .property("Color").expression = OE + '.effect("Handle Color")("Color");';
            applyDotRotation(inGrp, hShapeVal, OE, "Handle Size");
            inGrp.property("Transform").property("Position").expression =
                'try { ' +
                'var srcL = ' + LE(source) + '; ' +
                'var p = ' + pE + '; ' +
                'var v = p.points()[' + i + ']; ' +
                'var t = p.inTangents()[' + i + ']; ' +
                'srcL.toComp([v[0]+t[0], v[1]+t[1]]); ' +
                '} catch(e) { [0,0]; }';

            // ── Out handle ────────────────────────────────────
            var outGrp  = hC.addProperty("ADBE Vector Group");
            outGrp.name = "OutHandle_" + i;
            var oC      = outGrp.property("Contents");
            buildDot(oC, OE, "Handle Size", hShapeVal);
            oC.addProperty("ADBE Vector Graphic - Fill")
              .property("Color").expression = OE + '.effect("Handle Color")("Color");';
            applyDotRotation(outGrp, hShapeVal, OE, "Handle Size");
            outGrp.property("Transform").property("Position").expression =
                'try { ' +
                'var srcL = ' + LE(source) + '; ' +
                'var p = ' + pE + '; ' +
                'var v = p.points()[' + i + ']; ' +
                'var t = p.outTangents()[' + i + ']; ' +
                'srcL.toComp([v[0]+t[0], v[1]+t[1]]); ' +
                '} catch(e) { [0,0]; }';
        }
    }

    // ══════════════════════════════════════════════════════════
    //  FLAT PATH COLLECTOR
    //  Walks all contents recursively, collecting every path
    //  with its index-based expression string.
    //  Using indices (.content(1).content(2)) instead of names
    //  is reliable for all layer types: pen tool, text outlines,
    //  compound shapes, Create Shapes from Vector Layer, etc.
    // ══════════════════════════════════════════════════════════
    function collectPaths(srcC, layerExprBase, indexExprBase, results) {
        if (!srcC || typeof srcC.numProperties === "undefined") return;
        for (var i=1; i<=srcC.numProperties; i++) {
            var prop = srcC.property(i);
            if (!prop) continue;
            var idxExpr = indexExprBase + ".content(" + i + ")";
            if (prop.matchName === "ADBE Vector Group") {
                collectPaths(prop.property("Contents"), layerExprBase, idxExpr, results);
            } else if (prop.matchName === "ADBE Vector Shape - Group") {
                // Verify path has vertices before adding
                var hasPts = false;
                try {
                    var pathProp = getPathProp(prop);
                    if (pathProp && pathProp.value && pathProp.value.vertices &&
                        pathProp.value.vertices.length > 0) hasPts = true;
                } catch(e) {}
                if (hasPts) {
                    results.push({
                        pathGroup : prop,
                        pathExpr  : layerExprBase + idxExpr + ".path"
                    });
                }
            }
        }
    }

    // ══════════════════════════════════════════════════════════
    //  MIRROR  (Create)
    //  Uses flat path collection — works for all shape types
    // ══════════════════════════════════════════════════════════
    function mirrorContents(srcC, dstC, source, overlay, names, opts) {
        var aV = shapeIdx(opts.anchorShape);
        var hV = shapeIdx(opts.handleShape);

        // Collect ALL paths from source layer with index-based expressions
        var layerBase = LE(source);
        var idxBase   = "";
        var allPaths  = [];
        collectPaths(srcC, layerBase, idxBase, allPaths);

        // Create one flat group in overlay for all anchors and handles
        for (var p=0; p<allPaths.length; p++) {
            addAnchors(dstC, source, overlay, allPaths[p].pathGroup,
                       allPaths[p].pathExpr, aV, p);
            addHandles(dstC, source, overlay, allPaths[p].pathGroup,
                       allPaths[p].pathExpr, hV, p);
        }
    }

    // ══════════════════════════════════════════════════════════
    //  REBUILD  (Update)
    // ══════════════════════════════════════════════════════════
    function removeGenerated(container) {
        if (!container || typeof container.numProperties === "undefined") return;
        for (var i=container.numProperties; i>=1; i--) {
            var p = container.property(i);
            if (!p) continue;
            if (p.name && (/^_HANDLES_/.test(p.name) || /^_ANCHORS_/.test(p.name))) {
                p.remove(); continue;
            }
            if (p.matchName === "ADBE Vector Group") removeGenerated(p.property("Contents"));
        }
    }

    function rebuildInto(srcC, dstC, source, overlay, names, opts) {
        var aV = shapeIdx(opts.anchorShape);
        var hV = shapeIdx(opts.handleShape);
        var layerBase = LE(source);
        var allPaths  = [];
        collectPaths(srcC, layerBase, "", allPaths);
        for (var p=0; p<allPaths.length; p++) {
            addAnchors(dstC, source, overlay, allPaths[p].pathGroup,
                       allPaths[p].pathExpr, aV, p);
            addHandles(dstC, source, overlay, allPaths[p].pathGroup,
                       allPaths[p].pathExpr, hV, p);
        }
    }

    // ══════════════════════════════════════════════════════════
    //  CREATE  — works on ALL selected shape layers at once
    // ══════════════════════════════════════════════════════════
    function createOverlay() {
        try {
            var comp = getActiveComp(); if (!comp) return;

            // Snapshot selected layers before any changes
            // (selection can change as layers are added)
            var selectedLayers = [];
            for (var s=0; s<comp.selectedLayers.length; s++) {
                selectedLayers.push(comp.selectedLayers[s]);
            }

            if (selectedLayers.length === 0) {
                alert("Error: Please select one or more Shape Layers."); return;
            }

            // Filter to shape layers only (exclude existing overlays)
            var targets = [];
            for (var t=0; t<selectedLayers.length; t++) {
                var l = selectedLayers[t];
                if (isShape(l) && !isOverlay(l)) targets.push(l);
            }

            if (targets.length === 0) {
                alert("Error: No Shape Layers found in your selection.\nPlease select Shape Layers (not overlay layers)."); return;
            }

            var opts = getSettings();
            app.beginUndoGroup("Create Path Overlay");

            for (var i=0; i<targets.length; i++) {
                var layer = targets[i];

                // Remove existing overlay for this layer if present
                try {
                    var ex = comp.layer(OVERLAY_PREFIX + layer.name);
                    if (ex) ex.remove();
                } catch(e) {}

                var ov   = comp.layers.addShape();
                ov.name  = OVERLAY_PREFIX + layer.name;
                ov.label = LABEL_OVERLAY;
                ov.moveBefore(layer);

                setupControls(ov, opts);
                linkLayerTr(ov, layer);
                mirrorContents(layer.property("Contents"), ov.property("Contents"),
                    layer, ov, [], opts);
            }

            app.endUndoGroup();

            // Feedback
            var msg = targets.length === 1
                ? "Overlay created for: " + targets[0].name
                : "Overlays created for " + targets.length + " layers.";
            // Silent success — no alert needed, user sees layers in timeline

        } catch(err) {
            app.endUndoGroup();
            alert("Create Path error:\n" + err.toString());
        }
    }

    // ══════════════════════════════════════════════════════════
    //  UPDATE  — works on ALL selected overlay layers at once
    // ══════════════════════════════════════════════════════════
    function updateOverlay() {
        try {
            var comp = getActiveComp(); if (!comp) return;

            var selectedLayers = [];
            for (var s=0; s<comp.selectedLayers.length; s++) {
                selectedLayers.push(comp.selectedLayers[s]);
            }

            if (selectedLayers.length === 0) {
                alert("Error: Select one or more ANCHOR_OVERLAY_ layers to update."); return;
            }

            var targets = [];
            for (var t=0; t<selectedLayers.length; t++) {
                if (isOverlay(selectedLayers[t])) targets.push(selectedLayers[t]);
            }

            if (targets.length === 0) {
                alert("Error: No overlay layers found in selection.\nPlease select ANCHOR_OVERLAY_ layers."); return;
            }

            var opts = getSettings();
            app.beginUndoGroup("Update Path Overlay");

            for (var j=0; j<targets.length; j++) {
                var ov  = targets[j];
                var src = getSource(ov);
                if (!src) {
                    alert("Warning: Source layer not found for:\n" + ov.name); continue;
                }

                setupControls(ov, opts);
                removeGenerated(ov.property("Contents"));
                rebuildInto(src.property("Contents"), ov.property("Contents"),
                    src, ov, [], opts);
            }

            app.endUndoGroup();
        } catch(err) {
            app.endUndoGroup();
            alert("Update Path error:\n" + err.toString());
        }
    }

    // ══════════════════════════════════════════════════════════
    //  CLEANUP  — removes ALL overlay layers in the comp
    // ══════════════════════════════════════════════════════════
    function cleanupOverlays() {
        try {
            var comp = getActiveComp(); if (!comp) return;

            // Scan ALL layers in comp for overlay layers
            var toDelete = [];
            for (var i=1; i<=comp.numLayers; i++) {
                var l = comp.layer(i);
                if (isOverlay(l)) toDelete.push(l);
            }

            if (toDelete.length === 0) {
                alert("No overlay layers found in this composition."); return;
            }

            if (!confirm(
                "Remove all " + toDelete.length + " overlay path shape layer" +
                (toDelete.length > 1 ? "s" : "") + " in this comp?\nThis cannot be undone."
            )) return;

            app.beginUndoGroup("Cleanup All Path Overlays");
            for (var d=0; d<toDelete.length; d++) toDelete[d].remove();
            app.endUndoGroup();

        } catch(err) {
            app.endUndoGroup();
            alert("Cleanup All Paths error:\n" + err.toString());
        }
    }

    // ══════════════════════════════════════════════════════════
    //  MENMEN: settings from the tool dialog instead of the ScriptUI panel
    // ══════════════════════════════════════════════════════════
    var OPTS = {};
    function getSettings() {
        return {
            anchorSize   : parseFloat(OPTS.anchorSize)  || 20,
            anchorColor  : hexToRgb(OPTS.anchorColor) || [1, 1, 1],
            anchorShape  : OPTS.anchorShape || "Square",
            handleSize   : parseFloat(OPTS.handleSize)  || 6,
            handleColor  : hexToRgb(OPTS.handleColor) || hexToRgb("#FF4444"),
            handleShape  : OPTS.handleShape || "Circle",
            lineColor    : hexToRgb(OPTS.lineColor) || hexToRgb("#FF4444"),
            lineWidth    : parseFloat(OPTS.lineWidth)   || 1.5
        };
    }

    T.pathVisualizer = function (o) {
        OPTS = o || {};
        MMW.comp();  // makes the comp viewer active, so app.project.activeItem is the comp
        if (o.shift) { cleanupOverlays(); return "Cleanup All Paths done."; }
        if (o.alt) { updateOverlay(); return "Update Path done."; }
        createOverlay();
        return "Create Path done.";
    };

})();

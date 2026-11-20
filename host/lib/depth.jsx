// depth.jsx - Depth Map: AE side. Renders the selected layer's frames to PNG and imports the depth
// maps the panel makes from them (client/js/depth.js runs Depth Anything V2 Small).
//  - footage / precomp layers: the layer's source is rendered at full source size (a temporary comp),
//    and the depth layer is parented to the layer so it sits exactly on top of it;
//  - other layers (text, shapes, solids...): the comp is rendered with only that layer soloed.
(function () {
    var T = MMW.tools;
    var TEMP = "__MenMen Depth (temp)";

    function q(s) { return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]/g, " ") + '"'; }
    function safe(s) { return String(s).replace(/[\\\/:*?"<>|]/g, "_").replace(/^\s+|\s+$/g, "").slice(0, 60) || "Layer"; }
    function slash(p) { return p.replace(/\\/g, "/"); }
    function outDir() {
        var base = app.project.file ? app.project.file.parent : Folder.desktop;
        var f = new Folder(base.fsName + "/MenMen Depth");
        if (!f.exists) f.create();
        return f;
    }
    function sourceOf(L) {  // the AV source worth rendering on its own, or null
        if (!(L instanceof AVLayer) || !L.source || !L.hasVideo) return null;
        var s = L.source;
        if (s instanceof FootageItem && (s.mainSource instanceof SolidSource || s.mainSource instanceof PlaceholderSource)) return null;
        if (!(s.width > 0 && s.height > 0)) return null;
        return s;
    }
    function compById(id) {
        var c = app.project.itemByID(id);
        if (!c || !(c instanceof CompItem)) MMW.fail("The composition is gone.");
        return c;
    }
    function layerOf(o) {
        var c = compById(o.compId);
        if (o.index < 1 || o.index > c.numLayers) MMW.fail("The layer is gone.");
        return c.layer(o.index);
    }
    function srcTime(L, t) {
        try { return L.sourceTime(t); } catch (e) { return (t - L.startTime) * 100 / (L.stretch || 100); }
    }
    function waitFile(file, ms) {
        var t = 0, last = -1;
        while (t < ms) {
            if (file.exists && file.length > 0) { if (file.length === last) return true; last = file.length; }
            $.sleep(15); t += 15;
        }
        return file.exists && file.length > 0;
    }

    // Selected layer info for the dialog (JSON)
    T.depthInfo = function () {
        var c = MMW.comp(), s = c.selectedLayers;
        if (s.length !== 1) MMW.fail("Select one layer.");
        var L = s[0];
        if (L instanceof AVLayer && !L.hasVideo) MMW.fail("The layer has no video.");
        if (L instanceof CameraLayer || L instanceof LightLayer) MMW.fail("Select a layer with pixels (not a camera or light).");
        var src = sourceOf(L), w = src ? src.width : c.width, h = src ? src.height : c.height;
        var still = !!(src && src instanceof FootageItem && src.mainSource.isStill);
        return "{" + [
            '"name":' + q(L.name), '"safe":' + q(safe(L.name)), '"index":' + L.index, '"compId":' + c.id,
            '"kind":' + q(src ? "source" : "comp"), '"w":' + w, '"h":' + h, '"fps":' + c.frameRate,
            '"inPoint":' + Math.max(0, L.inPoint), '"outPoint":' + Math.min(c.duration, L.outPoint),
            '"time":' + c.time, '"still":' + still,
            '"dir":' + q(slash(outDir().fsName)), '"temp":' + q(slash(Folder.temp.fsName))
        ].join(",") + "}";
    };

    // Before rendering: a temp comp holding the source, or solo just this layer. Returns the temp comp id (or 0).
    T.depthPrep = function (o) {
        var L = layerOf(o), c = L.containingComp;
        T.depthCleanup(o);
        if (o.kind === "source") {
            var src = sourceOf(L);
            if (!src) MMW.fail("The layer has no source to render.");
            var dur = src.duration > 0 ? src.duration : c.duration;
            var tc = app.project.items.addComp(TEMP, src.width, src.height, src.pixelAspect || 1, Math.max(dur, 1 / c.frameRate), c.frameRate);
            tc.bgColor = [0, 0, 0];
            tc.layers.add(src);
            return tc.id;
        }
        var soloed = [];
        for (var i = 1; i <= c.numLayers; i++) {
            var x = c.layer(i);
            if (x.solo) soloed.push(x.index);
            if (x !== L && x.solo) x.solo = false;
        }
        L.solo = true;
        $.global.__mmwDepthSolo = { compId: c.id, index: L.index, soloed: soloed };
        return 0;
    };

    // Renders o.times (comp seconds) to o.dir/f<from+i>.png. Read-only: nothing in the undo history.
    T.depthFrames = function (o) {
        var L = layerOf(o), c = L.containingComp, dir = new Folder(o.dir);
        if (!dir.exists) dir.create();
        var tc = o.tempId ? app.project.itemByID(o.tempId) : null;
        if (o.kind === "source" && !(tc && tc instanceof CompItem)) MMW.fail("Render comp missing - try again.");
        for (var i = 0; i < o.times.length; i++) {
            var f = new File(dir.fsName + "/f" + ("00000" + (o.from + i)).slice(-5) + ".png");
            if (f.exists) f.remove();
            if (tc) {
                var st = srcTime(L, o.times[i]);
                st = Math.max(0, Math.min(st, tc.duration - 1 / tc.frameRate));
                tc.saveFrameToPng(st, f);
            } else c.saveFrameToPng(o.times[i], f);
            if (!waitFile(f, 20000)) MMW.fail("After Effects did not write " + f.fsName);
        }
        return o.times.length;
    };

    // After rendering (also on cancel / error): remove the temp comp, restore solo switches.
    T.depthCleanup = function () {
        for (var i = app.project.numItems; i >= 1; i--) {
            var it = app.project.item(i);
            if (it instanceof CompItem && it.name === TEMP) it.remove();
        }
        var s = $.global.__mmwDepthSolo;
        if (s) {
            $.global.__mmwDepthSolo = null;
            var c = app.project.itemByID(s.compId);
            if (c && c instanceof CompItem) {
                var keep = {};
                for (var k = 0; k < s.soloed.length; k++) keep[s.soloed[k]] = true;
                for (var j = 1; j <= c.numLayers; j++) {
                    var want = !!keep[j];
                    if (c.layer(j).solo !== want) try { c.layer(j).solo = want; } catch (e) {}
                }
            }
        }
        return "ok";
    };

    function depthFolder() {
        var root = app.project.rootFolder;
        for (var i = 1; i <= root.numItems; i++) {
            var it = root.item(i);
            if (it instanceof FolderItem && it.name === "MenMen Depth") return it;
        }
        return app.project.items.addFolder("MenMen Depth");
    }

    // Imports o.dir/depth_00000.png (a still, or a PNG sequence with o.seq) right above the layer.
    T.depthImport = function (o) {
        var L = layerOf(o), c = L.containingComp;
        var file = new File(o.dir + "/depth_00000.png");
        if (!file.exists) MMW.fail("Depth map not found: " + file.fsName);
        var io = new ImportOptions(file);
        if (o.seq && o.count > 1) { io.sequence = true; io.forceAlphabetical = true; }
        var ft = app.project.importFile(io);
        ft.name = L.name + " Depth";
        ft.parentFolder = depthFolder();
        if (o.seq && o.count > 1) ft.mainSource.conformFrameRate = c.frameRate;
        var src = o.kind === "source" ? sourceOf(L) : null;
        if (src && src.pixelAspect && src.pixelAspect !== 1) ft.pixelAspect = src.pixelAspect;

        var name = MMW.uniqueLayerName(c, L.name + " Depth");
        var D = c.layers.add(ft);
        D.moveBefore(L);
        D.name = name;
        if (src) {  // sit exactly on the source: parented, at the layer's own top-left origin
            if (L.threeDLayer) D.threeDLayer = true;
            D.parent = L;
            var cx = ft.width / 2, cy = ft.height / 2, tr = D.transform;
            tr.anchorPoint.setValue(D.threeDLayer ? [cx, cy, 0] : [cx, cy]);
            tr.position.setValue(D.threeDLayer ? [cx, cy, 0] : [cx, cy]);
            tr.scale.setValue(D.threeDLayer ? [100, 100, 100] : [100, 100]);
            if (D.threeDLayer) { tr.orientation.setValue([0, 0, 0]); tr.xRotation.setValue(0); tr.yRotation.setValue(0); tr.zRotation.setValue(0); }
            else tr.rotation.setValue(0);
        }
        if (o.seq && o.count > 1) {
            D.startTime = o.start;
        } else {  // a still: as long as the layer
            D.startTime = Math.max(0, L.inPoint);
            D.outPoint = Math.min(c.duration, L.outPoint);
        }
        for (var i = 0; i < c.selectedLayers.length; i++) c.selectedLayers[i].selected = false;
        D.selected = true;
        return "Depth map added above " + L.name;
    };
})();

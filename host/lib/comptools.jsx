// comptools.jsx - auto trim, pre-compose, batch comp settings, background color, project & guides & view
(function () {
    var T = MMW.tools;

    function selectedComps() {
        var out = [], sel = app.project.selection;
        for (var i = 0; i < sel.length; i++) if (sel[i] instanceof CompItem) out.push(sel[i]);
        if (!out.length && app.project.activeItem instanceof CompItem) out.push(app.project.activeItem);
        if (!out.length) MMW.fail("Select comps in the Project panel or open a comp.");
        return out;
    }

    // ================= Composition =================
    // Click: fit the work area to the layers. Alt: also change the comp duration.
    T.autoTrimComp = function (o) {
        var comps = selectedComps(), n = 0;
        for (var i = 0; i < comps.length; i++) {
            var c = comps[i], a = 1e9, b = -1e9;
            for (var l = 1; l <= c.numLayers; l++) {
                var L = c.layer(l);
                if (!L.enabled && !(L.hasAudio && L.audioEnabled)) continue;
                a = Math.min(a, L.inPoint); b = Math.max(b, L.outPoint);
            }
            if (a > b) continue;
            a = Math.max(0, a); b = Math.min(c.duration, b);
            if (o.alt && b > a) c.duration = b;
            c.workAreaStart = a;
            c.workAreaDuration = Math.max(c.frameDuration, Math.min(b, c.duration) - a);
            n++;
        }
        return "Trimmed " + n + " comp(s).";
    };

    // Pre-composes the selected layers (Move all attributes). Alt: Leave attributes (single layer only).
    T.preCompose = function (o) {
        var c = MMW.comp(), s = MMW.sortByIndex(MMW.selLayers(c)), idx = [];
        for (var i = 0; i < s.length; i++) idx.push(s[i].index);
        var base = s.length === 1 ? s[0].name + " Comp" : "Precomp";
        var name = base, k = 1;
        var taken = {};
        for (var it = 1; it <= app.project.numItems; it++) taken[app.project.item(it).name] = true;
        while (taken[name]) { k++; name = base + " " + k; }
        var leave = o.alt && s.length === 1;
        c.layers.precompose(idx, name, !leave);
        return "Pre-composed " + s.length + " layer(s) → \"" + name + "\".";
    };

    // o.width, o.height, o.fps, o.duration (seconds) – empty = unchanged
    T.batchCompSettings = function (o) {
        var comps = selectedComps(), n = 0;
        function num(v) { var x = parseFloat(v); return isNaN(x) || x <= 0 ? null : x; }
        for (var i = 0; i < comps.length; i++) {
            var c = comps[i];
            if (num(o.width)) c.width = Math.round(num(o.width));
            if (num(o.height)) c.height = Math.round(num(o.height));
            if (num(o.fps)) c.frameRate = num(o.fps);
            if (num(o.duration)) c.duration = num(o.duration);
            n++;
        }
        return "Updated " + n + " comp(s).";
    };

    // o.color = [r,g,b] (0..1)
    T.setBgColor = function (o) {
        var comps = selectedComps(), col = o.color || [0, 0, 0];
        for (var i = 0; i < comps.length; i++) comps[i].bgColor = [col[0], col[1], col[2]];
        return "Changed the background of " + comps.length + " comp(s).";
    };

    // Saves the current frame as PNG (next to the project file, or on the Desktop).
    T.saveScreenshot = function () {
        var c = MMW.comp();
        var base = app.project.file ? app.project.file.parent : Folder.desktop;
        var f = new Folder(base.fsName + "/MenMen Screenshots");
        if (!f.exists) f.create();
        var frame = Math.round(c.time / c.frameDuration);
        var file = new File(f.fsName + "/" + c.name.replace(/[\\\/:*?"<>|]/g, "_") + "_f" + frame + ".png");
        c.saveFrameToPng(c.time, file);
        return "Saved " + file.fsName;
    };

    // ================= Project =================
    T.projectCleanup = function (o) {
        var before = app.project.numItems;
        app.project.removeUnusedFootage();
        if (!o.alt) app.project.consolidateFootage();
        return "Project cleaned: " + (before - app.project.numItems) + " item(s) removed.";
    };

    function rootFolder(name) {
        var root = app.project.rootFolder;
        for (var i = 1; i <= root.numItems; i++) {
            var it = root.item(i);
            if (it instanceof FolderItem && it.name === name) return it;
        }
        return app.project.items.addFolder(name);
    }
    // Moves root-level items into folders by type.
    T.organizeProject = function () {
        var root = app.project.rootFolder, items = [], n = 0, i;
        for (i = 1; i <= root.numItems; i++) items.push(root.item(i));
        for (i = 0; i < items.length; i++) {
            var it = items[i], folder = null;
            if (it instanceof FolderItem) continue;
            if (it instanceof CompItem) folder = "Comps";
            else if (it instanceof FootageItem) {
                var src = it.mainSource;
                if (src instanceof SolidSource) folder = "Solids";
                else if (it.hasAudio && !it.hasVideo) folder = "Audio";
                else if (src.isStill) folder = "Images";
                else folder = "Footage";
            }
            if (folder) { it.parentFolder = rootFolder(folder); n++; }
        }
        return "Organized " + n + " item(s).";
    };
    // o.folders: comma-separated names. Use "/" for subfolders.
    T.createFolderStructure = function (o) {
        var names = String(o.folders || "").split(","), n = 0;
        for (var i = 0; i < names.length; i++) {
            var path = names[i].replace(/^\s+|\s+$/g, "");
            if (!path) continue;
            var parts = path.split("/"), parent = app.project.rootFolder;
            for (var p = 0; p < parts.length; p++) {
                var nm = parts[p].replace(/^\s+|\s+$/g, ""), found = null;
                for (var k = 1; k <= parent.numItems; k++) if (parent.item(k) instanceof FolderItem && parent.item(k).name === nm) found = parent.item(k);
                if (!found) { found = app.project.items.addFolder(nm); found.parentFolder = parent; n++; }
                parent = found;
            }
        }
        return "Created " + n + " folder(s).";
    };
    T.revealProjectFolder = function () {
        if (!app.project.file) MMW.fail("The project has not been saved yet.");
        app.project.file.parent.execute();
        return app.project.file.parent.fsName;
    };
    T.revealLayerSource = function () {
        var c = MMW.comp(), s = MMW.selLayers(c);
        var src = s[0].source;
        if (!(src instanceof FootageItem) || !src.file) MMW.fail("The layer has no source file.");
        src.file.parent.execute();
        return src.file.fsName;
    };

    // ================= Guides =================
    function bboxOf(c, layers) {
        var h = MMW.helper(c), b = { l: 1e9, t: 1e9, r: -1e9, b: -1e9 };
        for (var i = 0; i < layers.length; i++) {
            var body = "var L=thisComp.layer(" + layers[i].index + ");var r=L.sourceRectAtTime(time,false);" +
                "var c=[L.toComp([r.left,r.top]),L.toComp([r.left+r.width,r.top]),L.toComp([r.left,r.top+r.height]),L.toComp([r.left+r.width,r.top+r.height])];" +
                "var mn=[1e9,1e9],mx=[-1e9,-1e9];for(var j=0;j<4;j++){mn[0]=Math.min(mn[0],c[j][0]);mn[1]=Math.min(mn[1],c[j][1]);mx[0]=Math.max(mx[0],c[j][0]);mx[1]=Math.max(mx[1],c[j][1]);}";
            var mn = h.evalAt(body + "[mn[0],mn[1],0]", c.time, 1), mx = h.evalAt(body + "[mx[0],mx[1],0]", c.time, 2);
            b.l = Math.min(b.l, mn[0]); b.t = Math.min(b.t, mn[1]); b.r = Math.max(b.r, mx[0]); b.b = Math.max(b.b, mx[1]);
        }
        h.remove();
        return b;
    }
    function targetBox(c) {
        var s = c.selectedLayers, list = [];
        for (var i = 0; i < s.length; i++) if (!(s[i] instanceof CameraLayer || s[i] instanceof LightLayer)) list.push(s[i]);
        return list.length ? bboxOf(c, list) : { l: 0, t: 0, r: c.width, b: c.height };
    }
    // o.where: "around" | "left" | "right" | "top" | "bottom" | "center" | "middle" | "both"
    // Uses the selected layers' bounds, or the whole comp when nothing is selected.
    T.addGuides = function (o) {
        var c = MMW.comp(), b = targetBox(c), w = o.where || "around", n = 0;
        function V(x) { c.addGuide(1, x); n++; }
        function H(y) { c.addGuide(0, y); n++; }
        if (w === "around" || w === "left") V(b.l);
        if (w === "around" || w === "right") V(b.r);
        if (w === "around" || w === "top") H(b.t);
        if (w === "around" || w === "bottom") H(b.b);
        if (w === "center" || w === "both") V((b.l + b.r) / 2);
        if (w === "middle" || w === "both") H((b.t + b.b) / 2);
        return "Added " + n + " guide(s).";
    };
    // Guides at the anchor point of the selected layers.
    T.addGuidesAnchor = function () {
        var c = MMW.comp(), s = MMW.selLayers(c), h = MMW.helper(c), n = 0;
        for (var i = 0; i < s.length; i++) {
            var p = h.evalAt("var L=thisComp.layer(" + s[i].index + ");var p=L.toComp(L.anchorPoint);[p[0],p[1],0]", c.time, 1);
            c.addGuide(1, p[0]); c.addGuide(0, p[1]); n += 2;
        }
        h.remove();
        return "Added " + n + " guide(s).";
    };
    // o.cols, o.rows, o.margin, o.gutter (px)
    T.guideGrid = function (o) {
        var c = MMW.comp(), cols = Math.max(1, parseInt(o.cols, 10) || 12), rows = Math.max(0, parseInt(o.rows, 10) || 0);
        var m = Math.max(0, Number(o.margin) || 0), g = Math.max(0, Number(o.gutter) || 0), n = 0, i;
        var W = c.width - 2 * m, H = c.height - 2 * m;
        c.addGuide(1, m); c.addGuide(1, c.width - m); c.addGuide(0, m); c.addGuide(0, c.height - m); n += 4;
        var cw = (W - g * (cols - 1)) / cols;
        for (i = 1; i < cols; i++) {
            var x = m + i * cw + (i - 1) * g;
            c.addGuide(1, x); n++;
            if (g > 0) { c.addGuide(1, x + g); n++; }
        }
        if (rows > 1) {
            var rh = (H - g * (rows - 1)) / rows;
            for (i = 1; i < rows; i++) {
                var y = m + i * rh + (i - 1) * g;
                c.addGuide(0, y); n++;
                if (g > 0) { c.addGuide(0, y + g); n++; }
            }
        }
        return "Created a " + cols + "-column" + (rows > 1 ? " × " + rows + "-row" : "") + " grid (" + n + " guides).";
    };
    T.clearGuides = function () {
        var c = MMW.comp(), n = c.guides.length;
        for (var i = n - 1; i >= 0; i--) c.removeGuide(i);
        return "Removed " + n + " guide(s).";
    };
    T.copyGuides = function () {
        var c = MMW.comp(), g = [];
        for (var i = 0; i < c.guides.length; i++) g.push({ o: c.guides[i].orientationType, p: c.guides[i].position });
        $.global.__mmwGuides = { list: g, w: c.width, h: c.height };
        return "Copied " + g.length + " guide(s).";
    };
    // Pastes guides. Alt: scale to the target comp size.
    T.pasteGuides = function (o) {
        var clip = $.global.__mmwGuides;
        if (!clip || !clip.list.length) MMW.fail("No guides copied yet.");
        var c = MMW.comp();
        for (var i = 0; i < clip.list.length; i++) {
            var g = clip.list[i], p = g.p;
            if (o.alt) p = p * (g.o === 1 ? c.width / clip.w : c.height / clip.h);
            c.addGuide(g.o, p);
        }
        return "Pasted " + clip.list.length + " guide(s).";
    };

    // Runs an AE menu command by name (tries several names since labels change with state).
    MMW.menuCommand = function (names) {
        for (var i = 0; i < names.length; i++) {
            var id = app.findMenuCommandId(names[i]);
            if (id) { app.executeCommand(id); return names[i]; }
        }
        MMW.fail("Menu command not found: " + names.join(" / ") + " (non-English AE?)");
    };
    T.toggleGuides = function () { return MMW.menuCommand(["Show Guides", "Hide Guides"]); };
    T.lockGuides = function () { return MMW.menuCommand(["Lock Guides", "Unlock Guides"]); };
    T.snapGuides = function () { return MMW.menuCommand(["Snap to Guides"]); };

    // ================= View =================
    // o.zoom: 1 = 100%, 0.5 = 50%...
    T.viewZoom = function (o) {
        var v = app.activeViewer;
        if (!v) MMW.fail("No viewer is open.");
        v.setActive();
        try { v.views[0].options.zoom = Number(o.zoom) || 1; } catch (e) { MMW.fail("This AE version does not support setting zoom from scripts."); }
        return "Zoom " + Math.round((Number(o.zoom) || 1) * 100) + "%";
    };
    T.toggleRulers = function () { return MMW.menuCommand(["Show Rulers", "Hide Rulers"]); };
    T.toggleGrid = function () { return MMW.menuCommand(["Show Grid", "Hide Grid"]); };

    // ================= Command (cho user item) =================
    // o.command: menu command name or numeric command ID
    T.runCommand = function (o) {
        var id = parseInt(o.command, 10);
        if (isNaN(id)) id = app.findMenuCommandId(String(o.command));
        if (!id) MMW.fail("Command not found: " + o.command);
        app.executeCommand(id);
        return "Ran command " + o.command;
    };
    // o.effect: effect matchName or display name
    T.applyEffect = function (o) {
        var c = MMW.comp(), s = MMW.selLayers(c), n = 0;
        for (var i = 0; i < s.length; i++) {
            var fx = s[i].property("ADBE Effect Parade");
            if (!fx || !fx.canAddProperty(o.effect)) continue;
            fx.addProperty(o.effect); n++;
        }
        if (!n) MMW.fail("Could not apply effect \"" + o.effect + "\" (wrong name/matchName?).");
        return "Applied " + o.effect + " to " + n + " layer(s).";
    };
    // o.code: a short ExtendScript snippet
    T.runScriptlet = function (o) {
        var r = eval(String(o.code || ""));
        return r === undefined ? "Scriptlet done." : String(r);
    };
})();

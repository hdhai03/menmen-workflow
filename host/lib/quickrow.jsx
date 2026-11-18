// quickrow.jsx - Disk cache usage + Purge, Add Layer row (Solid / Adjustment / Camera / Null / Light / Text / Shape)
(function () {
    var T = MMW.tools;
    var isWin = String($.os || "").indexOf("Windows") >= 0;

    // ---------- disk cache ----------
    // The cache folder / max size live in the machine-specific prefs ("Disk Cache Controls").
    // Key names carry a version suffix ("Folder 7", "Max Size 3"), so try a few.
    function pref(keys, asLong) {
        var types = [];
        try { types.push(PREFType.PREF_Type_MACHINE_SPECIFIC); } catch (e) { /* old AE */ }
        types.push(null);
        for (var t = 0; t < types.length; t++) {
            for (var i = 0; i < keys.length; i++) {
                try {
                    var v;
                    if (types[t] === null) v = asLong ? app.preferences.getPrefAsLong("Disk Cache Controls", keys[i]) : app.preferences.getPrefAsString("Disk Cache Controls", keys[i]);
                    else v = asLong ? app.preferences.getPrefAsLong("Disk Cache Controls", keys[i], types[t]) : app.preferences.getPrefAsString("Disk Cache Controls", keys[i], types[t]);
                    if (v !== undefined && v !== null && String(v) !== "") return v;
                } catch (e2) { /* key not found */ }
            }
        }
        return null;
    }
    function cacheFolder(o) {
        if (o && o.folder) return new Folder(o.folder);
        var p = pref(["Folder 7", "Folder 8", "Folder 9", "Folder 6", "Folder 5", "Folder"], false);
        if (p) {
            var f = new Folder(String(p));
            if (f.exists) return f;
        }
        // default locations
        var v = app.version.split("."), cands = isWin
            ? [Folder.temp.fsName + "\\Adobe\\After Effects Disk Cache - " + $.getenv("COMPUTERNAME"), Folder.temp.fsName + "\\Adobe\\After Effects Disk Cache"]
            : [Folder("~").fsName + "/Library/Caches/Adobe/After Effects/" + v[0] + "." + v[1], Folder("~").fsName + "/Library/Caches/Adobe/After Effects/" + v[0] + ".0"];
        for (var i = 0; i < cands.length; i++) { var c = new Folder(cands[i]); if (c.exists) return c; }
        return null;
    }
    function maxBytes(o) {
        if (o && o.maxGB) return o.maxGB * 1073741824;
        var v = pref(["Max Size 3", "Max Size 2", "Max Size 4", "Max Size"], true);
        v = Number(v);
        if (!v || isNaN(v)) return 0;
        // stored in GB (newer AE) or MB (older): values above 4096 are MB
        return v > 4096 ? v * 1048576 : v * 1073741824;
    }
    // Folder size: du / PowerShell when available (fast), else walk the folder (capped).
    function folderBytes(f) {
        var r;
        try {
            if (isWin) {
                r = system.callSystem('powershell -NoProfile -Command "(Get-ChildItem -LiteralPath \'' + f.fsName.replace(/'/g, "''") +
                    '\' -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum"');
                r = Number(String(r).replace(/[^\d]/g, ""));
                if (!isNaN(r) && String(r) !== "") return r;
            } else {
                r = system.callSystem('du -sk "' + f.fsName.replace(/"/g, '\\"') + '"');
                var m = /^\s*(\d+)/.exec(String(r));
                if (m) return Number(m[1]) * 1024;
            }
        } catch (e) { /* fall through */ }
        var total = 0, count = 0, stack = [f];
        while (stack.length && count < 200000) {
            var items = stack.pop().getFiles();
            for (var i = 0; i < items.length; i++) {
                count++;
                if (items[i] instanceof Folder) stack.push(items[i]); else total += items[i].length;
            }
        }
        return total;
    }
    // -> "used|max|path"  (bytes; max 0 = unknown)
    T.diskCacheInfo = function (o) {
        var f = cacheFolder(o);
        if (!f) return "0|" + maxBytes(o) + "|";
        return folderBytes(f) + "|" + maxBytes(o) + "|" + f.fsName;
    };
    function menuId(names) {
        for (var i = 0; i < names.length; i++) {
            var id = 0;
            try { id = app.findMenuCommandId(names[i]); } catch (e) { id = 0; }
            if (id) return id;
        }
        return 0;
    }
    // Click: purge all memory caches. Alt: also empty the disk cache (AE asks to confirm).
    T.purgeCache = function (o) {
        if (o.alt) {
            var id = menuId(["All Memory & Disk Cache...", "Empty Disk Cache...", "Clean Database & Cache..."]);
            if (!id) MMW.fail("Disk cache command not found: use Edit > Purge > All Memory & Disk Cache");
            app.executeCommand(id);
            return "Disk cache";
        }
        app.purge(PurgeTarget.ALL_CACHES);
        return "Memory purged";
    };

    // ---------- add layer ----------
    // New layer goes above the top selected layer; Alt on camera = with a 3D null rig.
    function place(c, L) {
        var sel = c.selectedLayers, top = null;
        for (var i = 0; i < sel.length; i++) if (!top || sel[i].index < top.index) top = sel[i];
        if (top && top !== L) { try { L.moveBefore(top); } catch (e) { /* locked */ } }
        for (var j = 0; j < sel.length; j++) sel[j].selected = false;
        L.selected = true;
        return L;
    }
    var lastColor = [0.5, 0.5, 0.5];
    T.addLayer = function (o) {
        var c = MMW.comp();
        if (!c) MMW.fail("Open a composition first");
        var L, k = o.kind || "solid", cx = c.width / 2, cy = c.height / 2;
        switch (k) {
            case "solid":
                var col = o.color || lastColor;
                if (o.alt) {  // Alt: pick the color
                    var picked = $.colorPicker(-1);
                    if (picked < 0) return "Cancelled";
                    col = [(picked >> 16 & 255) / 255, (picked >> 8 & 255) / 255, (picked & 255) / 255];
                    lastColor = col;
                }
                L = c.layers.addSolid(col, MMW.uniqueLayerName(c, "Solid"), c.width, c.height, c.pixelAspect, c.duration);
                break;
            case "adjustment":
                L = c.layers.addSolid([1, 1, 1], MMW.uniqueLayerName(c, "Adjustment Layer"), c.width, c.height, c.pixelAspect, c.duration);
                L.adjustmentLayer = true;
                L.label = 5;
                break;
            case "null":
                L = MMW.newNull(c, MMW.uniqueLayerName(c, "Null"));
                break;
            case "camera":
                L = c.layers.addCamera(MMW.uniqueLayerName(c, "Camera"), [cx, cy]);
                if (o.alt) {
                    var n = MMW.newNull(c, MMW.uniqueLayerName(c, "Camera Control"));
                    n.threeDLayer = true;
                    n.transform.position.setValue([cx, cy, 0]);
                    L.parent = n;
                    place(c, n);
                    L.moveBefore(n);
                    L.selected = false; n.selected = true;
                    return "Camera + control null (rotate / move the null)";
                }
                break;
            case "light":
                L = c.layers.addLight(MMW.uniqueLayerName(c, "Light"), [cx, cy]);
                try { L.lightType = LightType.POINT; } catch (e) { /* default */ }
                break;
            case "text":
                L = c.layers.addText(o.text || "Text");
                L.name = MMW.uniqueLayerName(c, "Text");
                break;
            case "shape":
                L = c.layers.addShape();
                L.name = MMW.uniqueLayerName(c, "Shape Layer");
                if (!o.alt) {
                    var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
                    g.name = "Rectangle 1";
                    var v = g.property("ADBE Vectors Group");
                    v.addProperty("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue([Math.round(c.width / 4), Math.round(c.width / 4)]);
                    v.addProperty("ADBE Vector Graphic - Fill");
                }
                L.transform.anchorPoint.setValue([0, 0]);
                L.transform.position.setValue([cx, cy]);
                break;
            default:
                MMW.fail("Unknown layer type: " + k);
        }
        place(c, L);
        return L.name;
    };

    // ---------- split text ----------
    // Splits the selected (point) text layers into one layer per line / word / character.
    // Each piece is a duplicate of the original holding only its text (left-justified); it is put
    // in place by shifting its anchor point, so scale / rotation / parenting / 3D all stay exact.
    // The anchor is then centered on the piece (Alt: keep it on the text baseline). The original is hidden.
    function pieces(text, by) {
        var lines = String(text).split(/\r\n|\r|\n|\u0003/), out = [];
        for (var li = 0; li < lines.length; li++) {
            var line = lines[li];
            if (by === "line") { if (/\S/.test(line)) out.push({ line: li, start: line.search(/\S/), text: line.replace(/^\s+|\s+$/g, "") }); continue; }
            var re = by === "word" ? /\S+/g : /\S/g, m;
            while ((m = re.exec(line)) !== null) out.push({ line: li, start: m.index, text: m[0] });
        }
        return { lines: lines, list: out };
    }
    function textDoc(L) { return L.property("ADBE Text Properties").property("ADBE Text Document"); }
    function setText(L, s, just) {
        var p = textDoc(L);
        while (p.numKeys) p.removeKey(1);
        if (p.expression) p.expression = "";
        var td = p.value;
        td.text = s;
        if (just) td.justification = just;
        p.setValue(td);
    }
    T.splitText = function (o) {
        var c = MMW.comp(), sel = c.selectedLayers, texts = [], made = [], by = o.by || "word";
        for (var i = 0; i < sel.length; i++) if (sel[i] instanceof TextLayer) texts.push(sel[i]);
        if (!texts.length) MMW.fail("Select a text layer");
        for (var t = 0; t < texts.length; t++) {
            var src = texts[t], td = textDoc(src).valueAtTime(c.time, false);
            if (td.boxText) MMW.fail(src.name + ": paragraph (box) text - right-click > Convert to Point Text first");
            var P = pieces(td.text, by);
            if (P.list.length < 2 && by !== "line") MMW.fail(src.name + ": nothing to split");
            if (!P.list.length) MMW.fail(src.name + ": the layer is empty");
            var lk = src.locked; src.locked = false;

            // line starts (left edge of each baseline, layer space): baselineLocs when available, else leading
            var fs = td.fontSize, lead = fs * 1.2;
            try { if (!td.autoLeading && td.leading) lead = td.leading; } catch (e0) { /* old AE */ }
            var locs = null;
            try { locs = td.baselineLocs; } catch (e1) { locs = null; }
            // advance (width incl. spaces) of a string, measured on a left-justified temp copy
            var tmp = src.duplicate(), cache = {};
            tmp.enabled = false;
            var adv = function (s) {
                if (cache[s] !== undefined) return cache[s];
                setText(tmp, s + "|", ParagraphJustification.LEFT_JUSTIFY);
                var r1 = tmp.sourceRectAtTime(c.time, false);
                setText(tmp, "|", ParagraphJustification.LEFT_JUSTIFY);
                var r0 = tmp.sourceRectAtTime(c.time, false);
                return (cache[s] = (r1.left + r1.width) - (r0.left + r0.width));
            };
            var lineStart = function (li) {
                if (locs && locs.length >= (li + 1) * 4) return [locs[li * 4], locs[li * 4 + 1]];
                var w = adv(P.lines[li]), j = td.justification, x = 0;
                if (j === ParagraphJustification.CENTER_JUSTIFY) x = -w / 2;
                else if (j === ParagraphJustification.RIGHT_JUSTIFY) x = -w;
                return [x, li * lead];
            };
            // baselineLocs counts only non-empty lines in some versions: fall back when the count is off
            if (locs && locs.length / 4 !== P.lines.length) locs = null;

            var above = src;
            for (var k = 0; k < P.list.length; k++) {
                var pc = P.list[k], ls = lineStart(pc.line);
                var ox = ls[0] + (pc.start ? adv(P.lines[pc.line].substring(0, pc.start)) : 0), oy = ls[1];
                var L = src.duplicate();
                setText(L, pc.text, ParagraphJustification.LEFT_JUSTIFY);
                L.name = MMW.uniqueLayerName(c, pc.text.length > 24 ? pc.text.substring(0, 24) : pc.text);
                L.enabled = true;
                L.moveBefore(above);
                MMW.offsetProp(L.transform.anchorPoint, [-ox, -oy, 0]);
                made.push(L);
            }
            tmp.remove();
            src.enabled = false;  // hide the original
            src.locked = lk;
        }
        for (var s = 1; s <= c.numLayers; s++) c.layer(s).selected = false;
        for (var m = 0; m < made.length; m++) made[m].selected = true;
        if (!o.alt) { try { T.moveAnchor({ x: 0.5, y: 0.5 }); } catch (e2) { /* keep baseline anchors */ } }
        return made.length + " layer(s) by " + by;
    };
})();

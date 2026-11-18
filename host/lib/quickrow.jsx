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
})();

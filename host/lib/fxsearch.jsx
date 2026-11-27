// fxsearch.jsx - FX Search: the list of installed effects and applying one (to the selected layers or
// to a new adjustment layer). The search box itself lives in the panel (client/js/fxsearch.js).
(function () {
    var T = MMW.tools;

    function q(s) { return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]/g, " ") + '"'; }

    // [{n: display name, m: match name, c: category}] of every effect After Effects knows (JSON)
    T.listEffects = function () {
        var fx = app.effects, out = [];
        for (var i = 0; i < fx.length; i++) {
            var e = fx[i];
            if (!e.displayName || !e.category) continue;  // hidden / obsolete entries have no category
            out.push("{" + '"n":' + q(e.displayName) + ',"m":' + q(e.matchName) + ',"c":' + q(e.category) + "}");
        }
        return "[" + out.join(",") + "]";
    };

    // Copies hotkey/MenMen FX Search.jsx into After Effects' Scripts folder (needed for a global shortcut).
    // Returns JSON {ok, path, src}: ok false when the folder is not writable (the panel then asks for admin rights).
    T.installFxHotkey = function () {
        var src = new File(MMW.root + "/hotkey/MenMen FX Search.jsx");
        if (!src.exists) MMW.fail("Script not found: " + src.fsName);
        var app0 = Folder.appPackage, dirs = [new Folder(app0.fsName + "/Scripts"), new Folder(app0.parent.fsName + "/Scripts")], dir = null;
        for (var i = 0; i < dirs.length; i++) if (dirs[i].exists) { dir = dirs[i]; break; }
        if (!dir) MMW.fail("After Effects' Scripts folder was not found next to " + app0.fsName);
        var dest = new File(dir.fsName + "/MenMen FX Search.jsx"), ok = false;
        try { ok = src.copy(dest.fsName); } catch (e) { ok = false; }
        return "{" + '"ok":' + (ok ? "true" : "false") + ',"path":' + q(dest.fsName) + ',"src":' + q(src.fsName) + "}";
    };

    // ----- global shortcut in After Effects' own shortcut file -----
    // AE binds keys to the first 20 scripts of File > Scripts through "ExecuteScriptMenuItem01".."20" in its
    // shortcut text file (read when AE starts). The script's number is its place in that alphabetical menu.
    var HOTKEY = "MenMen FX Search.jsx";
    function scriptsFolder() {
        var a = Folder.appPackage, dirs = [new Folder(a.fsName + "/Scripts"), new Folder(a.parent.fsName + "/Scripts")];
        for (var i = 0; i < dirs.length; i++) if (dirs[i].exists) return dirs[i];
        return null;
    }
    function scriptNumber() {
        var dir = scriptsFolder();
        if (!dir) return 0;
        var f = dir.getFiles(function (x) { return x instanceof File && /\.(jsx|jsxbin|js)$/i.test(x.name); }), names = [];
        for (var i = 0; i < f.length; i++) names.push(decodeURI(f[i].name));
        names.sort(function (a, b) { a = a.toLowerCase(); b = b.toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; });
        for (var k = 0; k < names.length; k++) if (names[k] === HOTKEY) return k + 1;
        return 0;
    }
    function shortcutFiles() {
        var m = /^(\d+\.\d+)/.exec(app.version), v = m ? m[1] : "";
        var bases = [Folder.userData.fsName + "/Adobe/After Effects/" + v, Folder("~/Library/Preferences/Adobe/After Effects/" + v).fsName], out = [];
        function scan(dir, depth) {
            if (!dir.exists) return;
            var list = dir.getFiles();
            for (var i = 0; i < list.length; i++) {
                var x = list[i];
                if (x instanceof Folder) { if (depth > 0) scan(x, depth - 1); continue; }
                var nm = decodeURI(x.name);
                if (!/shortcut|\.txt$/i.test(nm) || /menmen-backup$/i.test(nm) || x.length > 3000000) continue;
                if (!x.open("r")) continue;
                var txt = x.read(); x.close();
                if (txt.indexOf("ExecuteScriptMenuItem01") >= 0) out.push(x);
            }
        }
        for (var b = 0; b < bases.length; b++) scan(new Folder(bases[b]), 1);
        return out;
    }
    function rxEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
    // o.combo: "Ctrl+Space", "Shift+Tab", "Ctrl+Alt+F"... Returns JSON {ok, number, files, msg}
    T.fxShortcutApply = function (o) {
        var num = scriptNumber();
        if (!num) return '{"ok":false,"msg":"MenMen FX Search is not in After Effects\' Scripts folder yet."}';
        if (num > 20) return '{"ok":false,"msg":"MenMen FX Search is script #' + num + ' in File > Scripts; After Effects only binds keys to the first 20."}';
        var files = shortcutFiles();
        if (!files.length) return '{"ok":false,"msg":"After Effects\' shortcut file was not found. Open Edit > Keyboard Shortcuts once, close it, then try again."}';
        var key = "ExecuteScriptMenuItem" + (num < 10 ? "0" : "") + num, done = [];
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            f.open("r"); var enc = f.encoding, txt = f.read(); f.close();
            var combo = String(o.combo || "");
            if (/Opt\+/.test(txt)) combo = combo.replace(/Alt\+/g, "Opt+");  // macOS files call Alt "Opt"
            var bak = new File(f.fsName + ".menmen-backup");
            if (!bak.exists) f.copy(bak.fsName);
            // the combo is taken away from any other command, then given to the script
            if (combo) txt = txt.split("(" + combo + ")").join("").replace(/(=\s*)""/g, '$1"()"');
            var rx = new RegExp('("' + key + '"\\s*=\\s*)"[^"\\r\\n]*"');
            if (!rx.test(txt)) continue;
            txt = txt.replace(rx, '$1"' + (combo ? "(" + combo + ")" : "") + '"');
            f.encoding = enc;
            if (!f.open("w")) continue;
            f.write(txt); f.close();
            done.push(f.fsName);
        }
        if (!done.length) return '{"ok":false,"msg":"The shortcut file could not be written (no ' + key + ' entry or no permission)."}';
        return '{"ok":true,"number":' + num + ',"msg":"' + done.length + ' shortcut file(s) updated"}';
    };
    // is the combo still in the shortcut file? (After Effects may rewrite the file when it quits)
    T.fxShortcutCheck = function (o) {
        var num = scriptNumber(), files = shortcutFiles(), want = "(" + o.combo + ")";
        if (!num || !files.length || num > 20) return "0";
        var key = "ExecuteScriptMenuItem" + (num < 10 ? "0" : "") + num;
        for (var i = 0; i < files.length; i++) {
            files[i].open("r"); var txt = files[i].read(); files[i].close();
            var m = new RegExp('"' + key + '"\\s*=\\s*"([^"\\r\\n]*)"').exec(txt);
            if (m && (m[1].indexOf(want) >= 0 || m[1].indexOf(want.replace(/Alt\+/g, "Opt+")) >= 0)) return "1";
        }
        return "0";
    };

    function canTakeEffects(L) {
        return L instanceof AVLayer && L.property("ADBE Effect Parade") !== null;  // AV, text, shape layers
    }

    // o.match: effect match name; o.name: display name (messages)
    // o.adjust (or nothing selected): on a new adjustment layer above the top selected layer
    T.applyEffect = function (o) {
        var c = MMW.comp(), sel = c.selectedLayers, targets = [], i, adj = null;
        for (i = 0; i < sel.length; i++) if (canTakeEffects(sel[i])) targets.push(sel[i]);
        if (o.adjust || !targets.length) {
            var top = null;
            for (i = 0; i < sel.length; i++) if (!top || sel[i].index < top.index) top = sel[i];
            adj = c.layers.addSolid([1, 1, 1], MMW.uniqueLayerName(c, o.name || "Adjustment Layer"), c.width, c.height, c.pixelAspect, c.duration);
            adj.adjustmentLayer = true;
            adj.label = 5;
            if (top) { adj.moveBefore(top); adj.inPoint = top.inPoint; adj.outPoint = top.outPoint; }
            targets = [adj];
        }
        var n = 0, added = [];
        for (i = 0; i < targets.length; i++) {
            var P = targets[i].property("ADBE Effect Parade");
            if (!P.canAddProperty(o.match)) continue;
            var e = P.addProperty(o.match);
            added.push(e);
            n++;
        }
        if (!n) MMW.fail((o.name || o.match) + " cannot be applied to the selected layer(s).");
        // select the new effect(s) so Effect Controls shows them, keep the layers selected
        for (i = 0; i < c.selectedLayers.length; i++) c.selectedLayers[i].selected = false;
        for (i = 0; i < targets.length; i++) targets[i].selected = true;
        for (i = 0; i < added.length; i++) { try { added[i].selected = true; } catch (e2) {} }
        return (o.name || o.match) + " applied to " + (adj ? "a new adjustment layer" : n + " layer(s)") + ".";
    };
})();

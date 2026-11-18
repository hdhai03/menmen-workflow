// custom.jsx - runs user scripts/presets and applies custom expressions
(function () {
    var T = MMW.tools;

    // o.path: path to a .jsx / .jsxbin / .ffx
    T.runFile = function (o) {
        var f = new File(o.path);
        if (!f.exists) MMW.fail("File not found: " + o.path);
        if (/\.ffx$/i.test(f.name)) {
            var c = MMW.comp(), layers = MMW.selLayers(c);
            for (var i = 0; i < layers.length; i++) layers[i].applyPreset(f);
            return "Applied preset " + decodeURI(f.name) + " to " + layers.length + " layer(s).";
        }
        $.evalFile(f);
        return "Ran " + decodeURI(f.name);
    };

    // o.code: expression source. Alt: remove the expression from the selected properties.
    T.applyExpression = function (o) {
        var c = MMW.comp(), props = MMW.selProps(c), n = 0;
        if (!props.length) MMW.fail("Select properties to apply the expression to.");
        for (var i = 0; i < props.length; i++) {
            var p = props[i].prop;
            if (!p.canSetExpression) continue;
            p.expression = o.alt ? "" : String(o.code || "");
            n++;
        }
        return (o.alt ? "Removed the expression from " : "Applied the expression to ") + n + " propert(ies).";
    };

    // ---------- Script library ----------
    // Folders scanned for .jsx / .jsxbin / .ffx files: <extension>/library and ~/Documents/MenMen Workflow/Scripts
    MMW.libraryFolders = function (root) {
        return [new Folder(root + "/library"), new Folder(Folder.myDocuments.fsName + "/MenMen Workflow/Scripts")];
    };
    // o.root: extension path. Returns a JSON array [{name, path, src}].
    T.listLibrary = function (o) {
        var dirs = MMW.libraryFolders(o.root), out = [];
        if (!dirs[1].exists) dirs[1].create();
        for (var i = 0; i < dirs.length; i++) {
            if (!dirs[i].exists) continue;
            var files = dirs[i].getFiles();
            files.sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
            for (var j = 0; j < files.length; j++) {
                var f = files[j];
                if (!(f instanceof File) || !/\.(jsx|jsxbin|ffx)$/i.test(f.name)) continue;
                out.push("{\"name\":" + MMW.quote(decodeURI(f.name)) + ",\"path\":" + MMW.quote(f.fsName) +
                    ",\"src\":" + MMW.quote(i === 0 ? "bundled" : "user") + "}");
            }
        }
        return "[" + out.join(",") + "]";
    };
    // Opens the user scripts folder (Alt: the bundled library folder).
    T.openScriptsFolder = function (o) {
        var d = MMW.libraryFolders(o.root)[o.alt ? 0 : 1];
        if (!d.exists) d.create();
        d.execute();
        return d.fsName;
    };

    // Info for the About dialog.
    T.hostInfo = function () {
        return "After Effects " + app.version + " · MenMen host " + MMW.VERSION;
    };
})();

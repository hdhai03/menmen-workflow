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

    // Info for the About dialog.
    T.hostInfo = function () {
        return "After Effects " + app.version + " · MenMen host " + MMW.VERSION;
    };
})();

// MenMen Workflow - ExtendScript entry point (ES3).
// Panels call MMW.load(<extension path>) on startup to load the modules in host/lib.
//
// MMW lives on $.global (no `var`): this file is also evaluated with $.evalFile from inside a
// function, and a `var` there would create a local copy that the tools would register into.

if (typeof $.global.MMW === "undefined" || !$.global.MMW) $.global.MMW = {};
$.global.MMW.tools = $.global.MMW.tools || {};

$.global.MMW.load = function (root) {
    var M = $.global.MMW;
    var files = [
        "core.jsx",
        "composition.jsx",
        "animation.jsx",
        "shapes.jsx",
        "layers.jsx",
        "rig.jsx",
        "render.jsx",
        "custom.jsx",
        "selection.jsx",
        "keyframes.jsx",
        "layertools.jsx",
        "comptools.jsx",
        "expression.jsx",
        "text.jsx",
        "shapetools.jsx",
        "rigs.jsx",
        "motiontools.jsx",
        "quickrow.jsx",
        "export.jsx"
    ];
    var errs = [];
    for (var i = 0; i < files.length; i++) {
        var f = new File(root + "/host/lib/" + files[i]);
        if (!f.exists) { errs.push(files[i] + ": file not found (" + f.fsName + ")"); continue; }
        try { $.evalFile(f); } catch (e) { errs.push(files[i] + ": " + e.message + " (line " + e.line + ")"); }
    }
    var n = 0;
    for (var k in M.tools) n++;
    if (!n) errs.push("no tools registered");
    return errs.length ? "ERR|" + errs.join("; ") : "OK|" + M.VERSION + " (" + n + " tools)";
};

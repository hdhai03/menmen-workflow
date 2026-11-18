// MenMen Workflow - ExtendScript entry point (ES3).
// Panels call MMW.load(<extension path>) on startup to load the modules in host/lib.

var MMW = (typeof MMW !== "undefined") ? MMW : {};
MMW.tools = MMW.tools || {};

MMW.load = function (root) {
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
        "rigs.jsx"
    ];
    var errs = [];
    for (var i = 0; i < files.length; i++) {
        var f = new File(root + "/host/lib/" + files[i]);
        if (!f.exists) { errs.push(files[i] + ": file not found"); continue; }
        try { $.evalFile(f); } catch (e) { errs.push(files[i] + ": " + e.message + " (line " + e.line + ")"); }
    }
    return errs.length ? "ERR|" + errs.join("; ") : "OK|" + MMW.VERSION;
};

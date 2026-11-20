// MenMen Workflow - ExtendScript entry point (ES3).
// Panels call MMW.load(<extension path>) on startup to load the modules in host/lib.
//
// MMW lives on $.global (no `var`): this file is also evaluated with $.evalFile from inside a
// function, and a `var` there would create a local copy that the tools would register into.

if (typeof $.global.MMW === "undefined" || !$.global.MMW) $.global.MMW = {};
$.global.MMW.tools = $.global.MMW.tools || {};

// Every panel calls this when it opens. The modules are evaluated only when they changed on disk
// (signature = their modification times) or force is set - not again for each panel.
$.global.MMW.load = function (root, force) {
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
    var errs = [], sig = root, i, k, n = 0;
    for (i = 0; i < files.length; i++) {
        var sf = new File(root + "/host/lib/" + files[i]);
        sig += "|" + (sf.exists && sf.modified ? sf.modified.getTime() : 0);
    }
    for (k in M.tools) n++;
    if (!force && n && M.loadedSig === sig) return "OK|" + M.VERSION + " (" + n + " tools, cached)";
    for (i = 0; i < files.length; i++) {
        var f = new File(root + "/host/lib/" + files[i]);
        if (!f.exists) { errs.push(files[i] + ": file not found (" + f.fsName + ")"); continue; }
        try { $.evalFile(f); } catch (e) { errs.push(files[i] + ": " + e.message + " (line " + e.line + ")"); }
    }
    n = 0;
    for (k in M.tools) n++;
    if (!n) errs.push("no tools registered");
    M.loadedSig = errs.length ? null : sig;
    return errs.length ? "ERR|" + errs.join("; ") : "OK|" + M.VERSION + " (" + n + " tools)";
};

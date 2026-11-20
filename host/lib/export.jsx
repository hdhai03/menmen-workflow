// export.jsx - Export PNG (current frame) and the frame renderer behind Export GIF.
// GIF encoding itself happens in the panel (client/js/gif.js); AE only renders PNG frames.
(function () {
    var T = MMW.tools;

    function q(s) { return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]/g, " ") + '"'; }
    function safe(s) { return String(s).replace(/[\\\/:*?"<>|]/g, "_"); }
    function defaultDir() {
        var base = app.project.file ? app.project.file.parent : Folder.desktop;
        var f = new Folder(base.fsName + "/MenMen Export");
        if (!f.exists) f.create();
        return f;
    }
    // saveFrameToPng can return before the file is written (newer AE): wait until it exists and stops growing.
    function waitFile(file, ms) {
        var t = 0, last = -1;
        while (t < ms) {
            if (file.exists && file.length > 0) {
                if (file.length === last) return true;
                last = file.length;
            }
            $.sleep(15); t += 15;
        }
        return file.exists && file.length > 0;
    }
    function render(c, time, file) {
        if (file.exists) file.remove();
        c.saveFrameToPng(time, file);
        if (!waitFile(file, 20000)) MMW.fail("After Effects did not write " + file.fsName);
    }

    // Comp info for the export dialogs (hand-built JSON: ExtendScript has no JSON object)
    T.exportInfo = function () {
        var c = MMW.comp(), fr = c.frameRate, bg = c.bgColor;
        return "{" + [
            '"name":' + q(c.name), '"w":' + c.width, '"h":' + c.height, '"fps":' + fr,
            '"duration":' + c.duration, '"time":' + c.time, '"frame":' + Math.round(c.time * fr),
            '"workStart":' + c.workAreaStart, '"workDuration":' + c.workAreaDuration,
            '"bg":[' + bg[0] + "," + bg[1] + "," + bg[2] + "]",
            '"dir":' + q(defaultDir().fsName.replace(/\\/g, "/")),
            '"temp":' + q(Folder.temp.fsName.replace(/\\/g, "/"))
        ].join(",") + "}";
    };

    // Current frame -> PNG (comp resolution). o.path from the panel's save dialog, else MenMen Export folder.
    T.exportPng = function (o) {
        var c = MMW.comp();
        var file = o.path ? new File(o.path) : new File(defaultDir().fsName + "/" + safe(c.name) + "_f" + Math.round(c.time * c.frameRate) + ".png");
        if (!/\.png$/i.test(file.name)) file = new File(file.fsName + ".png");
        render(c, c.time, file);
        if (o.alt) file.parent.execute();  // Alt: reveal the folder
        return "PNG saved: " + file.fsName;
    };

    // Renders frames o.from..o.to (inclusive) of a sequence starting at o.start seconds, o.fps apart,
    // into o.dir as f00000.png... The panel calls this in small batches to show progress.
    T.gifFrames = function (o) {
        var c = MMW.comp(), dir = new Folder(o.dir);
        if (!dir.exists) dir.create();
        var n = 0;
        for (var i = o.from; i <= o.to; i++) {
            var t = o.start + i / o.fps;
            var name = "f" + ("00000" + i).slice(-5) + ".png";
            render(c, t, new File(dir.fsName + "/" + name));
            n++;
        }
        return n;
    };

    T.removeFolder = function (o) {
        var d = new Folder(o.dir);
        var ours = d.name.indexOf("MenMenGIF_") === 0 || d.name.indexOf("MenMenDepth_") === 0 || (d.parent && d.parent.name === "MenMen Depth");
        if (!d.exists || !ours) return "skip";  // only our temp / output folders
        var f = d.getFiles();
        for (var i = 0; i < f.length; i++) f[i].remove();
        d.remove();
        return "removed";
    };
    T.revealFile = function (o) {
        var f = new File(o.path);
        if (f.exists) f.parent.execute();
        return f.fsName;
    };
})();

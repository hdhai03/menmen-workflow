// render.jsx - Simple Proxy
(function () {
    var T = MMW.tools;

    function targetComps() {
        var out = [], sel = app.project.selection;
        for (var i = 0; i < sel.length; i++) if (sel[i] instanceof CompItem) out.push(sel[i]);
        if (!out.length) {
            var c = MMW.comp();
            var L = c.selectedLayers;
            for (var j = 0; j < L.length; j++) if (L[j].source instanceof CompItem) out.push(L[j].source);
            if (!out.length) out.push(c);
        }
        return out;
    }

    function proxyFolder() {
        var base = app.project.file ? app.project.file.parent : Folder.desktop;
        var f = new Folder(base.fsName + "/MenMen Proxies");
        if (!f.exists) f.create();
        return f;
    }

    // ---------------- Simple Proxy ----------------
    // Click: render a proxy (lossless with alpha) for the selected comps and assign it.
    // Alt: remove proxies. Shift: toggle proxy usage.
    T.simpleProxy = function (o) {
        var comps = targetComps(), i;
        if (o.alt) {
            for (i = 0; i < comps.length; i++) comps[i].setProxyToNone();
            return "Removed proxies from " + comps.length + " comp(s).";
        }
        if (o.shift) {
            var n = 0;
            for (i = 0; i < comps.length; i++) if (comps[i].proxySource) { comps[i].useProxy = !comps[i].useProxy; n++; }
            return n ? "Toggled proxy for " + n + " comp(s)." : "The comp has no proxy.";
        }
        var rq = app.project.renderQueue, prev = [];
        for (i = 1; i <= rq.numItems; i++) {
            var it = rq.item(i);
            prev.push(it.status === RQItemStatus.QUEUED);
            if (it.status === RQItemStatus.QUEUED) it.render = false;
        }
        var folder = proxyFolder(), mine = [];
        for (i = 0; i < comps.length; i++) {
            var item = rq.items.add(comps[i]);
            var om = item.outputModule(1);
            var templates = ["High Quality with Alpha", "Lossless with Alpha"];
            for (var t = 0; t < templates.length; t++) {
                try { om.applyTemplate(templates[t]); break; } catch (e) {}
            }
            var safe = comps[i].name.replace(/[\\\/:*?"<>|]/g, "_");
            om.file = new File(folder.fsName + "/" + safe + "_proxy.mov");
            mine.push({ item: item, comp: comps[i], file: om.file });
        }
        rq.render();
        var ok = 0;
        for (i = 0; i < mine.length; i++) {
            var f = new File(mine[i].file.fsName);
            if (f.exists) { mine[i].comp.setProxy(f); ok++; }
        }
        for (i = mine.length - 1; i >= 0; i--) { try { mine[i].item.remove(); } catch (e2) {} }
        for (i = 1; i <= rq.numItems && i <= prev.length; i++) { try { if (prev[i - 1]) rq.item(i).render = true; } catch (e3) {} }
        return "Created proxies for " + ok + "/" + comps.length + " comp(s) -> " + folder.fsName;
    };
})();

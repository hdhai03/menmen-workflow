// composition.jsx - Crop Comp, Comp Duplicator, UnPreComp
(function () {
    var T = MMW.tools;

    // ---------------- Crop Comp ----------------
    // Crops the selected precomps to their visible content (intersected with the comp frame).
    T.cropComp = function (o) {
        var c = MMW.comp();
        var layers = MMW.selLayers(c);
        var done = 0, seen = {}, msgs = [];
        for (var i = 0; i < layers.length; i++) {
            var L = layers[i];
            if (!(L.source instanceof CompItem) || seen[L.source.id]) continue;
            seen[L.source.id] = true;
            var r = cropInner(L.source);
            if (r) { done++; msgs.push(L.source.name + " → " + r); }
        }
        if (!done) MMW.fail("No precomp needs cropping (select precomp layers).");
        return msgs.join(", ");
    };

    function cropInner(sc) {
        var targets = [];
        for (var i = 1; i <= sc.numLayers; i++) {
            var l = sc.layer(i);
            if (!l.enabled || l.guideLayer) continue;
            if (l instanceof CameraLayer || l instanceof LightLayer) continue;
            if (l instanceof AVLayer && (!l.hasVideo || l.nullLayer || l.adjustmentLayer)) continue;
            targets.push(l);
        }
        if (!targets.length) return null;

        var h = MMW.helper(sc);
        var ids = [];
        for (var j = 0; j < targets.length; j++) ids.push(targets[j].index);
        var body = "var ids=[" + ids.join(",") + "];var mn=[1e9,1e9],mx=[-1e9,-1e9];" +
            "for(var i=0;i<ids.length;i++){var L=thisComp.layer(ids[i]);if(!L.active)continue;" +
            "var r=L.sourceRectAtTime(time,false);" +
            "var c=[[r.left,r.top],[r.left+r.width,r.top],[r.left,r.top+r.height],[r.left+r.width,r.top+r.height]];" +
            "for(var j=0;j<4;j++){var p=L.toComp(c[j]);" +
            "mn[0]=Math.min(mn[0],p[0]);mn[1]=Math.min(mn[1],p[1]);mx[0]=Math.max(mx[0],p[0]);mx[1]=Math.max(mx[1],p[1]);}}";
        var frames = Math.max(1, Math.round(sc.duration / sc.frameDuration));
        var samples = Math.min(frames, 60);
        var b = { l: 1e9, t: 1e9, r: -1e9, b: -1e9 };
        for (var s = 0; s < samples; s++) {
            var t = samples === 1 ? 0 : (sc.duration - sc.frameDuration) * s / (samples - 1);
            var mn = h.evalAt(body + "[mn[0],mn[1],0]", t, 1);
            var mx = h.evalAt(body + "[mx[0],mx[1],0]", t, 2);
            if (mn[0] > 1e8) continue;
            b.l = Math.min(b.l, mn[0]); b.t = Math.min(b.t, mn[1]);
            b.r = Math.max(b.r, mx[0]); b.b = Math.max(b.b, mx[1]);
        }
        h.remove();
        if (b.l > 1e8) return null;

        var left = Math.max(0, Math.floor(b.l)), top = Math.max(0, Math.floor(b.t));
        var right = Math.min(sc.width, Math.ceil(b.r)), bottom = Math.min(sc.height, Math.ceil(b.b));
        var w = right - left, hgt = bottom - top;
        if (w < 4 || hgt < 4) return null;
        if (left === 0 && top === 0 && w === sc.width && hgt === sc.height) return null;

        shiftLayers(sc, -left, -top);
        sc.width = w;
        sc.height = hgt;

        // Compensate the anchor of every layer using this comp so nothing visually shifts.
        var used = sc.usedIn;
        for (var u = 0; u < used.length; u++) {
            for (var li = 1; li <= used[u].numLayers; li++) {
                var ol = used[u].layer(li);
                if (ol.source && ol.source.id === sc.id) {
                    var lk = ol.locked; ol.locked = false;
                    MMW.offsetProp(ol.transform.anchorPoint, [-left, -top, 0]);
                    ol.locked = lk;
                }
            }
        }
        return w + "×" + hgt;
    }

    // Shifts all layers in the comp via a temporary null (keeps existing parenting).
    function shiftLayers(comp, dx, dy) {
        var n = comp.layers.addNull();
        n.transform.anchorPoint.setValue([0, 0]);
        n.transform.position.setValue([0, 0]);
        var kids = [], locks = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (l === n || l.parent) continue;
            locks.push(l.locked); l.locked = false;
            l.parent = n;
            kids.push(l);
        }
        n.transform.position.setValue([dx, dy]);
        for (var k = 0; k < kids.length; k++) { kids[k].parent = null; kids[k].locked = locks[k]; }
        MMW.removeLayerAndSource(n);
    }
    MMW.shiftLayers = shiftLayers;

    // ---------------- Comp Duplicator ----------------
    // Duplicates a comp with all nested comps and updates comp("...") expressions.
    // Alt: put all copies into a new folder.
    T.compDuplicator = function (o) {
        var roots = [], sel = app.project.selection, i;
        for (i = 0; i < sel.length; i++) if (sel[i] instanceof CompItem) roots.push(sel[i]);
        if (!roots.length && app.project.activeItem instanceof CompItem) roots.push(app.project.activeItem);
        if (!roots.length) MMW.fail("Select comps in the Project panel or open a comp.");

        var map = {}, renames = [], dups = [];
        var folder = null;
        if (o.alt) folder = app.project.items.addFolder(roots[0].name + " (copy)");

        function uniqueItemName(base) {
            var taken = {};
            for (var k = 1; k <= app.project.numItems; k++) taken[app.project.item(k).name] = true;
            var m = base.match(/^(.*?)(\d+)$/), stem = m ? m[1] : base + " ", n = m ? parseInt(m[2], 10) : 1, name;
            do { n++; name = stem + n; } while (taken[name]);
            return name;
        }
        function dup(comp) {
            if (map[comp.id]) return map[comp.id];
            var d = comp.duplicate();
            d.name = uniqueItemName(comp.name);
            map[comp.id] = d;
            renames.push([comp.name, d.name]);
            dups.push(d);
            if (folder) d.parentFolder = folder;
            for (var l = 1; l <= d.numLayers; l++) {
                var L = d.layer(l);
                if (L.source instanceof CompItem) L.replaceSource(dup(L.source), false);
            }
            return d;
        }
        for (i = 0; i < roots.length; i++) dup(roots[i]);

        // Update comp("old name") -> comp("new name") in the duplicated comps.
        var fixed = 0;
        for (i = 0; i < dups.length; i++) {
            for (var l = 1; l <= dups[i].numLayers; l++) {
                MMW.walkProps(dups[i].layer(l), function (p) {
                    if (!p.canSetExpression || p.expression === "") return;
                    var e = p.expression, ne = e;
                    for (var r = 0; r < renames.length; r++) {
                        ne = ne.split('comp("' + renames[r][0] + '")').join('comp("' + renames[r][1] + '")');
                        ne = ne.split("comp('" + renames[r][0] + "')").join("comp('" + renames[r][1] + "')");
                    }
                    if (ne !== e) { p.expression = ne; fixed++; }
                });
            }
        }
        return "Duplicated " + dups.length + " comp(s), updated " + fixed + " expression(s).";
    };

    // ---------------- UnPreComp ----------------
    // Moves the layers of a precomp into the current comp. The precomp transform is kept with a parent null.
    // Alt: keep the precomp layer (disabled) instead of deleting it.
    T.unPreComp = function (o) {
        var c = MMW.comp();
        var layers = MMW.selLayers(c), count = 0, warn = "";
        for (var i = 0; i < layers.length; i++) {
            var L = layers[i];
            if (!(L.source instanceof CompItem)) continue;
            var sc = L.source;
            if (L.timeRemapEnabled) warn = " (Time Remap ignored)";

            var nul = MMW.newNull(c, MMW.uniqueLayerName(c, "UnPreComp - " + L.name));
            nul.threeDLayer = L.threeDLayer;
            nul.moveBefore(L);
            var props = ["ADBE Anchor Point", "ADBE Position", "ADBE Scale", "ADBE Rotate Z"];
            if (L.threeDLayer) props = props.concat(["ADBE Orientation", "ADBE Rotate X", "ADBE Rotate Y"]);
            for (var p = 0; p < props.length; p++) {
                var sp = L.transform.property(props[p]), dp = nul.transform.property(props[p]);
                if (sp && dp) MMW.copyPropValue(sp, dp);
            }
            if (L.parent) nul.setParentWithJump(L.parent);

            var before = {};
            for (var b = 1; b <= c.numLayers; b++) before[c.layer(b).id] = true;
            var copies = [];
            for (var k = 1; k <= sc.numLayers; k++) {
                sc.layer(k).copyToComp(c);
                for (var f = 1; f <= c.numLayers; f++) {
                    var nl = c.layer(f);
                    if (!before[nl.id]) { before[nl.id] = true; copies.push(nl); break; }
                }
            }
            for (var m = 0; m < copies.length; m++) {
                copies[m].moveBefore(L);
                copies[m].startTime += L.startTime;
            }
            // Restore inner parenting; top-level layers get parented to the null.
            for (var q = 0; q < copies.length; q++) {
                var orig = sc.layer(q + 1);
                if (orig.parent) copies[q].setParentWithJump(copies[orig.parent.index - 1]);
                else copies[q].setParentWithJump(nul);
            }
            if (o.alt) { L.enabled = false; L.shy = true; } else L.remove();
            count++;
        }
        if (!count) MMW.fail("Select precomp layers.");
        return "Decomposed " + count + " precomp(s)" + warn + ".";
    };
})();

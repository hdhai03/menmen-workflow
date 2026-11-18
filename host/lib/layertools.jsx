// layertools.jsx - parent, rename, màu label, khóa, shy/solo, reset, trim, duplicate
(function () {
    var T = MMW.tools;

    function withUnlock(L, fn) { var lk = L.locked; L.locked = false; try { fn(); } finally { L.locked = lk; } }

    // ---------- Parent ----------
    // Mọi layer đang chọn làm con của layer được chọn đầu tiên.
    T.parentToFirst = function () {
        var c = MMW.comp(), s = MMW.selLayers(c, 2), p = s[0], n = 0;
        for (var i = 1; i < s.length; i++) { (function (L) { withUnlock(L, function () { L.parent = p; }); })(s[i]); n++; }
        return n + " layer → con của \"" + p.name + "\".";
    };
    // Mỗi layer làm con của layer ngay phía trên nó.
    T.parentToAbove = function () {
        var c = MMW.comp(), s = MMW.sortByIndex(MMW.selLayers(c)), n = 0;
        for (var i = 0; i < s.length; i++) {
            if (s[i].index === 1) continue;
            (function (L) { withUnlock(L, function () { L.parent = c.layer(L.index - 1); }); })(s[i]);
            n++;
        }
        return "Đã parent " + n + " layer vào layer phía trên.";
    };
    // Chuỗi parent theo thứ tự chọn: 2 → 1, 3 → 2, ...
    T.parentChain = function () {
        var c = MMW.comp(), s = MMW.selLayers(c, 2);
        for (var i = 1; i < s.length; i++) (function (L, P) { withUnlock(L, function () { L.parent = P; }); })(s[i], s[i - 1]);
        return "Đã tạo chuỗi parent " + s.length + " layer.";
    };
    T.unparent = function () {
        var c = MMW.comp(), s = MMW.selLayers(c);
        for (var i = 0; i < s.length; i++) (function (L) { withUnlock(L, function () { L.parent = null; }); })(s[i]);
        return "Đã bỏ parent " + s.length + " layer.";
    };

    // ---------- Duplicate ----------
    // o.count: số bản sao mỗi layer.
    T.duplicateLayers = function (o) {
        var c = MMW.comp(), s = MMW.selLayers(c), n = Math.max(1, Math.min(200, parseInt(o.count, 10) || 1)), made = 0;
        for (var i = 0; i < s.length; i++) for (var k = 0; k < n; k++) { s[i].duplicate(); made++; }
        return "Đã tạo " + made + " bản sao.";
    };

    // ---------- Rename ----------
    // o.name (đặt tên mới + số), o.start, o.prefix, o.suffix, o.find, o.replace
    T.renameLayers = function (o) {
        var c = MMW.comp(), s = MMW.sortByIndex(MMW.selLayers(c)), num = parseInt(o.start, 10);
        if (isNaN(num)) num = 1;
        for (var i = 0; i < s.length; i++) {
            var L = s[i], name = L.name;
            if (o.name) name = o.name + " " + (num + i);
            if (o.find) name = name.split(o.find).join(o.replace || "");
            name = (o.prefix || "") + name + (o.suffix || "");
            L.name = name;
        }
        return "Đã đổi tên " + s.length + " layer.";
    };

    // ---------- Label colors ----------
    // o.mode: "type" (theo loại layer) | "random" | "1".."16" (một màu)
    T.setLayerColors = function (o) {
        var c = MMW.comp(), s = c.selectedLayers.length ? c.selectedLayers : null, mode = String(o.mode || "type"), n = 0;
        for (var i = 1; i <= c.numLayers; i++) {
            var L = c.layer(i);
            if (s && !L.selected) continue;
            var lab;
            if (mode === "random") lab = 1 + Math.floor(Math.random() * 16);
            else if (mode === "type") {
                lab = L instanceof TextLayer ? 1 : L instanceof ShapeLayer ? 8 : L instanceof CameraLayer ? 4 :
                    L instanceof LightLayer ? 6 : L.nullLayer ? 2 : L.adjustmentLayer ? 5 :
                    (L.source instanceof CompItem) ? 13 : (L.hasAudio && !L.hasVideo) ? 11 : 9;
            } else lab = Math.max(0, Math.min(16, parseInt(mode, 10) || 0));
            L.label = lab; n++;
        }
        return "Đã đổi màu label " + n + " layer.";
    };

    // ---------- Lock / Shy / Solo ----------
    // Khóa hoặc mở khóa toàn bộ layer. Alt: chỉ layer đang chọn.
    T.lockToggle = function (o) {
        var c = MMW.comp(), list = [], i;
        for (i = 1; i <= c.numLayers; i++) if (!o.alt || c.layer(i).selected) list.push(c.layer(i));
        var anyUnlocked = false;
        for (i = 0; i < list.length; i++) if (!list[i].locked) anyUnlocked = true;
        for (i = 0; i < list.length; i++) list[i].locked = anyUnlocked;
        return (anyUnlocked ? "Đã khóa " : "Đã mở khóa ") + list.length + " layer.";
    };
    // Click: bật/tắt shy cho layer đang chọn. Alt: bật/tắt "Hide Shy Layers" của comp.
    T.shyToggle = function (o) {
        var c = MMW.comp();
        if (o.alt) { c.hideShyLayers = !c.hideShyLayers; return "Hide Shy Layers: " + (c.hideShyLayers ? "bật" : "tắt"); }
        var s = MMW.selLayers(c);
        for (var i = 0; i < s.length; i++) s[i].shy = !s[i].shy;
        return "Đã đổi shy cho " + s.length + " layer.";
    };
    // Chỉ hiện layer đang chọn trong timeline (dùng shy). Bấm lần nữa để hiện lại tất cả.
    T.soloTimeline = function () {
        var c = MMW.comp(), i;
        if (c.hideShyLayers && $.global.__mmwSoloShy) {
            for (i = 1; i <= c.numLayers; i++) c.layer(i).shy = false;
            c.hideShyLayers = false; $.global.__mmwSoloShy = false;
            return "Đã hiện lại toàn bộ layer.";
        }
        var s = MMW.selLayers(c);
        for (i = 1; i <= c.numLayers; i++) c.layer(i).shy = !c.layer(i).selected;
        c.hideShyLayers = true; $.global.__mmwSoloShy = true;
        return "Timeline chỉ còn " + s.length + " layer (bấm lại để hiện tất cả).";
    };
    // Click: bật/tắt Solo cho layer đang chọn. Alt: tắt Solo mọi layer.
    T.soloViewer = function (o) {
        var c = MMW.comp(), i;
        if (o.alt) { for (i = 1; i <= c.numLayers; i++) try { c.layer(i).solo = false; } catch (e) {} return "Đã tắt solo."; }
        var s = MMW.selLayers(c);
        for (i = 0; i < s.length; i++) s[i].solo = !s[i].solo;
        return "Đã đổi solo " + s.length + " layer.";
    };
    T.toggleVisibility = function () {
        var c = MMW.comp(), s = MMW.selLayers(c);
        for (var i = 0; i < s.length; i++) s[i].enabled = !s[i].enabled;
        return "Đã bật/tắt hiển thị " + s.length + " layer.";
    };

    // ---------- Reset ----------
    // Reset transform (xóa keyframe). Alt: giữ nguyên Position.
    T.resetTransform = function (o) {
        var c = MMW.comp(), s = MMW.selLayers(c);
        for (var i = 0; i < s.length; i++) {
            (function (L) {
                withUnlock(L, function () {
                    var tr = L.transform;
                    var reset = [["ADBE Scale", [100, 100, 100]], ["ADBE Rotate Z", 0], ["ADBE Opacity", 100]];
                    if (!o.alt) reset.push(["ADBE Position", [c.width / 2, c.height / 2, 0]]);
                    if (L.threeDLayer) reset = reset.concat([["ADBE Orientation", [0, 0, 0]], ["ADBE Rotate X", 0], ["ADBE Rotate Y", 0]]);
                    for (var r = 0; r < reset.length; r++) {
                        var p = tr.property(reset[r][0]);
                        if (!p) continue;
                        if (p.dimensionsSeparated) continue;
                        while (p.numKeys) p.removeKey(1);
                        try { p.expression = ""; } catch (e) {}
                        var v = reset[r][1];
                        if (v instanceof Array && !L.threeDLayer) v = [v[0], v[1]];
                        try { p.setValue(v); } catch (e2) {}
                    }
                });
            })(s[i]);
        }
        return "Đã reset transform " + s.length + " layer.";
    };

    // ---------- Trim ----------
    // Click: cắt Out point về playhead. Alt: In point về playhead. Shift: về work area.
    T.trimLayers = function (o) {
        var c = MMW.comp(), s = MMW.selLayers(c), t = c.time;
        for (var i = 0; i < s.length; i++) {
            (function (L) {
                withUnlock(L, function () {
                    if (o.shift) { L.inPoint = c.workAreaStart; L.outPoint = c.workAreaStart + c.workAreaDuration; }
                    else if (o.alt) L.inPoint = t;
                    else L.outPoint = t;
                });
            })(s[i]);
        }
        return "Đã trim " + s.length + " layer.";
    };
})();

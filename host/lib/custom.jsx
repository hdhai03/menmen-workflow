// custom.jsx - chạy script/preset của người dùng và áp expression tùy chỉnh
(function () {
    var T = MMW.tools;

    // o.path: đường dẫn .jsx / .jsxbin / .ffx
    T.runFile = function (o) {
        var f = new File(o.path);
        if (!f.exists) MMW.fail("Không tìm thấy file: " + o.path);
        if (/\.ffx$/i.test(f.name)) {
            var c = MMW.comp(), layers = MMW.selLayers(c);
            for (var i = 0; i < layers.length; i++) layers[i].applyPreset(f);
            return "Đã áp preset " + decodeURI(f.name) + " cho " + layers.length + " layer.";
        }
        $.evalFile(f);
        return "Đã chạy " + decodeURI(f.name);
    };

    // o.code: nội dung expression. Alt: xóa expression trên property đang chọn.
    T.applyExpression = function (o) {
        var c = MMW.comp(), props = MMW.selProps(c), n = 0;
        if (!props.length) MMW.fail("Hãy chọn property để áp expression.");
        for (var i = 0; i < props.length; i++) {
            var p = props[i].prop;
            if (!p.canSetExpression) continue;
            p.expression = o.alt ? "" : String(o.code || "");
            n++;
        }
        return (o.alt ? "Đã xóa expression trên " : "Đã áp expression cho ") + n + " property.";
    };

    // Thông tin cho panel About.
    T.hostInfo = function () {
        return "After Effects " + app.version + " · MenMen host " + MMW.VERSION;
    };
})();

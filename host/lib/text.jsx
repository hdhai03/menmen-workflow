// text.jsx - tìm/thay text, lorem ipsum, typewriter, number counter, text box
(function () {
    var T = MMW.tools;

    function textLayers(c, allIfNone) {
        var out = [], i;
        for (i = 1; i <= c.numLayers; i++) {
            var L = c.layer(i);
            if (L instanceof TextLayer && (L.selected || (allIfNone && !c.selectedLayers.length))) out.push(L);
        }
        if (!out.length) MMW.fail("Hãy chọn text layer.");
        return out;
    }
    function srcText(L) { return L.property("ADBE Text Properties").property("ADBE Text Document"); }
    function ensureEffect(L, matchName, name, val) {
        var fx = L.property("ADBE Effect Parade"), ex = fx.property(name);
        if (ex) return ex;
        var e = MMW.addEffect(L, matchName, name);
        if (val !== undefined) e.property(1).setValue(val);
        return L.property("ADBE Effect Parade").property(name);
    }

    // o.find, o.replace — trên text layer đang chọn (hoặc mọi text layer nếu không chọn gì).
    T.findReplaceText = function (o) {
        if (!o.find) MMW.fail("Nhập chuỗi cần tìm.");
        var c = MMW.comp(), list = textLayers(c, true), n = 0;
        for (var i = 0; i < list.length; i++) {
            var p = srcText(list[i]);
            if (p.numKeys > 0) {
                for (var k = 1; k <= p.numKeys; k++) {
                    var dk = p.keyValue(k);
                    if (dk.text.indexOf(o.find) >= 0) { dk.text = dk.text.split(o.find).join(o.replace || ""); p.setValueAtKey(k, dk); n++; }
                }
            } else {
                var d = p.value;
                if (d.text.indexOf(o.find) >= 0) { d.text = d.text.split(o.find).join(o.replace || ""); p.setValue(d); n++; }
            }
        }
        return "Đã thay " + n + " chỗ.";
    };

    var LOREM = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat";
    // o.words: số từ
    T.loremIpsum = function (o) {
        var c = MMW.comp(), words = LOREM.split(" "), n = Math.max(1, parseInt(o.words, 10) || 12), out = [];
        for (var i = 0; i < n; i++) out.push(words[i % words.length]);
        var txt = out.join(" ");
        txt = txt.charAt(0).toUpperCase() + txt.slice(1) + ".";
        var L = c.layers.addBoxText([Math.round(c.width * 0.6), Math.round(c.height * 0.4)], txt);
        L.name = "Lorem Ipsum";
        return "Đã tạo text " + n + " từ.";
    };

    // Typewriter: hiện dần ký tự theo slider "Typewriter %" (tạo sẵn key 0 → 100 trong o.seconds giây).
    T.typewriter = function (o) {
        var c = MMW.comp(), list = textLayers(c), dur = Number(o.seconds) || 2;
        for (var i = 0; i < list.length; i++) {
            var L = list[i];
            var s = ensureEffect(L, "ADBE Slider Control", "Typewriter %").property(1);
            var cur = ensureEffect(L, "ADBE Checkbox Control", "Cursor").property(1);
            if (s.numKeys === 0) { s.setValueAtTime(L.inPoint, 0); s.setValueAtTime(L.inPoint + dur, 100); }
            if (o.cursor) cur.setValue(1);
            srcText(L).expression =
                "var p=clamp(effect(\"Typewriter %\")(1),0,100)/100, s=value.toString();\n" +
                "var n=Math.round(s.length*p), out=s.substr(0,n);\n" +
                "if(effect(\"Cursor\")(1)==1 && (p<1 || Math.floor(time*2)%2==0)) out+=\"|\";\nout;";
        }
        return "Typewriter → " + list.length + " text layer.";
    };

    // Number Counter: text layer mới (hoặc text đang chọn) đếm theo slider "Counter".
    T.numberCounter = function (o) {
        var c = MMW.comp(), list = [], i;
        var sel = c.selectedLayers;
        for (i = 0; i < sel.length; i++) if (sel[i] instanceof TextLayer) list.push(sel[i]);
        if (!list.length) {
            var L0 = c.layers.addText("0");
            L0.name = "Number Counter";
            list.push(L0);
        }
        var dec = Math.max(0, Math.min(6, parseInt(o.decimals, 10) || 0)), from = Number(o.from) || 0, to = (o.to === undefined || o.to === "") ? 100 : Number(o.to);
        for (i = 0; i < list.length; i++) {
            var L = list[i];
            var s = ensureEffect(L, "ADBE Slider Control", "Counter").property(1);
            if (s.numKeys === 0) { s.setValueAtTime(L.inPoint, from); s.setValueAtTime(L.inPoint + (Number(o.seconds) || 2), to); }
            srcText(L).expression =
                "var v=effect(\"Counter\")(1), d=" + dec + ", sep=" + (o.separator ? "true" : "false") + ";\n" +
                "var s=Math.abs(v).toFixed(d), parts=s.split(\".\");\n" +
                "if(sep) parts[0]=parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, \",\");\n" +
                MMW.quote(o.prefix || "") + " + (v<0?\"-\":\"\") + parts.join(\".\") + " + MMW.quote(o.suffix || "") + ";";
        }
        return "Number counter → " + list.length + " layer.";
    };

    // Text Box: shape layer nền tự co giãn theo text (padding / bo góc chỉnh bằng slider).
    T.textBox = function (o) {
        var c = MMW.comp(), list = textLayers(c), made = 0;
        for (var i = 0; i < list.length; i++) {
            var L = list[i];
            var box = c.layers.addShape();
            box.name = MMW.uniqueLayerName(c, L.name + " Box");
            box.moveAfter(L);
            box.transform.anchorPoint.setValue([0, 0]);
            box.transform.position.setValue([0, 0]);
            var root = box.property("ADBE Root Vectors Group");
            root.addProperty("ADBE Vector Group");
            var grp = box.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
            grp.addProperty("ADBE Vector Shape - Rect");
            box.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
            var g2 = box.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
            g2.property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(o.color || [0.1, 0.1, 0.12]);
            MMW.addEffect(box, "ADBE Slider Control", "Padding X").property(1).setValue(Number(o.padX) || 24);
            MMW.addEffect(box, "ADBE Slider Control", "Padding Y").property(1).setValue(Number(o.padY) || 14);
            MMW.addEffect(box, "ADBE Slider Control", "Roundness").property(1).setValue(Number(o.round) || 8);
            var ref = "thisComp.layer(" + MMW.quote(L.name) + ")";
            var rect = box.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").property("ADBE Vector Shape - Rect");
            rect.property("ADBE Vector Rect Size").expression =
                "var t=" + ref + ", r=t.sourceRectAtTime(time,false), s=t.transform.scale/100;\n" +
                "[r.width*s[0]+2*effect(\"Padding X\")(1), r.height*s[1]+2*effect(\"Padding Y\")(1)];";
            rect.property("ADBE Vector Rect Position").expression =
                "var t=" + ref + ", r=t.sourceRectAtTime(time,false);\nfromComp(t.toComp([r.left+r.width/2, r.top+r.height/2]));";
            rect.property("ADBE Vector Rect Roundness").expression = "effect(\"Roundness\")(1)";
            made++;
        }
        return "Đã tạo " + made + " text box.";
    };
})();

// rig.jsx - Create Limb, Position Trace
(function () {
    var T = MMW.tools;
    var ROOT = "ADBE Root Vectors Group";

    // Tạo shape layer có 1 group chứa path + stroke. Trả về layer.
    function newStrokeLayer(c, name, color, width) {
        var L = c.layers.addShape();
        L.name = MMW.uniqueLayerName(c, name);
        L.transform.anchorPoint.setValue([0, 0]);
        L.transform.position.setValue([0, 0]);
        var g = L.property(ROOT).addProperty("ADBE Vector Group");
        g.name = "Path";
        L.property(ROOT).property(1).property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Group");
        L.property(ROOT).property(1).property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Stroke");
        var st = L.property(ROOT).property(1).property("ADBE Vectors Group").property("ADBE Vector Graphic - Stroke");
        st.property("ADBE Vector Stroke Color").setValue(color);
        st.property("ADBE Vector Stroke Width").setValue(width);
        st.property("ADBE Vector Stroke Line Cap").setValue(2);
        st.property("ADBE Vector Stroke Line Join").setValue(2);
        return L;
    }
    function pathProp(L) {
        return L.property(ROOT).property(1).property("ADBE Vectors Group").property("ADBE Vector Shape - Group").property("ADBE Vector Shape");
    }
    function strokeWidth(L) {
        return L.property(ROOT).property(1).property("ADBE Vectors Group").property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Width");
    }

    // ---------------- Create Limb ----------------
    // Tạo "ống" (hose) điều khiển bởi 2 null Start/End. Khi 2 đầu lại gần, ống tự cong để giữ chiều dài.
    T.createLimb = function (o) {
        var c = MMW.comp();
        var base = MMW.uniqueLayerName(c, "Limb");
        var cx = c.width / 2, cy = c.height / 2, half = Math.min(c.width, c.height) / 6;

        var limb = newStrokeLayer(c, base, [1, 0.55, 0.2], 24);
        var a = MMW.newNull(c, base + " Start");
        var b = MMW.newNull(c, base + " End");
        a.transform.position.setValue([cx - half, cy]);
        b.transform.position.setValue([cx + half, cy]);
        a.label = 2; b.label = 2;

        MMW.addEffect(limb, "ADBE Slider Control", "Length").property(1).setValue(half * 2 * 1.25);
        MMW.addEffect(limb, "ADBE Slider Control", "Thickness").property(1).setValue(24);
        MMW.addEffect(limb, "ADBE Checkbox Control", "Flip");

        pathProp(limb).expression =
            "// MenMen Limb\n" +
            "var A=thisComp.layer(" + MMW.quote(a.name) + "), B=thisComp.layer(" + MMW.quote(b.name) + ");\n" +
            "var p0=fromComp(A.toComp(A.anchorPoint)), p2=fromComp(B.toComp(B.anchorPoint));\n" +
            "var len=effect(\"Length\")(1), flip=effect(\"Flip\")(1);\n" +
            "var dx=p2[0]-p0[0], dy=p2[1]-p0[1], d=Math.sqrt(dx*dx+dy*dy);\n" +
            "var ux=d>0?dx/d:1, uy=d>0?dy/d:0, nx=-uy, ny=ux; if(flip==1){nx=-nx;ny=-ny;}\n" +
            "var h=Math.sqrt(Math.max(0,(len/2)*(len/2)-(d/2)*(d/2)));\n" +
            "var m=[(p0[0]+p2[0])/2+nx*h,(p0[1]+p2[1])/2+ny*h];\n" +
            "var k=Math.max(d,len*0.3)/4;\n" +
            "var aOut=[(m[0]-p0[0])*0.45,(m[1]-p0[1])*0.45], bIn=[(m[0]-p2[0])*0.45,(m[1]-p2[1])*0.45];\n" +
            "createPath([p0,m,p2],[[0,0],[-ux*k,-uy*k],bIn],[aOut,[ux*k,uy*k],[0,0]],false);";
        strokeWidth(limb).expression = "effect(\"Thickness\")(1)";
        a.moveBefore(limb); b.moveBefore(limb);
        return "Đã tạo " + limb.name + " (kéo 2 null Start/End để điều khiển).";
    };

    // ---------------- Position Trace ----------------
    // Vẽ quỹ đạo (vị trí anchor trong không gian comp) của layer đang chọn thành shape layer.
    // Alt: chỉ trong vùng work area.
    T.positionTrace = function (o) {
        var c = MMW.comp(), layers = MMW.selLayers(c), made = 0;
        var fd = c.frameDuration;
        var colors = [[1, 0.3, 0.4], [0.3, 0.8, 1], [0.5, 1, 0.4], [1, 0.8, 0.3]];
        for (var i = 0; i < layers.length; i++) {
            var L = layers[i];
            if (L instanceof CameraLayer || L instanceof LightLayer) continue;
            var t0 = Math.max(L.inPoint, 0), t1 = Math.min(L.outPoint, c.duration);
            if (o.alt) { t0 = Math.max(t0, c.workAreaStart); t1 = Math.min(t1, c.workAreaStart + c.workAreaDuration); }
            var frames = Math.max(2, Math.round((t1 - t0) / fd));
            var stepF = Math.max(1, Math.ceil(frames / 1500));
            var h = MMW.helper(c);
            var expr = "var L=thisComp.layer(" + L.index + ");var p=L.toComp(L.anchorPoint);[p[0],p[1],0]";
            var pts = [], ins = [], outs = [];
            for (var f = 0; f <= frames; f += stepF) {
                var v = h.evalAt(expr, t0 + f * fd, 1);
                pts.push([v[0], v[1]]); ins.push([0, 0]); outs.push([0, 0]);
            }
            h.remove();
            var tr = newStrokeLayer(c, L.name + " Trace", colors[i % colors.length], 2);
            var shp = new Shape();
            shp.vertices = pts; shp.inTangents = ins; shp.outTangents = outs; shp.closed = false;
            pathProp(tr).setValue(shp);
            tr.guideLayer = true;
            tr.moveBefore(L);
            made++;
        }
        if (!made) MMW.fail("Hãy chọn layer có vị trí (không phải camera/light).");
        return "Đã vẽ quỹ đạo cho " + made + " layer.";
    };
})();

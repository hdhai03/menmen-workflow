# MenMen Workflow

Extension cho **Adobe After Effects 2022+** (CEP). Gom script, widget và expression vào **4 panel dạng lưới** có thể tùy biến, giúp tăng tốc workflow motion design.

## Tính năng (v0.1.0)

**Giao diện**
- 4 panel độc lập (`Window ▸ Extensions ▸ MenMen Workflow 1…4`), mỗi panel chọn một layout riêng.
- Layout: tạo, đổi tên, nhân bản, xóa, tìm kiếm.
- Edit mode (biểu tượng bút chì): kéo ô để sắp xếp, kéo góc để đổi kích thước, xóa ô, thêm tool từ thư viện.
- Chuột phải lên ô: chạy theo từng chế độ phím (Alt/Shift/Ctrl), đổi tên, đổi màu, đổi kích thước.
- Thanh helptip ở cuối panel hiện mô tả tool và các phím bổ trợ.
- Cài đặt: màu nhấn, kích thước ô, khoảng cách, cỡ chữ, ẩn/hiện tên, theo màu nền AE; export/import/reset.
- Cài đặt lưu ở `<userData>/MenMenWorkflow/settings.json` và tự đồng bộ giữa các panel.

**Tool** (giữ phím bổ trợ khi click để đổi chế độ)

| Nhóm | Tool | Click | Alt | Shift | Ctrl |
|---|---|---|---|---|---|
| Composition | Crop Comp | Crop precomp về vùng nội dung | | | |
| | Comp Duplicator | Nhân bản comp + comp lồng, sửa `comp("…")` | Đưa vào folder mới | | |
| | UnPreComp | Bung layer ra comp hiện tại (null giữ transform) | Giữ layer precomp | | |
| Animation | Easy Keyframes *(widget)* | Ease / In / Out / Linear / Hold với influence tùy chỉnh | | | |
| | Clone | Copy key tới playhead | Chọn key mới | Đảo ngược | |
| | Easings Manager *(widget)* | Copy/Paste giá trị + easing | Chỉ easing | Chỉ giá trị | |
| | Fix Keys Time | Đưa key lệch về đúng frame | | | |
| | Loop In/Out | `loopOut("cycle")` | pingpong | offset | continue |
| | Elastic / Bounce | Expression đàn hồi / nảy | | | |
| Shapes | Extract Shapes | Tách group thành layer | Giữ gốc | | |
| | Merge Shapes | Gộp shape layer vào layer trên cùng | Giữ nguồn | | |
| | Nulls To Point | Null bám theo điểm path | Path đi theo null | | |
| | Selector | Chọn mọi Path | Mọi Fill | Mọi Stroke | |
| | Shapes From Vector | AI/PDF → Shape | Xóa nguồn | Xóa artboard | |
| | Remove Artboards | Xóa group "Artboard" | | | |
| Rig | Create Limb | Ống/tay chân rig bằng 2 null | | | |
| | Position Trace | Vẽ quỹ đạo thành shape | Chỉ work area | | |
| Layers | Add Null | 1 null ở giữa các layer | Null mặc định | Mỗi layer 1 null | |
| | Get Colors | Gom màu vào controller | | | |
| | Move Anchor *(widget)* | 9 vị trí, giữ nguyên hình | | Ô giữa: lệnh gốc (3D) | |
| | Sequencer *(widget)* | Dàn layer/keyframe ↓ ↑ ngẫu nhiên | | | |
| Render | Simple Proxy | Render proxy + gắn tự động | Gỡ proxy | Bật/tắt proxy | |
| Custom | Custom Script | Chạy `.jsx` / `.jsxbin` / áp `.ffx` | | | |
| | Custom Expression | Áp expression lên property | Xóa expression | | |

## Cài đặt để phát triển

1. Clone repo về máy có After Effects.
2. Chạy script cài:
   - macOS:
     ```bash
     bash scripts/install-dev-mac.sh
     ```
   - Windows (PowerShell):
     ```powershell
     powershell -ExecutionPolicy Bypass -File scripts\install-dev-win.ps1
     ```
   Script bật `PlayerDebugMode` (cho phép chạy extension chưa ký) và link thư mục project vào thư mục `CEP/extensions`.
3. Khởi động lại After Effects → `Window ▸ Extensions ▸ MenMen Workflow 1`.
4. Debug panel: mở Chrome tới `http://localhost:8091` (panel 2–4 dùng cổng 8092–8094, khai báo trong `.debug`).
5. Sau khi sửa file trong `host/`: menu ☰ ▸ **Nạp lại host scripts**. Sau khi sửa `client/`: đóng/mở lại panel (hoặc F5 trong DevTools).

**Xem trước giao diện không cần AE:** mở `client/index.html` bằng Chrome (`?panel=1…4`). Bridge sẽ chạy ở chế độ mock, tool chỉ được giả lập.

## Cấu trúc

```
CSXS/manifest.xml      4 panel, AE 22.0+, CSXS 9.0
client/                giao diện panel (HTML/CSS/JS thuần, không cần build)
  js/bridge.js         evalScript, events, file system (window.__adobe_cep__ / window.cep.fs)
  js/tools.js          danh mục tool (tên, nhóm, icon, mô tả, phím bổ trợ)
  js/store.js          cài đặt + layout mặc định, lưu file, đồng bộ panel
  js/widgets.js        Easy Keyframes, Easings Manager, Sequencer, Move Anchor
  js/ui.js             menu, dialog, toast
  js/app.js            lưới, edit mode, layout, settings, thư viện tool
host/                  ExtendScript (ES3)
  main.jsx             MMW.load() nạp các module
  lib/core.jsx         MMW.run (undo group + "OK|"/"ERR|"), helper keyframe/expression
  lib/*.jsx            tool theo nhóm
scripts/               cài đặt dev
```

## Thêm một tool mới

1. Viết hàm trong `host/lib/<nhóm>.jsx`:
   ```js
   T.myTool = function (o) {          // o = { alt, shift, ctrl, ...tham số widget }
       var c = MMW.comp(), layers = MMW.selLayers(c);
       // ...
       return "Thông báo hiển thị trên toast";   // lỗi: MMW.fail("…")
   };
   ```
2. Khai báo trong `client/js/tools.js`:
   ```js
   { id: 'myTool', name: 'My Tool', cat: 'layers', desc: '…', mods: { alt: '…' } }
   ```
3. Thêm icon (SVG 24×24) vào object `I` trong `tools.js` (tùy chọn).

## Đóng gói ZXP

Dùng [ZXPSignCmd](https://github.com/Adobe-CEP/CEP-Resources/tree/master/ZXPSignCMD):

```bash
ZXPSignCmd -selfSignedCert VN HN MenMen "MenMen Workflow" <password> cert.p12
```

```bash
ZXPSignCmd -sign menmen-workflow dist/MenMenWorkflow.zxp cert.p12 <password> -tsa http://timestamp.digicert.com
```

(Chạy từ thư mục cha của project. Không commit file `.p12`.)

## Giới hạn đã biết (v0.1.0)

- Merge Shapes / Nulls To Point quy đổi transform của group ở dạng tĩnh (2D). Path nằm trong group có transform khác mặc định có thể bị lệch.
- UnPreComp bỏ qua Time Remap, effect và opacity của layer precomp.
- Remove Artboards nhận diện artboard theo tên group có chứa "Artboard".
- Simple Proxy dùng template "High Quality with Alpha"/"Lossless with Alpha" (theo tên tiếng Anh); AE ngôn ngữ khác sẽ dùng template mặc định.

## Roadmap gợi ý

- Code editor (Monaco) + thư viện expression, đồng bộ với editor ngoài.
- Thư viện theme, icon vector, Rive animation cho ô.
- Widget: bảng màu (Collect Palette), easing presets có Speed Graph, Visualize Easings.
- Xuất GIF (ffmpeg), quản lý format mạng xã hội (tạo comp + safe zone).
- Share Center: export/import chọn lọc layout, script, expression.

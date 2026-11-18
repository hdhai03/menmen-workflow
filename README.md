# MenMen Workflow

Extension cho **Adobe After Effects 2022+** (CEP). Gom script, widget và expression vào **4 panel dạng lưới** có thể tùy biến, giúp tăng tốc workflow motion design.

## Tính năng (v0.2.0)

### Giao diện: 1 main panel + 4 panel phụ
- **MenMen Workflow** (main panel, `Window ▸ Extensions ▸ MenMen Workflow`): thanh dọc gọn gồm
  - ô **tìm kiếm** tool (dùng phím ↑ ↓, Enter để chạy, Esc để xóa),
  - dải **Favorites** (bấm ☆ cạnh tool để ghim),
  - **12 nhóm tool**: bấm vào nhóm để mở menu tool,
  - **User panels** (panel tự tạo) và **Add New Item**.
  - Khi panel được kéo thấp và rộng, main panel tự chuyển sang dạng thanh ngang chỉ có icon.
- **Dock**: trong menu của một nhóm hay một user panel, bấm biểu tượng Dock để mở nội dung đó ra **MenMen Panel 1–4** (panel phụ, dock được như panel AE bình thường).
- **Panel phụ**: hiển thị một nhóm tool hoặc một user panel, dạng danh sách hoặc lưới.
  - Với nhóm tool: ẩn bớt tool không dùng; nút "Hiện tất cả" để hiện lại tạm thời.
  - Với user panel: kéo thả để sắp xếp, chuột phải để sửa / xóa item.
- **User panel** chứa được nhiều loại item: MenMen tool, Expression, Scriptlet (ExtendScript), Script file (.jsx/.jsxbin), Preset (.ffx), Effect, Menu Command, Divider.
- **Tool có tham số** mở một form nhỏ, giá trị lần trước được ghi nhớ. **Widget** (Keyframe Assistant, Easing Presets, Easings Manager, Offset Layers, Set Anchor Point) mở trong một hộp thoại.
- **Cài đặt**:
  - kiểu icon: Đơn sắc / Màu / Khối màu,
  - cỡ icon: S / M / L,
  - bật/tắt tooltip,
  - theo màu nền AE, màu nhấn,
  - Backup / Khôi phục / Reset.
- Cài đặt lưu ở `<userData>/MenMenWorkflow/settings.json` và đồng bộ giữa mọi panel.

### 126 tool trong 12 nhóm
| Nhóm | Tool |
|---|---|
| Selection (23) | Select Nulls / 3D / Lights (Alt: camera) / Precomps / Shape / Text / Audio / Guide / Adjustment, Inverse, Every Nth, Odd/Even, Above, Below, Children, Parents, Hierarchy, Random, At Frame, Matching Property, All Paths / Fills / Strokes |
| Layers (17) | Parent to Null, Parent to First / Above / Selection Order, Unparent, Offset Layers, Duplicate, Rename, Layer Colors, Lock All, Shy, Solo (Timeline), Visibility, Reset Transform, Trim, Set Anchor Point, Collect Colors |
| Keyframes (12) | Clone, Clone & Mirror, Align to Playhead / In-Out / Left-Right, Offset, Time-Reverse, Snap to Frames, Clean, Copy/Paste Values, Key Looper |
| Easing (6) | Keyframe Assistant, Easing Presets (Sine…Back × In/Out/InOut), Easings Manager, Copy/Paste Easing, Reverse Easing |
| Composition (9) | Auto Crop, Auto Trim, Pre-Compose, Decompose, Duplicate Comps, Batch Comp Settings, Black/Gray/White BG |
| Project (6) | Project Cleanup, Organize Project, Folder Structure, Reveal Project Folder, Reveal Layer Source, Proxy Manager |
| Guides (11) | Guides Around / Center / Edge / Anchor, Grid System, Clear, Copy, Paste, Show/Hide, Lock, Snap |
| View (6) | Zoom 100% / 50%, Solo (Viewer), Rulers, Grid, Save Screenshot |
| Expression (7) | Expression Editor, Enable / Disable / Remove, Remove Broken, Bake, Find & Replace |
| Shapes (15) | Separate Shapes, Merge, Null Controllers for Points, Shapes from Vector, Remove Artboards, Mask → Shape, Cap/Join Round/Miter/Bevel, Toggle Fill/Stroke, Reverse Path, Reset Shape Transforms, Rectangle / Circle Wizard, Trim Paths Controller |
| Text (5) | Find & Replace Text, Lorem Ipsum, Typewriter, Number Counter, Text Box Generator |
| Animation (9) | Overshoot, Bounce, Wiggle, Spin, Auto Fader, Blinker, Stop Motion, Bend / Limb Rig, Position Trace |

Các tool tạo animation bằng expression đều thêm slider để chỉnh lại sau (Wiggle Freq/Amp, Spin, Fade, Counter…). Giữ **Alt / Shift / Ctrl** khi click để đổi chế độ; chữ nhỏ A/S/C cạnh tên tool cho biết tool đó có chế độ phụ nào.

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
3. Khởi động lại After Effects → `Window ▸ Extensions ▸ MenMen Workflow` (main panel). Các panel phụ ở `MenMen Panel 1–4`.
4. Debug: mở Chrome tới `http://localhost:8090` (main panel); panel phụ 1–4 dùng cổng 8091–8094 (khai báo trong `.debug`).
5. Sau khi sửa file trong `host/`: menu ☰ ▸ **Nạp lại host scripts**. Sau khi sửa `client/`: đóng/mở lại panel (hoặc F5 trong DevTools).

**Xem trước giao diện không cần AE:** mở `client/index.html` bằng Chrome (`?panel=main` hoặc `?panel=1…4`). Bridge sẽ chạy ở chế độ mock, tool chỉ được giả lập.

## Cấu trúc

```
CSXS/manifest.xml      main panel + 4 panel phụ, AE 22.0+, CSXS 9.0
client/                giao diện panel (HTML/CSS/JS thuần, không cần build)
  js/bridge.js         evalScript, events, file system (window.__adobe_cep__ / window.cep.fs)
  js/tools.js          12 nhóm + 126 tool (tên, icon, mô tả, phím bổ trợ, tham số)
  js/store.js          favorites, user panels, slot panel phụ, tham số; lưu file + đồng bộ
  js/widgets.js        Keyframe Assistant, Easing Presets, Easings Manager, Offset Layers, Set Anchor
  js/ui.js             menu, dialog, toast
  js/app.js            main panel, sheet nhóm, dock, panel phụ, add item, settings
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
2. Khai báo trong `client/js/tools.js` (`cat` là một trong 12 nhóm; `params` tùy chọn sẽ tạo form):
   ```js
   { id: 'myTool', name: 'My Tool', cat: 'layers', desc: '…', mods: { alt: '…' },
     params: [P.num('count', 'Số lượng', 3)] }
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

- Zoom viewer, Show/Hide Guides/Rulers/Grid dùng tên lệnh menu tiếng Anh; AE ngôn ngữ khác có thể báo không tìm thấy lệnh.
- Panel phụ chỉ có 4 slot (CEP cần khai báo trước số panel trong manifest).

## Roadmap gợi ý

- Phím tắt cho tool (qua thư mục Scripts của AE), tìm cả effect và script trong thư mục người dùng.
- Icon tùy chỉnh (SVG) cho item của user panel.
- Code editor (Monaco) + thư viện expression, đồng bộ với editor ngoài.
- Thư viện theme, icon vector, Rive animation cho ô.
- Widget: bảng màu (Collect Palette), easing presets có Speed Graph, Visualize Easings.
- Xuất GIF (ffmpeg), quản lý format mạng xã hội (tạo comp + safe zone).
- Share Center: export/import chọn lọc layout, script, expression.

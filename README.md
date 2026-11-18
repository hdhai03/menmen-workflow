# MenMen Workflow

An extension for **Adobe After Effects 2022+** (CEP). It brings scripts, widgets and expressions together in **one main panel plus dockable sub panels** to speed up motion design work.

## Features (v0.3.0)

### Interface: 1 main panel + 4 sub panels
- **MenMen Workflow** (main panel, `Window ▸ Extensions ▸ MenMen Workflow`) is a compact vertical bar with:
  - a **tool search** field (↑ ↓ to move, Enter to run, Esc to clear),
  - a **Favorites** strip (click ☆ next to a tool to pin it),
  - **12 tool categories** plus **Scripts** (your own script library): click a category to open its tool menu,
  - **User panels** (your own panels) and **Add New Item**.
  - When the panel is short and wide, it switches to a horizontal icon-only bar.
- **Dock**: in the menu of a category or user panel, click the Dock icon to open it in **MenMen Panel 1–4** (sub panels that dock like any AE panel).
- **Sub panels** show one category or one user panel, as a list or a grid.
  - Category panels: hide the tools you don't use; "Unhide all" brings them back temporarily.
  - User panels: drag to reorder, right-click to edit / delete items.
- **Layout view / Quick Panel**: sub panels can also show a compact grid of square cells (like a classic tool palette). Widgets work inline (the full Graph Editor across the top, Copy/Paste keys, 3×3 anchor grid, Offset Layers); other tools are icon tiles. In edit mode, drag cells to reorder and drag the corner to resize (or right-click ▸ Size). A ready-made **Quick Panel** opens in MenMen Panel 1; create more with ☰ ▸ New quick panel.
- **User panels** can hold: MenMen tools, Expressions, Scriptlets (ExtendScript), Script files (.jsx/.jsxbin), Presets (.ffx), Effects, Menu Commands, Dividers.
- **Tools with parameters** open a small form that remembers the last values. **Widgets** (Keyframe Assistant, Easing Presets, Easings Manager, Offset Layers, Set Anchor Point) open in a dialog.
- **Responsive**: below ~220px wide secondary labels hide; below ~130px the main panel becomes an icon column (search expands on click); short panels hide the help bar; Layout cells always fill the panel width; dialogs and the speed graph shrink to fit.
- **Diagnostics…** (☰ menu) checks the CEP ↔ ExtendScript connection step by step and gives a copyable report.
- **Settings**:
  - icon style: Mono / Color / Solid,
  - icon size: S / M / L,
  - tooltips on/off,
  - match the AE background, accent color,
  - Back up / Restore / Reset.
- Settings are saved to `<userData>/MenMenWorkflow/settings.json` and synced across all panels.

### 145 tools in 12 categories
| Category | Tools |
|---|---|
| Selection (23) | Select Nulls / 3D / Lights (Alt: cameras) / Precomps / Shape / Text / Audio / Guide / Adjustment, Inverse, Every Nth, Odd/Even, Above, Below, Children, Parents, Hierarchy, Random, At Frame, Matching Property, All Paths / Fills / Strokes |
| Layers (20) | Align & Distribute, Arrange Grid, Stare, Parent to Null, Parent to First / Above / Selection Order, Unparent, Offset Layers, Duplicate, Rename, Layer Colors, Lock All, Shy, Solo (Timeline), Visibility, Reset Transform, Trim, Set Anchor Point, Collect Colors |
| Keyframes (12) | Clone, Clone & Mirror, Align to Playhead / In-Out / Left-Right, Offset, Time-Reverse, Snap to Frames, Clean, Copy/Paste Values, Key Looper |
| Easing (6) | Graph Editor (value + speed graph), Easing Presets (Sine…Back × In/Out/InOut), Easings Manager, Copy/Paste Easing, Reverse Easing |
| Composition (13) | Auto Crop, Crop Comp to Layer, Trash Disabled, Auto Trim, Pre-Compose, Decompose, Duplicate Comps, Batch Comp Settings, Audio to Precomps, Spot Blur, Black/Gray/White BG |
| Project (6) | Project Cleanup, Organize Project, Folder Structure, Reveal Project Folder, Reveal Layer Source, Proxy Manager |
| Guides (11) | Guides Around / Center / Edge / Anchor, Grid System, Clear, Copy, Paste, Show/Hide, Lock, Snap |
| View (6) | Zoom 100% / 50%, Solo (Viewer), Rulers, Grid, Save Screenshot |
| Expression (7) | Expression Editor, Enable / Disable / Remove, Remove Broken, Bake, Find & Replace |
| Shapes (15) | Separate Shapes, Merge, Null Controllers for Points, Shapes from Vector, Remove Artboards, Mask → Shape, Cap/Join Round/Miter/Bevel, Toggle Fill/Stroke, Reverse Path, Reset Shape Transforms, Rectangle / Circle Wizard, Trim Paths Controller |
| Text (5) | Find & Replace Text, Lorem Ipsum, Typewriter, Number Counter, Text Box Generator |
| Animation (20) | Orbit, Overshoot, Bounce, Wiggle, Spin, Auto Fader, Blinker, Stop Motion, Beat Switch Layers, Beat Markers, Metronome Click, Beat Counter, Metronome Controller, Area Opacity / Scale / Position / Rotation / Color, Bend / Limb Rig, Position Trace |

### Rigs
- **Area Effector** (Area Opacity / Scale / Position / Rotation / Color): an `Area Effector` null with Radius, Falloff, Invert Field and Show Field controls plus a dashed guide; layers react to their distance from it. Alt = new controller, Shift = remove the effect.
- **Spot Blur** (spot.Blur setup): `spot.Blur` adjustment layer with **Compound Blur** reading `blur.Map` (white feathered circles = sharp). Drag the `spot.Blur_01…` guide circles; `spot.Blur_Controller` holds Blur Amount, Spot Size, Feather, Invert and Show Spot Guides. Helper layers are shy and the comp hides shy layers.
- **Audio to Precomps** (Universal Audio style): the selected audio goes into one audio comp (`♪ <comp> Audio`, in the `MenMen Audio` folder), added to every precomp inside the current comp, at any depth, as a **locked guide layer with audio on**, offset to play in sync. Guide layers are heard in previews but never rendered from a parent comp. Run it again to refresh the audio everywhere (new precomps get it too). Alt = also every other comp in the project; Shift = remove all shared audio. Precomps with time remap/stretch are skipped.

### MenMen Tools (Panel 1)
`Window ▸ Extensions ▸ MenMen Tools` is the main tool panel, kept apart from user panels (its own row in the main panel; right-click ▸ **Reset to default layout**). Default layout, top to bottom:
- **Disk cache** meter (% of the max size set in Preferences ▸ Media & Disk Cache; click to refresh) + **Purge** (all memory caches; Alt = also empty the disk cache, AE asks to confirm).
- **Graph Editor** (full), **Quick Access** (10 most used tools).
- **Add** row: Solid (Alt: pick color), Adjustment, Null, Camera (Alt: with a 3D control null), Light, Text, Shape (Alt: empty) - added above the selected layer.
- **Align** row: **To: Comp / To: Sel** switch + align left / center / right / top / middle / bottom.
- **Split** row: the first box shows **By: Line / Word / Char** (pick with the three buttons); select a point text layer and click **Split** to get one layer per line / word / character, each exactly where it was (anchor centered; Alt = anchor on the baseline). The original is hidden. Paragraph (box) text must be converted to point text first.
- Easings copy/paste, Offset Layers, anchor grid and one-click tools.

### Export PNG / GIF
- **Export PNG** (View ▸ Export PNG, also in MenMen Tools): saves the frame shown in the viewer at comp resolution; asks where to save (Alt = reveal the folder).
- **Export GIF** (View ▸ Export GIF): renders the work area (or whole comp) and encodes it in the panel with an encoder tuned for small files:
  - one global palette from **Xiaolin Wu's color quantizer** (sampled across all frames);
  - **inter-frame delta**: pixels that did not change (within *Tolerance*) become transparent, so LZW compresses them to almost nothing;
  - every frame is **cropped** to the area that changed; identical frames are **merged** into a longer delay;
  - optional serpentine **Floyd-Steinberg dithering** (smoother gradients, bigger file);
  - exact timing (centisecond delays with carry), looping via NETSCAPE2.0.
  - Presets: **High** (800 px, 30 fps, 256 colors, dither), **Balanced** (640 px, 25 fps, 128 colors, light dither), **Small** (480 px, 15 fps, 64 colors), **Tiny** (320 px, 12 fps, 32 colors); every field can be changed (custom).
  - On a test animation the delta encoding is 10-38x smaller than writing full frames, and matches or beats ffmpeg's palettegen/paletteuse (diff mode) at the same settings.

### AE native look
Settings ▸ Appearance ▸ **AE native look**: every icon becomes AE's neutral gray, no category colors and no colored button backgrounds (selection = a lighter gray, like AE). Surfaces are stepped from AE's own panel color, the font is AE's UI font and highlights use AE's highlight color, so the panels blend in with the rest of After Effects (light and dark brightness both work).

### Quick Access
The Quick Panel has a **Quick Access** area under the Graph Editor that fills itself with your **10 most used tools** (by run count, then most recent). Every run counts: clicks in any panel, search, favorites, widgets. Tiles reorder after you move the mouse away, so they never jump under the cursor. Right-click a tile: **Pin to this panel** / **Remove from Quick Access**; right-click the area: **Reset usage counts** / **Delete this area**. Add it to any user panel with Add New Item ▸ Quick Access. Tools already shown as inline widgets in that panel are left out.

### Main panel + Panel 1
Opening either the main panel (**MenMen Workflow**) or **MenMen Tools** opens the other one too (Settings ▸ Panels to turn it off). The main panel has two modes, switched with the button next to ☰ (or ☰ ▸ Icons only): **icons + names**, or **icons only**, a thin column that saves workspace; hover an icon to see its name. The content always follows the panel frame: drag the panel edge narrow once (down to ~40 px) and After Effects keeps that width in your workspace. Extensions cannot resize a docked panel themselves.

### Graph Editor
Easing ▸ **Graph Editor** (also full width at the top of MenMen Tools) edits one ease between two keyframes.
- **Value** view: the bezier value curve with its two handles. Grab a handle (no jump) or click the graph to move the nearest one; pull it past the top/bottom for overshoot (the view grows). Shift = lock axis, Ctrl/Cmd = fine, Alt or **Link** = mirrored handles, soft snap to flat ease; arrows nudge, Tab switches handle.
- **Speed** view: AE-style speed curve with both keys on the baseline and no handles: **drag the curve itself** - sideways moves the speed peak, up/down makes the ease stronger/softer (a drag here makes the curve a pure ease). Shift = one axis, Ctrl/Cmd = fine, Alt or Link = symmetric.
- In both views the drag continues anywhere in the panel (it ends on release or when the pointer leaves the panel); double-click resets. Switching views never changes the curve.
- Detail strip: **[Out ›]** and **[‹ In]** influence boxes (drag sideways to scrub, click to type, arrows +1 / Shift +10 / Alt −); **Apply / In / Out / Linear / Hold** buttons at the bottom.
- **Auto** (on by default): every release, typed value, scrub or preset is applied to the selected keys at once; a small "Applied" note shows in the graph (no popup; "Select keyframes to apply" if none are selected).
- Type or paste `cubic-bezier(x1, y1, x2, y2)`; **Read** loads the curve from the selected keyframes; built-in and saved curves (**+** saves, right-click deletes).

### Metronome
One `Metronome` null drives the beat tools (BPM, Beats per Bar, Start Time, Mode, Beats/Frames per Step, Step, Random Order):
- **Beat Switch Layers**: the selected layers take turns being visible, one per step, by BPM, every N frames, at the Metronome's markers or by keyframing its Step slider. The layers can be used as track-matte sources. Shift removes the switching.
- **Beat Markers**: `bar.beat` markers across the work area (Alt: bars only, Shift: clear).
- **Metronome Click**: an audible click track (Tone effect) with accented downbeats.
- **Beat Counter**: a text layer showing `BAR n  BEAT m`.

### Script library
Every `.jsx`, `.jsxbin` and `.ffx` file in `library/` (inside the extension) or in `Documents/MenMen Workflow/Scripts` appears in the **Scripts** category. Scripts can be favorited, searched, docked and added to user panels like built-in tools; `.ffx` presets are applied to the selected layers. Use the folder and refresh icons in the Scripts header after adding files. Files in `library/` are git-ignored so third-party scripts are not published with this repo.

Expression-driven tools add sliders so you can tweak them later (Wiggle Freq/Amp, Spin, Fade, Counter…). Hold **Alt / Shift / Ctrl** while clicking for alternate modes; the small A/S/C letters next to a tool name show which modes it has.

## Development setup

1. Clone the repo on a machine with After Effects.
2. Run the install script:
   - macOS:
     ```bash
     bash scripts/install-dev-mac.sh
     ```
   - Windows (PowerShell):
     ```powershell
     powershell -ExecutionPolicy Bypass -File scripts\install-dev-win.ps1
     ```
   The script enables `PlayerDebugMode` (allows unsigned extensions) and links the project folder into `CEP/extensions`.
3. Restart After Effects → `Window ▸ Extensions ▸ MenMen Workflow` (main panel). `MenMen Tools` opens with it; extra sub panels are under `MenMen Panel 2–4`.
4. Debugging: open Chrome at `http://localhost:8090` (main panel); sub panels 1–4 use ports 8091–8094 (see `.debug`).
5. After editing files in `host/`: menu ☰ ▸ **Reload host scripts**. After editing `client/`: close and reopen the panel (or press F5 in DevTools).

**Preview the UI without AE:** open `client/index.html` in Chrome (`?panel=main` or `?panel=1…4`). The bridge runs in mock mode and tools are simulated.

## Structure

```
CSXS/manifest.xml      main panel + 4 sub panels, AE 22.0+, CSXS 9.0
client/                panel UI (plain HTML/CSS/JS, no build step)
  js/bridge.js         evalScript, events, file system (window.__adobe_cep__ / window.cep.fs)
  js/tools.js          12 categories + 126 tools (name, icon, description, modifiers, parameters)
  js/store.js          favorites, user panels, sub panel slots, parameters; file storage + sync
  js/widgets.js        Keyframe Assistant, Easing Presets, Easings Manager, Offset Layers, Set Anchor
  js/ui.js             menu, dialog, toast
  js/app.js            main panel, category sheets, docking, sub panels, add item, settings
host/                  ExtendScript (ES3)
  main.jsx             MMW.load() loads the modules
  lib/core.jsx         MMW.run (undo group + "OK|"/"ERR|"), keyframe/expression helpers
  lib/*.jsx            tools by category
library/               your script library (git-ignored, see library/README.md)
scripts/               dev install scripts
```

## Adding a tool

1. Write a function in `host/lib/<category>.jsx`:
   ```js
   T.myTool = function (o) {          // o = { alt, shift, ctrl, ...params }
       var c = MMW.comp(), layers = MMW.selLayers(c);
       // ...
       return "Message shown in the toast";   // errors: MMW.fail("…")
   };
   ```
2. Register it in `client/js/tools.js` (`cat` is one of the 12 categories; optional `params` create a form):
   ```js
   { id: 'myTool', name: 'My Tool', cat: 'layers', desc: '…', mods: { alt: '…' },
     params: [P.num('count', 'Count', 3)] }
   ```
3. Optionally add a 24×24 SVG icon to the `I` object in `tools.js`.

## Packaging a ZXP

Use [ZXPSignCmd](https://github.com/Adobe-CEP/CEP-Resources/tree/master/ZXPSignCMD):

```bash
ZXPSignCmd -selfSignedCert VN HN MenMen "MenMen Workflow" <password> cert.p12
```

```bash
ZXPSignCmd -sign menmen-workflow dist/MenMenWorkflow.zxp cert.p12 <password> -tsa http://timestamp.digicert.com
```

(Run from the project's parent folder. Never commit the `.p12` file.)

## Known limitations

- Merge Shapes / Null Controllers for Points convert group transforms statically (2D). Paths inside groups with non-default transforms may be offset.
- Decompose ignores the precomp layer's Time Remap, effects and opacity.
- Remove Artboards detects artboards by group names containing "Artboard".
- Proxy Manager uses the "High Quality with Alpha"/"Lossless with Alpha" templates (English names); other AE languages fall back to the default template.
- Viewer zoom and Show/Hide Guides/Rulers/Grid use English menu command names; non-English AE may report the command as not found.
- There are only 4 sub panel slots (CEP needs the panel count declared in the manifest).

## Roadmap

- Keyboard shortcuts for tools (via the AE Scripts folder); search effects and scripts in user folders.
- Custom SVG icons for user panel items.
- Code editor (Monaco) + expression library, synced with external editors.
- Theme library, vector icons, Rive animations for cells.
- Widgets: Collect Palette, easing presets with a Speed Graph, Visualize Easings.
- GIF export (ffmpeg), social media format manager (comps + safe zones).
- Share Center: selective export/import of layouts, scripts, expressions.

# Changelog

All notable changes to MenMen Workflow. Versions follow `version.json`; the **Update** button in MenMen Tools offers a new version to everyone once `version` there is raised.

---

## 0.8.1 – FX Search pops up at the mouse

**Changed**
- **FX Search** now pops up **right under the mouse pointer**, like FX Console: a compact box with no title bar and no dimmed background, kept inside the panel.
  - It opens with the shortcut or *Open FX Search*.
  - The search field sits where the pointer is, ready to type.
  - Click outside or press **Esc** to close it.
- The floating window and global shortcut script from 0.8.0 are removed. FX Search stays a popup inside the MenMen panels.

## 0.7.2 – Quick Access counts tools from every panel

**Fixed**
- **Quick Access** lost runs made in other panels. Each panel wrote the whole settings file, so when MenMen Tools saved anything (a graph change, its own run count) shortly after a tool was used in the main panel or a sub panel, that run was overwritten.
- Now each panel adds its own runs to the counts already on disk, so tools used in **any** MenMen panel count.
- In a test with runs in the main panel and in MenMen Tools at the same moment, both are counted. Before, only the MenMen Tools runs survived.

## 0.7.1 – FX Search settings

**Changed**
- **Clicking FX Search** opens its **settings**. The search itself opens with the shortcut:
  - **Shortcut**: Ctrl + Space (default), Shift + Space, Ctrl + Tab, Shift + Tab, or **Custom**. For Custom, click the field and press the keys (a modifier or an F key is required).
  - **Search in**: Effects, Presets & scripts, MenMen tools; each can be turned off.
  - **Enter applies effects to**: the selected layers (Shift = a new adjustment layer), or the other way round.
  - Buttons: **Open FX Search**, **Reload effects**, **Clear Recent**.
- The shortcut works in every MenMen panel that has the focus. After Effects does not give panels global shortcuts.

## 0.7.0 – FX Search

**Added**
- **FX Search** (View; also in MenMen Tools after Depth Map): one search box for **every installed effect** (third-party plugins included), your **presets / scripts** in the library and all **MenMen tools**.
  - Type a few letters (`gaus`, `turb disp`, `glow`): effects come first, words can be in any order.
  - **Enter** applies the effect to the selected layers. With no layer selected, it goes on a new adjustment layer.
  - **Shift+Enter** always puts the effect on a new adjustment layer above the selection.
  - **Ctrl/Cmd+Enter** applies the effect and keeps the search open.
  - Tools, presets and scripts run as if clicked; a tool with options opens its dialog.
  - **★ Favorites** and **Recent** show up as soon as the search opens.
  - The applied effect is selected, so Effect Controls shows it.
  - **Shortcut:** **Ctrl+Space** while a MenMen panel has the focus.
- The effect list is read once and remembered. The reload button reads it again after you install new plugins.

## 0.6.4 – Layers stay selected

**Fixed**
- **Align / Distribute** (and other tools that measure layers, like Arrange Grid, Crop Comp to Layer and the Area Effector placement) no longer deselect your layers. They briefly add a hidden helper layer, which used to take the selection; the selection is now restored, so you can click several align buttons in a row.

## 0.6.3 – Update asks for administrator permission on Windows

**Changed**
- **Update** on Windows when the plugin is installed for all users (`C:\Program Files (x86)\Common Files\Adobe\CEP\extensions`): instead of stopping with *"The extension folder is read-only"*, it runs the update with administrator rights.
  - Windows shows its **User Account Control** prompt. Click **Yes** and the update runs as usual.
  - Click **No** and the dialog says permission was not given, then offers *Try again*.
  - The update dialog tells you beforehand that Windows will ask.
- macOS installs for all users still need a manual update, or moving the plugin to the user extensions folder.

## 0.6.2 – Field Shape: Circle and Ring only

**Changed**
- **Field Shape** keeps only **Circle** and **Ring**; Ellipse, Box and Linear Band are removed, and so is the *Field Aspect %* slider.
- **Controllers from 0.6.0** are converted the next time an Area tool uses them:
  - the menu is rebuilt, and a controller set to Ring stays Ring (any other shape becomes Circle);
  - the expressions on the layers it drives are updated, so they keep working;
  - the field guide is drawn again.

## 0.6.1 – Update removes old files

**Changed**
- **Update** now mirrors the extension folder: files the new version no longer has are deleted, so nothing piles up over many updates.
  - Kept: `library/` (your scripts) and `presets/` (your presets). They only receive the new version's files; nothing in them is deleted.
  - Settings and downloaded models live outside the extension folder and are not affected.
- Tools: macOS uses `rsync --delete` with those folders protected. Windows uses `robocopy /MIR`, plus a plain copy into those folders.
- A git checkout still updates with `git pull`.

## 0.6.0 – Field Shape for the whole Area Effector set

**Added**
- **Field Shape** menu on every Area Effector controller. It applies to Area Opacity / Scale / Position / Rotation / Color and Area Text Effector.

  | Shape | Full effect | Controls |
  |---|---|---|
  | **Circle** | inside *Radius* (as before) | – |
  | **Ellipse** | inside an ellipse | *Field Aspect %* sets the height against the width |
  | **Box** | inside a rectangle | *Radius* is the half-width; *Field Aspect %* sets the height |
  | **Linear Band** | inside a straight band across the comp | *Radius* is the half-thickness; ideal for wipes through a line of text |
  | **Ring** | only on a ring around *Radius* | *Ring Width* sets the ring's thickness |

  - *Falloff* softens the edge of every shape.
- **Rotate or scale the controller** to turn or stretch the field, for example a diagonal band or a tilted ellipse.
- **The field guide** draws the chosen shape (full-effect edge and falloff edge) and turns and stretches with the controller.
- **Existing controllers**: they get the new controls the next time an Area tool uses them, and their guide is redrawn. Layers set up before keep the circle field until you apply the tool to them again.

## 0.5.3 – Area Text Effector: italic

**Added**
- **Area Text Effector** on a variable font with an **Italic** axis (`ital`) gets a **Text Italic** slider.
  - Its default is the font's italic end, usually 1; 0 is upright.
  - The letters the effector passes over turn italic.
- Effectors made with an older version get it when you click the tool again on the text.

## 0.5.2 – Area Text Effector: width and slant

**Added**
- **Area Text Effector** on a variable font also drives the **Width** (`wdth`) and **Slant** (`slnt`) axes, alongside Weight.
  - The effector gets **Text Width** and **Text Slant** sliders, each limited to the font's own range.
  - Defaults: Width = the font's widest, Slant = the font's most slanted.
  - Only the axes the font really has are added.
- Effectors made with an older version get the new axes when you click the tool again on the text.

## 0.5.1 – Area Text Effector: variable font weight

**Added**
- **Area Text Effector** on a **variable font** with a Weight axis: the effector gets a **Text Weight** slider, and the letters it passes over animate to that weight, limited to the font's own range.
  - Its default is the font's heaviest weight.
  - Needs After Effects 2024 or later.
  - Effectors made with 0.5.0 get the Weight axis when you click the tool again on the text.

**Fixed**
- Layer and animator names with special characters (Audio to Precomps, Area Text Effector) are written with escapes, so they appear correctly whatever the system text encoding.

## 0.5.0 – Area Text Effector

**Added**
- **Area Text Effector** (Animation, in the Area Effector set): the letters of a text layer animate when an effector passes over them, then settle again behind it.
  - **Effector**: select a layer together with the text (a cursor, a shape, anything) and that layer becomes the effector. Otherwise the comp's *Area Effector* null is used, or created.
  - **Field**: *Radius* is full effect, it fades out over *Falloff*. *Text Strength %* and *Invert Field* control the amount. The dashed field guide shows the area.
  - **Effects** (sliders on the effector): Text Offset X / Y, Text Scale %, Text Rotation, Text Opacity %, Text Blur, Text Tracking, and Text Color with *Text Use Color*.
  - **Alt** adds a new effector, stacked on the same text. **Shift** removes the Area Text Effector animators.
  - **After editing the text**, click the tool again to refresh the letter positions.
  - The positions are measured once per letter, because expressions cannot read where a letter is. Point text is measured exactly. Box text is measured on its hard line breaks.

## 0.4.18 – Performance

**Changed**
- **Export GIF**
  - After Effects renders the **next frame while the panel reads the current one**. In a test with 60 frames, the render phase went from about 21 s to about 15 s.
  - The status shows the time left.
  - **Encoding runs in the background** (Web Worker), so the panel keeps responding and **Cancel** works during encoding. Before, a 60-frame export froze the panel for 1.5–6 s.
  - Frames are handed to the encoder without copying, which saves memory on big exports.
- **Depth Map / Export GIF**: a rendered frame is picked up sooner. The panel checks quickly at first, then less often.
- **All panels**: the ONNX Runtime library is no longer loaded at every panel start, only when Depth Map needs it on the panel thread.

## 0.4.17 – Export GIF never refuses a big comp

**Fixed**
- **Export GIF**: a long or large export (for example a 4K comp at *Comp size*) disabled the Export button, and clicking it did nothing.
  - The GIF is now scaled down just enough to fit in memory, and the summary line says *(scaled down to fit in memory)*.
  - Example: 60 frames of a 3840×2160 comp export at 2108×1186.

## 0.4.16 – Export GIF works again

**Fixed**
- **Export GIF** failed on newer After Effects versions. Those versions write a rendered frame only after the script returns, so the render step always timed out.
  - Now AE starts each frame render, and the panel waits until AE reports the PNG complete before reading it.
  - Temporary frames go next to the GIF instead of the system temp folder.
- **Depth Map**: frames and image files are read through the extension's file access again.
  - Since 0.4.3 they were loaded as `file://` images. Chromium treats those as foreign, so the canvas could not read their pixels ("tainted canvas").

## 0.4.15 – Align icons like After Effects

**Changed**
- **Align / Distribute icons** in MenMen Tools (and in Align & Distribute) are drawn like After Effects' Align panel: a thin guide line plus solid layer bars, easier to read at small sizes.

## 0.4.14 – Distribute row

**Added**
- **MenMen Tools**: a **Distribute** row under the Align row with After Effects' six *Distribute Layers* buttons:
  - top edges, vertical centers, bottom edges,
  - left edges, horizontal centers, right edges.
- Select 3 or more layers: the first and last layer stay in place and the chosen edge or center of the others is spaced evenly between them.
- Existing MenMen Tools layouts get the row once, right under Align.

**Changed**
- **MenMen Tools**: the Graph Editor no longer shows the row of preset curves (still in the expanded Graph Editor).
- **Path Visualizer**: shorter tool description.

## 0.4.13 – Path Visualizer runs at once

**Changed**
- **Path Visualizer** no longer opens a settings dialog. One click creates the overlay with the V2.1 defaults:
  - **Vertex**: white, size 20, Square
  - **Handle**: #FF4444, size 6, Circle
  - **Line**: #FF4444, width 1.5
- Everything is adjusted in **Effect Controls** afterwards.
- **Alt (Update Path)** keeps the colors, sizes, shapes and switches already set in Effect Controls. It used to reset them.

## 0.4.12 – Path Visualizer: shape menus fixed

**Fixed**
- **Path Visualizer**: the shape menus were added as "Dropdown Menu Control" / "Dropdown Menu Control 2" instead of **Vertex Shape** / **Handle Shape**. Changing them did nothing, and the dot expressions reported errors. The menus now get their names.
- **Alt (Update Path)** on an overlay made with 0.4.11 removes the unnamed menus and adds the named ones.

## 0.4.11 – Path Visualizer: shape menus

**Added**
- **Path Visualizer**: Effect Controls of a `PATH_OVERLAY_` layer have **Vertex Shape** and **Handle Shape** menus (Square / Circle / Diamond). Changing them reshapes the dots right away, with no rebuild.
  - The shapes chosen in the tool dialog become the menus' starting values.
  - Overlays made with an older version get the menus after **Alt (Update Path)**.

## 0.4.10 – Path Visualizer: original V2.1 code

**Changed**
- **Path Visualizer** now runs the original *Path Visualizer V2.1* code by Sheikh Sohel, unchanged. Only its ScriptUI panel is replaced by the MenMen tool dialog: vertex, handle and line colors, sizes and shapes.
  - Click = **Create Path**, Alt = **Update Path**, Shift = **Cleanup All Paths**.
  - The `PATH_OVERLAY_` layers and Effect Controls are the same as in the standalone script.
- The rewrite from 0.4.9 is removed.

## 0.4.9 – Path Visualizer

**Added**
- **Path Visualizer** (Shapes): a live overlay that draws the **vertices**, **bezier handles** and **handle lines** of the selected layers' paths, for tutorials and design breakdowns.
  - Works on **shape layers** (every Path shape, at any group depth) and on **masks** of any layer.
  - The overlay follows the source's animation and parenting, and copies its opacity and in/out points.
  - Animated paths whose point count changes get enough dots for their largest shape; the extra dots hide while not needed.
  - Handles and handle lines are hidden on **corner points**, where there is no handle to show.
  - **Effect Controls** on the overlay: Vertex / Handle / Line color, Vertex / Handle size, Line width, Show Vertices / Handles / Lines, and *Scale With Layer* (the dots follow the source's scale).
  - Options when creating: vertex and handle shape (square, circle, diamond) and **Show in render**. Turning it off makes the overlay a guide layer: visible while you work, not rendered.
  - **Alt** rebuilds the selected overlays from their source and keeps your Effect Controls settings. Use it after adding points.
  - **Shift** removes every path overlay in the comp (can be undone).

## 0.4.8 – Audio to Precomps plays again

**Fixed**
- **Audio to Precomps**: precomps were silent. The audio was shared as a nested `♪ … Audio` comp used as a guide layer, which After Effects did not play.
  - The selected audio layers themselves are now copied into every precomp, as locked guide layers with audio on, shifted to play in sync.
  - You hear them while working inside a precomp. They are never rendered from a parent comp, so the sound does not double.
  - Running it again replaces the copies. Setups from the previous version, including the old `♪ … Audio` comps, are cleaned up automatically.

## 0.4.7 – Spot Blur reads the blur map correctly

**Fixed**
- **Spot Blur**: Compound Blur could see `blur.Map` as a plain white solid (its *Blur Layer* menu was on *Source*, which ignores masks), so the whole frame blurred the same.
  - By default `blur.Map` is a **precomp** again: a precomp's *Source* already contains the masked circles, so the map works without any extra step.
  - If `presets/Compound Blur (Effects & Masks).ffx` is installed, Spot Blur applies it instead: Compound Blur is set to **Effects & Masks** and `blur.Map` is a masked solid right in the comp (no precomp).
  - Scripts cannot switch that menu themselves, which is why the preset is needed. How to make it: see `presets/README.md`.
- Spot Blur setups made with an older version are not changed: delete them and run Spot Blur again.

## 0.4.6 – Spot Blur map rebuilt

**Changed**
- **Spot Blur**: `blur.Map` is a white solid with **one feathered round mask per spot** (mode Add).
  - Each mask follows its `spot.Blur_0x` guide by expression.
  - The mask size comes from **Spot Size** and the softness from **Feather**, both on `spot.Blur_Controller`.
- The controller and its settings are unchanged: Blur Amount, Spot Size, Feather, Invert, Show Spot Guides.

## 0.4.5 – Version box

**Added**
- The installed version (for example `v0.4.5`) is shown in a box left of the **Update** button in the Contact row.

## 0.4.4 – Faster depth maps for video

**Added**
- **Depth Map → Whole layer** works on several frames at once, one CPU core each.
  - Up to 4 frames at a time with the *Fast* model, 2 with *Best*.
  - After Effects renders the next frames while the model works.
  - Results are still saved in frame order, so the flicker smoothing between frames keeps working.
  - Test result: 50 frames at *Low* took 59 s instead of about 175 s on a 4-core machine.
- The status line shows progress, for example `13 / 50 frames done (3 at once, 51 s left)`.

## 0.4.3 – Depth Map reliability

**Fixed**
- Frames are read straight from disk instead of through huge text strings, which could stall on 4K footage.
- After Effects confirms each rendered frame is completely written before the panel reads it. A half-written PNG used to load as a cut-off image.
- **Still image layers** (jpg, png, webp, bmp, gif) are read directly from their file, with no render in After Effects.
- Temporary frames are written next to the output folder instead of the macOS system temp folder.
- If After Effects writes no frame within 60 s, the run stops with a clear message instead of waiting forever.

## 0.4.2 – Depth Map no longer freezes the panel

**Changed**
- The depth model runs in the **background** (a Web Worker), so the panel keeps responding.
  - A frame at *High* detail can take about 30 s, and the panel used to look frozen during it.
  - If the background worker cannot start, the model runs in the panel as before.
- Each step is shown with a live seconds counter:
  - `After Effects renders it`
  - `depth model`
  - `saving`
- **Cancel** stops immediately, even in the middle of a frame.
- Choosing *High* detail adds a note that it takes about 3× longer than *Normal*.

## 0.4.1 – Update button look

**Changed**
- **Update** is a labelled button styled like **Purge**: the word *Update* plus a download arrow.
- A **red dot** in its corner means a newer version is waiting.

**Fixed**
- **Depth Map**: newer After Effects versions write a rendered frame only after the script finishes. The panel now waits for the file there, instead of failing with *"After Effects did not write …"*.

## 0.4.0 – Updates and Depth Map

**Added**
- **Update button** in the Contact row of MenMen Tools.
  - When After Effects starts, one panel checks GitHub for a newer version. If there is one, it asks **Later / Update now** and lists what changed.
  - The button also checks on demand.
  - Updating downloads the latest version and copies it over the installed extension. Files are only added or replaced, so these are kept:
    - your scripts in `library/` and `Documents/MenMen Workflow/Scripts`,
    - your settings,
    - downloaded depth models.
  - A git checkout is updated with `git pull --ff-only`.
  - The panels reload afterwards. Restart After Effects if a new version adds panels.
  - An extension installed for all users (read-only folder) cannot update itself and says so.
- **Depth Map** (Depth Anything V2 Small, runs on this computer). Select one layer, choose a range and click **Generate Depth Map**:
  - **First frame**, **Current frame** or **Whole layer** (a PNG sequence).
  - **Model**: *Fast* (27 MB) or *Best* (99 MB), downloaded once, then used offline.
  - **Detail**: *Low* / *Normal* / *High* (model input 364 / 518 / 742 px). Lower is faster, and the output is always at full source size.
  - **Invert**: near = black instead of white.
  - The depth map is imported **right above the layer**:
    - **footage / precomp layers**: parented to the layer so it follows its animation;
    - **text / shape layers**: the comp is rendered with that layer soloed.
  - Files are saved in a `MenMen Depth` folder next to the project (Desktop if the project is unsaved) and appear in a *MenMen Depth* folder in the Project panel.
- **Timer**: the Pomodoro loop keeps its rhythm.
  - Each phase starts exactly when the previous one ends.
  - Phases that ended while the panel was hidden or closed are caught up.
  - To loop continuously, turn on both *Auto Start Breaks* and *Auto Start Pomodoros*.

---

### Publishing a new version
1. Push the changes to `main`.
2. Raise `version` in `version.json` and list the changes in `notes`, which appear in the update dialog.
3. Push again. Users get the update prompt the next time After Effects starts, or when they click **Update**.

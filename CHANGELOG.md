# Changelog

All notable changes to MenMen Workflow. Versions follow `version.json`; the **Update** button in MenMen Tools offers a new version to everyone once `version` there is raised.

---

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

/* tools.js - tool catalog in 12 categories.
 * Each tool: id, name, cat, desc, host (MMW.tools.* function, defaults to id), opts (fixed options),
 * mods (Alt/Shift/Ctrl descriptions), params (form shown before running), widget (custom UI), icon. */
(function () {
  var CATS = [
    { id: 'selection',   name: 'Selection',   color: '#8b7bff' },
    { id: 'layers',      name: 'Layers',      color: '#ff6b81' },
    { id: 'keyframes',   name: 'Keyframes',   color: '#ffc04d' },
    { id: 'easing',      name: 'Easing',      color: '#ff8f6b' },
    { id: 'composition', name: 'Composition', color: '#4cd98a' },
    { id: 'project',     name: 'Project',     color: '#f5a35c' },
    { id: 'guides',      name: 'Guides',      color: '#4fc8ff' },
    { id: 'view',        name: 'View',        color: '#e083ff' },
    { id: 'expression',  name: 'Expression',  color: '#c9e64a' },
    { id: 'shapes',      name: 'Shapes',      color: '#35d0b5' },
    { id: 'text',        name: 'Text',        color: '#5b9dff' },
    { id: 'animation',   name: 'Animation',   color: '#ffd166' },
    { id: 'scripts',     name: 'Scripts',     color: '#9aa4b2' }
  ];

  // 24x24 line icons (stroke = currentColor)
  var I = {
    // categories
    'cat-selection': '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M4 15v4a1 1 0 0 0 1 1h4" stroke-dasharray="2.2 2.2"/><path d="M13 13l8 3-3.5 1.5L16 21z"/>',
    'cat-layers': '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17.5l9 5 9-5" opacity=".55"/>',
    'cat-keyframes': '<path d="M12 4l6 8-6 8-6-8z"/><path d="M2 12h2M20 12h2"/>',
    'cat-easing': '<path d="M3 20c9 0 9-16 18-16"/><circle cx="3" cy="20" r="1.6"/><circle cx="21" cy="4" r="1.6"/><path d="M3 20h6M21 4h-6" opacity=".55"/>',
    'cat-composition': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 5v4M12 5v4M17 5v4"/><path d="M10.5 12.5v4l3.5-2z"/>',
    'cat-project': '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    'cat-guides': '<path d="M7 3v18M17 3v18M3 7h18M3 17h18" opacity=".9"/><rect x="7" y="7" width="10" height="10" stroke-dasharray="2 2"/>',
    'cat-view': '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    'cat-expression': '<path d="M9 4c-3 0-3 3-3 5s-2 3-3 3c1 0 3 1 3 3s0 5 3 5M15 4c3 0 3 3 3 5s2 3 3 3c-1 0-3 1-3 3s0 5-3 5"/>',
    'cat-shapes': '<circle cx="7.5" cy="7.5" r="4"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M17 3l4 7h-8z"/><path d="M3 21l4-7 4 7z" opacity=".55"/>',
    'cat-text': '<path d="M4 6V4h16v2M12 4v16M9 20h6"/>',
    'cat-scripts': '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M10.5 11l-2 2.5 2 2.5M14.5 11l2 2.5-2 2.5"/>',
    'cat-animation': '<path d="M3 18c4 0 5-12 9-12s5 8 9 8" /><circle cx="21" cy="14" r="1.8"/><path d="M3 21h4" opacity=".55"/>',
    // tool
    quickAccess: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
    user: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 13h4M8 16h7"/>',
    cropComp: '<path d="M6 2v16h16"/><path d="M2 6h16v16"/>',
    compDuplicator: '<rect x="3" y="7" width="11" height="11" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5"/>',
    unPreComp: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 12h9M15 9l3 3-3 3"/><path d="M8 8v8"/>',
    preCompose: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M18 12H9M12 9l-3 3 3 3"/><path d="M16 8v8"/>',
    easyKeyframes: '<path d="M3 19C9 19 9 5 21 5"/><path d="M12 9l3 3-3 3-3-3z"/>',
    clone: '<path d="M7 9l3 3-3 3-3-3z"/><path d="M17 9l3 3-3 3-3-3z"/><path d="M11 12h2"/>',
    easings: '<path d="M3 20C10 20 14 4 21 4"/><circle cx="3" cy="20" r="1.5"/><circle cx="21" cy="4" r="1.5"/>',
    fixKeysTime: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
    loop: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    elastic: '<path d="M2 12h4l2-6 3 12 3-9 2 5 2-2h4"/>',
    bounce: '<path d="M3 4c2 0 3 16 5 16s3-10 5-10 2 10 4 10 2-5 4-5"/>',
    extractShapes: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M14 4h6v6M10 20H4v-6"/>',
    mergeShapes: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
    nullsToPoint: '<path d="M4 18C8 4 16 20 20 6"/><rect x="2" y="16" width="4" height="4"/><rect x="18" y="4" width="4" height="4"/><rect x="10" y="10" width="4" height="4"/>',
    selector: '<path d="M5 3l14 8-6 2-3 6z"/>',
    shapesFromVector: '<path d="M12 3l9 16H3z"/><circle cx="12" cy="3" r="1.5"/><circle cx="21" cy="19" r="1.5"/><circle cx="3" cy="19" r="1.5"/>',
    removeArtboards: '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/><path d="M9 9l6 6M15 9l-6 6"/>',
    createLimb: '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="M5 16C5 4 19 4 19 16"/>',
    positionTrace: '<path d="M3 19c3-1 4-8 8-8s4 6 10-6" stroke-dasharray="2 2.5"/><circle cx="21" cy="5" r="2"/>',
    addNull: '<rect x="4" y="4" width="16" height="16"/><path d="M4 4l16 16M20 4L4 20"/>',
    getColors: '<circle cx="8" cy="9" r="4"/><circle cx="16" cy="9" r="4"/><circle cx="12" cy="16" r="4"/>',
    moveAnchor: '<circle cx="12" cy="12" r="3"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
    sequencer: '<path d="M3 5h6M6 10h6M9 15h6M12 20h6"/>',
    simpleProxy: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    parent: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8.5 8.5l7 7"/>',
    rename: '<path d="M4 7V5h11v2M9.5 5v14M7 19h5"/><path d="M15 13h6M18 10v9" />',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    trim: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1L20 20M8.1 15.9L20 4"/>',
    duplicate: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
    align: '<path d="M4 3v18"/><rect x="7" y="6" width="12" height="4" rx="1"/><rect x="7" y="14" width="8" height="4" rx="1"/>',
    reverse: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
    clean: '<path d="M3 21l9-9M14 4l6 6-7 7-6-6z"/>',
    curvePreset: '<path d="M3 20c6 0 6-16 12-16h6"/><path d="M3 20h4"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>',
    reveal: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M10 14h5M13 11.5l2.5 2.5-2.5 2.5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    grid: '<path d="M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18"/>',
    zoom: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6M11 8v6"/>',
    toggle: '<rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="16" cy="12" r="3"/>',
    bake: '<path d="M4 20h16M6 16l3-8 3 5 3-9 3 12"/>',
    find: '<circle cx="10" cy="10" r="6"/><path d="M20 20l-5.5-5.5"/>',
    wiggle: '<path d="M2 12c2-6 4 6 6 0s4 6 6 0 4 6 6 0"/>',
    spin: '<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 3v4h-4"/>',
    fade: '<path d="M3 20L9 6h6l6 14"/><path d="M3 20h18" opacity=".5"/>',
    blink: '<path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/><circle cx="12" cy="12" r="3.5"/>',
    stopMotion: '<path d="M3 18h4v-4h4v-4h4V6h4"/>',
    cap: '<path d="M4 12h12"/><circle cx="17" cy="12" r="3"/><path d="M4 8v8" opacity=".5"/>',
    rect: '<rect x="3" y="6" width="18" height="12" rx="2"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    trimPath: '<path d="M4 18C4 9 12 4 20 6" stroke-dasharray="14 4"/><circle cx="20" cy="6" r="1.5"/>',
    mask: '<path d="M5 19L12 4l7 15z" stroke-dasharray="3 2"/><path d="M8 19h8"/>',
    typewriter: '<rect x="3" y="11" width="18" height="9" rx="2"/><path d="M7 11V5h10v6M7 15h2M11 15h2M15 15h2"/>',
    counter: '<path d="M5 9l3-3v12M12 8a2.5 2.5 0 0 1 5 0c0 2-5 4-5 10h5"/>',
    textBox: '<rect x="2" y="6" width="20" height="12" rx="3"/><path d="M7 10h10M12 10v5"/>',
    lorem: '<path d="M4 6h16M4 10h16M4 14h12M4 18h8"/>',
    script: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    command: '<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/>',
    effect: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    preset: '<path d="M4 4h10l6 6v10H4z"/><path d="M14 4v6h6M8 15l2.5-3 2 2 3.5-4"/>',
    divider: '<path d="M3 12h18"/>',
    metronome: '<path d="M8 21h8l-3-17h-2z"/><path d="M12 15l6-9"/><circle cx="18" cy="6" r="1.5"/>',
    alignIco: '<path d="M4 3v18"/><rect x="7" y="6" width="12" height="4"/><rect x="7" y="14" width="8" height="4"/>',
    arrange: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    stare: '<circle cx="6" cy="12" r="3"/><path d="M9 12h9M15 9l3 3-3 3"/><circle cx="20" cy="12" r="1.5"/>',
    orbit: '<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="9" ry="5"/><circle cx="20" cy="10" r="1.6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
        area: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="10" stroke-dasharray="2.5 2.5"/>',
    spotBlur: '<circle cx="9" cy="10" r="4"/><circle cx="16" cy="15" r="3"/><path d="M3 3h18v18H3z" stroke-dasharray="1.5 3"/>',
    audio: '<path d="M9 18V5l10-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'
  };

  var P = {
    num: function (key, label, def, extra) { return Object.assign({ key: key, label: label, type: 'number', def: def }, extra || {}); },
    text: function (key, label, def, extra) { return Object.assign({ key: key, label: label, type: 'text', def: def }, extra || {}); },
    area: function (key, label, def) { return { key: key, label: label, type: 'textarea', def: def }; },
    check: function (key, label, def) { return { key: key, label: label, type: 'check', def: !!def }; },
    select: function (key, label, def, options) { return { key: key, label: label, type: 'select', def: def, options: options }; }
  };

  var TOOLS = [
    // ---------------- Selection ----------------
    { id: 'selectNulls', name: 'Select Nulls', cat: 'selection', icon: 'addNull', desc: 'Selects all null layers in the comp.' },
    { id: 'select3D', name: 'Select 3D Layers', cat: 'selection', desc: 'Selects all 3D layers.' },
    { id: 'selectLights', name: 'Select Lights', cat: 'selection', desc: 'Selects all lights.', mods: { alt: 'Select cameras' } },
    { id: 'selectPrecomps', name: 'Select Precomps', cat: 'selection', desc: 'Selects all precomp layers.' },
    { id: 'selectShapeLayers', name: 'Select Shape Layers', cat: 'selection', icon: 'cat-shapes', desc: 'Selects all shape layers.' },
    { id: 'selectTextLayers', name: 'Select Text Layers', cat: 'selection', icon: 'cat-text', desc: 'Selects all text layers.' },
    { id: 'selectAudioLayers', name: 'Select Audio Layers', cat: 'selection', desc: 'Selects audio-only layers.' },
    { id: 'selectGuideLayers', name: 'Select Guide Layers', cat: 'selection', desc: 'Selects all guide layers.' },
    { id: 'selectAdjustment', name: 'Select Adjustment Layers', cat: 'selection', desc: 'Selects all adjustment layers.' },
    { id: 'inverseSelection', name: 'Inverse Selection', cat: 'selection', icon: 'reverse', desc: 'Inverts the layer selection.' },
    { id: 'selectEveryNth', name: 'Select Every Nth Layer', cat: 'selection', desc: 'Selects every Nth layer (within the selection or the whole comp).',
      params: [P.num('n', 'Every N layers', 2, { min: 1 }), P.num('offset', 'Start at layer #', 1, { min: 1 })] },
    { id: 'selectOddEven', name: 'Select Odd / Even', cat: 'selection', desc: 'Selects odd layers.', mods: { alt: 'Select even layers' } },
    { id: 'selectAbove', name: 'Select Layers Above', cat: 'selection', desc: 'Selects all layers above the selection.', mods: { alt: 'Include the selected layers' } },
    { id: 'selectBelow', name: 'Select Layers Below', cat: 'selection', desc: 'Selects all layers below the selection.', mods: { alt: 'Include the selected layers' } },
    { id: 'selectChildren', name: 'Select Child Layers', cat: 'selection', icon: 'parent', desc: 'Selects all child layers (every level).', mods: { alt: 'Include parent layers' } },
    { id: 'selectParents', name: 'Select Parent Layers', cat: 'selection', icon: 'parent', desc: 'Selects all parent layers (every level).', mods: { alt: 'Include child layers' } },
    { id: 'selectHierarchy', name: 'Select Hierarchy', cat: 'selection', icon: 'parent', desc: 'Selects the whole parent tree containing the selected layers.' },
    { id: 'randomSelect', name: 'Random Select', cat: 'selection', desc: 'Randomly selects a portion of the layers.',
      params: [P.num('percent', 'Selection ratio (%)', 50, { min: 0, max: 100 })] },
    { id: 'selectAtFrame', name: 'Select Layers at Frame', cat: 'selection', desc: 'Selects the layers visible at the playhead.' },
    { id: 'selectMatchingProperty', name: 'Select Matching Property', cat: 'selection', desc: 'Selects the same property (e.g. Position) on the selected layers.', mods: { alt: 'On all layers' } },
    { id: 'selectPaths', name: 'Select All Paths', cat: 'selection', host: 'selector', icon: 'selector', desc: 'Selects all Paths in the selected shape layers.' },
    { id: 'selectFills', name: 'Select All Fills', cat: 'selection', host: 'selector', opts: { alt: true }, icon: 'selector', desc: 'Selects all Fills in the selected shape layers.' },
    { id: 'selectStrokes', name: 'Select All Strokes', cat: 'selection', host: 'selector', opts: { shift: true }, icon: 'selector', desc: 'Selects all Strokes in the selected shape layers.' },

    // ---------------- Layers ----------------
    { id: 'addNull', name: 'Parent to Null', cat: 'layers', desc: 'Adds a parent null centered on the selected layers.', mods: { alt: 'Default null', shift: 'One null per layer' } },
    { id: 'parentToFirst', name: 'Parent to First Selected', cat: 'layers', icon: 'parent', desc: 'Parents the other layers to the first selected layer.' },
    { id: 'parentToAbove', name: 'Parent to Above Layer', cat: 'layers', icon: 'parent', desc: 'Parents each layer to the layer directly above it.' },
    { id: 'parentChain', name: 'Parent in Selection Order', cat: 'layers', icon: 'parent', desc: 'Creates a parent chain in selection order.' },
    { id: 'unparent', name: 'Unparent', cat: 'layers', icon: 'parent', desc: 'Removes the parent of the selected layers.' },
    { id: 'align', name: 'Align & Distribute', cat: 'layers', widget: 'align', icon: 'alignIco', desc: 'Align layers left / center / right / top / middle / bottom to the selection or the comp (one layer = comp), and distribute 3+ layers evenly.' },
    { id: 'arrangeGrid', name: 'Arrange Grid', cat: 'layers', icon: 'arrange', desc: 'Arranges the selected layers in a centered grid of equal cells (layer order).',
      params: [P.num('cols', 'Columns (0 = auto)', 0, { min: 0 }), P.num('gap', 'Gap (px)', 40)] },
    { id: 'stare', name: 'Stare', cat: 'layers', icon: 'stare', desc: 'Layers always rotate to face a target: the last selected layer, or a new Stare Target null. Their Rotation becomes an offset.', mods: { shift: 'Remove' } },
    { id: 'sequencer', name: 'Offset Layers', cat: 'layers', widget: 'sequencer', desc: 'Offsets layers or keyframes in sequence (down / up / random).' },
    { id: 'duplicateLayers', name: 'Duplicate Layers', cat: 'layers', icon: 'duplicate', desc: 'Duplicates layers several times.',
      params: [P.num('count', 'Copies', 3, { min: 1, max: 200 })] },
    { id: 'renameLayers', name: 'Rename Layers', cat: 'layers', icon: 'rename', desc: 'Batch rename: new name + number, find/replace, prefix/suffix.',
      params: [P.text('name', 'New name (empty = keep name)', ''), P.num('start', 'Start number', 1), P.text('find', 'Find', ''), P.text('replace', 'Replace with', ''),
        P.text('prefix', 'Prefix', ''), P.text('suffix', 'Suffix', '')] },
    { id: 'setLayerColors', name: 'Set Layer Colors', cat: 'layers', icon: 'palette', desc: 'Sets label colors by layer type / random / a single color.',
      params: [P.select('mode', 'Mode', 'type', [['type', 'By layer type'], ['random', 'Random'], ['1', 'Red'], ['2', 'Yellow'], ['3', 'Aqua'],
        ['4', 'Pink'], ['5', 'Lavender'], ['6', 'Peach'], ['7', 'Sea Foam'], ['8', 'Blue'], ['9', 'Green'], ['10', 'Purple'], ['11', 'Orange'],
        ['12', 'Brown'], ['13', 'Fuchsia'], ['14', 'Cyan'], ['15', 'Sandstone'], ['16', 'Dark Green'], ['0', 'None']])] },
    { id: 'lockToggle', name: 'Lock / Unlock All', cat: 'layers', icon: 'lock', desc: 'Locks or unlocks all layers.', mods: { alt: 'Selected layers only' } },
    { id: 'shyToggle', name: 'Shy Toggle', cat: 'layers', icon: 'eye', desc: 'Toggles shy on the selected layers.', mods: { alt: 'Toggle Hide Shy Layers' } },
    { id: 'soloTimeline', name: 'Solo Layers (Timeline)', cat: 'layers', icon: 'eye', desc: 'Shows only the selected layers in the timeline. Run again to show all.' },
    { id: 'toggleVisibility', name: 'Toggle Visibility', cat: 'layers', icon: 'eye', desc: 'Toggles visibility (eyeball) of the selected layers.' },
    { id: 'resetTransform', name: 'Reset Layer Transform', cat: 'layers', icon: 'reset', desc: 'Resets Position/Scale/Rotation/Opacity (removes keyframes).', mods: { alt: 'Keep Position' } },
    { id: 'trimLayers', name: 'Trim Layers', cat: 'layers', icon: 'trim', desc: 'Trims the Out point to the playhead.', mods: { alt: 'Trim In point', shift: 'Theo work area' } },
    { id: 'moveAnchor', name: 'Set Anchor Point', cat: 'layers', widget: 'moveAnchor', desc: 'Moves the anchor point to 9 positions without shifting the layer.', mods: { shift: 'Center cell: native command (3D)' } },
    { id: 'getColors', name: 'Collect Colors', cat: 'layers', desc: 'Collects all colors into one controller; identical colors are shared.' },

    // ---------------- Keyframes ----------------
    { id: 'clone', name: 'Clone Keys', cat: 'keyframes', desc: 'Copies the selected keyframes to the playhead.', mods: { alt: 'Select the new keys', shift: 'Reversed clone' } },
    { id: 'cloneMirror', name: 'Clone & Mirror Keys', cat: 'keyframes', host: 'clone', opts: { shift: true }, icon: 'clone', desc: 'Clones keys to the playhead in reverse order.' },
    { id: 'alignKeysToTime', name: 'Align Keys to Playhead', cat: 'keyframes', icon: 'align', desc: 'Moves the selected keys to the playhead.', mods: { alt: 'Align each property' } },
    { id: 'alignKeysToInOut', name: 'Align Keys to In Point', cat: 'keyframes', icon: 'align', desc: 'First key to the layer In point.', mods: { alt: 'Last key to Out point' } },
    { id: 'alignKeysLeftRight', name: 'Left / Right Align Keys', cat: 'keyframes', icon: 'align', desc: 'Lines up the first keys of all properties.', mods: { alt: 'Align last keys' } },
    { id: 'offsetKeys', name: 'Offset Keys', cat: 'keyframes', desc: 'Offsets the selected keys by N frames.', mods: { alt: 'Move earlier' },
      params: [P.num('frames', 'Frames', 5)] },
    { id: 'timeReverseKeys', name: 'Time-Reverse Keys', cat: 'keyframes', icon: 'reverse', desc: 'Time-reverses the selected keys.' },
    { id: 'fixKeysTime', name: 'Snap Keys to Frames', cat: 'keyframes', desc: 'Snaps off-frame keys to whole frames.' },
    { id: 'cleanKeyframes', name: 'Clean Keyframes', cat: 'keyframes', icon: 'clean', desc: 'Removes redundant keys (same value as the previous and next key).' },
    { id: 'copyKeyValues', name: 'Copy Key Values', cat: 'keyframes', host: 'easingsCopy', opts: { shift: true }, icon: 'duplicate', desc: 'Copies the values of the selected keys.' },
    { id: 'pasteKeyValues', name: 'Paste Key Values', cat: 'keyframes', host: 'easingsPaste', opts: { shift: true }, icon: 'duplicate', desc: 'Pastes the copied values onto the selected keys.' },
    { id: 'loop', name: 'Key Looper', cat: 'keyframes', desc: 'Adds loopOut("cycle").', mods: { alt: 'pingpong', ctrl: 'continue', shift: 'offset' } },

    // ---------------- Easing ----------------
    { id: 'easyKeyframes', name: 'Graph Editor', cat: 'easing', widget: 'easyKeyframes', desc: 'Value / speed graph: drag the handles freely (overshoot allowed). Shift = lock axis, Ctrl = fine, Alt or Link = mirror, Auto = apply on release. Built-in and saved curves, Read from keys, Apply / In / Out / Linear / Hold.' },
    { id: 'easingPresets', name: 'Easing Presets', cat: 'easing', widget: 'easingPresets', icon: 'curvePreset', desc: 'Sine, Quad, Cubic, Quart, Quint, Expo, Circ, Back – In / Out / InOut.' },
    { id: 'easings', name: 'Easings Manager', cat: 'easing', widget: 'easings', desc: 'Copy / paste values and easing.', mods: { alt: 'Easing only', shift: 'Values only' } },
    { id: 'copyKeyEasing', name: 'Copy Key Easing', cat: 'easing', host: 'easingsCopy', opts: { alt: true }, icon: 'easings', desc: 'Copies the easing of the selected keys.' },
    { id: 'pasteKeyEasing', name: 'Paste Key Easing', cat: 'easing', host: 'easingsPaste', opts: { alt: true }, icon: 'easings', desc: 'Pastes the copied easing onto the selected keys.' },
    { id: 'reverseKeyEasing', name: 'Reverse Key Easing', cat: 'easing', icon: 'reverse', desc: 'Reverses the in/out easing of each key segment.' },

    // ---------------- Composition ----------------
    { id: 'cropComp', name: 'Auto Crop Comps', cat: 'composition', desc: 'Crops precomps to their visible content.' },
    { id: 'autoTrimComp', name: 'Auto Trim Comp', cat: 'composition', icon: 'trim', desc: 'Fits the work area to the layers.', mods: { alt: 'Also change comp duration' } },
    { id: 'preCompose', name: 'Pre-Compose', cat: 'composition', desc: 'Pre-composes the selected layers (Move all attributes).', mods: { alt: 'Leave attributes (1 layer)' } },
    { id: 'unPreComp', name: 'Decompose', cat: 'composition', desc: 'Moves the layers of a precomp into the current comp.', mods: { alt: 'Keep the precomp layer' } },
    { id: 'compDuplicator', name: 'Duplicate Comps', cat: 'composition', desc: 'Duplicates comps + nested comps and fixes comp("…") expressions.', mods: { alt: 'Put into a new folder' } },
    { id: 'cropToLayer', name: 'Crop Comp to Layer', cat: 'composition', icon: 'cropComp', desc: 'Crops the active comp to the bounds of the selected layer(s); layers using this comp stay in place.' },
    { id: 'trash', name: 'Trash Disabled', cat: 'composition', icon: 'trash', desc: 'Removes disabled effects and disabled expressions from the selected layers (or the whole comp).', mods: { alt: 'Whole comp' } },
    { id: 'batchCompSettings', name: 'Batch Comp Settings', cat: 'composition', icon: 'cat-composition', desc: 'Changes size / fps / duration of many comps (empty = unchanged).',
      params: [P.num('width', 'Width (px)', ''), P.num('height', 'Height (px)', ''), P.num('fps', 'Frame rate', ''), P.num('duration', 'Duration (seconds)', '')] },
    { id: 'audioToPrecomps', name: 'Audio to Precomps', cat: 'composition', icon: 'audio', desc: 'Copies the selected audio layers into every nested precomp, in sync, so you can hear them while working inside precomps.', mods: { shift: 'Remove all synced audio from the project' } },
    { id: 'spotBlur', name: 'Spot Blur', cat: 'composition', icon: 'spotBlur', desc: 'Draggable focus spots: everything outside the spots is blurred (Compound Blur + map comp, settings on a controller).',
      params: [P.num('spots', 'Spots', 4, { min: 1, max: 12 }), P.num('maxBlur', 'Max blur', 40), P.num('size', 'Spot size (px)', 240), P.num('feather', 'Feather (px)', 120)] },
    { id: 'bgBlack', name: 'Black BG', cat: 'composition', host: 'setBgColor', opts: { color: [0, 0, 0] }, icon: 'rect', desc: 'Black comp background.' },
    { id: 'bgGray', name: 'Gray BG', cat: 'composition', host: 'setBgColor', opts: { color: [0.5, 0.5, 0.5] }, icon: 'rect', desc: 'Gray comp background.' },
    { id: 'bgWhite', name: 'White BG', cat: 'composition', host: 'setBgColor', opts: { color: [1, 1, 1] }, icon: 'rect', desc: 'White comp background.' },

    // ---------------- Project ----------------
    { id: 'projectCleanup', name: 'Project Cleanup', cat: 'project', icon: 'clean', desc: 'Removes unused footage + consolidates duplicates.', mods: { alt: 'Only remove unused footage' } },
    { id: 'organizeProject', name: 'Organize Project', cat: 'project', icon: 'folder', desc: 'Moves root items into Comps / Footage / Images / Audio / Solids folders.' },
    { id: 'createFolderStructure', name: 'Create Folder Structure', cat: 'project', icon: 'folder', desc: 'Creates a folder tree from a template (comma-separated, "/" for subfolders).',
      params: [P.area('folders', 'Folders', '01 Comps, 01 Comps/Precomps, 02 Footage, 03 Audio, 04 Assets, 05 Render')] },
    { id: 'revealProjectFolder', name: 'Reveal Project Folder', cat: 'project', icon: 'reveal', desc: 'Opens the folder containing the project file.' },
    { id: 'revealLayerSource', name: 'Reveal Layer Source', cat: 'project', icon: 'reveal', desc: 'Opens the folder containing the source file of the selected layer.' },
    { id: 'simpleProxy', name: 'Proxy Manager', cat: 'project', desc: 'Renders proxies for heavy comps and assigns them automatically.', mods: { alt: 'Remove proxy', shift: 'Toggle proxy' } },

    // ---------------- Guides ----------------
    { id: 'guidesAround', name: 'Add Guides Around', cat: 'guides', host: 'addGuides', opts: { where: 'around' }, desc: 'Guides around the selected layers (or the comp edges).' },
    { id: 'guidesCenter', name: 'Add Guides Center', cat: 'guides', host: 'addGuides', opts: { where: 'both' }, desc: 'Guides at the center of the selected layers (or the comp).' },
    { id: 'guidesEdge', name: 'Add Guide at Edge', cat: 'guides', host: 'addGuides', desc: 'A guide at an edge / center of the selected layers.',
      params: [P.select('where', 'Position', 'left', [['left', 'Left'], ['right', 'Right'], ['top', 'Top'], ['bottom', 'Bottom'], ['center', 'Center (vertical)'], ['middle', 'Middle (horizontal)']])] },
    { id: 'addGuidesAnchor', name: 'Add Guides at Anchor', cat: 'guides', icon: 'moveAnchor', desc: 'Guides at the anchor point of the selected layers.' },
    { id: 'guideGrid', name: 'Guide / Grid System', cat: 'guides', icon: 'grid', desc: 'Creates a column/row grid with margins and gutters.',
      params: [P.num('cols', 'Columns', 12, { min: 1 }), P.num('rows', 'Rows (0 = none)', 0, { min: 0 }), P.num('margin', 'Margin (px)', 80), P.num('gutter', 'Gutter (px)', 20)] },
    { id: 'clearGuides', name: 'Clear Guides', cat: 'guides', icon: 'clean', desc: 'Removes all guides in the comp.' },
    { id: 'copyGuides', name: 'Copy Guides', cat: 'guides', icon: 'duplicate', desc: 'Copies the guides of the current comp.' },
    { id: 'pasteGuides', name: 'Paste Guides', cat: 'guides', icon: 'duplicate', desc: 'Pastes the copied guides.', mods: { alt: 'Scale to comp size' } },
    { id: 'toggleGuides', name: 'Show / Hide Guides', cat: 'guides', icon: 'eye', desc: 'Toggles guide visibility.' },
    { id: 'lockGuides', name: 'Lock / Unlock Guides', cat: 'guides', icon: 'lock', desc: 'Locks/unlocks guides.' },
    { id: 'snapGuides', name: 'Snap to Guides', cat: 'guides', icon: 'toggle', desc: 'Toggles snapping to guides.' },

    // ---------------- View ----------------
    { id: 'viewZoom100', name: 'Zoom 100%', cat: 'view', host: 'viewZoom', opts: { zoom: 1 }, icon: 'zoom', desc: 'Sets the viewer zoom to 100%.' },
    { id: 'viewZoom50', name: 'Zoom 50%', cat: 'view', host: 'viewZoom', opts: { zoom: 0.5 }, icon: 'zoom', desc: 'Sets the viewer zoom to 50%.' },
    { id: 'soloViewer', name: 'Solo Layers (Viewer)', cat: 'view', icon: 'eye', desc: 'Toggles Solo on the selected layers.', mods: { alt: 'Unsolo all layers' } },
    { id: 'toggleRulers', name: 'Show / Hide Rulers', cat: 'view', icon: 'align', desc: 'Toggles rulers.' },
    { id: 'toggleGrid', name: 'Show / Hide Grid', cat: 'view', icon: 'grid', desc: 'Toggles the grid.' },
    { id: 'saveScreenshot', name: 'Save Screenshot', cat: 'view', icon: 'camera', desc: 'Saves the current frame as PNG.' },

    // ---------------- Expression ----------------
    { id: 'customExpression', name: 'Expression Editor', cat: 'expression', host: 'applyExpression', icon: 'cat-expression', desc: 'Write and apply an expression to the selected properties.',
      params: [P.area('code', 'Expression', 'wiggle(2, 30)')], mods: { alt: 'Remove expression' } },
    { id: 'enableExpressions', name: 'Enable Expressions', cat: 'expression', icon: 'toggle', desc: 'Enables expressions (selected properties / layers).', mods: { alt: 'Whole comp' } },
    { id: 'disableExpressions', name: 'Disable Expressions', cat: 'expression', icon: 'toggle', desc: 'Disables expressions (selected properties / layers).', mods: { alt: 'Whole comp' } },
    { id: 'removeExpressions', name: 'Remove Expressions', cat: 'expression', icon: 'clean', desc: 'Removes expressions (selected properties / layers).', mods: { alt: 'Whole comp' } },
    { id: 'removeExpressionErrors', name: 'Remove Broken Expressions', cat: 'expression', icon: 'clean', desc: 'Removes every expression with errors in the comp.' },
    { id: 'bakeExpressions', name: 'Bake Expressions', cat: 'expression', icon: 'bake', desc: 'Converts expressions into keyframes (every frame).', mods: { alt: 'Whole comp' } },
    { id: 'findReplaceExpressions', name: 'Find & Replace Expressions', cat: 'expression', icon: 'find', desc: 'Finds and replaces text in expressions.', mods: { alt: 'Whole comp' },
      params: [P.text('find', 'Find', ''), P.text('replace', 'Replace with', '')] },

    // ---------------- Shapes ----------------
    { id: 'extractShapes', name: 'Separate Shapes to Layers', cat: 'shapes', desc: 'Splits groups into separate layers.', mods: { alt: 'Keep source' } },
    { id: 'mergeShapes', name: 'Merge Shape Layers', cat: 'shapes', desc: 'Merges shape layers into the top one.', mods: { alt: 'Keep source layers' } },
    { id: 'nullsToPoint', name: 'Null Controllers for Points', cat: 'shapes', desc: 'Nulls that follow the points of the selected Path / Mask.', mods: { alt: 'Path follows nulls' } },
    { id: 'shapesFromVector', name: 'Shapes from Vector', cat: 'shapes', desc: 'AI / PDF → shape layers.', mods: { alt: 'Delete source', shift: 'Remove artboards' } },
    { id: 'removeArtboards', name: 'Remove Artboards', cat: 'shapes', desc: 'Removes "Artboard" groups in shape layers.' },
    { id: 'maskToShape', name: 'Convert Mask to Shape', cat: 'shapes', icon: 'mask', desc: 'Converts masks into a shape layer.', mods: { alt: 'Delete original masks' } },
    { id: 'capRound', name: 'Cap Join Round', cat: 'shapes', host: 'capJoin', opts: { cap: 2, join: 2 }, icon: 'cap', desc: 'Stroke: Round cap + Round join.' },
    { id: 'capMiter', name: 'Cap Join Miter', cat: 'shapes', host: 'capJoin', opts: { cap: 1, join: 1 }, icon: 'cap', desc: 'Stroke: Butt cap + Miter join.' },
    { id: 'capBevel', name: 'Cap Join Bevel', cat: 'shapes', host: 'capJoin', opts: { cap: 1, join: 3 }, icon: 'cap', desc: 'Stroke: Butt cap + Bevel join.' },
    { id: 'toggleFillStroke', name: 'Toggle Fill / Stroke', cat: 'shapes', icon: 'toggle', desc: 'Toggles Fills.', mods: { alt: 'Toggle Strokes' } },
    { id: 'reversePathDirection', name: 'Reverse Path Direction', cat: 'shapes', icon: 'reverse', desc: 'Reverses path direction.' },
    { id: 'resetShapeTransforms', name: 'Reset Shape Transforms', cat: 'shapes', icon: 'reset', desc: 'Resets the transform of every group in shape layers.' },
    { id: 'rectangleWizard', name: 'Rectangle Wizard', cat: 'shapes', icon: 'rect', desc: 'Creates a rectangle at an exact size.',
      params: [P.num('width', 'Width', 400), P.num('height', 'Height', 240), P.num('round', 'Roundness', 0)] },
    { id: 'circleWizard', name: 'Circle Wizard', cat: 'shapes', icon: 'circle', desc: 'Creates a circle at an exact size.', params: [P.num('size', 'Diameter', 300)] },
    { id: 'trimPathsController', name: 'Trim Paths Controller', cat: 'shapes', icon: 'trimPath', desc: 'Adds Trim Paths + Start / End / Offset sliders.' },

    // ---------------- Text ----------------
    { id: 'findReplaceText', name: 'Find & Replace Text', cat: 'text', icon: 'find', desc: 'Finds and replaces text in text layers.',
      params: [P.text('find', 'Find', ''), P.text('replace', 'Replace with', '')] },
    { id: 'loremIpsum', name: 'Lorem Ipsum', cat: 'text', icon: 'lorem', desc: 'Creates placeholder text.', params: [P.num('words', 'Words', 12, { min: 1 })] },
    { id: 'typewriter', name: 'Typewriter', cat: 'text', icon: 'typewriter', desc: 'Reveals characters one by one (Typewriter % slider).',
      params: [P.num('seconds', 'Duration (seconds)', 2), P.check('cursor', 'Blinking cursor', true)] },
    { id: 'numberCounter', name: 'Number Counter', cat: 'text', icon: 'counter', desc: 'Counting number text (Counter slider).',
      params: [P.num('from', 'From', 0), P.num('to', 'To', 100), P.num('seconds', 'Duration (seconds)', 2), P.num('decimals', 'Decimals', 0, { min: 0, max: 6 }),
        P.check('separator', 'Thousands separator', true), P.text('prefix', 'Prefix', ''), P.text('suffix', 'Suffix', '')] },
    { id: 'textBox', name: 'Text Box Generator', cat: 'text', icon: 'textBox', desc: 'A background that resizes with the text.',
      params: [P.num('padX', 'Horizontal padding', 24), P.num('padY', 'Vertical padding', 14), P.num('round', 'Roundness', 8)] },

    // ---------------- Animation ----------------
    { id: 'elastic', name: 'Overshoot', cat: 'animation', desc: 'Elastic overshoot after keyframes.' },
    { id: 'bounce', name: 'Bounce', cat: 'animation', desc: 'Bounces back after keyframes.' },
    { id: 'wiggleProperty', name: 'Wiggle Property', cat: 'animation', icon: 'wiggle', desc: 'Wiggle with Freq / Amp sliders.',
      params: [P.num('freq', 'Frequency', 2), P.num('amp', 'Amplitude', 30)] },
    { id: 'spin', name: 'Spin', cat: 'animation', icon: 'spin', desc: 'Continuous rotation.', params: [P.num('speed', 'Speed (degrees/second)', 90)] },
    { id: 'autoFader', name: 'Auto Fader', cat: 'animation', icon: 'fade', desc: 'Automatic fade in/out based on the In/Out points.',
      params: [P.num('fadeIn', 'Fade in (frame)', 10), P.num('fadeOut', 'Fade out (frame)', 10)] },
    { id: 'blinker', name: 'Blinker / Flicker', cat: 'animation', icon: 'blink', desc: 'Blinks the opacity.',
      params: [P.num('freq', 'Frequency', 6), P.num('random', 'Randomness (%)', 0)] },
    { id: 'stopMotion', name: 'Stop Motion', cat: 'animation', icon: 'stopMotion', desc: 'Stop-motion style stepping.', params: [P.num('fps', 'FPS', 12)] },
    { id: 'beatSwitch', name: 'Beat Switch Layers', cat: 'animation', icon: 'metronome', desc: 'Selected layers take turns (one visible at a time) on the beat: by BPM, every N frames, at markers or by keyframing the Step slider. Works as a track-matte source too.',
      mods: { shift: 'Remove switching from the selected layers' },
      params: [P.select('mode', 'Switch by', 'BPM', [['BPM', 'BPM'], ['Frames', 'Every N frames'], ['Markers', 'Metronome markers'], ['Keyframes', 'Keyframed Step slider']]),
        P.num('bpm', 'BPM', 120), P.num('beatsPerStep', 'Beats per step', 1), P.num('framesPerStep', 'Frames per step', 6), P.check('random', 'Random order', false)] },
    { id: 'beatMarkers', name: 'Beat Markers', cat: 'animation', icon: 'metronome', desc: 'Adds bar.beat markers on the Metronome layer across the work area.',
      mods: { alt: 'Bars only', shift: 'Clear markers' }, params: [P.num('bpm', 'BPM', 120), P.num('beatsPerBar', 'Beats per bar', 4)] },
    { id: 'metronomeClick', name: 'Metronome Click', cat: 'animation', icon: 'metronome', desc: 'Adds an audible click track (Tone effect) following the Metronome; downbeats are higher.', mods: { alt: 'No accent on downbeats' } },
    { id: 'beatCounter', name: 'Beat Counter', cat: 'animation', icon: 'counter', desc: 'Text layer showing the current bar and beat from the Metronome.', mods: { alt: 'Total beat count only' } },
    { id: 'metronomeSetup', name: 'Metronome Controller', cat: 'animation', icon: 'metronome', desc: 'Creates or updates the Metronome controller (BPM, beats per bar, start time).',
      params: [P.num('bpm', 'BPM', 120), P.num('beatsPerBar', 'Beats per bar', 4), P.num('start', 'Start time (s, new controller)', 0)] },
    { id: 'areaOpacity', name: 'Area Opacity', cat: 'animation', host: 'areaEffector', opts: { mode: 'opacity' }, icon: 'area', desc: 'Layers fade in as the Area Effector controller gets close (Radius + Falloff).', mods: { alt: 'New controller', shift: 'Remove effect' } },
    { id: 'areaScale', name: 'Area Scale', cat: 'animation', host: 'areaEffector', opts: { mode: 'scale' }, icon: 'area', desc: 'Layers scale between Outside % and Inside % depending on the distance to the controller.', mods: { alt: 'New controller', shift: 'Remove effect' } },
    { id: 'areaPosition', name: 'Area Position', cat: 'animation', host: 'areaEffector', opts: { mode: 'position' }, icon: 'area', desc: 'Layers near the controller are pushed by Offset X / Y / Z.', mods: { alt: 'New controller', shift: 'Remove effect' } },
    { id: 'areaRotation', name: 'Area Rotation', cat: 'animation', host: 'areaEffector', opts: { mode: 'rotation' }, icon: 'area', desc: 'Layers near the controller rotate by the Rotation slider.', mods: { alt: 'New controller', shift: 'Remove effect' } },
    { id: 'areaColor', name: 'Area Color', cat: 'animation', host: 'areaEffector', opts: { mode: 'color' }, icon: 'area', desc: 'Layers blend from Color Outside to Color Inside near the controller (Fill effect).', mods: { alt: 'New controller', shift: 'Remove effect' } },
    { id: 'orbit', name: 'Orbit', cat: 'animation', icon: 'orbit', desc: 'Selected layers orbit around a new Orbit Center null (Speed slider, optional Face Center).', mods: { shift: 'Remove' },
      params: [P.num('speed', 'Speed (deg/s)', 45)] },
    { id: 'createLimb', name: 'Bend / Limb Rig', cat: 'animation', desc: 'A bendable hose/limb driven by 2 nulls.' },
    { id: 'positionTrace', name: 'Position Trace', cat: 'animation', desc: 'Draws the motion path as a shape.', mods: { alt: 'Work area only' } }
  ];

  var byId = {}, byCat = {};
  CATS.forEach(function (c) { byCat[c.id] = []; });
  TOOLS.forEach(function (t) { byId[t.id] = t; byCat[t.cat].push(t); });
  var catById = {};
  CATS.forEach(function (c) { catById[c.id] = c; });

  // Item types users can add to user panels
  var ITEM_TYPES = [
    { type: 'tool', name: 'MenMen Tool', icon: 'star', desc: 'A built-in tool' },
    { type: 'expression', name: 'Expression', icon: 'cat-expression', desc: 'Paste an expression, applied to the selected properties' },
    { type: 'scriptlet', name: 'Scriptlet', icon: 'script', desc: 'A short ExtendScript snippet' },
    { type: 'script', name: 'Script File', icon: 'script', desc: 'File .jsx / .jsxbin' },
    { type: 'preset', name: 'Preset', icon: 'preset', desc: 'An .ffx file, applied to the selected layers' },
    { type: 'effect', name: 'Effect', icon: 'effect', desc: 'Effect name or matchName' },
    { type: 'command', name: 'Menu Command', icon: 'command', desc: 'AE menu command name or command ID' },
    { type: 'divider', name: 'Divider', icon: 'divider', desc: 'A line separating groups' },
    { type: 'quickAccess', name: 'Quick Access', icon: 'quickAccess', desc: 'Fills itself with your 10 most used tools' }
  ];

  // Script library (.jsx / .jsxbin / .ffx found by the host) -> tools in the "scripts" category.
  function prettyName(file) { return file.replace(/\.(jsx|jsxbin|ffx)$/i, '').replace(/_/g, ' ').trim(); }
  function registerScripts(list) {
    for (var i = TOOLS.length - 1; i >= 0; i--) if (TOOLS[i].cat === 'scripts') { delete byId[TOOLS[i].id]; TOOLS.splice(i, 1); }
    byCat.scripts = [];
    (list || []).forEach(function (f) {
      var isFfx = /\.ffx$/i.test(f.name);
      var t = { id: 'script:' + f.name, name: prettyName(f.name), cat: 'scripts', host: 'runFile', opts: { path: f.path },
        icon: isFfx ? 'preset' : 'script', file: f.name, src: f.src,
        desc: (isFfx ? 'Preset' : 'Script') + ' · ' + f.name + (f.src === 'user' ? ' (your Scripts folder)' : ' (bundled library)') };
      if (byId[t.id]) return;
      TOOLS.push(t); byId[t.id] = t; byCat.scripts.push(t);
    });
  }

  window.Tools = {
    registerScripts: registerScripts,
    CATS: CATS,
    cat: function (id) { return catById[id]; },
    list: TOOLS,
    inCat: function (id) { return byCat[id] || []; },
    get: function (id) { return byId[id]; },
    ITEM_TYPES: ITEM_TYPES,
    iconSvg: function (key) {
      return '<svg viewBox="0 0 24 24" class="ico" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
        (I[key] || I.script) + '</svg>';
    },
    toolIcon: function (t) { return this.iconSvg(t.icon || (I[t.id] ? t.id : 'cat-' + t.cat)); }
  };
})();

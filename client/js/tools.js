/* tools.js - danh mục tool chia theo 12 nhóm.
 * Mỗi tool: id, name, cat, desc, host (tên hàm MMW.tools.*, mặc định = id), opts (tham số cố định),
 * mods (mô tả Alt/Shift/Ctrl), params (form nhập trước khi chạy), widget (giao diện riêng), icon. */
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
    { id: 'animation',   name: 'Animation',   color: '#ffd166' }
  ];

  // Icon nét 24x24 (stroke = currentColor)
  var I = {
    // nhóm
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
    'cat-animation': '<path d="M3 18c4 0 5-12 9-12s5 8 9 8" /><circle cx="21" cy="14" r="1.8"/><path d="M3 21h4" opacity=".55"/>',
    // tool
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
    divider: '<path d="M3 12h18"/>'
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
    { id: 'selectNulls', name: 'Select Nulls', cat: 'selection', icon: 'addNull', desc: 'Chọn mọi null layer trong comp.' },
    { id: 'select3D', name: 'Select 3D Layers', cat: 'selection', desc: 'Chọn mọi layer 3D.' },
    { id: 'selectLights', name: 'Select Lights', cat: 'selection', desc: 'Chọn mọi light.', mods: { alt: 'Chọn camera' } },
    { id: 'selectPrecomps', name: 'Select Precomps', cat: 'selection', desc: 'Chọn mọi layer precomp.' },
    { id: 'selectShapeLayers', name: 'Select Shape Layers', cat: 'selection', icon: 'cat-shapes', desc: 'Chọn mọi shape layer.' },
    { id: 'selectTextLayers', name: 'Select Text Layers', cat: 'selection', icon: 'cat-text', desc: 'Chọn mọi text layer.' },
    { id: 'selectAudioLayers', name: 'Select Audio Layers', cat: 'selection', desc: 'Chọn layer chỉ có âm thanh.' },
    { id: 'selectGuideLayers', name: 'Select Guide Layers', cat: 'selection', desc: 'Chọn mọi guide layer.' },
    { id: 'selectAdjustment', name: 'Select Adjustment Layers', cat: 'selection', desc: 'Chọn mọi adjustment layer.' },
    { id: 'inverseSelection', name: 'Inverse Selection', cat: 'selection', icon: 'reverse', desc: 'Đảo vùng chọn layer.' },
    { id: 'selectEveryNth', name: 'Select Every Nth Layer', cat: 'selection', desc: 'Chọn mỗi layer thứ N (trong vùng chọn hoặc cả comp).',
      params: [P.num('n', 'Mỗi N layer', 2, { min: 1 }), P.num('offset', 'Bắt đầu từ layer thứ', 1, { min: 1 })] },
    { id: 'selectOddEven', name: 'Select Odd / Even', cat: 'selection', desc: 'Chọn layer lẻ.', mods: { alt: 'Chọn layer chẵn' } },
    { id: 'selectAbove', name: 'Select Layers Above', cat: 'selection', desc: 'Chọn mọi layer phía trên vùng chọn.', mods: { alt: 'Gồm cả layer đang chọn' } },
    { id: 'selectBelow', name: 'Select Layers Below', cat: 'selection', desc: 'Chọn mọi layer phía dưới vùng chọn.', mods: { alt: 'Gồm cả layer đang chọn' } },
    { id: 'selectChildren', name: 'Select Child Layers', cat: 'selection', icon: 'parent', desc: 'Chọn mọi layer con (mọi cấp).', mods: { alt: 'Gồm cả layer cha' } },
    { id: 'selectParents', name: 'Select Parent Layers', cat: 'selection', icon: 'parent', desc: 'Chọn mọi layer cha (mọi cấp).', mods: { alt: 'Gồm cả layer con' } },
    { id: 'selectHierarchy', name: 'Select Hierarchy', cat: 'selection', icon: 'parent', desc: 'Chọn toàn bộ cây parent chứa layer đang chọn.' },
    { id: 'randomSelect', name: 'Random Select', cat: 'selection', desc: 'Chọn ngẫu nhiên một phần layer.',
      params: [P.num('percent', 'Tỉ lệ chọn (%)', 50, { min: 0, max: 100 })] },
    { id: 'selectAtFrame', name: 'Select Layers at Frame', cat: 'selection', desc: 'Chọn các layer đang hiện tại playhead.' },
    { id: 'selectMatchingProperty', name: 'Select Matching Property', cat: 'selection', desc: 'Chọn cùng property (vd Position) trên các layer đang chọn.', mods: { alt: 'Trên mọi layer' } },
    { id: 'selectPaths', name: 'Select All Paths', cat: 'selection', host: 'selector', icon: 'selector', desc: 'Chọn mọi Path trong shape layer đang chọn.' },
    { id: 'selectFills', name: 'Select All Fills', cat: 'selection', host: 'selector', opts: { alt: true }, icon: 'selector', desc: 'Chọn mọi Fill trong shape layer đang chọn.' },
    { id: 'selectStrokes', name: 'Select All Strokes', cat: 'selection', host: 'selector', opts: { shift: true }, icon: 'selector', desc: 'Chọn mọi Stroke trong shape layer đang chọn.' },

    // ---------------- Layers ----------------
    { id: 'addNull', name: 'Parent to Null', cat: 'layers', desc: 'Thêm null cha ở giữa các layer đang chọn.', mods: { alt: 'Null mặc định', shift: 'Mỗi layer một null' } },
    { id: 'parentToFirst', name: 'Parent to First Selected', cat: 'layers', icon: 'parent', desc: 'Các layer còn lại làm con của layer được chọn đầu tiên.' },
    { id: 'parentToAbove', name: 'Parent to Above Layer', cat: 'layers', icon: 'parent', desc: 'Mỗi layer làm con của layer ngay phía trên.' },
    { id: 'parentChain', name: 'Parent in Selection Order', cat: 'layers', icon: 'parent', desc: 'Tạo chuỗi parent theo thứ tự đã chọn.' },
    { id: 'unparent', name: 'Unparent', cat: 'layers', icon: 'parent', desc: 'Bỏ parent của layer đang chọn.' },
    { id: 'sequencer', name: 'Offset Layers', cat: 'layers', widget: 'sequencer', desc: 'Dàn layer hoặc keyframe nối tiếp nhau (xuống / lên / ngẫu nhiên).' },
    { id: 'duplicateLayers', name: 'Duplicate Layers', cat: 'layers', icon: 'duplicate', desc: 'Nhân bản layer nhiều lần.',
      params: [P.num('count', 'Số bản sao', 3, { min: 1, max: 200 })] },
    { id: 'renameLayers', name: 'Rename Layers', cat: 'layers', icon: 'rename', desc: 'Đổi tên hàng loạt: tên mới + số, tìm/thay, tiền tố/hậu tố.',
      params: [P.text('name', 'Tên mới (để trống = giữ tên)', ''), P.num('start', 'Số bắt đầu', 1), P.text('find', 'Tìm', ''), P.text('replace', 'Thay bằng', ''),
        P.text('prefix', 'Tiền tố', ''), P.text('suffix', 'Hậu tố', '')] },
    { id: 'setLayerColors', name: 'Set Layer Colors', cat: 'layers', icon: 'palette', desc: 'Đổi màu label theo loại layer / ngẫu nhiên / một màu.',
      params: [P.select('mode', 'Kiểu', 'type', [['type', 'Theo loại layer'], ['random', 'Ngẫu nhiên'], ['1', 'Red'], ['2', 'Yellow'], ['3', 'Aqua'],
        ['4', 'Pink'], ['5', 'Lavender'], ['6', 'Peach'], ['7', 'Sea Foam'], ['8', 'Blue'], ['9', 'Green'], ['10', 'Purple'], ['11', 'Orange'],
        ['12', 'Brown'], ['13', 'Fuchsia'], ['14', 'Cyan'], ['15', 'Sandstone'], ['16', 'Dark Green'], ['0', 'None']])] },
    { id: 'lockToggle', name: 'Lock / Unlock All', cat: 'layers', icon: 'lock', desc: 'Khóa hoặc mở khóa toàn bộ layer.', mods: { alt: 'Chỉ layer đang chọn' } },
    { id: 'shyToggle', name: 'Shy Toggle', cat: 'layers', icon: 'eye', desc: 'Bật/tắt shy cho layer đang chọn.', mods: { alt: 'Bật/tắt Hide Shy Layers' } },
    { id: 'soloTimeline', name: 'Solo Layers (Timeline)', cat: 'layers', icon: 'eye', desc: 'Chỉ hiện layer đang chọn trong timeline. Bấm lại để hiện tất cả.' },
    { id: 'toggleVisibility', name: 'Toggle Visibility', cat: 'layers', icon: 'eye', desc: 'Bật/tắt hiển thị (eyeball) layer đang chọn.' },
    { id: 'resetTransform', name: 'Reset Layer Transform', cat: 'layers', icon: 'reset', desc: 'Reset Position/Scale/Rotation/Opacity (xóa keyframe).', mods: { alt: 'Giữ Position' } },
    { id: 'trimLayers', name: 'Trim Layers', cat: 'layers', icon: 'trim', desc: 'Cắt Out point về playhead.', mods: { alt: 'Cắt In point', shift: 'Theo work area' } },
    { id: 'moveAnchor', name: 'Set Anchor Point', cat: 'layers', widget: 'moveAnchor', desc: 'Dời anchor point tới 9 vị trí, giữ nguyên hình.', mods: { shift: 'Ô giữa: lệnh gốc (3D)' } },
    { id: 'getColors', name: 'Collect Colors', cat: 'layers', desc: 'Gom mọi màu vào 1 controller, màu trùng dùng chung.' },

    // ---------------- Keyframes ----------------
    { id: 'clone', name: 'Clone Keys', cat: 'keyframes', desc: 'Copy keyframe đang chọn tới playhead.', mods: { alt: 'Chọn key mới', shift: 'Clone đảo ngược' } },
    { id: 'cloneMirror', name: 'Clone & Mirror Keys', cat: 'keyframes', host: 'clone', opts: { shift: true }, icon: 'clone', desc: 'Clone key tới playhead theo thứ tự đảo ngược.' },
    { id: 'alignKeysToTime', name: 'Align Keys to Playhead', cat: 'keyframes', icon: 'align', desc: 'Dời nhóm key đang chọn tới playhead.', mods: { alt: 'Căn từng property' } },
    { id: 'alignKeysToInOut', name: 'Align Keys to In Point', cat: 'keyframes', icon: 'align', desc: 'Key đầu về In point của layer.', mods: { alt: 'Key cuối về Out point' } },
    { id: 'alignKeysLeftRight', name: 'Left / Right Align Keys', cat: 'keyframes', icon: 'align', desc: 'Căn key đầu của mọi property thẳng hàng.', mods: { alt: 'Căn key cuối' } },
    { id: 'offsetKeys', name: 'Offset Keys', cat: 'keyframes', desc: 'Dời key đang chọn N frame.', mods: { alt: 'Lùi lại' },
      params: [P.num('frames', 'Số frame', 5)] },
    { id: 'timeReverseKeys', name: 'Time-Reverse Keys', cat: 'keyframes', icon: 'reverse', desc: 'Đảo ngược thời gian các key đang chọn.' },
    { id: 'fixKeysTime', name: 'Snap Keys to Frames', cat: 'keyframes', desc: 'Đưa key lệch frame về đúng frame.' },
    { id: 'cleanKeyframes', name: 'Clean Keyframes', cat: 'keyframes', icon: 'clean', desc: 'Xóa key thừa (trùng giá trị với key trước và sau).' },
    { id: 'copyKeyValues', name: 'Copy Key Values', cat: 'keyframes', host: 'easingsCopy', opts: { shift: true }, icon: 'duplicate', desc: 'Copy giá trị các key đang chọn.' },
    { id: 'pasteKeyValues', name: 'Paste Key Values', cat: 'keyframes', host: 'easingsPaste', opts: { shift: true }, icon: 'duplicate', desc: 'Dán giá trị đã copy lên key đang chọn.' },
    { id: 'loop', name: 'Key Looper', cat: 'keyframes', desc: 'Thêm loopOut("cycle").', mods: { alt: 'pingpong', ctrl: 'continue', shift: 'offset' } },

    // ---------------- Easing ----------------
    { id: 'easyKeyframes', name: 'Keyframe Assistant', cat: 'easing', widget: 'easyKeyframes', desc: 'Ease / In / Out / Linear / Hold với influence tùy chỉnh.' },
    { id: 'easingPresets', name: 'Easing Presets', cat: 'easing', widget: 'easingPresets', icon: 'curvePreset', desc: 'Sine, Quad, Cubic, Quart, Quint, Expo, Circ, Back – In / Out / InOut.' },
    { id: 'easings', name: 'Easings Manager', cat: 'easing', widget: 'easings', desc: 'Copy / paste giá trị và easing.', mods: { alt: 'Chỉ easing', shift: 'Chỉ giá trị' } },
    { id: 'copyKeyEasing', name: 'Copy Key Easing', cat: 'easing', host: 'easingsCopy', opts: { alt: true }, icon: 'easings', desc: 'Copy easing của key đang chọn.' },
    { id: 'pasteKeyEasing', name: 'Paste Key Easing', cat: 'easing', host: 'easingsPaste', opts: { alt: true }, icon: 'easings', desc: 'Dán easing đã copy lên key đang chọn.' },
    { id: 'reverseKeyEasing', name: 'Reverse Key Easing', cat: 'easing', icon: 'reverse', desc: 'Đảo easing ra/vào của từng đoạn key.' },

    // ---------------- Composition ----------------
    { id: 'cropComp', name: 'Auto Crop Comps', cat: 'composition', desc: 'Crop precomp về đúng vùng nội dung nhìn thấy.' },
    { id: 'autoTrimComp', name: 'Auto Trim Comp', cat: 'composition', icon: 'trim', desc: 'Work area ôm vừa các layer.', mods: { alt: 'Đổi luôn độ dài comp' } },
    { id: 'preCompose', name: 'Pre-Compose', cat: 'composition', desc: 'Pre-compose layer đang chọn (Move all attributes).', mods: { alt: 'Leave attributes (1 layer)' } },
    { id: 'unPreComp', name: 'Decompose', cat: 'composition', desc: 'Bung layer trong precomp ra comp hiện tại.', mods: { alt: 'Giữ layer precomp' } },
    { id: 'compDuplicator', name: 'Duplicate Comps', cat: 'composition', desc: 'Nhân bản comp + comp lồng, sửa expression comp("…").', mods: { alt: 'Đưa vào folder mới' } },
    { id: 'batchCompSettings', name: 'Batch Comp Settings', cat: 'composition', icon: 'cat-composition', desc: 'Đổi kích thước / fps / độ dài cho nhiều comp (để trống = giữ nguyên).',
      params: [P.num('width', 'Rộng (px)', ''), P.num('height', 'Cao (px)', ''), P.num('fps', 'Frame rate', ''), P.num('duration', 'Độ dài (giây)', '')] },
    { id: 'bgBlack', name: 'Black BG', cat: 'composition', host: 'setBgColor', opts: { color: [0, 0, 0] }, icon: 'rect', desc: 'Nền comp màu đen.' },
    { id: 'bgGray', name: 'Gray BG', cat: 'composition', host: 'setBgColor', opts: { color: [0.5, 0.5, 0.5] }, icon: 'rect', desc: 'Nền comp màu xám.' },
    { id: 'bgWhite', name: 'White BG', cat: 'composition', host: 'setBgColor', opts: { color: [1, 1, 1] }, icon: 'rect', desc: 'Nền comp màu trắng.' },

    // ---------------- Project ----------------
    { id: 'projectCleanup', name: 'Project Cleanup', cat: 'project', icon: 'clean', desc: 'Xóa footage không dùng + gộp footage trùng.', mods: { alt: 'Chỉ xóa footage không dùng' } },
    { id: 'organizeProject', name: 'Organize Project', cat: 'project', icon: 'folder', desc: 'Gom item ở thư mục gốc vào folder Comps / Footage / Images / Audio / Solids.' },
    { id: 'createFolderStructure', name: 'Create Folder Structure', cat: 'project', icon: 'folder', desc: 'Tạo cây folder theo mẫu (dấu phẩy ngăn cách, "/" cho folder con).',
      params: [P.area('folders', 'Folders', '01 Comps, 01 Comps/Precomps, 02 Footage, 03 Audio, 04 Assets, 05 Render')] },
    { id: 'revealProjectFolder', name: 'Reveal Project Folder', cat: 'project', icon: 'reveal', desc: 'Mở thư mục chứa file project.' },
    { id: 'revealLayerSource', name: 'Reveal Layer Source', cat: 'project', icon: 'reveal', desc: 'Mở thư mục chứa file nguồn của layer đang chọn.' },
    { id: 'simpleProxy', name: 'Proxy Manager', cat: 'project', desc: 'Render proxy cho comp nặng và gắn tự động.', mods: { alt: 'Gỡ proxy', shift: 'Bật/tắt proxy' } },

    // ---------------- Guides ----------------
    { id: 'guidesAround', name: 'Add Guides Around', cat: 'guides', host: 'addGuides', opts: { where: 'around' }, desc: 'Guide quanh layer đang chọn (hoặc mép comp).' },
    { id: 'guidesCenter', name: 'Add Guides Center', cat: 'guides', host: 'addGuides', opts: { where: 'both' }, desc: 'Guide ở tâm layer đang chọn (hoặc tâm comp).' },
    { id: 'guidesEdge', name: 'Add Guide at Edge', cat: 'guides', host: 'addGuides', desc: 'Một guide ở cạnh / tâm của layer đang chọn.',
      params: [P.select('where', 'Vị trí', 'left', [['left', 'Trái'], ['right', 'Phải'], ['top', 'Trên'], ['bottom', 'Dưới'], ['center', 'Giữa (dọc)'], ['middle', 'Giữa (ngang)']])] },
    { id: 'addGuidesAnchor', name: 'Add Guides at Anchor', cat: 'guides', icon: 'moveAnchor', desc: 'Guide tại anchor point của layer đang chọn.' },
    { id: 'guideGrid', name: 'Guide / Grid System', cat: 'guides', icon: 'grid', desc: 'Tạo lưới cột/hàng có lề và khoảng cách.',
      params: [P.num('cols', 'Số cột', 12, { min: 1 }), P.num('rows', 'Số hàng (0 = không)', 0, { min: 0 }), P.num('margin', 'Lề (px)', 80), P.num('gutter', 'Khoảng cách (px)', 20)] },
    { id: 'clearGuides', name: 'Clear Guides', cat: 'guides', icon: 'clean', desc: 'Xóa mọi guide trong comp.' },
    { id: 'copyGuides', name: 'Copy Guides', cat: 'guides', icon: 'duplicate', desc: 'Copy guide của comp hiện tại.' },
    { id: 'pasteGuides', name: 'Paste Guides', cat: 'guides', icon: 'duplicate', desc: 'Dán guide đã copy.', mods: { alt: 'Co giãn theo kích thước comp' } },
    { id: 'toggleGuides', name: 'Show / Hide Guides', cat: 'guides', icon: 'eye', desc: 'Bật/tắt hiển thị guide.' },
    { id: 'lockGuides', name: 'Lock / Unlock Guides', cat: 'guides', icon: 'lock', desc: 'Khóa/mở khóa guide.' },
    { id: 'snapGuides', name: 'Snap to Guides', cat: 'guides', icon: 'toggle', desc: 'Bật/tắt bắt dính vào guide.' },

    // ---------------- View ----------------
    { id: 'viewZoom100', name: 'Zoom 100%', cat: 'view', host: 'viewZoom', opts: { zoom: 1 }, icon: 'zoom', desc: 'Đặt zoom viewer 100%.' },
    { id: 'viewZoom50', name: 'Zoom 50%', cat: 'view', host: 'viewZoom', opts: { zoom: 0.5 }, icon: 'zoom', desc: 'Đặt zoom viewer 50%.' },
    { id: 'soloViewer', name: 'Solo Layers (Viewer)', cat: 'view', icon: 'eye', desc: 'Bật/tắt Solo layer đang chọn.', mods: { alt: 'Tắt solo mọi layer' } },
    { id: 'toggleRulers', name: 'Show / Hide Rulers', cat: 'view', icon: 'align', desc: 'Bật/tắt thước.' },
    { id: 'toggleGrid', name: 'Show / Hide Grid', cat: 'view', icon: 'grid', desc: 'Bật/tắt lưới.' },
    { id: 'saveScreenshot', name: 'Save Screenshot', cat: 'view', icon: 'camera', desc: 'Lưu frame hiện tại thành PNG.' },

    // ---------------- Expression ----------------
    { id: 'customExpression', name: 'Expression Editor', cat: 'expression', host: 'applyExpression', icon: 'cat-expression', desc: 'Viết và áp expression cho property đang chọn.',
      params: [P.area('code', 'Expression', 'wiggle(2, 30)')], mods: { alt: 'Xóa expression' } },
    { id: 'enableExpressions', name: 'Enable Expressions', cat: 'expression', icon: 'toggle', desc: 'Bật expression (property / layer đang chọn).', mods: { alt: 'Cả comp' } },
    { id: 'disableExpressions', name: 'Disable Expressions', cat: 'expression', icon: 'toggle', desc: 'Tắt expression (property / layer đang chọn).', mods: { alt: 'Cả comp' } },
    { id: 'removeExpressions', name: 'Remove Expressions', cat: 'expression', icon: 'clean', desc: 'Xóa expression (property / layer đang chọn).', mods: { alt: 'Cả comp' } },
    { id: 'removeExpressionErrors', name: 'Remove Broken Expressions', cat: 'expression', icon: 'clean', desc: 'Xóa mọi expression đang báo lỗi trong comp.' },
    { id: 'bakeExpressions', name: 'Bake Expressions', cat: 'expression', icon: 'bake', desc: 'Chuyển expression thành keyframe (mỗi frame).', mods: { alt: 'Cả comp' } },
    { id: 'findReplaceExpressions', name: 'Find & Replace Expressions', cat: 'expression', icon: 'find', desc: 'Tìm và thay chuỗi trong expression.', mods: { alt: 'Cả comp' },
      params: [P.text('find', 'Tìm', ''), P.text('replace', 'Thay bằng', '')] },

    // ---------------- Shapes ----------------
    { id: 'extractShapes', name: 'Separate Shapes to Layers', cat: 'shapes', desc: 'Tách group thành layer riêng.', mods: { alt: 'Giữ gốc' } },
    { id: 'mergeShapes', name: 'Merge Shape Layers', cat: 'shapes', desc: 'Gộp shape layer vào layer trên cùng.', mods: { alt: 'Giữ layer nguồn' } },
    { id: 'nullsToPoint', name: 'Null Controllers for Points', cat: 'shapes', desc: 'Null bám theo điểm của Path / Mask đang chọn.', mods: { alt: 'Path đi theo null' } },
    { id: 'shapesFromVector', name: 'Shapes from Vector', cat: 'shapes', desc: 'AI / PDF → shape layer.', mods: { alt: 'Xóa nguồn', shift: 'Xóa artboard' } },
    { id: 'removeArtboards', name: 'Remove Artboards', cat: 'shapes', desc: 'Xóa group "Artboard" trong shape layer.' },
    { id: 'maskToShape', name: 'Convert Mask to Shape', cat: 'shapes', icon: 'mask', desc: 'Chuyển mask thành shape layer.', mods: { alt: 'Xóa mask gốc' } },
    { id: 'capRound', name: 'Cap Join Round', cat: 'shapes', host: 'capJoin', opts: { cap: 2, join: 2 }, icon: 'cap', desc: 'Stroke: Round cap + Round join.' },
    { id: 'capMiter', name: 'Cap Join Miter', cat: 'shapes', host: 'capJoin', opts: { cap: 1, join: 1 }, icon: 'cap', desc: 'Stroke: Butt cap + Miter join.' },
    { id: 'capBevel', name: 'Cap Join Bevel', cat: 'shapes', host: 'capJoin', opts: { cap: 1, join: 3 }, icon: 'cap', desc: 'Stroke: Butt cap + Bevel join.' },
    { id: 'toggleFillStroke', name: 'Toggle Fill / Stroke', cat: 'shapes', icon: 'toggle', desc: 'Bật/tắt Fill.', mods: { alt: 'Bật/tắt Stroke' } },
    { id: 'reversePathDirection', name: 'Reverse Path Direction', cat: 'shapes', icon: 'reverse', desc: 'Đảo hướng path.' },
    { id: 'resetShapeTransforms', name: 'Reset Shape Transforms', cat: 'shapes', icon: 'reset', desc: 'Reset transform mọi group trong shape layer.' },
    { id: 'rectangleWizard', name: 'Rectangle Wizard', cat: 'shapes', icon: 'rect', desc: 'Tạo hình chữ nhật đúng kích thước.',
      params: [P.num('width', 'Rộng', 400), P.num('height', 'Cao', 240), P.num('round', 'Bo góc', 0)] },
    { id: 'circleWizard', name: 'Circle Wizard', cat: 'shapes', icon: 'circle', desc: 'Tạo hình tròn đúng kích thước.', params: [P.num('size', 'Đường kính', 300)] },
    { id: 'trimPathsController', name: 'Trim Paths Controller', cat: 'shapes', icon: 'trimPath', desc: 'Thêm Trim Paths + slider Start / End / Offset.' },

    // ---------------- Text ----------------
    { id: 'findReplaceText', name: 'Find & Replace Text', cat: 'text', icon: 'find', desc: 'Tìm và thay chữ trong text layer.',
      params: [P.text('find', 'Tìm', ''), P.text('replace', 'Thay bằng', '')] },
    { id: 'loremIpsum', name: 'Lorem Ipsum', cat: 'text', icon: 'lorem', desc: 'Tạo text giả.', params: [P.num('words', 'Số từ', 12, { min: 1 })] },
    { id: 'typewriter', name: 'Typewriter', cat: 'text', icon: 'typewriter', desc: 'Hiện dần từng ký tự (slider Typewriter %).',
      params: [P.num('seconds', 'Thời lượng (giây)', 2), P.check('cursor', 'Con trỏ nhấp nháy', true)] },
    { id: 'numberCounter', name: 'Number Counter', cat: 'text', icon: 'counter', desc: 'Text đếm số (slider Counter).',
      params: [P.num('from', 'Từ', 0), P.num('to', 'Đến', 100), P.num('seconds', 'Thời lượng (giây)', 2), P.num('decimals', 'Số thập phân', 0, { min: 0, max: 6 }),
        P.check('separator', 'Phân cách hàng nghìn', true), P.text('prefix', 'Tiền tố', ''), P.text('suffix', 'Hậu tố', '')] },
    { id: 'textBox', name: 'Text Box Generator', cat: 'text', icon: 'textBox', desc: 'Nền tự co giãn theo text.',
      params: [P.num('padX', 'Padding ngang', 24), P.num('padY', 'Padding dọc', 14), P.num('round', 'Bo góc', 8)] },

    // ---------------- Animation ----------------
    { id: 'elastic', name: 'Overshoot', cat: 'animation', desc: 'Dao động đàn hồi sau keyframe.' },
    { id: 'bounce', name: 'Bounce', cat: 'animation', desc: 'Nảy lại sau keyframe.' },
    { id: 'wiggleProperty', name: 'Wiggle Property', cat: 'animation', icon: 'wiggle', desc: 'Wiggle có slider Freq / Amp.',
      params: [P.num('freq', 'Tần số', 2), P.num('amp', 'Biên độ', 30)] },
    { id: 'spin', name: 'Spin', cat: 'animation', icon: 'spin', desc: 'Xoay liên tục.', params: [P.num('speed', 'Tốc độ (độ/giây)', 90)] },
    { id: 'autoFader', name: 'Auto Fader', cat: 'animation', icon: 'fade', desc: 'Fade in/out tự động theo In/Out point.',
      params: [P.num('fadeIn', 'Fade in (frame)', 10), P.num('fadeOut', 'Fade out (frame)', 10)] },
    { id: 'blinker', name: 'Blinker / Flicker', cat: 'animation', icon: 'blink', desc: 'Nhấp nháy opacity.',
      params: [P.num('freq', 'Tần số', 6), P.num('random', 'Ngẫu nhiên (%)', 0)] },
    { id: 'stopMotion', name: 'Stop Motion', cat: 'animation', icon: 'stopMotion', desc: 'Giật hình kiểu stop-motion.', params: [P.num('fps', 'FPS', 12)] },
    { id: 'createLimb', name: 'Bend / Limb Rig', cat: 'animation', desc: 'Ống/tay chân uốn cong bằng 2 null.' },
    { id: 'positionTrace', name: 'Position Trace', cat: 'animation', desc: 'Vẽ quỹ đạo chuyển động thành shape.', mods: { alt: 'Chỉ work area' } }
  ];

  var byId = {}, byCat = {};
  CATS.forEach(function (c) { byCat[c.id] = []; });
  TOOLS.forEach(function (t) { byId[t.id] = t; byCat[t.cat].push(t); });
  var catById = {};
  CATS.forEach(function (c) { catById[c.id] = c; });

  // Loại item người dùng có thể thêm vào user panel
  var ITEM_TYPES = [
    { type: 'tool', name: 'MenMen Tool', icon: 'star', desc: 'Một tool có sẵn' },
    { type: 'expression', name: 'Expression', icon: 'cat-expression', desc: 'Dán expression, áp lên property đang chọn' },
    { type: 'scriptlet', name: 'Scriptlet', icon: 'script', desc: 'Đoạn ExtendScript ngắn' },
    { type: 'script', name: 'Script File', icon: 'script', desc: 'File .jsx / .jsxbin' },
    { type: 'preset', name: 'Preset', icon: 'preset', desc: 'File .ffx, áp lên layer đang chọn' },
    { type: 'effect', name: 'Effect', icon: 'effect', desc: 'Tên hoặc matchName effect' },
    { type: 'command', name: 'Menu Command', icon: 'command', desc: 'Tên lệnh menu AE hoặc command ID' },
    { type: 'divider', name: 'Divider', icon: 'divider', desc: 'Đường kẻ ngăn nhóm' }
  ];

  window.Tools = {
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

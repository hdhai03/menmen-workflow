/* tools.js - danh mục tool. Thêm tool mới: thêm 1 mục ở đây + 1 hàm MMW.tools.<id> trong host/lib. */
(function () {
  var CATS = {
    composition: { name: 'Composition', color: '#7b8cff' },
    animation:   { name: 'Animation',   color: '#ff8a4c' },
    shapes:      { name: 'Shapes',      color: '#35c9a0' },
    layers:      { name: 'Layers',      color: '#c47dff' },
    rig:         { name: 'Rig',         color: '#f2c14e' },
    render:      { name: 'Render',      color: '#ff5d7a' },
    custom:      { name: 'Custom',      color: '#9aa4b2' }
  };

  // Icon nét 24x24 (stroke = currentColor)
  var I = {
    cropComp: '<path d="M6 2v16h16"/><path d="M2 6h16v16"/>',
    compDuplicator: '<rect x="3" y="7" width="11" height="11" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5"/>',
    unPreComp: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 12h9M15 9l3 3-3 3"/><path d="M8 8v8" />',
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
    customScript: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    customExpression: '<path d="M9 4c-3 0-3 3-3 5s-2 3-3 3c1 0 3 1 3 3s0 5 3 5M15 4c3 0 3 3 3 5s2 3 3 3c-1 0-3 1-3 3s0 5-3 5"/>'
  };

  // mods: mô tả hành vi khi giữ phím bổ trợ lúc click.
  var TOOLS = [
    { id: 'cropComp', name: 'Crop Comp', cat: 'composition', desc: 'Crop precomp về đúng vùng nội dung nhìn thấy.' },
    { id: 'compDuplicator', name: 'Comp Duplicator', cat: 'composition', desc: 'Nhân bản comp cùng comp lồng bên trong, cập nhật expression.',
      mods: { alt: 'Đưa tất cả bản sao vào folder mới' } },
    { id: 'unPreComp', name: 'UnPreComp', cat: 'composition', desc: 'Bung layer trong precomp ra comp hiện tại.',
      mods: { alt: 'Giữ layer precomp (tắt + shy)' } },

    { id: 'easyKeyframes', name: 'Easy Keyframes', cat: 'animation', widget: 'easyKeyframes', size: [3, 2],
      desc: 'Đổi easing keyframe nhanh: kéo influence rồi bấm Ease / In / Out / Linear / Hold.' },
    { id: 'clone', name: 'Clone', cat: 'animation', desc: 'Copy keyframe đang chọn tới playhead.',
      mods: { alt: 'Clone và chọn các key mới', shift: 'Clone đảo ngược' } },
    { id: 'easings', name: 'Easings Manager', cat: 'animation', widget: 'easings', size: [2, 1],
      desc: 'Copy / paste giá trị và easing giữa các keyframe.',
      mods: { alt: 'Chỉ easing', shift: 'Chỉ giá trị' } },
    { id: 'fixKeysTime', name: 'Fix Keys Time', cat: 'animation', desc: 'Đưa keyframe lệch về đúng frame của comp.' },
    { id: 'loop', name: 'Loop In/Out', cat: 'animation', desc: 'Thêm loopOut("cycle") vào property đang chọn.',
      mods: { alt: 'pingpong', ctrl: 'continue', shift: 'offset' } },
    { id: 'elastic', name: 'Elastic', cat: 'animation', desc: 'Dao động đàn hồi sau keyframe (như lò xo).' },
    { id: 'bounce', name: 'Bounce', cat: 'animation', desc: 'Nảy lại sau keyframe (như quả bóng chạm đất).' },

    { id: 'extractShapes', name: 'Extract Shapes', cat: 'shapes', desc: 'Tách group của shape layer thành layer riêng (chọn group để chỉ tách group đó).',
      mods: { alt: 'Giữ lại layer / group gốc' } },
    { id: 'mergeShapes', name: 'Merge Shapes', cat: 'shapes', desc: 'Gộp các shape layer vào layer trên cùng.',
      mods: { alt: 'Giữ layer nguồn (tắt hiển thị)' } },
    { id: 'nullsToPoint', name: 'Nulls To Point', cat: 'shapes', desc: 'Tạo null bám theo từng điểm của Path / Mask đang chọn.',
      mods: { alt: 'Điểm path đi theo null' } },
    { id: 'selector', name: 'Selector', cat: 'shapes', desc: 'Chọn mọi Path trong shape layer.',
      mods: { alt: 'Chọn mọi Fill', shift: 'Chọn mọi Stroke' } },
    { id: 'shapesFromVector', name: 'Shapes From Vector', cat: 'shapes', desc: 'Chuyển layer Illustrator / PDF thành shape layer.',
      mods: { alt: 'Xóa layer nguồn', shift: 'Xóa luôn artboard' } },
    { id: 'removeArtboards', name: 'Remove Artboards', cat: 'shapes', desc: 'Xóa group "Artboard" trong shape layer từ Illustrator.' },

    { id: 'createLimb', name: 'Create Limb', cat: 'rig', desc: 'Tạo ống/tay chân có rig với 2 null Start / End.' },
    { id: 'positionTrace', name: 'Position Trace', cat: 'rig', desc: 'Vẽ quỹ đạo chuyển động của layer thành shape (guide).',
      mods: { alt: 'Chỉ trong work area' } },

    { id: 'addNull', name: 'Add Null', cat: 'layers', desc: 'Thêm null cha ở giữa các layer đang chọn.',
      mods: { alt: 'Null mặc định (không căn giữa)', shift: 'Mỗi layer một null' } },
    { id: 'getColors', name: 'Get Colors', cat: 'layers', desc: 'Gom mọi màu vào 1 controller, màu trùng dùng chung.' },
    { id: 'moveAnchor', name: 'Move Anchor', cat: 'layers', widget: 'moveAnchor', size: [1, 1],
      desc: 'Dời anchor point tới 9 vị trí, giữ nguyên hình.', mods: { shift: 'Ô giữa: lệnh Center Anchor gốc (3D)' } },
    { id: 'sequencer', name: 'Sequencer', cat: 'layers', widget: 'sequencer', size: [3, 1],
      desc: 'Dàn layer hoặc keyframe nối tiếp nhau (xuống / lên / ngẫu nhiên).' },

    { id: 'simpleProxy', name: 'Simple Proxy', cat: 'render', desc: 'Render proxy cho comp nặng và gắn tự động.',
      mods: { alt: 'Gỡ proxy', shift: 'Bật/tắt dùng proxy' } },

    { id: 'customScript', name: 'Custom Script', cat: 'custom', hostId: 'runFile', user: true,
      desc: 'Chạy file .jsx / .jsxbin hoặc áp preset .ffx của bạn.' },
    { id: 'customExpression', name: 'Custom Expression', cat: 'custom', hostId: 'applyExpression', user: true,
      desc: 'Áp expression của bạn lên property đang chọn.', mods: { alt: 'Xóa expression' } }
  ];

  var byId = {};
  TOOLS.forEach(function (t) { byId[t.id] = t; });

  window.Tools = {
    CATS: CATS,
    list: TOOLS,
    get: function (id) { return byId[id]; },
    icon: function (id) {
      return '<svg viewBox="0 0 24 24" class="ico" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        (I[id] || I.customScript) + '</svg>';
    }
  };
})();

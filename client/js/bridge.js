/* bridge.js - giao tiếp với After Effects qua CEP (không cần CSInterface.js).
 * Khi mở index.html bằng trình duyệt thường, bridge chạy ở chế độ mock để xem trước giao diện. */
(function () {
  var cep = window.__adobe_cep__;
  var B = { inCEP: !!cep };

  B.extId = cep ? cep.getExtensionId()
    : 'com.menmen.workflow.panel' + (new URLSearchParams(location.search).get('panel') || '1');
  B.panelNo = B.extId.replace(/^.*panel/, '');

  B.systemPath = function (type) {
    if (!cep) return '';
    var p = decodeURI(cep.getSystemPath(type));
    return /^file:\/\/\/[A-Za-z]:/.test(p) ? p.replace('file:///', '') : p.replace('file://', '');
  };
  B.extPath = B.systemPath('extension');
  B.userData = B.systemPath('userData');

  B.evalScript = function (script) {
    return new Promise(function (resolve) {
      if (!cep) {
        console.log('[mock evalScript]', script);
        setTimeout(function () { var m = /MMW\.run\("(\w+)"/.exec(script);
        resolve('OK|(xem trước) đã gọi ' + (m ? m[1] : 'host')); }, 60);
        return;
      }
      cep.evalScript(script, function (r) { resolve(r); });
    });
  };

  // Kết quả từ host luôn có dạng "OK|msg" hoặc "ERR|msg".
  B.parse = function (r) {
    r = String(r == null ? '' : r);
    if (r === 'EvalScript error.') return { ok: false, msg: 'Lỗi ExtendScript (host chưa được nạp?)' };
    var i = r.indexOf('|');
    if (i < 0) return { ok: true, msg: r };
    return { ok: r.slice(0, i) === 'OK', msg: r.slice(i + 1) };
  };

  B.run = function (toolId, opts) {
    var s = 'MMW.run(' + JSON.stringify(toolId) + ',' + JSON.stringify(opts || {}) + ')';
    return B.evalScript(s).then(B.parse);
  };

  B.loadHost = function () {
    if (!cep) return Promise.resolve({ ok: true, msg: 'mock' });
    var root = B.extPath.replace(/\\/g, '/');
    var s = '(function(){try{$.evalFile(new File(' + JSON.stringify(root + '/host/main.jsx') + '));return MMW.load(' +
      JSON.stringify(root) + ');}catch(e){return "ERR|"+e.message;}})()';
    return B.evalScript(s).then(B.parse);
  };

  // ----- events giữa các panel -----
  B.on = function (type, fn) {
    if (cep) {
      cep.addEventListener(type, function (e) {
        var d = e.data;
        try { if (typeof d === 'string') d = JSON.parse(d); } catch (x) { /* ignore */ }
        fn(d, e);
      });
    } else {
      window.addEventListener('storage', function (e) {
        if (e.key === 'mmw:event:' + type) { try { fn(JSON.parse(e.newValue).data); } catch (x) { /* ignore */ } }
      });
    }
  };
  B.emit = function (type, data) {
    if (cep) {
      cep.dispatchEvent({ type: type, scope: 'APPLICATION', appId: '', extensionId: B.extId, data: JSON.stringify(data) });
    } else {
      try { localStorage.setItem('mmw:event:' + type, JSON.stringify({ data: data, t: Date.now() })); } catch (x) { /* ignore */ }
    }
  };

  B.hostEnv = function () {
    if (!cep) return null;
    try { return JSON.parse(cep.getHostEnvironment()); } catch (e) { return null; }
  };

  // ----- file system (window.cep.fs) -----
  var fs = window.cep && window.cep.fs;
  B.fs = {
    available: !!fs,
    read: function (path) {
      if (!fs) return null;
      var r = fs.readFile(path);
      return r.err === 0 ? r.data : null;
    },
    write: function (path, data) {
      if (!fs) return false;
      var dir = path.replace(/[\\/][^\\/]*$/, '');
      fs.makedir(dir);
      return fs.writeFile(path, data).err === 0;
    },
    openDialog: function (title, exts) {
      if (!fs) return null;
      var r = fs.showOpenDialogEx(false, false, title, null, exts || []);
      return r.err === 0 && r.data && r.data.length ? r.data[0] : null;
    },
    saveDialog: function (title, name, exts) {
      if (!fs) return null;
      var r = fs.showSaveDialogEx(title, null, exts || [], name);
      return r.err === 0 && r.data ? r.data : null;
    }
  };

  B.openURL = function (url) {
    if (window.cep && window.cep.util) window.cep.util.openURLInDefaultBrowser(url);
    else window.open(url, '_blank');
  };

  window.Bridge = B;
})();

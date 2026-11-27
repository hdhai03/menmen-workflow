/* fxwindow.js - the floating FX Search window (extension com.menmen.workflow.fxsearch, a Modeless window).
 * It opens over After Effects from Window > Extensions > MenMen FX Search, from the global shortcut
 * (the "MenMen FX Search.jsx" script bound in Edit > Keyboard Shortcuts) or from a MenMen panel.
 * Enter applies and closes the window; Esc closes it. */
(function () {
  var B = window.Bridge, S = window.Store, T = window.Tools, W = window.Widgets;
  var cep = window.__adobe_cep__, status = document.getElementById('fxstatus');

  function closeWindow() {
    if (cep && cep.closeExtension) { try { cep.closeExtension(); return; } catch (e) { /* ignore */ } }
    window.close();
  }
  function say(msg, ok) { status.textContent = msg || ''; status.classList.toggle('err', ok === false); }

  S.load();
  S.onExternalChange(function () {});
  // the search's "close" closes this window (fxsearch.js calls UI.close() before / after running)
  window.UI = window.UI || {};
  window.UI.close = function () { /* closing waits until the action has been sent: see ctx.after */ };

  var t = T.get('fxSearch');
  // MenMen tools that need a panel (dialogs, widgets, a save box) are run by an open MenMen panel
  function needsPanel(x) { return !!(x.widget || x.client || (x.params && x.params.length)); }
  var ctx = {
    data: S.data,
    save: function () { S.save(); },
    query: function (id, o) { return B.run(id, o || {}); },
    run: function (id, o) {
      say('Applying…');
      return B.run(id, o || {}).then(function (r) {
        S.track('fxSearch');
        if (r && r.ok) { say(r.msg, true); setTimeout(closeWindow, 150); } else say(r ? r.msg : 'Error', false);
        return r;
      });
    },
    runTool: function (id, e) {
      var x = T.get(id); if (!x) return;
      S.track(id);
      if (needsPanel(x)) {
        B.emit('com.menmen.workflow.runtool', { id: id, alt: !!(e && e.altKey), shift: !!(e && e.shiftKey), ctrl: !!(e && (e.ctrlKey || e.metaKey)) });
        say('Opened in the MenMen panel'); setTimeout(closeWindow, 300);
        return;
      }
      say('Running ' + x.name + '…');
      B.run(x.host || x.id, Object.assign({ alt: !!(e && e.altKey), shift: !!(e && e.shiftKey), ctrl: !!(e && (e.ctrlKey || e.metaKey)) }, x.opts || {})).then(function (r) {
        if (r && r.ok) { say(r.msg, true); setTimeout(closeWindow, 150); } else say(r ? r.msg : 'Error', false);
      });
    }
  };

  B.loadHost().then(function (r) {
    if (r && !r.ok) say('Could not load the host scripts: ' + r.msg, false);
    if (B.inCEP) B.run('listLibrary', { root: (B.extPath || '').replace(/\\/g, '/') }).then(function (l) {
      try { T.registerScripts(JSON.parse(l.msg)); } catch (e) { /* no library */ }
    });
  });
  document.getElementById('fx').appendChild(W.fxSearch(S.widgetData('fxSearch'), ctx));
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeWindow(); });
  // opened again while already open (shortcut pressed twice): just focus the box
  window.addEventListener('focus', function () { var i = document.querySelector('.fxs-input'); if (i) { i.focus(); i.select(); } });
})();

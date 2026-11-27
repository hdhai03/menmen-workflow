// MenMen FX Search - opens the floating FX Search window of MenMen Workflow from anywhere in After Effects.
// Installed into After Effects' Scripts folder by FX Search settings > Apply to After Effects, which also
// writes the chosen key into After Effects' shortcut file (it works after restarting After Effects).
(function () {
    var id = 0;
    try { id = app.findMenuCommandId("MenMen FX Search"); } catch (e) {}
    if (id) { app.executeCommand(id); return; }
    // fallback: ask an open MenMen panel to open the window
    try {
        if (!ExternalObject.PlugPlugExternalObject) new ExternalObject("lib:PlugPlugExternalObject");
        var ev = new CSXSEvent();
        ev.type = "com.menmen.workflow.openfx";
        ev.data = "";
        ev.dispatch();
    } catch (e2) {
        alert("MenMen FX Search: open Window > Extensions > MenMen FX Search once, then try the shortcut again.");
    }
})();

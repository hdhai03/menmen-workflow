/* update.js - checks GitHub for a newer MenMen Workflow and installs it in place.
 * The version lives in version.json at the repo root (bump it to publish an update).
 * Install: the main branch zip is downloaded and copied over the extension folder with the system's own
 * tools (curl + ditto + rsync on macOS, PowerShell + robocopy on Windows). The extension folder is mirrored:
 * files that are no longer part of the plugin are deleted, except what the user adds - library/ (their
 * scripts) and presets/ (their .ffx presets) only get new files, nothing there is deleted. Settings live in
 * userData and scripts in Documents, outside the extension folder.
 * A git checkout is updated with `git pull --ff-only` instead. */
(function () {
  var B = window.Bridge;
  var REPO = 'hdhai03/menmen-workflow', BRANCH = 'main';
  var VERSION_URL = 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/version.json';
  var ZIP_URL = 'https://codeload.github.com/' + REPO + '/zip/refs/heads/' + BRANCH;
  var ROOT = (B.extPath || '').replace(/\\/g, '/');
  var STATE = B.userData ? B.userData.replace(/\\/g, '/') + '/MenMenWorkflow/update.json' : null;
  var WIN = navigator.platform.indexOf('Win') === 0;

  function readJSON(path) { try { var s = B.fs.read(path); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function state() { return (STATE && readJSON(STATE)) || {}; }
  function saveState(s) { if (STATE) B.fs.write(STATE, JSON.stringify(s)); }
  function local() { var v = readJSON(ROOT + '/version.json'); return v && v.version ? v.version : '0.0.0'; }
  // 1.10.0 > 1.9.2
  function cmp(a, b) {
    a = String(a).split('.'); b = String(b).split('.');
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var x = parseInt(a[i], 10) || 0, y = parseInt(b[i], 10) || 0;
      if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
  }
  function remote() {
    return new Promise(function (res, rej) {
      var x = new XMLHttpRequest();
      x.open('GET', VERSION_URL + '?t=' + Date.now());
      x.timeout = 15000;
      x.onload = function () {
        if (x.status !== 200) return rej(new Error('GitHub answered ' + x.status));
        try { var v = JSON.parse(x.responseText); if (!v.version) throw 0; res(v); } catch (e) { rej(new Error('Bad version.json on GitHub')); }
      };
      x.onerror = x.ontimeout = function () { rej(new Error('No connection to GitHub')); };
      x.send();
    });
  }

  // { current, latest, notes, available, git }
  function check() {
    var s = state();
    s.checked = Date.now(); saveState(s);  // claim the check so the other panels opening now stay quiet
    return remote().then(function (v) {
      var cur = local(), r = { current: cur, latest: v.version, notes: v.notes || [], date: v.date || '', available: cmp(v.version, cur) > 0, git: isGit() };
      s = state(); s.latest = v.version; s.notes = r.notes; s.checked = Date.now(); saveState(s);
      return r;
    });
  }
  // Startup: once per ~20 minutes across all panels. Resolves null when another panel already checked.
  function startupCheck() {
    if (!B.inCEP || !STATE) return Promise.resolve(null);
    var s = state();
    if (s.checked && Date.now() - s.checked < 20 * 60000) return Promise.resolve(null);
    return check().catch(function () { return null; });
  }
  // Known newer version from the last check (for the badge) without going online.
  function cached() {
    var s = state(), cur = local();
    return s.latest && cmp(s.latest, cur) > 0 ? { current: cur, latest: s.latest, notes: s.notes || [] } : null;
  }

  function isGit() { return !!(window.cep && ROOT && window.cep.fs.stat(ROOT + '/.git').err === 0); }
  function writable() {
    var p = ROOT + '/.mmw-write-test';
    if (window.cep.fs.writeFile(p, 'x').err !== 0) return false;
    window.cep.fs.deleteFile(p);
    return true;
  }
  function sh(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
  function ps(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }
  function command(git, elevate) {
    var dest = WIN ? ROOT.replace(/\//g, '\\') : ROOT;
    if (WIN) {
      var script = git
        ? "$ErrorActionPreference='Stop';$g=(Get-Command git -ErrorAction SilentlyContinue).Source;" +
          "if(-not $g){$g='C:\\Program Files\\Git\\cmd\\git.exe'};if(-not (Test-Path $g)){throw 'Git is not installed'};" +
          "& $g -C " + ps(dest) + " pull --ff-only 2>&1;if($LASTEXITCODE -ne 0){throw 'git pull failed'};'MMW_OK'"
        : "$ErrorActionPreference='Stop';[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" +
          "$t=Join-Path $env:TEMP ('MenMenUpdate_'+[guid]::NewGuid().ToString('N'));New-Item -ItemType Directory -Path $t|Out-Null;" +
          "Invoke-WebRequest -UseBasicParsing -Uri " + ps(ZIP_URL) + " -OutFile (Join-Path $t 'u.zip');" +
          "Expand-Archive -LiteralPath (Join-Path $t 'u.zip') -DestinationPath (Join-Path $t 'x');" +
          "$s=(Get-ChildItem -LiteralPath (Join-Path $t 'x') -Directory|Select-Object -First 1).FullName;" +
          // 1) mirror everything except the user folders (/MIR deletes files the new version no longer has),
          // 2) add the new version's files to library / presets without deleting anything there
          "$o=@('/NFL','/NDL','/NJH','/NJS','/NP','/R:2','/W:1');" +
          "robocopy $s " + ps(dest) + " /MIR /XD library presets .git @o|Out-Null;$rc=$LASTEXITCODE;" +
          "foreach($k in 'library','presets'){$f=Join-Path $s $k;if(Test-Path $f){robocopy $f (Join-Path " + ps(dest) + " $k) /E @o|Out-Null;if($LASTEXITCODE -ge 8){$rc=$LASTEXITCODE}}};" +
          "Remove-Item -LiteralPath $t -Recurse -Force -ErrorAction SilentlyContinue;if($rc -ge 8){throw ('Copy failed ('+$rc+')')};'MMW_OK'";
      if (elevate) {
        // Installed for all users (Program Files): the same update runs in an elevated PowerShell - Windows
        // shows its administrator (UAC) prompt. The elevated script writes its result to a file we read back.
        var inner = "param($r);try{$x=& {" + script + "};Set-Content -LiteralPath $r -Value ($x -join ' ')}catch{Set-Content -LiteralPath $r -Value ('ERR '+$_.Exception.Message)}";
        script = "$ErrorActionPreference='Stop';$id=[guid]::NewGuid().ToString('N');" +
          "$f=Join-Path $env:TEMP ('MenMenUpdate_'+$id+'.ps1');$r=Join-Path $env:TEMP ('MenMenUpdate_'+$id+'.txt');" +
          "Set-Content -LiteralPath $f -Value " + ps(inner) + " -Encoding UTF8;" +
          "try{Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',([char]34+$f+[char]34),([char]34+$r+[char]34))}" +  // [char]34 = a double quote (paths may contain spaces)
          "catch{Remove-Item -LiteralPath $f -ErrorAction SilentlyContinue;throw 'Administrator permission was not given'};" +
          "$o=Get-Content -LiteralPath $r -Raw -ErrorAction SilentlyContinue;Remove-Item -LiteralPath $f,$r -ErrorAction SilentlyContinue;" +
          "if($o -match 'MMW_OK'){'MMW_OK'}else{throw ('Update failed: '+$o)}";
      }
      return ['C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script];
    }
    var s2 = git
      ? 'g=; for x in /usr/bin/git /opt/homebrew/bin/git /usr/local/bin/git; do [ -x "$x" ] && { g="$x"; break; }; done; ' +
        '[ -n "$g" ] || { echo "Git is not installed" >&2; exit 1; }; "$g" -C ' + sh(dest) + ' pull --ff-only 2>&1 && echo MMW_OK'
      : 'set -e; t=$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/MenMenUpdate.XXXXXX"); ' +
        '/usr/bin/curl -fsSL --retry 2 -o "$t/u.zip" ' + sh(ZIP_URL) + '; ' +
        '/usr/bin/ditto -x -k "$t/u.zip" "$t/x"; s=$(ls -d "$t"/x/*/ | head -n 1); ' +
        // mirror: delete what the new version no longer has, but never touch library/ or presets/ files
        '/usr/bin/rsync -a --delete --filter="P /library/***" --filter="P /presets/***" --filter="P /.git/***" "$s" ' + sh(dest + '/') + '; ' +
        '/bin/rm -rf "$t"; echo MMW_OK';
    return ['/bin/sh', '-c', s2];
  }
  // Downloads and installs. Resolves with the new version; rejects with a readable message.
  function install() {
    var P = window.cep && window.cep.process;
    if (!P || !P.createProcess || !ROOT) return Promise.reject(new Error('Updating only works inside After Effects.'));
    var git = isGit();
    // read-only folder (installed for all users): on Windows ask for administrator permission (UAC)
    var elevate = !writable();
    if (elevate && (!WIN || git)) return Promise.reject(new Error('The extension folder is read-only (installed for all users): ' + ROOT + '. Reinstall it in your user extensions folder, or update it by hand.'));
    return new Promise(function (res, rej) {
      var r, out = '', err = '';
      try { r = P.createProcess.apply(P, command(git, elevate)); } catch (e) { return rej(new Error('Cannot start the updater: ' + e.message)); }
      if (!r || r.err !== 0) return rej(new Error('Cannot start the updater'));
      P.stdout(r.data, function (c) { out += c; });
      if (P.stderr) P.stderr(r.data, function (c) { err += c; });
      var timer = setTimeout(function () { try { P.terminate(r.data); } catch (e) { /* ignore */ } rej(new Error('The update timed out')); }, 5 * 60000);
      P.onquit(r.data, function () {
        clearTimeout(timer);
        if (out.indexOf('MMW_OK') >= 0) {
          var v = local(), s = state(); s.latest = v; s.checked = Date.now(); saveState(s);
          return res({ version: v, git: git });
        }
        var msg = (err || out).replace(/MMW_OK/g, '').trim().split(/\r?\n/).slice(-3).join(' ');
        rej(new Error((git ? 'git pull: ' : '') + (msg || 'The update failed')));
      });
    });
  }

  // Windows install for all users: the update will show the administrator (UAC) prompt
  function needsAdmin() { return !!(window.cep && ROOT && WIN && !isGit() && !writable()); }

  window.Updater = { needsAdmin: needsAdmin, check: check, startupCheck: startupCheck, cached: cached, install: install, local: local, cmp: cmp, isGit: isGit, REPO: REPO };
})();

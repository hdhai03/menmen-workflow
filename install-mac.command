#!/bin/bash
# MenMen Workflow - installer for macOS. Double-click this file (or right-click > Open the first time).
# 1) allows unsigned extensions in After Effects 2022-2026 (PlayerDebugMode for CSXS 9-13)
# 2) copies this folder to ~/Library/Application Support/Adobe/CEP/extensions/com.menmen.workflow
#    (existing files are replaced, your own scripts in library/ are kept)
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.menmen.workflow"

echo "MenMen Workflow installer"
echo "-------------------------"
if [ ! -f "$SRC/CSXS/manifest.xml" ]; then
  echo "ERROR: run this file from inside the MenMen Workflow folder (CSXS/manifest.xml not found)."
  read -r -p "Press Enter to close." _; exit 1
fi

for v in 9 10 11 12 13; do defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1; done
echo "OK  Unsigned extensions allowed (CSXS 9-13)"

if [ -L "$DEST" ]; then
  echo "OK  $DEST is a link to a development copy - left as it is"
elif [ "$SRC" != "$DEST" ]; then
  mkdir -p "$DEST"
  /usr/bin/ditto "$SRC" "$DEST"
  echo "OK  Copied to $DEST"
fi
/usr/bin/xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true
# CEP reads PlayerDebugMode at launch; make sure the preferences are flushed
killall cfprefsd 2>/dev/null || true

echo
echo "Done. Quit After Effects completely, open it again, then Window > Extensions > MenMen Workflow."
read -r -p "Press Enter to close." _

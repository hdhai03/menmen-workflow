#!/usr/bin/env bash
# Installs MenMen Workflow for development on macOS: enables PlayerDebugMode + symlinks into the CEP extensions folder.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"
DEST="$DEST_DIR/com.menmen.workflow"

for v in 9 10 11 12; do
  defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1
done
echo "✓ PlayerDebugMode enabled (CSXS 9-12)"

mkdir -p "$DEST_DIR"
if [ -L "$DEST" ]; then
  echo "• Symlink already exists: $DEST"
elif [ -e "$DEST" ]; then
  echo "✗ $DEST already exists and is not a symlink. Remove or rename that folder yourself, then run again." >&2
  exit 1
else
  ln -s "$SRC" "$DEST"
  echo "✓ Linked $SRC → $DEST"
fi
echo "Restart After Effects, then open Window ▸ Extensions ▸ MenMen Workflow"

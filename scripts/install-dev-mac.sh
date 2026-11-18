#!/usr/bin/env bash
# Cài MenMen Workflow ở chế độ dev trên macOS: bật PlayerDebugMode + symlink vào thư mục CEP extensions.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"
DEST="$DEST_DIR/com.menmen.workflow"

for v in 9 10 11 12; do
  defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1
done
echo "✓ Đã bật PlayerDebugMode (CSXS 9-12)"

mkdir -p "$DEST_DIR"
if [ -L "$DEST" ]; then
  echo "• Symlink đã tồn tại: $DEST"
elif [ -e "$DEST" ]; then
  echo "✗ $DEST đã tồn tại và không phải symlink. Hãy tự xóa/đổi tên thư mục đó rồi chạy lại." >&2
  exit 1
else
  ln -s "$SRC" "$DEST"
  echo "✓ Đã link $SRC → $DEST"
fi
echo "Khởi động lại After Effects, rồi mở Window ▸ Extensions ▸ MenMen Workflow 1..4"

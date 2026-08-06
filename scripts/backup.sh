#!/usr/bin/env bash
# Pull a timestamped backup of the live database and uploads from the Hetzner VPS.
# Usage: bash scripts/backup.sh
# Backups land in: ~/dcfc-backups/YYYYMMDD-HHMMSS/

set -euo pipefail

DATE=$(date +%Y%m%d-%H%M%S)
DEST="$HOME/dcfc-backups/$DATE"
SERVER="root@188.245.172.170"
DB_PATH="/home/claude/code/dcfc/db.sqlite"
UPLOADS_PATH="/var/lib/dcfc/uploads/"

mkdir -p "$DEST/uploads"

echo "▸ Backing up database..."
rsync -az "$SERVER:$DB_PATH" "$DEST/db.sqlite"

echo "▸ Backing up uploads..."
rsync -az "$SERVER:$UPLOADS_PATH" "$DEST/uploads/"

SIZE=$(du -sh "$DEST" | cut -f1)
echo ""
echo "✓ Backup complete: $DEST ($SIZE)"
echo ""
echo "Files:"
ls "$DEST"

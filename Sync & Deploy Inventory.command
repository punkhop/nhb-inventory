#!/usr/bin/env bash

# ============================================================
#  NHB Inventory — Sync from Notion & Deploy
#  Double-click this file to update the inventory app.
# ============================================================

clear
echo "========================================"
echo "  NHB Inventory — Sync & Deploy"
echo "========================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Source zshrc for PATH (wrangler, python3, git)
source ~/.zshrc 2>/dev/null

# Run the sync script with --deploy
if "$SCRIPT_DIR/sync.sh" --deploy; then
    ITEM_COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/nhb-sync-data.json'))))")

    echo ""
    echo "========================================"
    echo "  SUCCESS!"
    echo "  $ITEM_COUNT items synced and deployed."
    echo "  https://nhb-inventory.pages.dev/"
    echo "========================================"

    # Show macOS notification
    osascript -e "display notification \"$ITEM_COUNT items synced and deployed to nhb-inventory.pages.dev\" with title \"NHB Inventory\" subtitle \"Sync Complete\" sound name \"Glass\""

else
    echo ""
    echo "========================================"
    echo "  FAILED — see errors above"
    echo "========================================"

    # Show macOS error dialog
    osascript -e 'display alert "NHB Inventory Sync Failed" message "Check the Terminal window for error details." as critical'
fi

echo ""
echo "Press any key to close..."
read -n 1 -s

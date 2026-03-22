#!/usr/bin/env bash
# sync-airtable-scripts-to-drive.sh
#
# Copies the 9 Airtable-only scripts + GoogleDocsPrepSystem.gs (.gs → .txt) + README to Google Drive.
# Uses the clasp OAuth refresh token for authentication.
#
# Target folder: https://drive.google.com/drive/folders/1FN-IyBCXj1r_zDNunpZzR-8u8DRSSiSp
#
# Usage:
#   cd "The Waratah/scripts"
#   bash sync-airtable-scripts-to-drive.sh

set -euo pipefail

DRIVE_FOLDER_ID="1FN-IyBCXj1r_zDNunpZzR-8u8DRSSiSp"
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
CLASP_CREDS="$HOME/.clasprc.json"

# Files to sync (source .gs → uploaded as .txt)
AIRTABLE_SCRIPTS=(
  "Waratah_ClearWeeklyCount.gs"
  "Waratah_FinaliseCount.gs"
  "Waratah_GeneratePrepRun.gs"
  "Waratah_GeneratePrepSheet_TimeBasedPolling.gs"
  "Waratah_InitStockCount.gs"
  "Waratah_ValidateStockCount.gs"
  "Waratah_GenerateStockOrders.gs"
  "Waratah_CompleteStockCount.gs"
  "Waratah_ExportOrderingDoc.gs"
)

GAS_SCRIPTS=(
  "GoogleDocsPrepSystem.gs"
)

# ── Get access token via refresh_token ──────────────────────────
get_access_token() {
  local client_id client_secret refresh_token
  client_id=$(python3 -c "import json; print(json.load(open('$CLASP_CREDS'))['tokens']['default']['client_id'])")
  client_secret=$(python3 -c "import json; print(json.load(open('$CLASP_CREDS'))['tokens']['default']['client_secret'])")
  refresh_token=$(python3 -c "import json; print(json.load(open('$CLASP_CREDS'))['tokens']['default']['refresh_token'])")

  curl -s -X POST "https://oauth2.googleapis.com/token" \
    -d "client_id=${client_id}" \
    -d "client_secret=${client_secret}" \
    -d "refresh_token=${refresh_token}" \
    -d "grant_type=refresh_token" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])"
}

# ── Find existing file by name in folder ────────────────────────
find_file_in_folder() {
  local token="$1" filename="$2"
  local escaped
  escaped=$(echo "$filename" | sed "s/'/%27/g")
  local result
  result=$(curl -s -H "Authorization: Bearer $token" \
    "https://www.googleapis.com/drive/v3/files?q=name%3D'${escaped}'+and+'${DRIVE_FOLDER_ID}'+in+parents+and+trashed%3Dfalse&fields=files(id)")
  echo "$result" | python3 -c "import sys, json; files=json.load(sys.stdin).get('files',[]); print(files[0]['id'] if files else '')" 2>/dev/null || echo ""
}

# ── Upload or update a file ─────────────────────────────────────
upload_file() {
  local token="$1" local_path="$2" drive_name="$3" mime="$4"
  local existing_id
  existing_id=$(find_file_in_folder "$token" "$drive_name")

  if [ -n "$existing_id" ]; then
    # Update existing file
    curl -s -X PATCH \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: $mime" \
      --data-binary @"$local_path" \
      "https://www.googleapis.com/upload/drive/v3/files/${existing_id}?uploadType=media" \
      | python3 -c "import sys, json; d=json.load(sys.stdin); print(f'  Updated: {d.get(\"name\",\"\")} ({d.get(\"id\",\"?\")})')"
  else
    # Create new file
    local metadata
    metadata=$(python3 -c "import json; print(json.dumps({'name':'$drive_name','parents':['$DRIVE_FOLDER_ID']}))")
    curl -s -X POST \
      -H "Authorization: Bearer $token" \
      -F "metadata=${metadata};type=application/json" \
      -F "file=@${local_path};type=${mime}" \
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart" \
      | python3 -c "import sys, json; d=json.load(sys.stdin); print(f'  Created: {d.get(\"name\",\"\")} ({d.get(\"id\",\"?\")})')"
  fi
}

# ── Generate README ─────────────────────────────────────────────
generate_readme() {
  local readme_path="$1"
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S %Z')
  cat > "$readme_path" <<READMEEOF
# Waratah PREP Scripts — Drive Backup

**Last synced:** ${timestamp}

These .txt files are raw copies of the Waratah PREP system scripts. The
Airtable automation scripts are excluded from clasp push (.claspignore) and
must be pasted manually into Airtable. GoogleDocsPrepSystem is deployed via
clasp but backed up here for reference.

## Files

| File | Purpose | Environment |
|------|---------|-------------|
| Waratah_ClearWeeklyCount.txt | Reset weekly counts (Saturday AM) | Airtable automation |
| Waratah_FinaliseCount.txt | Validate stocktake (Monday AM) | Airtable automation |
| Waratah_GeneratePrepRun.txt | Generate prep tasks from shortfalls (Monday AM) | Airtable automation |
| Waratah_GeneratePrepSheet_TimeBasedPolling.txt | Mark exports as REQUESTED for GAS pickup | Airtable automation |
| Waratah_InitStockCount.txt | Create stock count session + placeholders (Monday AM) | Airtable automation |
| Waratah_ValidateStockCount.txt | Validate stock counts, flag outliers | Airtable automation |
| Waratah_GenerateStockOrders.txt | Generate combined stock orders with prep usage | Airtable automation |
| Waratah_CompleteStockCount.txt | Button-triggered: advance session to Completed | Airtable automation |
| Waratah_ExportOrderingDoc.txt | Trigger ordering doc export via GAS polling | Airtable automation |
| GoogleDocsPrepSystem.txt | Main doc exporter + Slack notifications (~2600 lines) | Google Apps Script |

## How to update Airtable

1. Open the Airtable base → Automations
2. Find the automation that uses the script
3. Open the "Run a script" action
4. Replace the entire script content with the .txt file
5. Test the automation

## Source of truth

The .gs files in the git repo are the source of truth:
\`The Waratah/scripts/Waratah_*.gs\` (Airtable)
\`The Waratah/scripts/GoogleDocsPrepSystem.gs\` (GAS)

These .txt copies are generated by \`sync-airtable-scripts-to-drive.sh\`.
READMEEOF
}

# ── Main ────────────────────────────────────────────────────────
echo "Syncing Airtable scripts to Google Drive..."
echo "  Folder: https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}"
echo ""

echo "Refreshing access token..."
TOKEN=$(get_access_token)
echo "  Done."
echo ""

# Generate README
README_TMP=$(mktemp)
generate_readme "$README_TMP"

echo "Uploading README.md..."
upload_file "$TOKEN" "$README_TMP" "README.md" "text/markdown"
rm -f "$README_TMP"

# Upload each Airtable script as .txt
for script in "${AIRTABLE_SCRIPTS[@]}"; do
  local_path="${SCRIPTS_DIR}/${script}"
  txt_name="${script%.gs}.txt"

  if [ ! -f "$local_path" ]; then
    echo "  SKIP: $script (file not found)"
    continue
  fi

  echo "Uploading ${txt_name}..."
  upload_file "$TOKEN" "$local_path" "$txt_name" "text/plain"
done

# Upload each GAS script as .txt
for script in "${GAS_SCRIPTS[@]}"; do
  local_path="${SCRIPTS_DIR}/${script}"
  txt_name="${script%.gs}.txt"

  if [ ! -f "$local_path" ]; then
    echo "  SKIP: $script (file not found)"
    continue
  fi

  echo "Uploading ${txt_name}..."
  upload_file "$TOKEN" "$local_path" "$txt_name" "text/plain"
done

echo ""
echo "Sync complete."

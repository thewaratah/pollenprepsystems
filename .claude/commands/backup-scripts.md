Back up venue scripts to Google Drive using Google Workspace MCP tools.

Scope: $ARGUMENTS

## Venues & Drive Folders

| Venue | Drive Folder ID | Scripts Directory |
|-------|----------------|-------------------|
| Waratah | `1FN-IyBCXj1r_zDNunpZzR-8u8DRSSiSp` | `The Waratah/scripts/` |
| Sakura | `1ATD1g3YlyC-lOYVhfWuDuXlBJr1Mm1Om` | `Sakura House/scripts/` |

## Steps

1. **Determine scope** from arguments:
   - `waratah` — Waratah only
   - `sakura` — Sakura only
   - No argument or `both` — both venues

2. **For Waratah**, read and upload these files (`.gs` → `.txt` in Drive):

   **Airtable automation scripts (9):**
   - `Waratah_ClearWeeklyCount.gs`
   - `Waratah_CompleteStockCount.gs`
   - `Waratah_ExportOrderingDoc.gs`
   - `Waratah_FinaliseCount.gs`
   - `Waratah_GeneratePrepRun.gs`
   - `Waratah_GeneratePrepSheet_TimeBasedPolling.gs`
   - `Waratah_GenerateStockOrders.gs`
   - `Waratah_InitStockCount.gs`
   - `Waratah_ValidateStockCount.gs`

   **GAS scripts (5):**
   - `GoogleDocsPrepSystem.gs`
   - `PrepConfig.gs`
   - `PrepUtils.gs`
   - `PrepDocFormatting.gs`
   - `PrepDocGenerators.gs`

3. **For Sakura**, read and upload these files (`.gs` → `.txt` in Drive):

   **Airtable automation scripts (5):**
   - `ClearPrepData.gs`
   - `ClearWeeklyCount.gs`
   - `FinaliseCount.gs`
   - `GeneratePrepRun.gs`
   - `GeneratePrepSheet.gs`

   **GAS scripts (5):**
   - `GoogleDocsPrepSystem.gs`
   - `PrepConfig.gs`
   - `PrepUtils.gs`
   - `PrepDocFormatting.gs`
   - `PrepDocGenerators.gs`

   **Other GAS scripts (2):**
   - `RecipeScaler.gs`
   - `FeedbackForm.gs`

4. **Upload each file** via Google Workspace MCP `create_drive_file`:
   - Read file content from local disk using the Read tool
   - Upload as plain text to the venue's Drive folder
   - File name: replace `.gs` extension with `.txt`
   - If a file with the same name already exists in the folder, overwrite it

5. **Generate and upload README.md** to each venue's folder with:
   - Sync timestamp (Sydney timezone)
   - File inventory table: File | Purpose | Environment (Airtable / GAS)
   - Instructions for updating Airtable automations
   - Note that git repo is the source of truth

6. **Report results**: files uploaded, any errors, Drive folder links

## Notes
- Uses Google Workspace MCP OAuth (evan@pollenhospitality.com) — no clasp token needed
- Replaces `The Waratah/scripts/sync-airtable-scripts-to-drive.sh` (bash script kept as fallback)
- Re-runnable at any time — safe to run after every code change
- Email for MCP: `evan@pollenhospitality.com`

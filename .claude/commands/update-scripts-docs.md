Use the `sakura-prep-agent` sub-agent to update the Advanced Script & Automation documentation.

What changed: $ARGUMENTS

The agent will:
1. Read all scripts in `Sakura House/scripts/` to understand current state
2. Read all existing files in `Sakura House/docs/Advanced Script & Automation/`
3. Update only the files affected by the changes described above
4. Apply minimal diffs — do not rewrite files that haven't changed
5. Update WORKFLOWS.md if any workflow timing or sequence changed
6. Update EDITING_GUIDE.md if Script Properties or editing procedures changed
7. Verify no cross-venue contamination (Gooch/Sabs only, never Andie/Blade)

Files in scope:
- `OVERVIEW.md` — System architecture
- `ClearPrepData.md` — Friday AM cleanup
- `ClearWeeklyCount.md` — Saturday AM reset
- `FinaliseCount.md` — Stocktake validation
- `GeneratePrepRun.md` — Prep calculation engine
- `GeneratePrepSheet.md` — Export bridge script
- `GoogleDocsPrepSystem.md` — Document generator + Slack
- `FeedbackForm.md` — Staff feedback web app
- `RecipeScaler.md` — Recipe scaling
- `EDITING_GUIDE.md` — How to edit scripts
- `WORKFLOWS.md` — End-to-end workflows

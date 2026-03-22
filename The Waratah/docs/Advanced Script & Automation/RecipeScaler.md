# RecipeScaler.gs -- Recipe Scaler Explainer

**Script:** `RecipeScaler.gs` + `RecipeScalerUI.html`
**Environment:** Google Apps Script (deployed via clasp as part of the same GAS project)
**Access:** Web app URL stored in Script Property `RECIPE_SCALER_URL`

---

## What It Does

The Recipe Scaler is a web app that allows bar staff to scale recipes based on a target production quantity. It:

1. Shows a dropdown of all active recipes
2. When a recipe is selected, displays its ingredients with quantities
3. Allows entering a target quantity (e.g., "I want to make 2000ml")
4. Calculates scaled ingredient quantities based on the recipe's yield

This is useful when bar staff need to make a different quantity than the standard recipe yield. For example, if the recipe yields 1000ml but you need 2500ml, the scaler calculates all ingredient quantities at 2.5x.

---

## How Bar Staff Access It

The scaler is accessed via URL, either:
- From the `RECIPE_SCALER_URL` Script Property
- Via `?page=scaler` on the web app URL
- With pre-fill parameters: `?page=scaler&recipeId=recXXX` or `?page=scaler&recipe=RecipeName`

Links to the scaler can be embedded in prep documents.

---

## Recipe Name Resolution Pattern (Important)

The Waratah Recipes table does NOT have a plain text "Recipe Name" field. Instead, it uses `Item Name` -- a **linked record field** pointing to the Items table.

The `getRecipeList()` function now uses shared utilities from PrepUtils.gs:
1. **`buildActiveItemNameMap_()`** fetches all active Items and returns a `recordId -> name` map
2. **Fetch all Recipes:** Each recipe has an `Item Name` field that is an array of linked record IDs (e.g., `["recXXXXXX"]`)
3. **`resolveRecipeName_()`** extracts the first linked item ID and looks it up in the Items map

This is different from Sakura House, which has a plain text `Recipe Name` field. Never reference `fields['Recipe Name']` in Waratah code.

---

## Key Functions

| Function | Called By | Purpose |
|----------|----------|---------|
| `doGetRecipeScaler(e)` | `doGet()` router in GoogleDocsPrepSystem.gs | Serves the HTML page |
| `getRecipeList()` | Client-side JavaScript | Returns all active recipes (name + ID) using the linked-record resolution pattern |
| `getRecipeDetails(recipeIdentifier)` | Client-side JavaScript | Fetches recipe ingredients and yield using `airtableGetByIds_()` and `resolveRecipeName_()` |
| `calculateScaledRecipe(recipeId, targetQty)` | Client-side JavaScript | Calculates scaled ingredient quantities |

---

## Scaling Calculation

```
Scale Factor = Target Qty / Recipe Yield Qty
Scaled Ingredient Qty = Original Ingredient Qty x Scale Factor
```

The result includes:
- Original and scaled yield quantities
- Scale factor and scale percentage
- Each ingredient with original and scaled quantities
- Units from the Items table

---

## Configuration

The `SCALER_CONFIG` object defines:

| Setting | Value | Notes |
|---------|-------|-------|
| `tables.recipes` | `"Recipes"` | The Recipes table |
| `tables.recipeLines` | `"Recipe Lines"` | Recipe ingredient lines |
| `tables.items` | `"Items"` | For name resolution and units |

---

## Airtable Integration

- **Base ID:** From Script Property `AIRTABLE_BASE_ID` (`appfcy14ZikhKZnRS`)
- **API Key:** From Script Property `AIRTABLE_PAT`
- **Uses:** `airtableListAll_()` helper for paginated queries

---

## What Could Go Wrong

| Problem | Cause | Fix |
|---------|-------|-----|
| No recipes in dropdown | No active items exist, or `AIRTABLE_BASE_ID`/`AIRTABLE_PAT` are wrong | Check Script Properties and verify items have `Status = "Active"` |
| Recipe shows 0 ingredients | Recipe Lines are missing for the selected recipe, or the `Recipe` linked field does not match | Check Recipe Lines table in Airtable |
| "Recipe yield quantity is zero - cannot scale" | The recipe's `Yield Qty` field is empty or 0 | Set the Yield Qty on the recipe in Airtable |
| Text invisible on white background | CSS issue with global dark theme | Ensure all text elements have explicit `color: '#1a1a1a'` and form controls have explicit `backgroundColor: '#fff'` |
| Wrong base ID used | Script falls back to Sakura House base ID | Verify `AIRTABLE_BASE_ID` is `appfcy14ZikhKZnRS` (Waratah), not `appNsFRhuU47e9qlR` (Sakura) |

---

## How to Edit

1. **RecipeScaler.gs:** Edit in GAS editor or locally, then `clasp push --force`
2. **RecipeScalerUI.html:** Same approach
3. After editing, create a new deployment if needed (Deploy --> New deployment)
4. Update `RECIPE_SCALER_URL` in Script Properties if the deployment URL changes

---

## Important: Each Venue Has Its Own Deployment

The Recipe Scaler web app URL must point to The Waratah's GAS project, not Sakura House's. Each venue has its own GAS project with its own Airtable credentials. Never share deployment URLs between venues.

---

### Security

- `RecipeScalerUI.html` uses `escapeHtml()` to sanitize all user-facing output — prevents XSS injection via recipe names or ingredient data
- `doPost()` returns sanitized error messages ("Internal error") instead of full stack traces

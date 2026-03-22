# RecipeScaler.gs -- Script Explainer

**Version:** 1.1
**Runs in:** Google Apps Script (GAS)
**Trigger:** Staff access via link in generated documents or direct URL
**Last Updated:** 2026-03-22

---

## What It Does

RecipeScaler is a web app that helps staff scale recipes based on how much of a constraining ingredient they have available.

For example, if a recipe calls for 500ml of yuzu juice but you only have 350ml, the scaler calculates how much of every other ingredient to use (and what the resulting yield will be).

---

## How Staff Access It

### From Generated Docs
The Batching List and Ingredient Prep List include "Scale this recipe" links next to each batch/sub-recipe. Clicking the link opens the Recipe Scaler with that recipe pre-selected.

### Direct URL
The scaler can be accessed directly at the GAS web app URL with `?page=scaler`:
```
<deployment-url>?page=scaler
```

Or with a recipe pre-selected:
```
<deployment-url>?page=scaler&recipeId=recXXXXXXXX
```

---

## How It Works

### Step 1: Select a Recipe
Staff choose from a dropdown list of all recipes in the system. The list is populated from the Airtable Recipes table, reading the "Recipe Name" field.

### Step 2: View Ingredients
The form shows all ingredients for the selected recipe with their base quantities and units. This data comes from:
- **Recipes table:** Recipe Name, Yield Qty
- **Recipe Lines table:** Qty per ingredient
- **Items table:** Item Name, Unit

### Step 3: Select Constraining Ingredient
Staff select which ingredient they want to constrain by (the one they have a limited amount of).

### Step 4: Enter Available Quantity
Staff enter how much of that ingredient they have.

### Step 5: View Scaled Results
The scaler calculates:
```
Scale Factor = Available Qty / Original Qty of Constraining Ingredient
```

Then applies that factor to every ingredient:
```
Scaled Qty = Original Qty x Scale Factor
```

And calculates the new yield:
```
Scaled Yield = Original Yield x Scale Factor
```

Results are displayed with:
- Each ingredient's original and scaled quantities
- The constraining ingredient highlighted
- Scale percentage (e.g., "70% of original recipe")
- Scaled yield

---

## Data Source

The Recipe Scaler reads directly from Airtable via the REST API:

| Table | Fields Used |
|-------|-------------|
| Recipes | Recipe Name, Yield Qty |
| Recipe Lines | Recipe (link), Item (link), Qty |
| Items | Item Name, Unit |

**Note:** Sakura House uses `"Recipe Name"` as a plain text field. The scaler reads it directly -- it does not need to resolve linked record IDs.

---

## Script Properties Required

| Property | Purpose |
|----------|---------|
| `AIRTABLE_BASE_ID` | Sakura Airtable base (`appNsFRhuU47e9qlR`) |
| `AIRTABLE_PAT` | Airtable Personal Access Token |

---

## What Could Go Wrong

### Recipe dropdown is empty
- **Cause:** Cannot connect to Airtable, or the Recipes table has no records
- **Fix:** Run `debugRecipeScaler()` from the GAS editor to test the connection

### "Please use recipe ID for lookup" error
- **Cause:** The scaler requires a recipe record ID (recXXX format) for detail lookups
- **Fix:** This is normal -- select a recipe from the dropdown (which uses record IDs internally)

### Ingredients show "Unknown" names
- **Cause:** The linked Item record may have been deleted, or the Items table fetch failed
- **Fix:** Check that the recipe's ingredient items still exist in the Items table

### "Original quantity is zero -- cannot scale"
- **Cause:** The selected constraining ingredient has a Qty of 0 in the Recipe Lines table
- **Fix:** Update the Recipe Line quantity in Airtable

### Scaler page does not load
- **Cause:** The GAS web app deployment may not include the `?page=scaler` routing
- **Fix:** Check that GoogleDocsPrepSystem.gs has the `doGet()` router function with the scaler route

---

## How to Check If It Worked

1. **Open the scaler URL** with `?page=scaler`
2. **Select a recipe** from the dropdown
3. **Check that ingredients appear** with quantities
4. **Select a constraining ingredient** and enter a quantity
5. **Verify the scaled results** make mathematical sense

---

## How to Edit This Script

The Recipe Scaler has two files:
- `RecipeScaler.gs` -- server-side logic (recipe fetching, scaling calculation)
- `RecipeScalerUI.html` -- client-side UI (HTML, CSS, JavaScript)

Edit in the GAS editor or via clasp. After changes, create a new deployment if needed.

### Key Functions

| Function | Purpose |
|----------|---------|
| `doGetRecipeScaler()` | Serves the HTML page |
| `getRecipeList()` | Returns all recipes for the dropdown |
| `getRecipeDetails()` | Fetches full recipe with ingredients |
| `calculateScaledRecipe()` | Performs the scaling calculation |
| `debugRecipeScaler()` | Tests Airtable connection and field availability |

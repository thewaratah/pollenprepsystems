/**
 * Recipe Scaler - Constraint-based recipe scaling
 *
 * Allows bar staff to scale recipes based on available ingredients.
 * Accessed via link in prep docs with recipe pre-filled.
 *
 * Usage: Deploy as web app, access with ?recipe=RecipeName or ?recipeId=recXXX
 *
 * @version 1.1
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const SCALER_CONFIG = {
  airtable: {
    baseId: null, // Set from Script Properties
    tables: {
      recipes: 'Recipes',
      recipeLines: 'Recipe Lines',
      items: 'Items'
    }
  },
  timeZone: 'Australia/Sydney'
};

// =============================================================================
// WEB APP ENTRY POINTS
// =============================================================================

/**
 * Serves the Recipe Scaler HTML page
 * Called by the unified doGet router in GoogleDocsPrepSystem.gs
 */
function doGetRecipeScaler(e) {
  const recipeName = e.parameter.recipe || '';
  const recipeId = e.parameter.recipeId || '';

  const template = HtmlService.createTemplateFromFile('RecipeScalerUI');
  template.recipeName = recipeName;
  template.recipeId = recipeId;

  return template.evaluate()
    .setTitle('Recipe Scaler')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Include HTML files (for modular templates)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// =============================================================================
// API FUNCTIONS (called from client-side)
// =============================================================================

/**
 * Get all active recipes for dropdown.
 * Uses "Item Name" linked record field on the Recipes table to derive the recipe name,
 * and cross-references against active Items (Status = "Active") to filter out inactive recipes.
 */
function getRecipeList() {
  const activeItemNameMap = buildActiveItemNameMap_();

  const allRecipes = airtableListAll_(CFG.airtable.tables.recipes, {
    fields: [CFG.airtable.fields.recipeName, 'Yield Qty'],
    pageSize: 100,
  });

  const recipes = [];
  for (const r of allRecipes) {
    const name = resolveRecipeName_(r, activeItemNameMap);
    if (!name) continue;
    recipes.push({ id: r.id, name });
  }

  recipes.sort((a, b) => a.name.localeCompare(b.name));
  return recipes;
}

/**
 * Get recipe details with ingredients
 * Fetches ALL recipe lines and filters client-side (same approach as GoogleDocsPrepSystem.gs)
 */
function getRecipeDetails(recipeIdentifier) {
  if (!recipeIdentifier || !recipeIdentifier.startsWith('rec')) {
    throw new Error('Please use recipe ID for lookup');
  }

  // Fetch recipe record via validated helpers
  const recs = airtableGetByIds_(CFG.airtable.tables.recipes, [recipeIdentifier], [
    CFG.airtable.fields.recipeName, 'Yield Qty',
  ]);
  if (!recs.length) throw new Error('Recipe not found: ' + recipeIdentifier);
  const recipeRecord = recs[0];

  const yieldQty = recipeRecord.fields['Yield Qty'] || 1;
  const recipeId = recipeRecord.id;

  // Resolve recipe name via shared utility
  const activeItemNameMap = buildActiveItemNameMap_();
  const recipeName = resolveRecipeName_(recipeRecord, activeItemNameMap) || 'Unknown';

  // Fetch ALL recipe lines with pagination, filter client-side
  const allLines = airtableListAll_(CFG.airtable.tables.recipeLines, {
    fields: [CFG.airtable.fields.rlRecipe, CFG.airtable.fields.rlItem, CFG.airtable.fields.rlQty, 'Name', 'Unit'],
    pageSize: 100,
  });

  const matchingLines = allLines.filter(line => {
    const linkedRecipeIds = line.fields[CFG.airtable.fields.rlRecipe];
    if (!Array.isArray(linkedRecipeIds)) return false;
    return linkedRecipeIds.includes(recipeId);
  });

  // Collect item IDs from matching lines and fetch only those
  const lineItemIds = [...new Set(matchingLines
    .map(l => { const ids = l.fields[CFG.airtable.fields.rlItem]; return Array.isArray(ids) ? ids[0] : null; })
    .filter(Boolean)
  )];

  const itemsById = {};
  if (lineItemIds.length) {
    for (const item of airtableGetByIds_(CFG.airtable.tables.items, lineItemIds, [CFG.airtable.fields.itemName, CFG.airtable.fields.itemUnit])) {
      itemsById[item.id] = {
        name: item.fields[CFG.airtable.fields.itemName] || 'Unknown',
        unit: item.fields[CFG.airtable.fields.itemUnit] || '',
      };
    }
  }

  // Resolve yield unit from recipe's linked item
  const recipeItemField = recipeRecord.fields[CFG.airtable.fields.recipeName];
  let yieldUnit = '';
  if (Array.isArray(recipeItemField) && recipeItemField.length) {
    const linkedId = typeof recipeItemField[0] === 'string' ? recipeItemField[0] : recipeItemField[0]?.id;
    if (linkedId && itemsById[linkedId]) yieldUnit = itemsById[linkedId].unit;
    else {
      // Yield item might not be in lineItemIds; fetch it
      const yieldItems = airtableGetByIds_(CFG.airtable.tables.items, [linkedId], [CFG.airtable.fields.itemUnit]);
      if (yieldItems.length) yieldUnit = yieldItems[0].fields[CFG.airtable.fields.itemUnit] || '';
    }
  }

  // Build ingredients array using Item names from Items table
  const ingredients = [];
  for (const line of matchingLines) {
    const itemIds = line.fields['Item'];
    const itemId = Array.isArray(itemIds) ? itemIds[0] : null;
    if (!itemId) continue;

    // Get name from Items table lookup
    const itemInfo = itemsById[itemId] || { name: 'Unknown', unit: '' };

    ingredients.push({
      id: itemId,
      name: itemInfo.name,
      qty: line.fields['Qty'] || 0,
      unit: itemInfo.unit
    });
  }

  return {
    id: recipeId,
    name: String(recipeName),
    yieldQty: yieldQty,
    yieldUnit: yieldUnit,
    ingredients: ingredients
  };
}

/**
 * Calculate ingredient quantities needed to produce a target prep quantity.
 * Scale factor = targetQty / yieldQty.
 */
function calculateScaledRecipe(recipeId, targetQty) {
  const recipe = getRecipeDetails(recipeId);

  const yieldQty = recipe.yieldQty;
  if (!yieldQty || yieldQty === 0) {
    throw new Error('Recipe yield quantity is zero - cannot scale');
  }

  const scaleFactor = targetQty / yieldQty;

  const scaledIngredients = recipe.ingredients.map(ing => ({
    name: ing.name,
    originalQty: ing.qty,
    scaledQty: Math.round(ing.qty * scaleFactor * 100) / 100,
    unit: ing.unit
  }));

  return {
    recipeName: recipe.name,
    originalYield: yieldQty,
    yieldUnit: recipe.yieldUnit,
    scaledYield: Math.round(yieldQty * scaleFactor * 100) / 100,
    scaleFactor: Math.round(scaleFactor * 1000) / 1000,
    scalePercent: Math.round(scaleFactor * 100),
    targetQty: targetQty,
    ingredients: scaledIngredients
  };
}

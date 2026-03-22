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
  // Step 1: Fetch all active Items and build id → name map
  const activeItemsById = {};
  for (const item of airtableListAll_(SCALER_CONFIG.airtable.tables.items, {
    fields: ['Item Name'],
    filterByFormula: '{Status}="Active"',
    pageSize: 100
  })) {
    activeItemsById[item.id] = item.fields['Item Name'] || 'Unknown';
  }

  // Step 2: Fetch all recipes with pagination
  // "Item Name" is a linked record field on Recipes pointing to the Items table.
  // The REST API returns linked record fields as [{id, name}] objects.
  const allRecipes = airtableListAll_(SCALER_CONFIG.airtable.tables.recipes, {
    fields: ['Item Name', 'Yield Qty'],
    pageSize: 100
  });

  // Step 3: Map, filter by active items, and resolve names
  const recipes = [];
  for (const r of allRecipes) {
    // Extract linked item ID from 'Item Name' linked record field
    const itemNameField = r.fields['Item Name'];
    let linkedItemId = null;
    if (Array.isArray(itemNameField) && itemNameField.length > 0) {
      const first = itemNameField[0];
      linkedItemId = typeof first === 'string' ? first : first?.id;
    }

    // Skip recipes with no linked item or whose item is not active
    if (!linkedItemId || !activeItemsById[linkedItemId]) continue;

    recipes.push({
      id: r.id,
      name: activeItemsById[linkedItemId]
    });
  }

  // Sort by name
  recipes.sort((a, b) => a.name.localeCompare(b.name));

  return recipes;
}

/**
 * Get recipe details with ingredients
 * Fetches ALL recipe lines and filters client-side (same approach as GoogleDocsPrepSystem.gs)
 */
function getRecipeDetails(recipeIdentifier) {
  const props = PropertiesService.getScriptProperties();
  const baseId = props.getProperty('AIRTABLE_BASE_ID');
  const pat = props.getProperty('AIRTABLE_PAT');

  if (!baseId || !pat) {
    throw new Error('Airtable credentials not configured (AIRTABLE_BASE_ID or AIRTABLE_PAT missing)');
  }

  // First, find the recipe
  let recipeRecord;

  if (recipeIdentifier.startsWith('rec')) {
    // It's a record ID - fetch directly
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(SCALER_CONFIG.airtable.tables.recipes)}/${recipeIdentifier}`;
    const response = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': `Bearer ${pat}` },
      muteHttpExceptions: true
    });
    const code = response.getResponseCode();
    if (code < 200 || code >= 300) {
      throw new Error(`Airtable recipe fetch failed (${code}): ${response.getContentText()}`);
    }
    recipeRecord = JSON.parse(response.getContentText());
  } else {
    throw new Error('Please use recipe ID for lookup');
  }

  const yieldQty = recipeRecord.fields['Yield Qty'] || 1;
  const recipeId = recipeRecord.id;

  // Extract linked item ID for name resolution (used after itemsById is built below)
  const itemLinkField = recipeRecord.fields['Item Name'];
  let linkedItemId = null;
  if (Array.isArray(itemLinkField) && itemLinkField.length > 0) {
    const first = itemLinkField[0];
    linkedItemId = typeof first === 'string' ? first : first?.id;
  }

  // Fetch ALL recipe lines with pagination
  // Include Name field (ingredient name), Unit field, Recipe, Item, Qty
  const allLines = airtableListAll_(SCALER_CONFIG.airtable.tables.recipeLines, {
    fields: ['Recipe', 'Item', 'Qty', 'Name', 'Unit'],
    pageSize: 100
  });

  // Filter client-side for lines matching this recipe
  const matchingLines = allLines.filter(line => {
    const linkedRecipeIds = line.fields['Recipe'];
    if (!Array.isArray(linkedRecipeIds)) return false;
    return linkedRecipeIds.includes(recipeId);
  });

  // Fetch ALL items with pagination (same approach as GoogleDocsPrepSystem.gs)
  const itemsById = {};
  for (const item of airtableListAll_(SCALER_CONFIG.airtable.tables.items, {
    fields: ['Item Name', 'Unit'],
    pageSize: 100
  })) {
    itemsById[item.id] = {
      name: item.fields['Item Name'] || 'Unknown',
      unit: item.fields['Unit'] || ''
    };
  }

  // Resolve recipe name and yield unit via linked item (Waratah uses Item Name linked record, not Recipe Name plain text)
  const linkedItem = linkedItemId ? itemsById[linkedItemId] : null;
  let recipeName = linkedItem ? linkedItem.name : null;
  if (!recipeName) recipeName = 'Unknown';
  const yieldUnit = linkedItem ? linkedItem.unit : '';

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

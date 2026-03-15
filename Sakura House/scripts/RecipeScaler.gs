/**
 * Recipe Scaler - Constraint-based recipe scaling
 *
 * Allows bar staff to scale recipes based on available ingredients.
 * Accessed via link in prep docs with recipe pre-filled.
 *
 * Usage: Deploy as web app, access with ?recipe=RecipeName or ?recipeId=recXXX
 *
 * @version 1.0
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
// DEBUG FUNCTION - Run this from Apps Script editor to diagnose issues
// =============================================================================

function debugRecipeScaler() {
  const props = PropertiesService.getScriptProperties();
  const baseId = props.getProperty('AIRTABLE_BASE_ID');
  const pat = props.getProperty('AIRTABLE_PAT');

  Logger.log('=== RECIPE SCALER DEBUG ===');
  Logger.log('Base ID: ' + baseId);
  Logger.log('PAT prefix: ' + (pat ? pat.substring(0, 10) + '...' : 'NOT SET'));

  // Test 1: Fetch one recipe to see all available fields
  Logger.log('\n=== TEST 1: Fetch first recipe (all fields) ===');
  try {
    const recipesUrl = `https://api.airtable.com/v0/${baseId}/Recipes?maxRecords=1`;
    const resp = UrlFetchApp.fetch(recipesUrl, {
      headers: { 'Authorization': `Bearer ${pat}` },
      muteHttpExceptions: true
    });
    Logger.log('HTTP ' + resp.getResponseCode());
    const data = JSON.parse(resp.getContentText());
    if (data.records && data.records[0]) {
      Logger.log('First recipe fields: ' + JSON.stringify(data.records[0].fields, null, 2));
      Logger.log('Available field names: ' + Object.keys(data.records[0].fields).join(', '));
    } else {
      Logger.log('Response: ' + resp.getContentText());
    }
  } catch (e) {
    Logger.log('Error: ' + e.message);
  }

  // Test 2: Fetch one recipe line to see all available fields
  Logger.log('\n=== TEST 2: Fetch first recipe line (all fields) ===');
  try {
    const linesUrl = `https://api.airtable.com/v0/${baseId}/Recipe%20Lines?maxRecords=1`;
    const resp = UrlFetchApp.fetch(linesUrl, {
      headers: { 'Authorization': `Bearer ${pat}` },
      muteHttpExceptions: true
    });
    Logger.log('HTTP ' + resp.getResponseCode());
    const data = JSON.parse(resp.getContentText());
    if (data.records && data.records[0]) {
      Logger.log('First recipe line fields: ' + JSON.stringify(data.records[0].fields, null, 2));
      Logger.log('Available field names: ' + Object.keys(data.records[0].fields).join(', '));
    } else {
      Logger.log('Response: ' + resp.getContentText());
    }
  } catch (e) {
    Logger.log('Error: ' + e.message);
  }

  // Test 3: Fetch one item to see all available fields
  Logger.log('\n=== TEST 3: Fetch first item (all fields) ===');
  try {
    const itemsUrl = `https://api.airtable.com/v0/${baseId}/Items?maxRecords=1`;
    const resp = UrlFetchApp.fetch(itemsUrl, {
      headers: { 'Authorization': `Bearer ${pat}` },
      muteHttpExceptions: true
    });
    Logger.log('HTTP ' + resp.getResponseCode());
    const data = JSON.parse(resp.getContentText());
    if (data.records && data.records[0]) {
      Logger.log('First item fields: ' + JSON.stringify(data.records[0].fields, null, 2));
      Logger.log('Available field names: ' + Object.keys(data.records[0].fields).join(', '));
    } else {
      Logger.log('Response: ' + resp.getContentText());
    }
  } catch (e) {
    Logger.log('Error: ' + e.message);
  }

  Logger.log('\n=== DEBUG COMPLETE ===');
}

// =============================================================================
// API FUNCTIONS (called from client-side)
// =============================================================================

/**
 * Get all recipes for dropdown
 * Uses "Recipe Name" field which is a lookup/formula field showing the item name
 */
function getRecipeList() {
  const props = PropertiesService.getScriptProperties();
  const baseId = props.getProperty('AIRTABLE_BASE_ID');
  const pat = props.getProperty('AIRTABLE_PAT');

  // Fetch recipes with Recipe Name field (lookup field that shows item name)
  const recipesUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(SCALER_CONFIG.airtable.tables.recipes)}?fields[]=Recipe%20Name&fields[]=Yield%20Qty`;

  const recipesResponse = UrlFetchApp.fetch(recipesUrl, {
    headers: { 'Authorization': `Bearer ${pat}` }
  });
  const recipesData = JSON.parse(recipesResponse.getContentText());

  // Map recipes - Recipe Name is a text/lookup field
  const recipes = recipesData.records.map(r => {
    // Recipe Name might be a string or array (lookup)
    let name = r.fields['Recipe Name'];
    if (Array.isArray(name)) name = name[0];
    if (!name) name = 'Unknown';

    return {
      id: r.id,
      name: String(name)
    };
  });

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

  // First, find the recipe
  let recipeRecord;

  if (recipeIdentifier.startsWith('rec')) {
    // It's a record ID - fetch directly
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(SCALER_CONFIG.airtable.tables.recipes)}/${recipeIdentifier}`;
    const response = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': `Bearer ${pat}` }
    });
    recipeRecord = JSON.parse(response.getContentText());
  } else {
    throw new Error('Please use recipe ID for lookup');
  }

  // Get recipe details - Recipe Name is a lookup/formula field
  const yieldQty = recipeRecord.fields['Yield Qty'] || 1;
  const recipeId = recipeRecord.id;

  let recipeName = recipeRecord.fields['Recipe Name'];
  if (Array.isArray(recipeName)) recipeName = recipeName[0];
  if (!recipeName) recipeName = 'Unknown';

  // Fetch ALL recipe lines with pagination
  // Include Name field (ingredient name), Unit field, Recipe, Item, Qty
  let allLines = [];
  let offset = null;

  do {
    let linesUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(SCALER_CONFIG.airtable.tables.recipeLines)}?fields[]=Recipe&fields[]=Item&fields[]=Qty&fields[]=Name&fields[]=Unit&pageSize=100`;
    if (offset) linesUrl += `&offset=${offset}`;

    const linesResponse = UrlFetchApp.fetch(linesUrl, {
      headers: { 'Authorization': `Bearer ${pat}` }
    });
    const linesData = JSON.parse(linesResponse.getContentText());
    allLines = allLines.concat(linesData.records || []);
    offset = linesData.offset || null;
  } while (offset);

  // Filter client-side for lines matching this recipe
  const matchingLines = allLines.filter(line => {
    const linkedRecipeIds = line.fields['Recipe'];
    if (!Array.isArray(linkedRecipeIds)) return false;
    return linkedRecipeIds.includes(recipeId);
  });

  // Fetch ALL items with pagination (same approach as GoogleDocsPrepSystem.gs)
  const itemsById = {};
  let itemsOffset = null;

  do {
    let itemsUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(SCALER_CONFIG.airtable.tables.items)}?fields[]=Item%20Name&fields[]=Unit&pageSize=100`;
    if (itemsOffset) itemsUrl += `&offset=${itemsOffset}`;

    const itemsResponse = UrlFetchApp.fetch(itemsUrl, {
      headers: { 'Authorization': `Bearer ${pat}` }
    });
    const itemsData = JSON.parse(itemsResponse.getContentText());

    for (const item of (itemsData.records || [])) {
      itemsById[item.id] = {
        name: item.fields['Item Name'] || 'Unknown',
        unit: item.fields['Unit'] || ''
      };
    }

    itemsOffset = itemsData.offset || null;
  } while (itemsOffset);

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
    ingredients: ingredients
  };
}

/**
 * Calculate scaled recipe based on constraint
 */
function calculateScaledRecipe(recipeId, constraintIngredientId, availableQty) {
  const recipe = getRecipeDetails(recipeId);

  // Find the constraining ingredient
  const constraintIngredient = recipe.ingredients.find(i => i.id === constraintIngredientId);
  if (!constraintIngredient) {
    throw new Error('Constraining ingredient not found in recipe');
  }

  // Calculate scale factor
  const originalQty = constraintIngredient.qty;
  if (originalQty === 0) {
    throw new Error('Original quantity is zero - cannot scale');
  }

  const scaleFactor = availableQty / originalQty;

  // Scale all ingredients
  const scaledIngredients = recipe.ingredients.map(ing => ({
    name: ing.name,
    originalQty: ing.qty,
    scaledQty: Math.round(ing.qty * scaleFactor * 100) / 100, // 2 decimal places
    unit: ing.unit,
    isConstraint: ing.id === constraintIngredientId
  }));

  // Calculate scaled yield
  const scaledYield = Math.round(recipe.yieldQty * scaleFactor * 100) / 100;

  return {
    recipeName: recipe.name,
    originalYield: recipe.yieldQty,
    scaledYield: scaledYield,
    scaleFactor: Math.round(scaleFactor * 1000) / 1000, // 3 decimal places
    scalePercent: Math.round(scaleFactor * 100),
    constraintIngredient: constraintIngredient.name,
    availableQty: availableQty,
    ingredients: scaledIngredients
  };
}

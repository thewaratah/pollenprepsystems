// Airtable client for PREP operations
// Multi-venue support: base ID is passed as parameter to all functions

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime?: string;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

async function airtableFetch(
  baseId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<AirtableResponse> {
  if (!AIRTABLE_PAT) {
    throw new Error('AIRTABLE_PAT environment variable is not set');
  }

  const url = `https://api.airtable.com/v0/${baseId}/${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Airtable API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// ============================================
// Stocktake Status
// ============================================

export interface StocktakeStatus {
  totalItems: number;
  countedItems: number;
  coveragePercent: number;
  lastUpdated: string | null;
  uncountedItems: string[];
  isReadyForFinalization: boolean;
}

export async function getStocktakeStatus(baseId: string): Promise<StocktakeStatus> {
  // Get all active items
  const itemsResponse = await airtableFetch(
    baseId,
    'Items?filterByFormula={Active}=TRUE()&fields[]=Item%20Name'
  );
  const totalItems = itemsResponse.records.length;

  // Get latest weekly counts (not confirmed)
  const countsResponse = await airtableFetch(
    baseId,
    'Weekly%20Counts?filterByFormula=AND({Confirmed}=FALSE(),{Stock%20Count}!="")&fields[]=Item&fields[]=Stock%20Count&fields[]=Count%20Date'
  );

  const countedItems = countsResponse.records.length;
  const coveragePercent = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0;

  // Find last count date
  let lastUpdated: string | null = null;
  for (const record of countsResponse.records) {
    const countDate = record.fields['Count Date'] as string | undefined;
    if (countDate && (!lastUpdated || countDate > lastUpdated)) {
      lastUpdated = countDate;
    }
  }

  // Get uncounted items (limit to 10)
  const countedItemIds = new Set(
    countsResponse.records.map((r) => (r.fields['Item'] as string[])?.[0]).filter(Boolean)
  );

  const uncountedItems = itemsResponse.records
    .filter((item) => !countedItemIds.has(item.id))
    .slice(0, 10)
    .map((item) => item.fields['Item Name'] as string);

  return {
    totalItems,
    countedItems,
    coveragePercent,
    lastUpdated,
    uncountedItems,
    isReadyForFinalization: coveragePercent >= 90,
  };
}

// ============================================
// Recipe Lookup
// ============================================

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  yield: number;
  yieldUnit: string;
  method: string | null;
  ingredients: RecipeIngredient[];
}

export async function lookupRecipe(baseId: string, nameOrId: string): Promise<Recipe | null> {
  // First search Items table for the item name
  const searchFormula = `SEARCH(LOWER("${nameOrId.replace(/"/g, '\\"')}"), LOWER({Item Name}))`;
  const itemsResponse = await airtableFetch(
    baseId,
    `Items?filterByFormula=${encodeURIComponent(searchFormula)}&maxRecords=5&fields[]=Item%20Name`
  );

  if (itemsResponse.records.length === 0) {
    return null;
  }

  // Get the first matching item's ID and name
  const targetItemId = itemsResponse.records[0].id;
  const itemName = itemsResponse.records[0].fields['Item Name'] as string;

  // Get all recipes and find the one that links to this item
  const recipesResponse = await airtableFetch(baseId, 'Recipes?maxRecords=200&fields[]=Item%20Name&fields[]=Yield%20Qty&fields[]=Method');

  // Find recipe that produces this item
  let recipe: AirtableRecord | null = null;
  for (const r of recipesResponse.records) {
    const linkedItems = r.fields['Item Name'] as string[] | undefined;
    if (linkedItems && linkedItems.includes(targetItemId)) {
      recipe = r;
      break;
    }
  }

  if (!recipe) {
    return null;
  }

  const recipeId = recipe.id;

  // Get recipe lines (ingredients)
  const linesResponse = await airtableFetch(baseId, `Recipe%20Lines?maxRecords=100&fields[]=Recipe&fields[]=Item&fields[]=Qty&fields[]=Unit`);
  const recipeLines = linesResponse.records.filter((line) => {
    const linkedRecipes = line.fields['Recipe'] as string[] | undefined;
    return linkedRecipes && linkedRecipes.includes(recipeId);
  });

  // Get item names for ingredients
  const ingredients: RecipeIngredient[] = [];
  for (const line of recipeLines) {
    const itemIds = line.fields['Item'] as string[] | undefined;
    if (itemIds && itemIds.length > 0) {
      try {
        const ingredientItemResponse = await airtableFetch(baseId, `Items/${itemIds[0]}`);
        ingredients.push({
          name: (ingredientItemResponse as unknown as AirtableRecord).fields['Item Name'] as string || 'Unknown',
          quantity: (line.fields['Qty'] as number) || 0,
          unit: (line.fields['Unit'] as string) || '',
        });
      } catch {
        // Skip if item not found
      }
    }
  }

  return {
    id: recipeId,
    name: itemName || 'Unknown Recipe',
    yield: (recipe.fields['Yield Qty'] as number) || 1,
    yieldUnit: (recipe.fields['Yield Unit'] as string) || 'batch',
    method: (recipe.fields['Method'] as string) || null,
    ingredients,
  };
}

// ============================================
// Scale Recipe
// ============================================

export interface ScaledRecipe {
  originalRecipe: Recipe;
  scaleFactor: number;
  scaledYield: number;
  scaledIngredients: RecipeIngredient[];
  constraintIngredient: string;
  availableQuantity: number;
}

export async function scaleRecipe(
  baseId: string,
  recipeNameOrId: string,
  constraintIngredient: string,
  availableQuantity: number
): Promise<ScaledRecipe | null> {
  const recipe = await lookupRecipe(baseId, recipeNameOrId);
  if (!recipe) return null;

  // Find the constraint ingredient in the recipe
  const constraint = recipe.ingredients.find(
    (ing) => ing.name.toLowerCase().includes(constraintIngredient.toLowerCase())
  );

  if (!constraint || constraint.quantity === 0) {
    return null;
  }

  // Calculate scale factor
  const scaleFactor = availableQuantity / constraint.quantity;

  // Scale all ingredients
  const scaledIngredients = recipe.ingredients.map((ing) => ({
    ...ing,
    quantity: Math.round(ing.quantity * scaleFactor * 100) / 100,
  }));

  return {
    originalRecipe: recipe,
    scaleFactor: Math.round(scaleFactor * 100) / 100,
    scaledYield: Math.round(recipe.yield * scaleFactor * 100) / 100,
    scaledIngredients,
    constraintIngredient: constraint.name,
    availableQuantity,
  };
}

// ============================================
// Prep Run Status
// ============================================

export interface PrepRunStatus {
  id: string;
  label: string;
  status: string;
  createdAt: string;
  tasksCount: number;
  completedTasks: number;
}

export async function getLatestPrepRun(baseId: string): Promise<PrepRunStatus | null> {
  // Get the 10 most recent prep runs and find the latest by createdTime
  const response = await airtableFetch(baseId, 'Prep%20Runs?maxRecords=10');

  if (response.records.length === 0) return null;

  // Sort by createdTime (metadata field) to get the most recent
  const sortedRecords = response.records.sort((a, b) => {
    const aTime = a.createdTime || '';
    const bTime = b.createdTime || '';
    return bTime.localeCompare(aTime);
  });

  const run = sortedRecords[0];

  // Get task count - the Prep Run is stored as a linked record
  let tasksCount = 0;
  try {
    const tasksResponse = await airtableFetch(
      baseId,
      `Prep%20Tasks?filterByFormula=FIND("${run.id}",ARRAYJOIN({Prep%20Run}))&fields[]=Item%20Needed`
    );
    tasksCount = tasksResponse.records.length;
  } catch {
    // If we can't get tasks, just return 0
    tasksCount = 0;
  }

  // Get the label from Prep Run - could be "Label" or in a linked field
  const label = (run.fields['Label'] as string) ||
    (run.fields['Name'] as string) ||
    `Run ${run.id.slice(-6)}`;

  return {
    id: run.id,
    label,
    status: 'Active', // Prep Runs don't have a status field
    createdAt: run.createdTime || '',
    tasksCount,
    completedTasks: 0, // No status tracking in current schema
  };
}

// ============================================
// List Recipes (for autocomplete)
// ============================================

export async function listRecipes(baseId: string, search?: string): Promise<Array<{ id: string; name: string }>> {
  // Search Items that match the query, then find which ones have recipes
  let itemsQuery = 'fields[]=Item%20Name&maxRecords=50';
  if (search) {
    const searchFormula = `SEARCH(LOWER("${search.replace(/"/g, '\\"')}"), LOWER({Item Name}))`;
    itemsQuery = `filterByFormula=${encodeURIComponent(searchFormula)}&${itemsQuery}`;
  }

  const itemsResponse = await airtableFetch(baseId, `Items?${itemsQuery}`);

  // Get all recipes to find which items have recipes
  const recipesResponse = await airtableFetch(baseId, 'Recipes?fields[]=Item%20Name&maxRecords=100');

  // Build a set of item IDs that have recipes
  const itemsWithRecipes = new Set<string>();
  for (const recipe of recipesResponse.records) {
    const linkedItems = recipe.fields['Item Name'] as string[] | undefined;
    if (linkedItems) {
      linkedItems.forEach((id) => itemsWithRecipes.add(id));
    }
  }

  // Filter to items that have recipes and return
  const results: Array<{ id: string; name: string }> = [];
  for (const item of itemsResponse.records) {
    if (itemsWithRecipes.has(item.id)) {
      results.push({
        id: item.id,
        name: item.fields['Item Name'] as string || 'Unknown',
      });
    }
    if (results.length >= 20) break;
  }

  return results;
}

// ============================================
// Get Prep Tasks for Current Run
// ============================================

export interface PrepTask {
  id: string;
  itemName: string;
  targetQty: number;
  batchesNeeded: number;
  unit: string;
  recipeName: string | null;
}

export async function getPrepTasks(baseId: string): Promise<PrepTask[]> {
  // Get the latest prep run first
  const prepRun = await getLatestPrepRun(baseId);
  if (!prepRun) return [];

  // Get all prep tasks for this run
  const tasksResponse = await airtableFetch(
    baseId,
    `Prep%20Tasks?filterByFormula=FIND("${prepRun.id}",ARRAYJOIN({Prep%20Run}))&maxRecords=100`
  );

  const tasks: PrepTask[] = [];
  for (const record of tasksResponse.records) {
    // Get item name from linked field
    const itemIds = record.fields['Item Needed'] as string[] | undefined;
    let itemName = 'Unknown Item';
    if (itemIds && itemIds.length > 0) {
      try {
        const itemResponse = await airtableFetch(baseId, `Items/${itemIds[0]}`);
        itemName = (itemResponse as unknown as AirtableRecord).fields['Item Name'] as string || 'Unknown';
      } catch {
        // Use default
      }
    }

    tasks.push({
      id: record.id,
      itemName,
      targetQty: (record.fields['Target Qty'] as number) || 0,
      batchesNeeded: (record.fields['Batches Needed'] as number) || 0,
      unit: (record.fields['Unit'] as string) || '',
      recipeName: (record.fields['Recipe Name'] as string) || null,
    });
  }

  return tasks;
}

// ============================================
// Get Ordering List
// ============================================

export interface OrderingItem {
  itemName: string;
  quantity: number;
  unit: string;
  supplier: string;
}

export interface OrderingList {
  staffName: string;
  items: OrderingItem[];
  totalItems: number;
}

export async function getOrderingLists(baseId: string): Promise<OrderingList[]> {
  // Get the latest prep run first
  const prepRun = await getLatestPrepRun(baseId);
  if (!prepRun) return [];

  // Get ingredient requirements for this run
  const reqsResponse = await airtableFetch(
    baseId,
    `Ingredient%20Requirements?filterByFormula=FIND("${prepRun.id}",ARRAYJOIN({Prep%20Run}))&maxRecords=200`
  );

  // Group by Ordering Staff
  const byStaff: Record<string, OrderingItem[]> = {};

  for (const record of reqsResponse.records) {
    const staff = (record.fields['Ordering Staff (Static)'] as string) || 'Unassigned';

    // Get item name from linked field
    const itemIds = record.fields['Item Link'] as string[] | undefined;
    let itemName = 'Unknown Item';
    if (itemIds && itemIds.length > 0) {
      try {
        const itemResponse = await airtableFetch(baseId, `Items/${itemIds[0]}`);
        itemName = (itemResponse as unknown as AirtableRecord).fields['Item Name'] as string || 'Unknown';
      } catch {
        // Use default
      }
    }

    const item: OrderingItem = {
      itemName,
      quantity: (record.fields['Total Qty Needed'] as number) || 0,
      unit: (record.fields['Unit'] as string) || '',
      supplier: (record.fields['Supplier Name (Static)'] as string) || 'Unknown Supplier',
    };

    if (!byStaff[staff]) {
      byStaff[staff] = [];
    }
    byStaff[staff].push(item);
  }

  // Convert to array format
  return Object.entries(byStaff).map(([staffName, items]) => ({
    staffName,
    items,
    totalItems: items.length,
  }));
}

// ============================================
// Get Item Details
// ============================================

export interface ItemDetails {
  id: string;
  name: string;
  type: string;
  unit: string;
  active: boolean;
  supplier: string | null;
  parLevel: number | null;
  currentStock: number | null;
  bufferMultiplier: number;
}

export async function getItemDetails(baseId: string, nameOrId: string): Promise<ItemDetails | null> {
  // Search for the item
  const searchFormula = `SEARCH(LOWER("${nameOrId.replace(/"/g, '\\"')}"), LOWER({Item Name}))`;
  const itemsResponse = await airtableFetch(
    baseId,
    `Items?filterByFormula=${encodeURIComponent(searchFormula)}&maxRecords=1`
  );

  if (itemsResponse.records.length === 0) return null;

  const item = itemsResponse.records[0];

  // Get par level
  let parLevel: number | null = null;
  try {
    const parResponse = await airtableFetch(
      baseId,
      `Par%20Levels?filterByFormula=FIND("${item.id}",ARRAYJOIN({Item%20Link}))&maxRecords=1`
    );
    if (parResponse.records.length > 0) {
      parLevel = (parResponse.records[0].fields['Par Qty'] as number) || null;
    }
  } catch {
    // No par level
  }

  // Get current stock from latest weekly count
  let currentStock: number | null = null;
  try {
    const countResponse = await airtableFetch(
      baseId,
      `Weekly%20Counts?filterByFormula=AND(FIND("${item.id}",ARRAYJOIN({Item})),{Confirmed}=FALSE())&maxRecords=1`
    );
    if (countResponse.records.length > 0) {
      currentStock = (countResponse.records[0].fields['Stock Count'] as number) || null;
    }
  } catch {
    // No current count
  }

  return {
    id: item.id,
    name: (item.fields['Item Name'] as string) || 'Unknown',
    type: (item.fields['Item Type'] as string) || 'Other',
    unit: (item.fields['Unit'] as string) || '',
    active: (item.fields['Active'] as boolean) ?? true,
    supplier: (item.fields['Supplier Name'] as string) || null,
    parLevel,
    currentStock,
    bufferMultiplier: (item.fields['Buffer Multiplier'] as number) || 1.0,
  };
}

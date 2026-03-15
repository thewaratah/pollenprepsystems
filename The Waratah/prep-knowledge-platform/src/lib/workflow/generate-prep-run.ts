/**
 * Generate Prep Run Workflow
 *
 * Complex BOM explosion algorithm that:
 * 1. Gets latest verified stocktake counts
 * 2. Loads par levels and calculates shortfalls
 * 3. Creates Prep Run record
 * 4. Generates Prep Tasks for batch items
 * 5. Processes sub-recipes (recursive BOM explosion)
 * 6. Generates Ingredient Requirements for ordering
 *
 * This is the core business logic for the weekly prep workflow.
 */

import { airtableListAll, batchCreate, createRecord } from '../airtable-client';
import { AirtableRecord, WorkflowResult } from './types';

export async function generatePrepRun(baseId: string): Promise<WorkflowResult> {
  // 2a: Get latest verified stocktake counts
  const verifiedCounts = await airtableListAll(
    baseId,
    'Weekly Counts',
    ['Item', 'Stock Count', 'Count Date'],
    "AND({Confirmed}=TRUE(), {Count Source}='Stocktake (Verified)')"
  );

  if (verifiedCounts.length === 0) {
    return {
      step: 'generate',
      status: 'error',
      message: 'No verified stocktake found. Please complete stocktake first.',
    };
  }

  // Build onHand map: itemId -> stockCount
  const onHand: Record<string, number> = {};
  for (const count of verifiedCounts) {
    const itemIds = count.fields['Item'] as string[] | undefined;
    if (itemIds && itemIds[0]) {
      onHand[itemIds[0]] = (count.fields['Stock Count'] as number) || 0;
    }
  }

  // 2b: Load par levels
  const parLevels = await airtableListAll(baseId, 'Par Levels', ['Item Link', 'Par Qty']);
  const parMap: Record<string, number> = {};
  for (const par of parLevels) {
    const itemIds = par.fields['Item Link'] as string[] | undefined;
    if (itemIds && itemIds[0]) {
      parMap[itemIds[0]] = (par.fields['Par Qty'] as number) || 0;
    }
  }

  // 2c: Load items data
  const items = await airtableListAll(
    baseId,
    'Items',
    ['Item Name', 'Item Type', 'Unit', 'Active', 'Buffer Multiplier', 'Supplier'],
    'AND({Active}=TRUE(), OR({Item Type}="Batch", {Item Type}="Sub Recipe", {Item Type}="Sub-recipe", {Item Type}="Garnish", {Item Type}="Other", {Item Type}="Ingredient"))'
  );

  const itemsMap: Record<string, AirtableRecord> = {};
  for (const item of items) {
    itemsMap[item.id] = item;
  }

  // 2d: Load recipes (what each recipe produces)
  const recipes = await airtableListAll(baseId, 'Recipes', ['Item Name', 'Yield Qty', 'Method']);
  const recipeByItemProduced: Record<string, AirtableRecord> = {};
  for (const recipe of recipes) {
    const producedItemIds = recipe.fields['Item Name'] as string[] | undefined;
    if (producedItemIds && producedItemIds[0]) {
      recipeByItemProduced[producedItemIds[0]] = recipe;
    }
  }

  // 2e: Load recipe lines (ingredients for each recipe)
  const recipeLines = await airtableListAll(baseId, 'Recipe Lines', ['Recipe', 'Item', 'Qty']);
  const linesByRecipe: Record<string, AirtableRecord[]> = {};
  for (const line of recipeLines) {
    const recipeIds = line.fields['Recipe'] as string[] | undefined;
    if (recipeIds && recipeIds[0]) {
      if (!linesByRecipe[recipeIds[0]]) {
        linesByRecipe[recipeIds[0]] = [];
      }
      linesByRecipe[recipeIds[0]].push(line);
    }
  }

  // 2f: Load suppliers for ordering staff mapping
  const suppliers = await airtableListAll(baseId, 'Supplier', ['Supplier Name', 'Ordering Staff']);
  const supplierMap: Record<string, { name: string; orderingStaff: string }> = {};
  for (const sup of suppliers) {
    supplierMap[sup.id] = {
      name: (sup.fields['Supplier Name'] as string) || '',
      orderingStaff: (sup.fields['Ordering Staff'] as string) || '',
    };
  }

  // 2g: Calculate shortfalls for Batch items
  const shortfalls: Array<{
    itemId: string;
    itemName: string;
    parQty: number;
    onHandQty: number;
    shortfall: number;
    bufferMultiplier: number;
    recipe: AirtableRecord | null;
  }> = [];

  for (const itemId of Object.keys(parMap)) {
    const item = itemsMap[itemId];
    if (!item) continue;

    const itemType = item.fields['Item Type'] as string;
    // Only calculate shortfalls for Batch items (top-level)
    if (itemType !== 'Batch') continue;

    const parQty = parMap[itemId] || 0;
    const stock = onHand[itemId] || 0;
    const shortfall = parQty - stock;

    if (shortfall > 0) {
      shortfalls.push({
        itemId,
        itemName: (item.fields['Item Name'] as string) || 'Unknown',
        parQty,
        onHandQty: stock,
        shortfall,
        bufferMultiplier: (item.fields['Buffer Multiplier'] as number) || 1.0,
        recipe: recipeByItemProduced[itemId] || null,
      });
    }
  }

  if (shortfalls.length === 0) {
    return {
      step: 'generate',
      status: 'success',
      message: 'No shortfalls detected - all items are at or above par level',
      details: { shortfallCount: 0, prepTasksCreated: 0 },
    };
  }

  // 2h: Create Prep Run record
  // Field: "Prep Week" is the date field for the prep run
  const prepWeek = new Date().toISOString();
  const prepRun = await createRecord(baseId, 'Prep Runs', {
    'Prep Week': prepWeek,
  });

  // 2i: Create Prep Tasks for each shortfall
  const prepTasks: Array<{ fields: Record<string, unknown> }> = [];
  const subRecipesToProcess: Array<{
    itemId: string;
    qtyNeeded: number;
    parentTaskName: string;
  }> = [];

  for (const sf of shortfalls) {
    const recipe = sf.recipe;
    const yieldQty = recipe ? ((recipe.fields['Yield Qty'] as number) || 1) : 1;
    const batchesNeeded = Math.ceil(sf.shortfall / yieldQty);
    const targetQty = batchesNeeded * yieldQty;
    const suggestedQty = targetQty * sf.bufferMultiplier;

    prepTasks.push({
      fields: {
        'Prep Run': [prepRun.id],
        'Item Needed': [sf.itemId],
        'Recipe Used': recipe ? [recipe.id] : undefined,
        'Target Qty': targetQty,
        'Batches Needed': batchesNeeded,
        'Suggested Qty (Buffer)': suggestedQty,
        Notes: `Shortfall: ${sf.shortfall}, Par: ${sf.parQty}, On Hand: ${sf.onHandQty}`,
      },
    });

    // If recipe exists, queue sub-recipes for processing
    if (recipe && linesByRecipe[recipe.id]) {
      for (const line of linesByRecipe[recipe.id]) {
        const ingredientIds = line.fields['Item'] as string[] | undefined;
        if (!ingredientIds || !ingredientIds[0]) continue;

        const ingredientItem = itemsMap[ingredientIds[0]];
        if (!ingredientItem) continue;

        const ingredientType = ingredientItem.fields['Item Type'] as string;
        // If ingredient is a Sub Recipe, queue it for processing
        if (ingredientType === 'Sub Recipe' || ingredientType === 'Sub-recipe') {
          const lineQty = (line.fields['Qty'] as number) || 0;
          const totalNeeded = lineQty * batchesNeeded;
          subRecipesToProcess.push({
            itemId: ingredientIds[0],
            qtyNeeded: totalNeeded,
            parentTaskName: sf.itemName,
          });
        }
      }
    }
  }

  // 2j: Process sub-recipes (BOM explosion)
  // First, aggregate quantities for duplicate sub-recipes
  const aggregatedSubRecipes: Record<string, {
    itemId: string;
    qtyNeeded: number;
    parentTaskNames: string[]
  }> = {};

  for (const subRecipe of subRecipesToProcess) {
    if (!aggregatedSubRecipes[subRecipe.itemId]) {
      aggregatedSubRecipes[subRecipe.itemId] = {
        itemId: subRecipe.itemId,
        qtyNeeded: 0,
        parentTaskNames: [],
      };
    }
    aggregatedSubRecipes[subRecipe.itemId].qtyNeeded += subRecipe.qtyNeeded;
    if (!aggregatedSubRecipes[subRecipe.itemId].parentTaskNames.includes(subRecipe.parentTaskName)) {
      aggregatedSubRecipes[subRecipe.itemId].parentTaskNames.push(subRecipe.parentTaskName);
    }
  }

  // Now create prep tasks for aggregated sub-recipes
  for (const subRecipe of Object.values(aggregatedSubRecipes)) {
    const item = itemsMap[subRecipe.itemId];
    if (!item) continue;

    const recipe = recipeByItemProduced[subRecipe.itemId];
    const yieldQty = recipe ? ((recipe.fields['Yield Qty'] as number) || 1) : 1;
    const batchesNeeded = Math.ceil(subRecipe.qtyNeeded / yieldQty);
    const targetQty = batchesNeeded * yieldQty;
    const bufferMultiplier = (item.fields['Buffer Multiplier'] as number) || 1.0;
    const suggestedQty = targetQty * bufferMultiplier;

    prepTasks.push({
      fields: {
        'Prep Run': [prepRun.id],
        'Item Needed': [subRecipe.itemId],
        'Recipe Used': recipe ? [recipe.id] : undefined,
        'Target Qty': targetQty,
        'Batches Needed': batchesNeeded,
        'Suggested Qty (Buffer)': suggestedQty,
        Notes: `Sub-recipe for: ${subRecipe.parentTaskNames.join(', ')}`,
      },
    });
  }

  // Create all prep tasks
  await batchCreate(baseId, 'Prep Tasks', prepTasks);

  // 2k: Generate Ingredient Requirements (BOM explosion for ordering)
  const ingredientRequirements: Record<
    string,
    {
      itemId: string;
      totalQty: number;
      supplierName: string;
      orderingStaff: string;
    }
  > = {};

  // Process all recipes used in prep tasks
  for (const sf of shortfalls) {
    if (!sf.recipe || !linesByRecipe[sf.recipe.id]) continue;

    const yieldQty = (sf.recipe.fields['Yield Qty'] as number) || 1;
    const batchesNeeded = Math.ceil(sf.shortfall / yieldQty);

    for (const line of linesByRecipe[sf.recipe.id]) {
      const ingredientIds = line.fields['Item'] as string[] | undefined;
      if (!ingredientIds || !ingredientIds[0]) continue;

      const ingredientItem = itemsMap[ingredientIds[0]];
      if (!ingredientItem) continue;

      const ingredientType = ingredientItem.fields['Item Type'] as string;
      // Only include Ingredients (not Sub Recipes - those are made in-house)
      if (ingredientType !== 'Ingredient') continue;

      const lineQty = (line.fields['Qty'] as number) || 0;
      const totalNeeded = lineQty * batchesNeeded;

      const supplierIds = ingredientItem.fields['Supplier'] as string[] | undefined;
      const supplier = supplierIds && supplierIds[0] ? supplierMap[supplierIds[0]] : null;

      const key = ingredientIds[0];
      if (!ingredientRequirements[key]) {
        ingredientRequirements[key] = {
          itemId: ingredientIds[0],
          totalQty: 0,
          supplierName: supplier?.name || 'Unknown',
          orderingStaff: supplier?.orderingStaff || 'Unassigned',
        };
      }
      ingredientRequirements[key].totalQty += totalNeeded;
    }
  }

  // Also process sub-recipe ingredient requirements
  for (const subRecipe of subRecipesToProcess) {
    const recipe = recipeByItemProduced[subRecipe.itemId];
    if (!recipe || !linesByRecipe[recipe.id]) continue;

    const yieldQty = (recipe.fields['Yield Qty'] as number) || 1;
    const batchesNeeded = Math.ceil(subRecipe.qtyNeeded / yieldQty);

    for (const line of linesByRecipe[recipe.id]) {
      const ingredientIds = line.fields['Item'] as string[] | undefined;
      if (!ingredientIds || !ingredientIds[0]) continue;

      const ingredientItem = itemsMap[ingredientIds[0]];
      if (!ingredientItem) continue;

      const ingredientType = ingredientItem.fields['Item Type'] as string;
      if (ingredientType !== 'Ingredient') continue;

      const lineQty = (line.fields['Qty'] as number) || 0;
      const totalNeeded = lineQty * batchesNeeded;

      const supplierIds = ingredientItem.fields['Supplier'] as string[] | undefined;
      const supplier = supplierIds && supplierIds[0] ? supplierMap[supplierIds[0]] : null;

      const key = ingredientIds[0];
      if (!ingredientRequirements[key]) {
        ingredientRequirements[key] = {
          itemId: ingredientIds[0],
          totalQty: 0,
          supplierName: supplier?.name || 'Unknown',
          orderingStaff: supplier?.orderingStaff || 'Unassigned',
        };
      }
      ingredientRequirements[key].totalQty += totalNeeded;
    }
  }

  // Create ingredient requirement records
  const requirementRecords = Object.values(ingredientRequirements).map((req) => ({
    fields: {
      'Prep Run': [prepRun.id],
      'Item Link': [req.itemId],
      'Total Qty Needed': req.totalQty,
      'Supplier Name (Static)': req.supplierName,
      'Ordering Staff (Static)': req.orderingStaff,
    },
  }));

  if (requirementRecords.length > 0) {
    await batchCreate(baseId, 'Ingredient Requirements', requirementRecords);
  }

  return {
    step: 'generate',
    status: 'success',
    message: `Created prep run with ${prepTasks.length} tasks and ${requirementRecords.length} ingredient requirements`,
    details: {
      prepRunId: prepRun.id,
      shortfallCount: shortfalls.length,
      prepTasksCreated: prepTasks.length,
      ingredientRequirements: requirementRecords.length,
    },
  };
}

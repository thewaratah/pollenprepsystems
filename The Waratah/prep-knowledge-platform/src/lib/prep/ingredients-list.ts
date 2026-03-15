/**
 * Ingredient Prep List Builder
 *
 * Generates ingredient prep list showing Batches → Sub-Recipes → Ingredients.
 * Shows what sub-recipes need to be made for each batch, with ingredient breakdown.
 */

import { airtableListAll } from '../airtable-client';
import { AirtableRecord } from '../workflow/types';
import { IngredientsListResult, ItemData } from './types';

/**
 * Build ingredient prep list with batch → sub-recipe → ingredient hierarchy
 *
 * @param baseId - Airtable base ID
 * @param prepRunId - Prep run record ID (optional)
 * @param taskIds - Prep task IDs for this prep run
 * @returns Ingredient prep list with batches and sub-recipes
 */
export async function buildIngredientsListResult(
  baseId: string,
  prepRunId: string | undefined,
  taskIds: string[]
): Promise<IngredientsListResult> {
  // Get prep tasks
  const allTasks = await airtableListAll(
    baseId,
    'Prep Tasks',
    ['Item Needed', 'Batches Needed', 'Target Qty', 'Notes', 'Recipe Used'],
    undefined
  );

  // Filter to this prep run's tasks
  const tasks = taskIds.length > 0
    ? allTasks.filter(t => taskIds.includes(t.id))
    : allTasks;

  // Fetch all items
  const allItems = await airtableListAll(baseId, 'Items', ['Item Name', 'Unit', 'Item Type'], undefined);
  const itemData: Record<string, ItemData> = {};
  allItems.forEach((item) => {
    itemData[item.id] = {
      name: (item.fields['Item Name'] as string) || 'Unknown',
      unit: (item.fields['Unit'] as string) || '',
      type: (item.fields['Item Type'] as string) || '',
    };
  });

  // Fetch recipes
  const allRecipes = await airtableListAll(baseId, 'Recipes', ['Recipe Name', 'Method'], undefined);
  const recipeData: Record<string, { name: string; method: string }> = {};
  allRecipes.forEach((recipe) => {
    recipeData[recipe.id] = {
      name: (recipe.fields['Recipe Name'] as string) || '',
      method: (recipe.fields['Method'] as string) || '',
    };
  });

  // Fetch recipe lines
  const recipeLines = await airtableListAll(baseId, 'Recipe Lines', ['Recipe', 'Item', 'Qty'], undefined);
  const linesByRecipe: Record<string, Array<{ itemId: string; qty: number }>> = {};
  recipeLines.forEach((line) => {
    const recipeLink = (line.fields['Recipe'] as string[])?.[0];
    const itemLink = (line.fields['Item'] as string[])?.[0];
    const qty = (line.fields['Qty'] as number) || 0;
    if (recipeLink && itemLink && qty > 0) {
      if (!linesByRecipe[recipeLink]) linesByRecipe[recipeLink] = [];
      linesByRecipe[recipeLink].push({ itemId: itemLink, qty });
    }
  });

  // Separate batch tasks and sub-recipe tasks
  const batchTasks: AirtableRecord[] = [];
  const subTasksByItemId: Record<string, AirtableRecord> = {};

  tasks.forEach((task) => {
    const itemLink = (task.fields['Item Needed'] as string[])?.[0];
    if (!itemLink) return;
    const itemType = itemData[itemLink]?.type || '';
    const targetQty = (task.fields['Target Qty'] as number) || 0;
    if (targetQty <= 0) return;

    if (itemType === 'Batch') {
      batchTasks.push(task);
    } else if (itemType === 'Sub Recipe' || itemType === 'Sub-recipe') {
      subTasksByItemId[itemLink] = task;
    }
  });

  // For each batch, find which sub-recipes it needs
  const batches = batchTasks
    .map((batch) => {
      const itemLink = (batch.fields['Item Needed'] as string[])?.[0];
      const recipeLink = (batch.fields['Recipe Used'] as string[])?.[0];
      const batchesNeeded = (batch.fields['Batches Needed'] as number) || 0;

      // Find sub-recipes needed by this batch
      const lines = recipeLink ? linesByRecipe[recipeLink] || [] : [];
      const subRecipes = lines
        .filter((line) => {
          const itemType = itemData[line.itemId]?.type || '';
          return itemType === 'Sub Recipe' || itemType === 'Sub-recipe';
        })
        .map((line) => {
          const subTask = subTasksByItemId[line.itemId];
          if (!subTask) return null;

          const subItemLink = (subTask.fields['Item Needed'] as string[])?.[0];
          const subRecipeLink = (subTask.fields['Recipe Used'] as string[])?.[0];
          const subBatches = (subTask.fields['Batches Needed'] as number) || 0;

          // Get ingredients for this sub-recipe
          const subLines = subRecipeLink ? linesByRecipe[subRecipeLink] || [] : [];
          const ingredients = subLines.map((sl) => {
            const totalQty = sl.qty * subBatches;
            return {
              id: sl.itemId,
              name: itemData[sl.itemId]?.name || 'Unknown',
              quantity: totalQty,
              unit: itemData[sl.itemId]?.unit || '',
            };
          }).filter(i => i.quantity > 0);

          return {
            id: subTask.id,
            itemId: line.itemId,
            name: itemData[line.itemId]?.name || 'Unknown',
            targetQty: (subTask.fields['Target Qty'] as number) || 0,
            unit: itemData[line.itemId]?.unit || '',
            batches: subBatches,
            method: subRecipeLink ? recipeData[subRecipeLink]?.method || '' : '',
            recipeId: subRecipeLink || null,
            ingredients,
            isCompleted: false,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null && s.ingredients.length > 0);

      return {
        id: batch.id,
        name: itemLink ? itemData[itemLink]?.name || 'Unknown' : 'Unknown',
        targetQty: (batch.fields['Target Qty'] as number) || 0,
        unit: itemLink ? itemData[itemLink]?.unit || '' : '',
        batches: batchesNeeded,
        isCompleted: false,
        subRecipes,
      };
    })
    .filter(b => b.targetQty > 0 && b.subRecipes.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Calculate totals (count sub-recipes, not batches)
  const totalSubRecipes = batches.reduce((sum, b) => sum + b.subRecipes.length, 0);
  const completedSubRecipes = batches.reduce(
    (sum, b) => sum + b.subRecipes.filter(s => s.isCompleted).length,
    0
  );

  return {
    type: 'ingredients',
    prepRunId,
    batches,
    summary: {
      total: totalSubRecipes,
      completed: completedSubRecipes,
      percent: totalSubRecipes > 0 ? Math.round((completedSubRecipes / totalSubRecipes) * 100) : 0,
    },
  };
}

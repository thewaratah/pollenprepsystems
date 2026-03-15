/**
 * Batching List Builder
 *
 * Generates batching tasks for Batch items with their recipe ingredients.
 * Shows what needs to be made, with quantities scaled by batch count.
 */

import { airtableListAll } from '../airtable-client';
import { AirtableRecord } from '../workflow/types';
import { BatchingListResult, ItemData } from './types';

/**
 * Build batching list with recipes and ingredients
 *
 * @param baseId - Airtable base ID
 * @param prepRunId - Prep run record ID (optional)
 * @param taskIds - Prep task IDs for this prep run
 * @returns Batching list with tasks and ingredients
 */
export async function buildBatchingList(
  baseId: string,
  prepRunId: string | undefined,
  taskIds: string[]
): Promise<BatchingListResult> {
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

  // Get item and recipe details
  const itemIds = new Set<string>();
  const recipeIds = new Set<string>();
  tasks.forEach((t) => {
    const itemLinks = t.fields['Item Needed'] as string[] | undefined;
    const recipeLinks = t.fields['Recipe Used'] as string[] | undefined;
    if (itemLinks?.[0]) itemIds.add(itemLinks[0]);
    if (recipeLinks?.[0]) recipeIds.add(recipeLinks[0]);
  });

  // Fetch items
  const itemData: Record<string, ItemData> = {};
  if (itemIds.size > 0) {
    const items = await airtableListAll(baseId, 'Items', ['Item Name', 'Unit', 'Item Type'], undefined);
    items.forEach((item) => {
      itemData[item.id] = {
        name: (item.fields['Item Name'] as string) || 'Unknown',
        unit: (item.fields['Unit'] as string) || '',
        type: (item.fields['Item Type'] as string) || '',
      };
    });
  }

  // Fetch recipes and their methods
  const recipeData: Record<string, { name: string; method: string }> = {};
  if (recipeIds.size > 0) {
    const recipes = await airtableListAll(baseId, 'Recipes', ['Recipe Name', 'Method'], undefined);
    recipes.forEach((recipe) => {
      if (recipeIds.has(recipe.id)) {
        recipeData[recipe.id] = {
          name: (recipe.fields['Recipe Name'] as string) || '',
          method: (recipe.fields['Method'] as string) || '',
        };
      }
    });
  }

  // Fetch recipe lines (ingredients for each recipe)
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

  // Fetch all items we need for ingredient names
  const ingredientItemIds = new Set<string>();
  Object.values(linesByRecipe).forEach(lines => {
    lines.forEach(l => ingredientItemIds.add(l.itemId));
  });

  const allItems = await airtableListAll(baseId, 'Items', ['Item Name', 'Unit', 'Item Type'], undefined);
  allItems.forEach((item) => {
    if (!itemData[item.id]) {
      itemData[item.id] = {
        name: (item.fields['Item Name'] as string) || 'Unknown',
        unit: (item.fields['Unit'] as string) || '',
        type: (item.fields['Item Type'] as string) || '',
      };
    }
  });

  // Build batch tasks with ingredients
  const batchTasks = tasks
    .filter((task) => {
      const itemLink = (task.fields['Item Needed'] as string[])?.[0];
      const itemType = itemLink ? itemData[itemLink]?.type || '' : '';
      return itemType === 'Batch';
    })
    .map((task) => {
      const itemLink = (task.fields['Item Needed'] as string[])?.[0];
      const recipeLink = (task.fields['Recipe Used'] as string[])?.[0];
      const batchesNeeded = (task.fields['Batches Needed'] as number) || 0;
      const targetQty = (task.fields['Target Qty'] as number) || 0;

      // Get ingredients for this batch's recipe
      const ingredients = recipeLink && linesByRecipe[recipeLink]
        ? linesByRecipe[recipeLink].map((line) => {
            const totalQty = line.qty * batchesNeeded;
            return {
              id: line.itemId,
              name: itemData[line.itemId]?.name || 'Unknown',
              quantity: totalQty,
              unit: itemData[line.itemId]?.unit || '',
            };
          }).filter(i => i.quantity > 0)
        : [];

      return {
        id: task.id,
        name: itemLink ? itemData[itemLink]?.name || 'Unknown' : 'Unknown',
        targetQty,
        unit: itemLink ? itemData[itemLink]?.unit || '' : '',
        batches: batchesNeeded,
        notes: (task.fields['Notes'] as string) || '',
        method: recipeLink ? recipeData[recipeLink]?.method || '' : '',
        recipeId: recipeLink || null,
        ingredients,
        isCompleted: false,
      };
    })
    .filter(t => t.targetQty > 0 && t.ingredients.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const completedCount = batchTasks.filter((t) => t.isCompleted).length;

  return {
    type: 'batching',
    prepRunId,
    tasks: batchTasks,
    summary: {
      total: batchTasks.length,
      completed: completedCount,
      percent: batchTasks.length > 0 ? Math.round((completedCount / batchTasks.length) * 100) : 0,
    },
  };
}

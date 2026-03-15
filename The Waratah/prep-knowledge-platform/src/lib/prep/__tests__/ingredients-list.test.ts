/**
 * Unit tests for buildIngredientsListResult function
 * Tests ingredient prep list with batch → sub-recipe → ingredient hierarchy
 */

import { buildIngredientsListResult } from '../ingredients-list';
import * as airtableClient from '../../airtable-client';

jest.mock('../../airtable-client');

describe('buildIngredientsListResult', () => {
  const mockBaseId = 'appTestBaseId';
  const mockPrepRunId = 'recPrepRun1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty list when no tasks', async () => {
    (airtableClient.airtableListAll as jest.Mock).mockResolvedValue([]);

    const result = await buildIngredientsListResult(mockBaseId, mockPrepRunId, []);

    expect(result.type).toBe('ingredients');
    expect(result.batches).toHaveLength(0);
    expect(result.summary.total).toBe(0);
  });

  it('should group sub-recipes under batches', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'task1',
          fields: {
            'Item Needed': ['batch1'],
            'Batches Needed': 2,
            'Target Qty': 20,
            'Recipe Used': ['batchRecipe'],
          },
        },
        {
          id: 'task2',
          fields: {
            'Item Needed': ['sub1'],
            'Batches Needed': 1,
            'Target Qty': 5,
            'Recipe Used': ['subRecipe'],
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'batch1', fields: { 'Item Name': 'Teriyaki Sauce', Unit: 'ml', 'Item Type': 'Batch' } },
        { id: 'sub1', fields: { 'Item Name': 'Mirin Base', Unit: 'ml', 'Item Type': 'Sub Recipe' } },
        { id: 'ing1', fields: { 'Item Name': 'Mirin', Unit: 'ml', 'Item Type': 'Ingredient' } },
      ])
      .mockResolvedValueOnce([
        { id: 'batchRecipe', fields: { 'Recipe Name': 'Teriyaki Recipe', Method: 'Mix' } },
        { id: 'subRecipe', fields: { 'Recipe Name': 'Mirin Base Recipe', Method: 'Heat and mix' } },
      ])
      .mockResolvedValueOnce([
        { id: 'line1', fields: { Recipe: ['batchRecipe'], Item: ['sub1'], Qty: 3 } },
        { id: 'line2', fields: { Recipe: ['subRecipe'], Item: ['ing1'], Qty: 100 } },
      ]);

    const result = await buildIngredientsListResult(mockBaseId, mockPrepRunId, ['task1', 'task2']);

    expect(result.batches).toHaveLength(1);
    expect(result.batches[0].name).toBe('Teriyaki Sauce');
    expect(result.batches[0].subRecipes).toHaveLength(1);
    expect(result.batches[0].subRecipes[0].name).toBe('Mirin Base');
    expect(result.batches[0].subRecipes[0].ingredients).toHaveLength(1);
    expect(result.summary.total).toBe(1); // Count sub-recipes
  });

  it('should scale sub-recipe ingredients by batch count', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'task1',
          fields: {
            'Item Needed': ['batch1'],
            'Batches Needed': 2,
            'Target Qty': 20,
            'Recipe Used': ['batchRecipe'],
          },
        },
        {
          id: 'task2',
          fields: {
            'Item Needed': ['sub1'],
            'Batches Needed': 3,
            'Target Qty': 15,
            'Recipe Used': ['subRecipe'],
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'batch1', fields: { 'Item Name': 'Teriyaki Sauce', Unit: 'ml', 'Item Type': 'Batch' } },
        { id: 'sub1', fields: { 'Item Name': 'Mirin Base', Unit: 'ml', 'Item Type': 'Sub Recipe' } },
        { id: 'ing1', fields: { 'Item Name': 'Mirin', Unit: 'ml', 'Item Type': 'Ingredient' } },
      ])
      .mockResolvedValueOnce([
        { id: 'batchRecipe', fields: { 'Recipe Name': 'Teriyaki Recipe', Method: '' } },
        { id: 'subRecipe', fields: { 'Recipe Name': 'Mirin Base Recipe', Method: '' } },
      ])
      .mockResolvedValueOnce([
        { id: 'line1', fields: { Recipe: ['batchRecipe'], Item: ['sub1'], Qty: 3 } },
        { id: 'line2', fields: { Recipe: ['subRecipe'], Item: ['ing1'], Qty: 50 } },
      ]);

    const result = await buildIngredientsListResult(mockBaseId, mockPrepRunId, ['task1', 'task2']);

    // Sub-recipe needs 3 batches, each requiring 50ml Mirin
    expect(result.batches[0].subRecipes[0].batches).toBe(3);
    expect(result.batches[0].subRecipes[0].ingredients[0].quantity).toBe(150); // 50 * 3
  });

  it('should filter out batches with no sub-recipes', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'task1',
          fields: {
            'Item Needed': ['batch1'],
            'Batches Needed': 2,
            'Target Qty': 20,
            'Recipe Used': ['batchRecipe'],
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'batch1', fields: { 'Item Name': 'Wasabi Mayo', Unit: 'ml', 'Item Type': 'Batch' } },
        { id: 'ing1', fields: { 'Item Name': 'Wasabi', Unit: 'g', 'Item Type': 'Ingredient' } },
      ])
      .mockResolvedValueOnce([
        { id: 'batchRecipe', fields: { 'Recipe Name': 'Wasabi Mayo Recipe', Method: '' } },
      ])
      .mockResolvedValueOnce([
        // Recipe only has ingredients, no sub-recipes
        { id: 'line1', fields: { Recipe: ['batchRecipe'], Item: ['ing1'], Qty: 5 } },
      ]);

    const result = await buildIngredientsListResult(mockBaseId, mockPrepRunId, ['task1']);

    // Batch has no sub-recipes, so it shouldn't appear
    expect(result.batches).toHaveLength(0);
    expect(result.summary.total).toBe(0);
  });

  it('should filter out sub-recipes with no ingredients', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'task1',
          fields: {
            'Item Needed': ['batch1'],
            'Batches Needed': 2,
            'Target Qty': 20,
            'Recipe Used': ['batchRecipe'],
          },
        },
        {
          id: 'task2',
          fields: {
            'Item Needed': ['sub1'],
            'Batches Needed': 1,
            'Target Qty': 5,
            'Recipe Used': ['subRecipe'],
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'batch1', fields: { 'Item Name': 'Teriyaki Sauce', Unit: 'ml', 'Item Type': 'Batch' } },
        { id: 'sub1', fields: { 'Item Name': 'Mirin Base', Unit: 'ml', 'Item Type': 'Sub Recipe' } },
      ])
      .mockResolvedValueOnce([
        { id: 'batchRecipe', fields: { 'Recipe Name': 'Teriyaki Recipe', Method: '' } },
        { id: 'subRecipe', fields: { 'Recipe Name': 'Mirin Base Recipe', Method: '' } },
      ])
      .mockResolvedValueOnce([
        { id: 'line1', fields: { Recipe: ['batchRecipe'], Item: ['sub1'], Qty: 3 } },
        // No recipe lines for subRecipe (empty ingredients)
      ]);

    const result = await buildIngredientsListResult(mockBaseId, mockPrepRunId, ['task1', 'task2']);

    // Sub-recipe has no ingredients, so batch shouldn't appear
    expect(result.batches).toHaveLength(0);
  });

  it('should filter out batches with zero target quantity', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'task1',
          fields: {
            'Item Needed': ['batch1'],
            'Batches Needed': 0,
            'Target Qty': 0,
            'Recipe Used': ['batchRecipe'],
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'batch1', fields: { 'Item Name': 'Teriyaki Sauce', Unit: 'ml', 'Item Type': 'Batch' } },
      ])
      .mockResolvedValueOnce([
        { id: 'batchRecipe', fields: { 'Recipe Name': 'Teriyaki Recipe', Method: '' } },
      ])
      .mockResolvedValueOnce([]);

    const result = await buildIngredientsListResult(mockBaseId, mockPrepRunId, ['task1']);

    expect(result.batches).toHaveLength(0);
  });

  it('should sort batches alphabetically', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'task1',
          fields: {
            'Item Needed': ['batch1'],
            'Batches Needed': 1,
            'Target Qty': 10,
            'Recipe Used': ['recipe1'],
          },
        },
        {
          id: 'task2',
          fields: {
            'Item Needed': ['batch2'],
            'Batches Needed': 1,
            'Target Qty': 10,
            'Recipe Used': ['recipe2'],
          },
        },
        {
          id: 'task3',
          fields: {
            'Item Needed': ['sub1'],
            'Batches Needed': 1,
            'Target Qty': 5,
            'Recipe Used': ['subRecipe'],
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'batch1', fields: { 'Item Name': 'Wasabi Mayo', Unit: 'ml', 'Item Type': 'Batch' } },
        { id: 'batch2', fields: { 'Item Name': 'Ponzu', Unit: 'ml', 'Item Type': 'Batch' } },
        { id: 'sub1', fields: { 'Item Name': 'Mirin Base', Unit: 'ml', 'Item Type': 'Sub Recipe' } },
        { id: 'ing1', fields: { 'Item Name': 'Mirin', Unit: 'ml', 'Item Type': 'Ingredient' } },
      ])
      .mockResolvedValueOnce([
        { id: 'recipe1', fields: { 'Recipe Name': 'Wasabi Mayo Recipe', Method: '' } },
        { id: 'recipe2', fields: { 'Recipe Name': 'Ponzu Recipe', Method: '' } },
        { id: 'subRecipe', fields: { 'Recipe Name': 'Mirin Base Recipe', Method: '' } },
      ])
      .mockResolvedValueOnce([
        { id: 'line1', fields: { Recipe: ['recipe1'], Item: ['sub1'], Qty: 3 } },
        { id: 'line2', fields: { Recipe: ['recipe2'], Item: ['sub1'], Qty: 2 } },
        { id: 'line3', fields: { Recipe: ['subRecipe'], Item: ['ing1'], Qty: 50 } },
      ]);

    const result = await buildIngredientsListResult(mockBaseId, mockPrepRunId, ['task1', 'task2', 'task3']);

    expect(result.batches).toHaveLength(2);
    expect(result.batches[0].name).toBe('Ponzu');
    expect(result.batches[1].name).toBe('Wasabi Mayo');
  });

  it('should include recipe methods for sub-recipes', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'task1',
          fields: {
            'Item Needed': ['batch1'],
            'Batches Needed': 1,
            'Target Qty': 10,
            'Recipe Used': ['batchRecipe'],
          },
        },
        {
          id: 'task2',
          fields: {
            'Item Needed': ['sub1'],
            'Batches Needed': 1,
            'Target Qty': 5,
            'Recipe Used': ['subRecipe'],
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'batch1', fields: { 'Item Name': 'Teriyaki Sauce', Unit: 'ml', 'Item Type': 'Batch' } },
        { id: 'sub1', fields: { 'Item Name': 'Mirin Base', Unit: 'ml', 'Item Type': 'Sub Recipe' } },
        { id: 'ing1', fields: { 'Item Name': 'Mirin', Unit: 'ml', 'Item Type': 'Ingredient' } },
      ])
      .mockResolvedValueOnce([
        { id: 'batchRecipe', fields: { 'Recipe Name': 'Teriyaki Recipe', Method: '' } },
        {
          id: 'subRecipe',
          fields: {
            'Recipe Name': 'Mirin Base Recipe',
            Method: '1. Heat mirin gently\n2. Add sugar\n3. Simmer until reduced',
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'line1', fields: { Recipe: ['batchRecipe'], Item: ['sub1'], Qty: 3 } },
        { id: 'line2', fields: { Recipe: ['subRecipe'], Item: ['ing1'], Qty: 100 } },
      ]);

    const result = await buildIngredientsListResult(mockBaseId, mockPrepRunId, ['task1', 'task2']);

    expect(result.batches[0].subRecipes[0].method).toContain('Heat mirin gently');
    expect(result.batches[0].subRecipes[0].method).toContain('Simmer until reduced');
  });
});

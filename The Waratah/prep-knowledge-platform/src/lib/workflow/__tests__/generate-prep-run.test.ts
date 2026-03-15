/**
 * Unit tests for generatePrepRun workflow function
 * Tests the complex BOM explosion algorithm
 */

import { generatePrepRun } from '../generate-prep-run';
import * as airtableClient from '../../airtable-client';

jest.mock('../../airtable-client');

describe('generatePrepRun', () => {
  const mockBaseId = 'appTestBaseId';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return error when no verified stocktake found', async () => {
    (airtableClient.airtableListAll as jest.Mock).mockResolvedValue([]);

    const result = await generatePrepRun(mockBaseId);

    expect(result.step).toBe('generate');
    expect(result.status).toBe('error');
    expect(result.message).toContain('No verified stocktake found');
  });

  it('should return success with zero shortfalls when all items at par', async () => {
    // Mock verified counts
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'count1',
          fields: {
            Item: ['item1'],
            'Stock Count': 20, // At par level
            'Count Date': '2026-02-12',
          },
        },
      ])
      // Mock par levels
      .mockResolvedValueOnce([
        {
          id: 'par1',
          fields: {
            'Item Link': ['item1'],
            'Par Qty': 20,
          },
        },
      ])
      // Mock items
      .mockResolvedValueOnce([
        {
          id: 'item1',
          fields: {
            'Item Name': 'Wasabi Mayo',
            'Item Type': 'Batch',
            Unit: 'ml',
            Active: true,
          },
        },
      ]);

    const result = await generatePrepRun(mockBaseId);

    expect(result.step).toBe('generate');
    expect(result.status).toBe('success');
    expect(result.message).toContain('No shortfalls detected');
    expect(result.details).toEqual({
      shortfallCount: 0,
      prepTasksCreated: 0,
    });
  });

  it('should calculate shortfalls and create prep tasks', async () => {
    // Mock verified counts
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'count1',
          fields: {
            Item: ['item1'],
            'Stock Count': 5, // Below par
          },
        },
      ])
      // Mock par levels
      .mockResolvedValueOnce([
        {
          id: 'par1',
          fields: {
            'Item Link': ['item1'],
            'Par Qty': 15,
          },
        },
      ])
      // Mock items
      .mockResolvedValueOnce([
        {
          id: 'item1',
          fields: {
            'Item Name': 'Wasabi Mayo',
            'Item Type': 'Batch',
            Unit: 'ml',
            Active: true,
            'Buffer Multiplier': 1.5,
          },
        },
      ])
      // Mock recipes
      .mockResolvedValueOnce([
        {
          id: 'recipe1',
          fields: {
            'Item Name': ['item1'],
            'Yield Qty': 10,
          },
        },
      ])
      // Mock recipe lines
      .mockResolvedValueOnce([]);

    (airtableClient.createRecord as jest.Mock).mockResolvedValue({
      id: 'prepRun1',
    });
    (airtableClient.batchCreate as jest.Mock).mockResolvedValue([]);

    const result = await generatePrepRun(mockBaseId);

    expect(result.step).toBe('generate');
    expect(result.status).toBe('success');
    expect(result.details?.shortfallCount).toBe(1);
    expect(result.details?.prepTasksCreated).toBe(1);

    // Verify prep run was created
    expect(airtableClient.createRecord).toHaveBeenCalledWith(
      mockBaseId,
      'Prep Runs',
      expect.objectContaining({
        'Prep Week': expect.any(String),
      })
    );

    // Verify prep tasks were created
    expect(airtableClient.batchCreate).toHaveBeenCalledWith(
      mockBaseId,
      'Prep Tasks',
      expect.arrayContaining([
        expect.objectContaining({
          fields: expect.objectContaining({
            'Prep Run': ['prepRun1'],
            'Item Needed': ['item1'],
            'Batches Needed': 1, // Math.ceil(10 shortfall / 10 yield) = 1
            'Target Qty': 10,
            'Suggested Qty (Buffer)': 15, // 10 * 1.5
          }),
        }),
      ])
    );
  });

  it('should calculate batches needed correctly based on yield', async () => {
    // Shortfall: 25, Yield: 10 → 3 batches needed
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        { id: 'count1', fields: { Item: ['item1'], 'Stock Count': 0 } },
      ])
      .mockResolvedValueOnce([
        { id: 'par1', fields: { 'Item Link': ['item1'], 'Par Qty': 25 } },
      ])
      .mockResolvedValueOnce([
        {
          id: 'item1',
          fields: { 'Item Name': 'Miso Glaze', 'Item Type': 'Batch', Unit: 'ml' },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'recipe1', fields: { 'Item Name': ['item1'], 'Yield Qty': 10 } },
      ])
      .mockResolvedValueOnce([]);

    (airtableClient.createRecord as jest.Mock).mockResolvedValue({ id: 'prepRun1' });
    (airtableClient.batchCreate as jest.Mock).mockResolvedValue([]);

    await generatePrepRun(mockBaseId);

    const prepTasksCall = (airtableClient.batchCreate as jest.Mock).mock.calls[0];
    const prepTasks = prepTasksCall[2];

    expect(prepTasks[0].fields['Batches Needed']).toBe(3); // ceil(25 / 10) = 3
    expect(prepTasks[0].fields['Target Qty']).toBe(30); // 3 * 10
  });

  it('should process sub-recipes with BOM explosion', async () => {
    // Setup: Batch requires a Sub Recipe
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        { id: 'count1', fields: { Item: ['batchItem'], 'Stock Count': 0 } },
      ])
      .mockResolvedValueOnce([
        { id: 'par1', fields: { 'Item Link': ['batchItem'], 'Par Qty': 10 } },
      ])
      .mockResolvedValueOnce([
        {
          id: 'batchItem',
          fields: { 'Item Name': 'Teriyaki Sauce', 'Item Type': 'Batch', Unit: 'ml' },
        },
        {
          id: 'subRecipeItem',
          fields: { 'Item Name': 'Mirin Base', 'Item Type': 'Sub Recipe', Unit: 'ml' },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'batchRecipe', fields: { 'Item Name': ['batchItem'], 'Yield Qty': 10 } },
        { id: 'subRecipe', fields: { 'Item Name': ['subRecipeItem'], 'Yield Qty': 5 } },
      ])
      .mockResolvedValueOnce([
        {
          id: 'line1',
          fields: { Recipe: ['batchRecipe'], Item: ['subRecipeItem'], Qty: 3 },
        },
        {
          id: 'line2',
          fields: { Recipe: ['subRecipe'], Item: ['ingredientItem'], Qty: 2 },
        },
      ]);

    (airtableClient.createRecord as jest.Mock).mockResolvedValue({ id: 'prepRun1' });
    (airtableClient.batchCreate as jest.Mock).mockResolvedValue([]);

    const result = await generatePrepRun(mockBaseId);

    expect(result.status).toBe('success');
    // Should create tasks for both Batch and Sub Recipe
    expect(result.details?.prepTasksCreated).toBeGreaterThan(1);
  });

  it('should aggregate duplicate sub-recipes', async () => {
    // Two batches require the same sub-recipe
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        { id: 'count1', fields: { Item: ['batch1'], 'Stock Count': 0 } },
        { id: 'count2', fields: { Item: ['batch2'], 'Stock Count': 0 } },
      ])
      .mockResolvedValueOnce([
        { id: 'par1', fields: { 'Item Link': ['batch1'], 'Par Qty': 10 } },
        { id: 'par2', fields: { 'Item Link': ['batch2'], 'Par Qty': 10 } },
      ])
      .mockResolvedValueOnce([
        { id: 'batch1', fields: { 'Item Name': 'Batch 1', 'Item Type': 'Batch' } },
        { id: 'batch2', fields: { 'Item Name': 'Batch 2', 'Item Type': 'Batch' } },
        { id: 'sub1', fields: { 'Item Name': 'Sub Recipe', 'Item Type': 'Sub Recipe' } },
      ])
      .mockResolvedValueOnce([
        { id: 'recipe1', fields: { 'Item Name': ['batch1'], 'Yield Qty': 10 } },
        { id: 'recipe2', fields: { 'Item Name': ['batch2'], 'Yield Qty': 10 } },
        { id: 'subRecipe', fields: { 'Item Name': ['sub1'], 'Yield Qty': 5 } },
      ])
      .mockResolvedValueOnce([
        { id: 'line1', fields: { Recipe: ['recipe1'], Item: ['sub1'], Qty: 2 } },
        { id: 'line2', fields: { Recipe: ['recipe2'], Item: ['sub1'], Qty: 3 } },
      ]);

    (airtableClient.createRecord as jest.Mock).mockResolvedValue({ id: 'prepRun1' });
    (airtableClient.batchCreate as jest.Mock).mockResolvedValue([]);

    await generatePrepRun(mockBaseId);

    const prepTasksCall = (airtableClient.batchCreate as jest.Mock).mock.calls[0];
    const prepTasks = prepTasksCall[2];

    // Should have 2 batch tasks + 1 aggregated sub-recipe task
    expect(prepTasks.length).toBe(3);

    // Find the sub-recipe task
    const subRecipeTask = prepTasks.find((t: any) =>
      t.fields.Notes?.includes('Sub-recipe for')
    );
    expect(subRecipeTask).toBeDefined();
    expect(subRecipeTask.fields.Notes).toContain('Batch 1');
    expect(subRecipeTask.fields.Notes).toContain('Batch 2');
  });

  it('should only include Ingredients in ordering requirements', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        { id: 'count1', fields: { Item: ['batch1'], 'Stock Count': 0 } },
      ])
      .mockResolvedValueOnce([
        { id: 'par1', fields: { 'Item Link': ['batch1'], 'Par Qty': 10 } },
      ])
      .mockResolvedValueOnce([
        { id: 'batch1', fields: { 'Item Name': 'Batch', 'Item Type': 'Batch' } },
        { id: 'ingredient1', fields: { 'Item Name': 'Yuzu', 'Item Type': 'Ingredient' } },
        { id: 'subRecipe1', fields: { 'Item Name': 'Sub', 'Item Type': 'Sub Recipe' } },
      ])
      .mockResolvedValueOnce([
        { id: 'recipe1', fields: { 'Item Name': ['batch1'], 'Yield Qty': 10 } },
      ])
      .mockResolvedValueOnce([
        { id: 'line1', fields: { Recipe: ['recipe1'], Item: ['ingredient1'], Qty: 5 } },
        { id: 'line2', fields: { Recipe: ['recipe1'], Item: ['subRecipe1'], Qty: 3 } },
      ])
      .mockResolvedValueOnce([]); // Suppliers

    (airtableClient.createRecord as jest.Mock).mockResolvedValue({ id: 'prepRun1' });
    (airtableClient.batchCreate as jest.Mock).mockResolvedValue([]);

    await generatePrepRun(mockBaseId);

    // Should have called batchCreate twice: once for prep tasks, once for ingredient requirements
    expect(airtableClient.batchCreate).toHaveBeenCalledTimes(2);

    const ingredientRequirementsCall = (airtableClient.batchCreate as jest.Mock).mock.calls[1];
    const ingredientRequirements = ingredientRequirementsCall[2];

    // Should only include the Ingredient, not the Sub Recipe
    expect(ingredientRequirements.length).toBe(1);
    expect(ingredientRequirements[0].fields['Item Link']).toEqual(['ingredient1']);
  });
});

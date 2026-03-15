/**
 * Unit tests for buildBatchingList function
 * Tests batching list generation with recipes and ingredients
 */

import { buildBatchingList } from '../batching-list';
import * as airtableClient from '../../airtable-client';

jest.mock('../../airtable-client');

describe('buildBatchingList', () => {
  const mockBaseId = 'appTestBaseId';
  const mockPrepRunId = 'recPrepRun1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty list when no tasks', async () => {
    (airtableClient.airtableListAll as jest.Mock).mockResolvedValue([]);

    const result = await buildBatchingList(mockBaseId, mockPrepRunId, []);

    expect(result.type).toBe('batching');
    expect(result.tasks).toHaveLength(0);
    expect(result.summary.total).toBe(0);
  });

  it('should filter to only Batch items', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'task1',
          fields: {
            'Item Needed': ['item1'],
            'Batches Needed': 2,
            'Target Qty': 20,
            'Recipe Used': ['recipe1'],
          },
        },
        {
          id: 'task2',
          fields: {
            'Item Needed': ['item2'],
            'Batches Needed': 1,
            'Target Qty': 5,
            'Recipe Used': ['recipe2'],
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'item1', fields: { 'Item Name': 'Wasabi Mayo', Unit: 'ml', 'Item Type': 'Batch' } },
        { id: 'item2', fields: { 'Item Name': 'Mirin Base', Unit: 'ml', 'Item Type': 'Sub Recipe' } },
      ])
      .mockResolvedValueOnce([
        { id: 'recipe1', fields: { 'Recipe Name': 'Wasabi Mayo Recipe', Method: 'Mix ingredients' } },
      ])
      .mockResolvedValueOnce([
        { id: 'line1', fields: { Recipe: ['recipe1'], Item: ['ing1'], Qty: 5 } },
      ])
      .mockResolvedValueOnce([
        { id: 'ing1', fields: { 'Item Name': 'Wasabi', Unit: 'g', 'Item Type': 'Ingredient' } },
      ]);

    const result = await buildBatchingList(mockBaseId, mockPrepRunId, ['task1', 'task2']);

    // Should only include Batch items, not Sub Recipe
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].name).toBe('Wasabi Mayo');
  });

  it('should calculate scaled ingredient quantities', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'task1',
          fields: {
            'Item Needed': ['item1'],
            'Batches Needed': 3,
            'Target Qty': 30,
            'Recipe Used': ['recipe1'],
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'item1', fields: { 'Item Name': 'Wasabi Mayo', Unit: 'ml', 'Item Type': 'Batch' } },
      ])
      .mockResolvedValueOnce([
        { id: 'recipe1', fields: { 'Recipe Name': 'Wasabi Mayo Recipe', Method: 'Mix' } },
      ])
      .mockResolvedValueOnce([
        { id: 'line1', fields: { Recipe: ['recipe1'], Item: ['ing1'], Qty: 5 } },
        { id: 'line2', fields: { Recipe: ['recipe1'], Item: ['ing2'], Qty: 10 } },
      ])
      .mockResolvedValueOnce([
        { id: 'ing1', fields: { 'Item Name': 'Wasabi', Unit: 'g', 'Item Type': 'Ingredient' } },
        { id: 'ing2', fields: { 'Item Name': 'Mayo Base', Unit: 'ml', 'Item Type': 'Ingredient' } },
      ]);

    const result = await buildBatchingList(mockBaseId, mockPrepRunId, ['task1']);

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].batches).toBe(3);
    expect(result.tasks[0].ingredients).toHaveLength(2);
    expect(result.tasks[0].ingredients[0].quantity).toBe(15); // 5 * 3
    expect(result.tasks[0].ingredients[1].quantity).toBe(30); // 10 * 3
  });

  it('should include recipe method', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'task1',
          fields: {
            'Item Needed': ['item1'],
            'Batches Needed': 1,
            'Target Qty': 10,
            'Recipe Used': ['recipe1'],
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'item1', fields: { 'Item Name': 'Wasabi Mayo', Unit: 'ml', 'Item Type': 'Batch' } },
      ])
      .mockResolvedValueOnce([
        {
          id: 'recipe1',
          fields: {
            'Recipe Name': 'Wasabi Mayo Recipe',
            Method: '1. Mix wasabi powder with water\n2. Fold into mayo base\n3. Chill for 1 hour',
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'line1', fields: { Recipe: ['recipe1'], Item: ['ing1'], Qty: 5 } },
      ])
      .mockResolvedValueOnce([
        { id: 'ing1', fields: { 'Item Name': 'Wasabi', Unit: 'g', 'Item Type': 'Ingredient' } },
      ]);

    const result = await buildBatchingList(mockBaseId, mockPrepRunId, ['task1']);

    expect(result.tasks[0].method).toContain('Mix wasabi powder');
    expect(result.tasks[0].method).toContain('Fold into mayo base');
  });

  it('should filter out tasks with zero target quantity', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'task1',
          fields: {
            'Item Needed': ['item1'],
            'Batches Needed': 0,
            'Target Qty': 0,
            'Recipe Used': ['recipe1'],
          },
        },
        {
          id: 'task2',
          fields: {
            'Item Needed': ['item2'],
            'Batches Needed': 2,
            'Target Qty': 20,
            'Recipe Used': ['recipe2'],
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'item1', fields: { 'Item Name': 'Wasabi Mayo', Unit: 'ml', 'Item Type': 'Batch' } },
        { id: 'item2', fields: { 'Item Name': 'Ponzu', Unit: 'ml', 'Item Type': 'Batch' } },
      ])
      .mockResolvedValueOnce([
        { id: 'recipe2', fields: { 'Recipe Name': 'Ponzu Recipe', Method: 'Mix' } },
      ])
      .mockResolvedValueOnce([
        { id: 'line1', fields: { Recipe: ['recipe2'], Item: ['ing1'], Qty: 5 } },
      ])
      .mockResolvedValueOnce([
        { id: 'ing1', fields: { 'Item Name': 'Soy Sauce', Unit: 'ml', 'Item Type': 'Ingredient' } },
      ]);

    const result = await buildBatchingList(mockBaseId, mockPrepRunId, ['task1', 'task2']);

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].name).toBe('Ponzu');
  });

  it('should filter out tasks with no ingredients', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'task1',
          fields: {
            'Item Needed': ['item1'],
            'Batches Needed': 2,
            'Target Qty': 20,
            'Recipe Used': ['recipe1'],
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'item1', fields: { 'Item Name': 'Wasabi Mayo', Unit: 'ml', 'Item Type': 'Batch' } },
      ])
      .mockResolvedValueOnce([
        { id: 'recipe1', fields: { 'Recipe Name': 'Wasabi Mayo Recipe', Method: 'Mix' } },
      ])
      .mockResolvedValueOnce([]) // No recipe lines
      .mockResolvedValueOnce([]);

    const result = await buildBatchingList(mockBaseId, mockPrepRunId, ['task1']);

    expect(result.tasks).toHaveLength(0);
  });

  it('should sort tasks alphabetically by name', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'task1',
          fields: {
            'Item Needed': ['item1'],
            'Batches Needed': 1,
            'Target Qty': 10,
            'Recipe Used': ['recipe1'],
          },
        },
        {
          id: 'task2',
          fields: {
            'Item Needed': ['item2'],
            'Batches Needed': 1,
            'Target Qty': 10,
            'Recipe Used': ['recipe2'],
          },
        },
        {
          id: 'task3',
          fields: {
            'Item Needed': ['item3'],
            'Batches Needed': 1,
            'Target Qty': 10,
            'Recipe Used': ['recipe3'],
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'item1', fields: { 'Item Name': 'Wasabi Mayo', Unit: 'ml', 'Item Type': 'Batch' } },
        { id: 'item2', fields: { 'Item Name': 'Ponzu', Unit: 'ml', 'Item Type': 'Batch' } },
        { id: 'item3', fields: { 'Item Name': 'Miso Glaze', Unit: 'ml', 'Item Type': 'Batch' } },
      ])
      .mockResolvedValueOnce([
        { id: 'recipe1', fields: { 'Recipe Name': 'Wasabi Mayo Recipe', Method: '' } },
        { id: 'recipe2', fields: { 'Recipe Name': 'Ponzu Recipe', Method: '' } },
        { id: 'recipe3', fields: { 'Recipe Name': 'Miso Glaze Recipe', Method: '' } },
      ])
      .mockResolvedValueOnce([
        { id: 'line1', fields: { Recipe: ['recipe1'], Item: ['ing1'], Qty: 5 } },
        { id: 'line2', fields: { Recipe: ['recipe2'], Item: ['ing1'], Qty: 5 } },
        { id: 'line3', fields: { Recipe: ['recipe3'], Item: ['ing1'], Qty: 5 } },
      ])
      .mockResolvedValueOnce([
        { id: 'ing1', fields: { 'Item Name': 'Ingredient', Unit: 'g', 'Item Type': 'Ingredient' } },
      ]);

    const result = await buildBatchingList(mockBaseId, mockPrepRunId, ['task1', 'task2', 'task3']);

    expect(result.tasks).toHaveLength(3);
    expect(result.tasks[0].name).toBe('Miso Glaze');
    expect(result.tasks[1].name).toBe('Ponzu');
    expect(result.tasks[2].name).toBe('Wasabi Mayo');
  });

  it('should include recipeId for linking', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'task1',
          fields: {
            'Item Needed': ['item1'],
            'Batches Needed': 1,
            'Target Qty': 10,
            'Recipe Used': ['recipe1'],
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'item1', fields: { 'Item Name': 'Wasabi Mayo', Unit: 'ml', 'Item Type': 'Batch' } },
      ])
      .mockResolvedValueOnce([
        { id: 'recipe1', fields: { 'Recipe Name': 'Wasabi Mayo Recipe', Method: 'Mix' } },
      ])
      .mockResolvedValueOnce([
        { id: 'line1', fields: { Recipe: ['recipe1'], Item: ['ing1'], Qty: 5 } },
      ])
      .mockResolvedValueOnce([
        { id: 'ing1', fields: { 'Item Name': 'Wasabi', Unit: 'g', 'Item Type': 'Ingredient' } },
      ]);

    const result = await buildBatchingList(mockBaseId, mockPrepRunId, ['task1']);

    expect(result.tasks[0].recipeId).toBe('recipe1');
  });
});

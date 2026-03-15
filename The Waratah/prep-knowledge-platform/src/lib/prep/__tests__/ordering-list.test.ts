/**
 * Unit tests for buildOrderingList function
 * Tests ordering list generation grouped by supplier and staff
 */

import { buildOrderingList } from '../ordering-list';
import * as airtableClient from '../../airtable-client';

jest.mock('../../airtable-client');

describe('buildOrderingList', () => {
  const mockBaseId = 'appTestBaseId';
  const mockPrepRunId = 'recPrepRun1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty list when no requirements', async () => {
    (airtableClient.airtableListAll as jest.Mock).mockResolvedValue([]);

    const result = await buildOrderingList(mockBaseId, mockPrepRunId, [], null);

    expect(result.type).toBe('ordering');
    expect(result.suppliers).toHaveLength(0);
    expect(result.summary.total).toBe(0);
  });

  it('should group items by supplier', async () => {
    // Mock ingredient requirements
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'req1',
          fields: {
            'Item Link': ['item1'],
            'Total Qty Needed': 100,
            'Supplier Name (Static)': 'Tokyo Mart',
            'Ordering Staff (Static)': 'Andie',
          },
        },
        {
          id: 'req2',
          fields: {
            'Item Link': ['item2'],
            'Total Qty Needed': 50,
            'Supplier Name (Static)': 'Tokyo Mart',
            'Ordering Staff (Static)': 'Andie',
          },
        },
        {
          id: 'req3',
          fields: {
            'Item Link': ['item3'],
            'Total Qty Needed': 200,
            'Supplier Name (Static)': 'Sushi Supplier',
            'Ordering Staff (Static)': 'Blade',
          },
        },
      ])
      // Mock items
      .mockResolvedValueOnce([
        { id: 'item1', fields: { 'Item Name': 'Wasabi', Unit: 'g', 'Item Type': 'Ingredient' } },
        { id: 'item2', fields: { 'Item Name': 'Soy Sauce', Unit: 'ml', 'Item Type': 'Ingredient' } },
        { id: 'item3', fields: { 'Item Name': 'Salmon', Unit: 'kg', 'Item Type': 'Ingredient' } },
      ]);

    const result = await buildOrderingList(mockBaseId, mockPrepRunId, ['req1', 'req2', 'req3'], null);

    expect(result.suppliers).toHaveLength(2);
    expect(result.suppliers[0].name).toBe('Sushi Supplier');
    expect(result.suppliers[0].items).toHaveLength(1);
    expect(result.suppliers[1].name).toBe('Tokyo Mart');
    expect(result.suppliers[1].items).toHaveLength(2);
    expect(result.summary.total).toBe(3);
  });

  it('should filter by staff name', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'req1',
          fields: {
            'Item Link': ['item1'],
            'Total Qty Needed': 100,
            'Supplier Name (Static)': 'Tokyo Mart',
            'Ordering Staff (Static)': 'Andie',
          },
        },
        {
          id: 'req2',
          fields: {
            'Item Link': ['item2'],
            'Total Qty Needed': 200,
            'Supplier Name (Static)': 'Sushi Supplier',
            'Ordering Staff (Static)': 'Blade',
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'item1', fields: { 'Item Name': 'Wasabi', Unit: 'g', 'Item Type': 'Ingredient' } },
        { id: 'item2', fields: { 'Item Name': 'Salmon', Unit: 'kg', 'Item Type': 'Ingredient' } },
      ]);

    const result = await buildOrderingList(mockBaseId, mockPrepRunId, ['req1', 'req2'], 'andie');

    expect(result.staff).toBe('andie');
    expect(result.suppliers).toHaveLength(1);
    expect(result.suppliers[0].name).toBe('Tokyo Mart');
    expect(result.summary.total).toBe(1);
  });

  it('should filter by blade', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'req1',
          fields: {
            'Item Link': ['item1'],
            'Total Qty Needed': 100,
            'Supplier Name (Static)': 'Sushi Supplier',
            'Ordering Staff (Static)': 'Sabine',
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'item1', fields: { 'Item Name': 'Salmon', Unit: 'kg', 'Item Type': 'Ingredient' } },
      ]);

    const result = await buildOrderingList(mockBaseId, mockPrepRunId, ['req1'], 'blade');

    expect(result.staff).toBe('blade');
    expect(result.suppliers).toHaveLength(1);
    expect(result.summary.total).toBe(1);
  });

  it('should filter out Batch and Sub Recipe items', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'req1',
          fields: {
            'Item Link': ['item1'],
            'Total Qty Needed': 100,
            'Supplier Name (Static)': 'Tokyo Mart',
            'Ordering Staff (Static)': 'Andie',
          },
        },
        {
          id: 'req2',
          fields: {
            'Item Link': ['item2'],
            'Total Qty Needed': 50,
            'Supplier Name (Static)': 'In House',
            'Ordering Staff (Static)': 'Andie',
          },
        },
        {
          id: 'req3',
          fields: {
            'Item Link': ['item3'],
            'Total Qty Needed': 75,
            'Supplier Name (Static)': 'Tokyo Mart',
            'Ordering Staff (Static)': 'Andie',
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'item1', fields: { 'Item Name': 'Wasabi', Unit: 'g', 'Item Type': 'Ingredient' } },
        { id: 'item2', fields: { 'Item Name': 'Wasabi Mayo', Unit: 'ml', 'Item Type': 'Batch' } },
        { id: 'item3', fields: { 'Item Name': 'Mirin Base', Unit: 'ml', 'Item Type': 'Sub Recipe' } },
      ]);

    const result = await buildOrderingList(mockBaseId, mockPrepRunId, ['req1', 'req2', 'req3'], null);

    // Should only include Ingredient items (Wasabi), excluding Batch and Sub Recipe
    expect(result.suppliers).toHaveLength(1);
    expect(result.suppliers[0].items).toHaveLength(1);
    expect(result.suppliers[0].items[0].name).toBe('Wasabi');
    expect(result.summary.total).toBe(1);
  });

  it('should aggregate duplicate items by name', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'req1',
          fields: {
            'Item Link': ['item1'],
            'Total Qty Needed': 100,
            'Supplier Name (Static)': 'Tokyo Mart',
            'Ordering Staff (Static)': 'Andie',
          },
        },
        {
          id: 'req2',
          fields: {
            'Item Link': ['item1'],
            'Total Qty Needed': 50,
            'Supplier Name (Static)': 'Tokyo Mart',
            'Ordering Staff (Static)': 'Andie',
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'item1', fields: { 'Item Name': 'Wasabi', Unit: 'g', 'Item Type': 'Ingredient' } },
      ]);

    const result = await buildOrderingList(mockBaseId, mockPrepRunId, ['req1', 'req2'], null);

    expect(result.suppliers).toHaveLength(1);
    expect(result.suppliers[0].items).toHaveLength(1);
    expect(result.suppliers[0].items[0].quantity).toBe(150); // 100 + 50
  });

  it('should skip items with zero quantity', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'req1',
          fields: {
            'Item Link': ['item1'],
            'Total Qty Needed': 0,
            'Supplier Name (Static)': 'Tokyo Mart',
            'Ordering Staff (Static)': 'Andie',
          },
        },
        {
          id: 'req2',
          fields: {
            'Item Link': ['item2'],
            'Total Qty Needed': 100,
            'Supplier Name (Static)': 'Tokyo Mart',
            'Ordering Staff (Static)': 'Andie',
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'item1', fields: { 'Item Name': 'Wasabi', Unit: 'g', 'Item Type': 'Ingredient' } },
        { id: 'item2', fields: { 'Item Name': 'Soy Sauce', Unit: 'ml', 'Item Type': 'Ingredient' } },
      ]);

    const result = await buildOrderingList(mockBaseId, mockPrepRunId, ['req1', 'req2'], null);

    expect(result.suppliers).toHaveLength(1);
    expect(result.suppliers[0].items).toHaveLength(1);
    expect(result.suppliers[0].items[0].name).toBe('Soy Sauce');
  });

  it('should sort suppliers with Unassigned last', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'req1',
          fields: {
            'Item Link': ['item1'],
            'Total Qty Needed': 100,
            'Supplier Name (Static)': 'Unassigned',
            'Ordering Staff (Static)': 'Andie',
          },
        },
        {
          id: 'req2',
          fields: {
            'Item Link': ['item2'],
            'Total Qty Needed': 50,
            'Supplier Name (Static)': 'Tokyo Mart',
            'Ordering Staff (Static)': 'Andie',
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'item1', fields: { 'Item Name': 'Unknown Item', Unit: 'g', 'Item Type': 'Ingredient' } },
        { id: 'item2', fields: { 'Item Name': 'Wasabi', Unit: 'g', 'Item Type': 'Ingredient' } },
      ]);

    const result = await buildOrderingList(mockBaseId, mockPrepRunId, ['req1', 'req2'], null);

    expect(result.suppliers).toHaveLength(2);
    expect(result.suppliers[0].name).toBe('Tokyo Mart');
    expect(result.suppliers[1].name).toBe('Unassigned');
  });

  it('should sort items alphabetically within suppliers', async () => {
    (airtableClient.airtableListAll as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'req1',
          fields: {
            'Item Link': ['item1'],
            'Total Qty Needed': 100,
            'Supplier Name (Static)': 'Tokyo Mart',
            'Ordering Staff (Static)': 'Andie',
          },
        },
        {
          id: 'req2',
          fields: {
            'Item Link': ['item2'],
            'Total Qty Needed': 50,
            'Supplier Name (Static)': 'Tokyo Mart',
            'Ordering Staff (Static)': 'Andie',
          },
        },
        {
          id: 'req3',
          fields: {
            'Item Link': ['item3'],
            'Total Qty Needed': 75,
            'Supplier Name (Static)': 'Tokyo Mart',
            'Ordering Staff (Static)': 'Andie',
          },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'item1', fields: { 'Item Name': 'Wasabi', Unit: 'g', 'Item Type': 'Ingredient' } },
        { id: 'item2', fields: { 'Item Name': 'Soy Sauce', Unit: 'ml', 'Item Type': 'Ingredient' } },
        { id: 'item3', fields: { 'Item Name': 'Mirin', Unit: 'ml', 'Item Type': 'Ingredient' } },
      ]);

    const result = await buildOrderingList(mockBaseId, mockPrepRunId, ['req1', 'req2', 'req3'], null);

    expect(result.suppliers[0].items[0].name).toBe('Mirin');
    expect(result.suppliers[0].items[1].name).toBe('Soy Sauce');
    expect(result.suppliers[0].items[2].name).toBe('Wasabi');
  });
});

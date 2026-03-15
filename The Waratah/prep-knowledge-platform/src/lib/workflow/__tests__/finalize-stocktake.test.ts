/**
 * Unit tests for finalizeStocktake workflow function
 */

import { finalizeStocktake } from '../finalize-stocktake';
import * as airtableClient from '../../airtable-client';

// Mock the airtable-client module
jest.mock('../../airtable-client');

describe('finalizeStocktake', () => {
  const mockBaseId = 'appTestBaseId';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should finalize unconfirmed counts successfully', async () => {
    // Mock unconfirmed counts
    const mockUnconfirmedCounts = [
      {
        id: 'rec1',
        fields: {
          Item: ['item1'],
          'Stock Count': 10,
          'Count Date': '2026-02-10',
          Confirmed: false,
          'Count Source': 'Stocktake',
        },
      },
      {
        id: 'rec2',
        fields: {
          Item: ['item2'],
          'Stock Count': 25.5,
          'Count Date': '2026-02-10',
          Confirmed: false,
          'Count Source': 'Stocktake',
        },
      },
    ];

    (airtableClient.airtableListAll as jest.Mock).mockResolvedValue(mockUnconfirmedCounts);
    (airtableClient.batchUpdate as jest.Mock).mockResolvedValue(undefined);

    const result = await finalizeStocktake(mockBaseId);

    expect(result.step).toBe('finalize');
    expect(result.status).toBe('success');
    expect(result.message).toContain('Finalized 2 stocktake counts');
    expect(result.details).toEqual({ count: 2 });

    // Verify airtableListAll was called correctly
    expect(airtableClient.airtableListAll).toHaveBeenCalledWith(
      mockBaseId,
      'Weekly Counts',
      ['Item', 'Stock Count', 'Count Date', 'Confirmed', 'Count Source'],
      '{Confirmed}=FALSE()'
    );

    // Verify batchUpdate was called with correct updates
    expect(airtableClient.batchUpdate).toHaveBeenCalledWith(
      mockBaseId,
      'Weekly Counts',
      expect.arrayContaining([
        expect.objectContaining({
          id: 'rec1',
          fields: expect.objectContaining({
            Confirmed: true,
            'Count Source': 'Stocktake (Verified)',
          }),
        }),
        expect.objectContaining({
          id: 'rec2',
          fields: expect.objectContaining({
            Confirmed: true,
            'Count Source': 'Stocktake (Verified)',
          }),
        }),
      ])
    );
  });

  it('should return skipped status when no unconfirmed counts found', async () => {
    (airtableClient.airtableListAll as jest.Mock).mockResolvedValue([]);

    const result = await finalizeStocktake(mockBaseId);

    expect(result.step).toBe('finalize');
    expect(result.status).toBe('skipped');
    expect(result.message).toContain('No unconfirmed counts found');

    // Should not call batchUpdate
    expect(airtableClient.batchUpdate).not.toHaveBeenCalled();
  });

  it('should return error when counts have missing stock values', async () => {
    const mockCountsWithMissing = [
      {
        id: 'rec1',
        fields: {
          Item: ['item1'],
          'Stock Count': 10,
        },
      },
      {
        id: 'rec2',
        fields: {
          Item: ['item2'],
          'Stock Count': null, // Missing count
        },
      },
      {
        id: 'rec3',
        fields: {
          Item: ['item3'],
          // Stock Count undefined
        },
      },
    ];

    (airtableClient.airtableListAll as jest.Mock).mockResolvedValue(mockCountsWithMissing);

    const result = await finalizeStocktake(mockBaseId);

    expect(result.step).toBe('finalize');
    expect(result.status).toBe('error');
    expect(result.message).toContain('2 items have missing stock counts');
    expect(result.details).toEqual({ missingCount: 2 });

    // Should not call batchUpdate
    expect(airtableClient.batchUpdate).not.toHaveBeenCalled();
  });

  it('should update Count Date to current timestamp', async () => {
    const mockCounts = [
      {
        id: 'rec1',
        fields: {
          Item: ['item1'],
          'Stock Count': 15,
          'Count Date': '2026-02-01',
        },
      },
    ];

    (airtableClient.airtableListAll as jest.Mock).mockResolvedValue(mockCounts);
    (airtableClient.batchUpdate as jest.Mock).mockResolvedValue(undefined);

    const beforeTime = Date.now();
    await finalizeStocktake(mockBaseId);
    const afterTime = Date.now();

    const updateCall = (airtableClient.batchUpdate as jest.Mock).mock.calls[0];
    const updates = updateCall[2];
    const countDate = updates[0].fields['Count Date'];

    // Verify Count Date is an ISO string and within time range
    expect(countDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const countDateTime = new Date(countDate).getTime();
    expect(countDateTime).toBeGreaterThanOrEqual(beforeTime);
    expect(countDateTime).toBeLessThanOrEqual(afterTime);
  });

  it('should handle zero stock counts correctly', async () => {
    const mockCounts = [
      {
        id: 'rec1',
        fields: {
          Item: ['item1'],
          'Stock Count': 0, // Zero is valid
        },
      },
    ];

    (airtableClient.airtableListAll as jest.Mock).mockResolvedValue(mockCounts);
    (airtableClient.batchUpdate as jest.Mock).mockResolvedValue(undefined);

    const result = await finalizeStocktake(mockBaseId);

    expect(result.status).toBe('success');
    expect(result.message).toContain('Finalized 1 stocktake counts');
  });

  it('should handle Airtable API errors gracefully', async () => {
    (airtableClient.airtableListAll as jest.Mock).mockRejectedValue(
      new Error('Airtable API error 500')
    );

    await expect(finalizeStocktake(mockBaseId)).rejects.toThrow('Airtable API error 500');
  });
});

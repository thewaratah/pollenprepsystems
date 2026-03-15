/**
 * Unit tests for useAutoSave hook
 * Tests debounced auto-save with saving/saved indicators
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutoSave } from '../useAutoSave';
import { StocktakeData } from '../useStocktakeData';

describe('useAutoSave', () => {
  let mockSetData: jest.Mock;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    mockSetData = jest.fn((updater) => {
      if (typeof updater === 'function') {
        const prev = mockData;
        return updater(prev);
      }
    });
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  const mockData: StocktakeData = {
    items: [
      {
        id: 'item1',
        countId: 'count1',
        name: 'Wasabi Mayo',
        type: 'Batch',
        unit: 'ml',
        stockCount: 10,
        confirmed: false,
      },
      {
        id: 'item2',
        countId: 'count2',
        name: 'Ponzu',
        type: 'Batch',
        unit: 'ml',
        stockCount: null,
        confirmed: false,
      },
    ],
    summary: {
      total: 2,
      counted: 1,
      coveragePercent: 50,
    },
  };

  it('should initialize with empty sets', () => {
    const { result } = renderHook(() => useAutoSave(mockSetData));

    expect(result.current.savingIds.size).toBe(0);
    expect(result.current.savedIds.size).toBe(0);
  });

  it('should debounce save for 300ms', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useAutoSave(mockSetData));

    act(() => {
      result.current.handleCountChange('item1', '15');
    });

    // Should update optimistically
    expect(mockSetData).toHaveBeenCalled();

    // Should not save immediately
    expect(mockFetch).not.toHaveBeenCalled();

    // Fast-forward 299ms (just before debounce)
    act(() => {
      jest.advanceTimersByTime(299);
    });

    expect(mockFetch).not.toHaveBeenCalled();

    // Fast-forward 1ms more (300ms total)
    act(() => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/prep/counts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: 'item1', stockCount: 15 }),
      });
    });
  });

  it('should mark item as saving during debounce', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useAutoSave(mockSetData));

    act(() => {
      result.current.handleCountChange('item1', '15');
    });

    // Should be in saving state immediately
    expect(result.current.savingIds.has('item1')).toBe(true);
    expect(result.current.savedIds.has('item1')).toBe(false);
  });

  it('should mark item as saved after successful save', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useAutoSave(mockSetData));

    act(() => {
      result.current.handleCountChange('item1', '15');
    });

    // Fast-forward through debounce
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.savingIds.has('item1')).toBe(false);
      expect(result.current.savedIds.has('item1')).toBe(true);
    });
  });

  it('should clear saved indicator after 2 seconds', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useAutoSave(mockSetData));

    act(() => {
      result.current.handleCountChange('item1', '15');
    });

    // Fast-forward through debounce
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.savedIds.has('item1')).toBe(true);
    });

    // Fast-forward 2 seconds
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(result.current.savedIds.has('item1')).toBe(false);
    });
  });

  it('should cancel previous timer when same item updated', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useAutoSave(mockSetData));

    act(() => {
      result.current.handleCountChange('item1', '15');
    });

    // Fast-forward 200ms
    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Update same item again
    act(() => {
      result.current.handleCountChange('item1', '20');
    });

    // Fast-forward 300ms from second update
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Should save with the latest value (20, not 15)
    expect(mockFetch).toHaveBeenCalledWith('/api/prep/counts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'item1', stockCount: 20 }),
    });
  });

  it('should handle empty string as null', () => {
    const { result } = renderHook(() => useAutoSave(mockSetData));

    act(() => {
      result.current.handleCountChange('item1', '');
    });

    // Should update optimistically with null
    expect(mockSetData).toHaveBeenCalled();

    // Should not save (null is not a valid number)
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should handle API error gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Database error' }),
    });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    const { result } = renderHook(() => useAutoSave(mockSetData));

    act(() => {
      result.current.handleCountChange('item1', '15');
    });

    // Fast-forward through debounce
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.savingIds.has('item1')).toBe(false);
    });

    // Should not be in saved state on error
    expect(result.current.savedIds.has('item1')).toBe(false);

    consoleErrorSpy.mockRestore();
  });

  it('should update local data after save', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    mockSetData.mockImplementation((updater) => {
      if (typeof updater === 'function') {
        updater(mockData);
      }
    });

    const { result } = renderHook(() => useAutoSave(mockSetData));

    act(() => {
      result.current.handleCountChange('item1', '20');
    });

    // Fast-forward through debounce
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockSetData).toHaveBeenCalledTimes(2); // Once optimistic, once after save
    });
  });

  it('should handle multiple items saving concurrently', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useAutoSave(mockSetData));

    act(() => {
      result.current.handleCountChange('item1', '15');
      result.current.handleCountChange('item2', '25');
    });

    // Both should be saving
    expect(result.current.savingIds.has('item1')).toBe(true);
    expect(result.current.savingIds.has('item2')).toBe(true);

    // Fast-forward through debounce
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // Both should be saved
    await waitFor(() => {
      expect(result.current.savedIds.has('item1')).toBe(true);
      expect(result.current.savedIds.has('item2')).toBe(true);
    });
  });
});

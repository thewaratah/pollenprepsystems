/**
 * Unit tests for useStocktakeData hook
 * Tests data fetching and polling functionality
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useStocktakeData } from '../useStocktakeData';

describe('useStocktakeData', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  const mockApiResponse = {
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
    ],
    summary: {
      total: 1,
      counted: 1,
      coveragePercent: 100,
    },
  };

  it('should initialize with loading state', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useStocktakeData());

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should fetch data on mount', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });

    const { result } = renderHook(() => useStocktakeData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/prep/counts');
    expect(result.current.data).toEqual(mockApiResponse);
    expect(result.current.error).toBe(null);
  });

  it('should handle API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Database error' }),
    });

    const { result } = renderHook(() => useStocktakeData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe('Database error');
  });

  it('should handle network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useStocktakeData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe('Network error');
  });

  it('should poll every 60 seconds', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });

    const { result } = renderHook(() => useStocktakeData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Initial fetch
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Fast-forward 60 seconds
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // Fast-forward another 60 seconds
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  it('should clear interval on unmount', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });

    const { unmount } = renderHook(() => useStocktakeData());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Unmount the hook
    unmount();

    // Fast-forward 60 seconds
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    // Should not fetch again after unmount
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should allow manual refetch via fetchData', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });

    const { result } = renderHook(() => useStocktakeData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Manual refetch
    await act(async () => {
      await result.current.fetchData();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should allow setData for optimistic updates', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });

    const { result } = renderHook(() => useStocktakeData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const newData = {
      ...mockApiResponse,
      items: [
        {
          ...mockApiResponse.items[0],
          stockCount: 20,
        },
      ],
    };

    act(() => {
      result.current.setData(newData);
    });

    expect(result.current.data).toEqual(newData);
  });

  it('should clear error on successful fetch', async () => {
    // First call fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Database error' }),
    });

    const { result } = renderHook(() => useStocktakeData());

    await waitFor(() => {
      expect(result.current.error).toBe('Database error');
    });

    // Second call succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    await act(async () => {
      await result.current.fetchData();
    });

    expect(result.current.error).toBe(null);
    expect(result.current.data).toEqual(mockApiResponse);
  });
});

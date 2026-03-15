/**
 * Unit tests for useStocktakeFilter hook
 * Tests search and type filtering for stocktake items
 */

import { renderHook, act } from '@testing-library/react';
import { useStocktakeFilter } from '../useStocktakeFilter';
import { StocktakeData } from '../useStocktakeData';

describe('useStocktakeFilter', () => {
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
      {
        id: 'item3',
        countId: 'count3',
        name: 'Wasabi',
        type: 'Ingredient',
        unit: 'g',
        stockCount: 50,
        confirmed: false,
      },
      {
        id: 'item4',
        countId: 'count4',
        name: 'Mirin Base',
        type: 'Sub Recipe',
        unit: 'ml',
        stockCount: null,
        confirmed: false,
      },
    ],
    summary: {
      total: 4,
      counted: 2,
      coveragePercent: 50,
    },
  };

  it('should return all items when no filters applied', () => {
    const { result } = renderHook(() => useStocktakeFilter(mockData));

    expect(result.current.filteredItems).toHaveLength(4);
    expect(result.current.searchQuery).toBe('');
    expect(result.current.typeFilter).toBe('all');
  });

  it('should filter items by search query (case-insensitive)', () => {
    const { result } = renderHook(() => useStocktakeFilter(mockData));

    act(() => {
      result.current.setSearchQuery('wasabi');
    });

    expect(result.current.filteredItems).toHaveLength(2);
    expect(result.current.filteredItems[0].name).toBe('Wasabi Mayo');
    expect(result.current.filteredItems[1].name).toBe('Wasabi');
  });

  it('should filter items by type', () => {
    const { result } = renderHook(() => useStocktakeFilter(mockData));

    act(() => {
      result.current.setTypeFilter('Batch');
    });

    expect(result.current.filteredItems).toHaveLength(2);
    expect(result.current.filteredItems[0].type).toBe('Batch');
    expect(result.current.filteredItems[1].type).toBe('Batch');
  });

  it('should combine search and type filters', () => {
    const { result } = renderHook(() => useStocktakeFilter(mockData));

    act(() => {
      result.current.setSearchQuery('wasabi');
      result.current.setTypeFilter('Ingredient');
    });

    expect(result.current.filteredItems).toHaveLength(1);
    expect(result.current.filteredItems[0].name).toBe('Wasabi');
    expect(result.current.filteredItems[0].type).toBe('Ingredient');
  });

  it('should return unique item types sorted', () => {
    const { result } = renderHook(() => useStocktakeFilter(mockData));

    expect(result.current.itemTypes).toEqual(['Batch', 'Ingredient', 'Sub Recipe']);
  });

  it('should handle null data gracefully', () => {
    const { result } = renderHook(() => useStocktakeFilter(null));

    expect(result.current.filteredItems).toEqual([]);
    expect(result.current.itemTypes).toEqual([]);
  });

  it('should memoize filtered items to avoid unnecessary re-renders', () => {
    const { result, rerender } = renderHook(() => useStocktakeFilter(mockData));

    const firstFilteredItems = result.current.filteredItems;

    // Rerender without changing props
    rerender();

    // Should return the same array instance (memoized)
    expect(result.current.filteredItems).toBe(firstFilteredItems);
  });

  it('should clear search query', () => {
    const { result } = renderHook(() => useStocktakeFilter(mockData));

    act(() => {
      result.current.setSearchQuery('wasabi');
    });

    expect(result.current.filteredItems).toHaveLength(2);

    act(() => {
      result.current.setSearchQuery('');
    });

    expect(result.current.filteredItems).toHaveLength(4);
  });

  it('should reset type filter to all', () => {
    const { result } = renderHook(() => useStocktakeFilter(mockData));

    act(() => {
      result.current.setTypeFilter('Batch');
    });

    expect(result.current.filteredItems).toHaveLength(2);

    act(() => {
      result.current.setTypeFilter('all');
    });

    expect(result.current.filteredItems).toHaveLength(4);
  });
});

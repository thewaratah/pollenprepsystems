/**
 * Stocktake Filter Hook
 *
 * Manages search and type filtering for stocktake items.
 * Provides filtered items and available item types.
 */

import { useState, useMemo } from 'react';
import { StocktakeData } from './useStocktakeData';

export function useStocktakeFilter(data: StocktakeData | null) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Filter items based on search and type
  const filteredItems = useMemo(() => {
    if (!data) return [];

    return data.items.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [data, searchQuery, typeFilter]);

  // Get unique types for filter dropdown
  const itemTypes = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.items.map((i) => i.type))].sort();
  }, [data]);

  return {
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    filteredItems,
    itemTypes,
  };
}

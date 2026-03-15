/**
 * Stocktake Data Hook
 *
 * Manages fetching and polling of stocktake data from /api/prep/counts.
 * Auto-refreshes every 60 seconds to keep data current.
 */

import { useState, useEffect, useCallback } from 'react';

export interface StocktakeItem {
  id: string;
  countId: string | null;
  name: string;
  type: string;
  unit: string;
  stockCount: number | null;
  confirmed: boolean;
}

export interface StocktakeData {
  items: StocktakeItem[];
  summary: {
    total: number;
    counted: number;
    coveragePercent: number;
  };
}

export function useStocktakeData() {
  const [data, setData] = useState<StocktakeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/prep/counts');
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch');
      }
      const result = await res.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stocktake data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll every 60 seconds (less frequent since user is actively editing)
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, setData, loading, error, fetchData };
}

/**
 * Auto-Save Hook
 *
 * Debounced auto-save for stocktake count updates.
 * Shows saving/saved indicators with 300ms debounce.
 */

import { useState, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { StocktakeData } from './useStocktakeData';

export function useAutoSave(setData: Dispatch<SetStateAction<StocktakeData | null>>) {
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const updateCount = useCallback(
    async (itemId: string, stockCount: number) => {
      // Clear any existing timer for this item
      if (debounceTimers.current[itemId]) {
        clearTimeout(debounceTimers.current[itemId]);
      }

      // Mark as saving
      setSavingIds((prev) => new Set(prev).add(itemId));
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });

      // Debounce the actual save
      debounceTimers.current[itemId] = setTimeout(async () => {
        try {
          const res = await fetch('/api/prep/counts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId, stockCount }),
          });

          if (!res.ok) {
            throw new Error('Failed to save');
          }

          // Mark as saved
          setSavedIds((prev) => new Set(prev).add(itemId));

          // Update local data
          setData((prev) => {
            if (!prev) return prev;
            const updatedItems = prev.items.map((item) =>
              item.id === itemId ? { ...item, stockCount } : item
            );
            const counted = updatedItems.filter((i) => i.stockCount !== null).length;
            return {
              ...prev,
              items: updatedItems,
              summary: {
                ...prev.summary,
                counted,
                coveragePercent: Math.round((counted / prev.summary.total) * 100),
              },
            };
          });

          // Clear saved indicator after 2 seconds
          setTimeout(() => {
            setSavedIds((prev) => {
              const next = new Set(prev);
              next.delete(itemId);
              return next;
            });
          }, 2000);
        } catch {
          // Error handling - could show toast
          console.error('Failed to save count for', itemId);
        } finally {
          setSavingIds((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        }
      }, 300);
    },
    [setData]
  );

  // Handle input change - optimistic update + debounced save
  const handleCountChange = useCallback(
    (itemId: string, value: string) => {
      const numValue = value === '' ? null : parseFloat(value);

      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === itemId ? { ...item, stockCount: numValue } : item
          ),
        };
      });

      // Save if it's a valid number
      if (numValue !== null && !isNaN(numValue)) {
        updateCount(itemId, numValue);
      }
    },
    [setData, updateCount]
  );

  return { savingIds, savedIds, handleCountChange };
}

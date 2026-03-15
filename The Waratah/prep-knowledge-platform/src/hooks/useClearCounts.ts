/**
 * Clear Counts Hook
 *
 * Manages the "Clear Weekly Count" modal and action.
 * Resets all stocktake counts to start fresh.
 */

import { useState, useCallback } from 'react';

export function useClearCounts(
  fetchData: () => Promise<void>,
  setError: (error: string | null) => void
) {
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleClearCounts = useCallback(async () => {
    setClearing(true);
    try {
      const res = await fetch('/api/prep/counts/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preserveVerified: false }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to clear counts');
      }

      // Refresh data
      await fetchData();
      setShowClearModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear counts');
    } finally {
      setClearing(false);
    }
  }, [fetchData, setError]);

  return {
    showClearModal,
    setShowClearModal,
    clearing,
    handleClearCounts,
  };
}

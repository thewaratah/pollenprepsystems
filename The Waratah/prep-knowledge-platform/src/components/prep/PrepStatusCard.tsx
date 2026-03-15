'use client';

import { useState, useEffect } from 'react';

interface PrepStatus {
  prepRun: {
    id: string;
    label: string;
    createdAt: string;
    status: string;
    tasksCount: number;
    completedTasks: number;
  } | null;
  stocktake: {
    coveragePercent: number;
    countedItems: number;
    totalItems: number;
    isReady: boolean;
  };
}

export function PrepStatusCard() {
  const [status, setStatus] = useState<PrepStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    fetchStatus();
    // Refresh every 5 minutes
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/prep/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch prep status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-lg p-2">
        <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-24"></div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const stocktakeCoverage = status.stocktake.coveragePercent;
  const prepProgress = status.prepRun
    ? Math.round((status.prepRun.completedTasks / status.prepRun.tasksCount) * 100) || 0
    : 0;

  // Determine status color
  const getStatusColor = (percent: number) => {
    if (percent >= 90) return 'text-green-600 dark:text-green-400';
    if (percent >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  return (
    <div className="relative">
      {/* Compact toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-sm"
      >
        <span className="flex items-center gap-1.5">
          <span className={`font-medium ${getStatusColor(stocktakeCoverage)}`}>
            {stocktakeCoverage}%
          </span>
          <span className="text-zinc-500 text-xs">stocktake</span>
        </span>
        {status.prepRun && (
          <>
            <span className="text-zinc-300 dark:text-zinc-600">|</span>
            <span className="flex items-center gap-1.5">
              <span className={`font-medium ${getStatusColor(prepProgress)}`}>
                {prepProgress}%
              </span>
              <span className="text-zinc-500 text-xs">prep</span>
            </span>
          </>
        )}
        <svg
          className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 p-4 z-50">
          {/* Stocktake section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Stocktake</h4>
              {status.stocktake.isReady && (
                <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
                  Ready
                </span>
              )}
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 mb-1">
              <div
                className={`h-2 rounded-full transition-all ${
                  stocktakeCoverage >= 90
                    ? 'bg-green-500'
                    : stocktakeCoverage >= 50
                    ? 'bg-yellow-500'
                    : 'bg-orange-500'
                }`}
                style={{ width: `${stocktakeCoverage}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500">
              {status.stocktake.countedItems} of {status.stocktake.totalItems} items counted
            </p>
          </div>

          {/* Prep run section */}
          {status.prepRun ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Prep Run
                </h4>
                <span className="text-xs text-zinc-500">{status.prepRun.label}</span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 mb-1">
                <div
                  className={`h-2 rounded-full transition-all ${
                    prepProgress >= 90
                      ? 'bg-green-500'
                      : prepProgress >= 50
                      ? 'bg-yellow-500'
                      : 'bg-orange-500'
                  }`}
                  style={{ width: `${prepProgress}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500">
                {status.prepRun.completedTasks} of {status.prepRun.tasksCount} tasks complete
              </p>
            </div>
          ) : (
            <div className="text-sm text-zinc-500 italic">No active prep run</div>
          )}

          {/* Quick actions hint */}
          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
            <p className="text-xs text-zinc-400">
              Ask me: &quot;What&apos;s the stocktake status?&quot; or &quot;What needs to be prepped?&quot;
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

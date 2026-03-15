'use client';

import Link from 'next/link';
import { ProgressBar } from '@/components/prep/ProgressBar';
import { useStocktakeData } from '@/hooks/useStocktakeData';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useClearCounts } from '@/hooks/useClearCounts';
import { useWorkflowGeneration } from '@/hooks/useWorkflowGeneration';
import { useStocktakeFilter } from '@/hooks/useStocktakeFilter';

export default function StocktakePage() {
  // Data fetching with polling
  const { data, setData, loading, error, fetchData } = useStocktakeData();

  // Auto-save with debouncing
  const { savingIds, savedIds, handleCountChange } = useAutoSave(setData);

  // Clear counts modal
  const { showClearModal, setShowClearModal, clearing, handleClearCounts } = useClearCounts(
    fetchData,
    (err) => {} // error is already managed by useStocktakeData
  );

  // Workflow generation
  const {
    showWorkflowModal,
    workflowRunning,
    workflowSteps,
    workflowResult,
    handleGenerate,
    closeWorkflowModal,
  } = useWorkflowGeneration(fetchData);

  // Search and filter
  const { searchQuery, setSearchQuery, typeFilter, setTypeFilter, filteredItems, itemTypes } =
    useStocktakeFilter(data);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-48" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600 font-medium">Error: {error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: '#4A5D23', fontFamily: 'var(--font-display)' }}
          >
            Weekly Stocktake
          </h1>
          <p className="text-sm" style={{ color: '#8a8a8a' }}>
            Enter stock counts for all items
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/prep"
            className="text-sm px-3 py-2 rounded border"
            style={{ borderColor: '#e5e5e5', color: '#8a8a8a' }}
          >
            ← Dashboard
          </Link>
          <button
            onClick={() => setShowClearModal(true)}
            className="text-sm px-4 py-2 rounded border font-medium"
            style={{ borderColor: '#d85a3a', color: '#d85a3a' }}
          >
            Clear Weekly Count
          </button>
          <button
            onClick={handleGenerate}
            className="text-sm px-4 py-2 rounded font-medium text-white hover:opacity-90"
            style={{ backgroundColor: '#4A5D23' }}
            title="Generate ordering and prep sheets"
          >
            GENERATE ORDERING & PREP SHEETS
          </button>
        </div>
      </div>

      {/* Coverage Progress */}
      {data && (
        <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#e5e5e5' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Coverage</span>
            <span className="text-sm" style={{ color: '#8a8a8a' }}>
              {data.summary.counted} of {data.summary.total} items counted (
              {data.summary.coveragePercent}%)
            </span>
          </div>
          <ProgressBar
            completed={data.summary.counted}
            total={data.summary.total}
            color="green"
          />
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            style={{ borderColor: '#e5e5e5' }}
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg"
          style={{ borderColor: '#e5e5e5' }}
        >
          <option value="all">All Types</option>
          {itemTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Items Grid */}
      <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: '#e5e5e5' }}>
        {/* Header Row */}
        <div
          className="grid grid-cols-12 gap-4 p-3 font-medium text-sm"
          style={{ backgroundColor: '#f5f4f0', color: '#1a1a1a' }}
        >
          <div className="col-span-5">Item Name</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-3">Stock Count</div>
          <div className="col-span-2">Status</div>
        </div>

        {/* Item Rows */}
        <div className="divide-y" style={{ borderColor: '#e5e5e5' }}>
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center" style={{ color: '#8a8a8a' }}>
              No items found
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-12 gap-4 p-3 items-center hover:bg-gray-50"
              >
                <div className="col-span-5 font-medium" style={{ color: '#1a1a1a' }}>
                  {item.name}
                </div>
                <div className="col-span-2 text-sm" style={{ color: '#8a8a8a' }}>
                  {item.type}
                </div>
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={item.stockCount ?? ''}
                      onChange={(e) => handleCountChange(item.id, e.target.value)}
                      placeholder="0"
                      className="w-24 px-2 py-1 border rounded text-right"
                      style={{ borderColor: '#e5e5e5' }}
                      min="0"
                      step="0.01"
                    />
                    <span className="text-sm" style={{ color: '#8a8a8a' }}>
                      {item.unit}
                    </span>
                  </div>
                </div>
                <div className="col-span-2">
                  {savingIds.has(item.id) ? (
                    <span className="text-sm" style={{ color: '#8a8a8a' }}>
                      Saving...
                    </span>
                  ) : savedIds.has(item.id) ? (
                    <span className="text-sm text-green-600">✓ Saved</span>
                  ) : item.stockCount !== null ? (
                    <span className="text-sm text-green-600">✓ Counted</span>
                  ) : (
                    <span className="text-sm" style={{ color: '#d85a3a' }}>
                      ⚠ Not counted
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Clear Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4" style={{ color: '#d85a3a' }}>
              Clear Weekly Count?
            </h2>
            <p className="mb-6" style={{ color: '#1a1a1a' }}>
              This will delete all current stocktake counts and create fresh placeholder
              records for all active items. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
                className="px-4 py-2 border rounded"
                style={{ borderColor: '#e5e5e5' }}
              >
                Cancel
              </button>
              <button
                onClick={handleClearCounts}
                disabled={clearing}
                className="px-4 py-2 rounded text-white"
                style={{ backgroundColor: '#d85a3a' }}
              >
                {clearing ? 'Clearing...' : 'Clear All Counts'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Modal */}
      {showWorkflowModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h2 className="text-xl font-bold mb-4" style={{ color: '#4A5D23' }}>
              {workflowRunning
                ? 'Generating...'
                : workflowResult?.success
                ? 'Complete!'
                : 'Generation Failed'}
            </h2>

            {/* Progress Steps */}
            <div className="space-y-3 mb-6">
              {workflowSteps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-6 h-6 flex items-center justify-center">
                    {step.status === 'pending' && (
                      <span className="w-4 h-4 border-2 border-gray-300 rounded-full" />
                    )}
                    {step.status === 'running' && (
                      <span className="w-4 h-4 border-2 border-[#4A5D23] border-t-transparent rounded-full animate-spin" />
                    )}
                    {step.status === 'success' && (
                      <span className="text-green-600">✓</span>
                    )}
                    {step.status === 'error' && (
                      <span className="text-red-600">✕</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className="font-medium"
                      style={{
                        color:
                          step.status === 'success'
                            ? '#16a34a'
                            : step.status === 'error'
                            ? '#dc2626'
                            : '#1a1a1a',
                      }}
                    >
                      {step.name}
                    </p>
                    {step.message && (
                      <p className="text-sm" style={{ color: '#8a8a8a' }}>
                        {step.message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Result */}
            {workflowResult && (
              <div
                className={`p-4 rounded-lg mb-6 ${
                  workflowResult.success ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                {workflowResult.success ? (
                  <>
                    <p className="font-medium text-green-800 mb-2">
                      Ordering and prep sheets are being generated!
                    </p>
                    <p className="text-sm text-green-700">
                      The Google Apps Script will create the documents. Check Airtable
                      for the folder link once complete.
                    </p>
                  </>
                ) : (
                  <p className="text-red-800">{workflowResult.error}</p>
                )}
              </div>
            )}

            {/* Close Button */}
            {!workflowRunning && (
              <div className="flex justify-end">
                <button
                  onClick={closeWorkflowModal}
                  className="px-4 py-2 rounded text-white"
                  style={{ backgroundColor: '#4A5D23' }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

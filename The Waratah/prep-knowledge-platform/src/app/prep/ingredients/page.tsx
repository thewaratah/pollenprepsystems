'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ProgressBar } from '@/components/prep/ProgressBar';

interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface SubRecipe {
  id: string;
  itemId: string;
  name: string;
  targetQty: number;
  unit: string;
  batches: number;
  method: string;
  recipeId: string | null;
  ingredients: Ingredient[];
  isCompleted: boolean;
}

interface Batch {
  id: string;
  name: string;
  targetQty: number;
  unit: string;
  batches: number;
  isCompleted: boolean;
  subRecipes: SubRecipe[];
}

interface IngredientsData {
  type: string;
  prepRunId?: string;
  batches: Batch[];
  summary: {
    total: number;
    completed: number;
    percent: number;
  };
}

const BUFFER_MULTIPLIER = 1.5;

function formatQty(qty: number, unit: string): string {
  const buffered = qty * BUFFER_MULTIPLIER;
  const qtyStr = Number.isInteger(qty) ? qty.toString() : qty.toFixed(2);
  const bufferedStr = Number.isInteger(buffered) ? buffered.toString() : buffered.toFixed(2);
  return `${qtyStr}${unit} (1.5× = ${bufferedStr}${unit})`;
}

export default function IngredientsPage() {
  const [data, setData] = useState<IngredientsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [expandedSubRecipes, setExpandedSubRecipes] = useState<Set<string>>(new Set());
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  async function fetchData() {
    try {
      const response = await fetch('/api/prep/lists?type=ingredients');
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch');
      }
      const result = await response.json();
      setData(result);
      setError(null);
      // Expand all by default
      setExpandedBatches(new Set(result.batches.map((b: Batch) => b.id)));
      const allSubRecipeIds = result.batches.flatMap((b: Batch) =>
        b.subRecipes.map((s: SubRecipe) => s.id)
      );
      setExpandedSubRecipes(new Set(allSubRecipeIds));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ingredient prep data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function toggleComplete(subRecipeId: string, currentState: boolean) {
    if (!data) return;

    setUpdatingIds((prev) => new Set(prev).add(subRecipeId));

    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        batches: prev.batches.map((b) => ({
          ...b,
          subRecipes: b.subRecipes.map((s) =>
            s.id === subRecipeId ? { ...s, isCompleted: !currentState } : s
          ),
        })),
        summary: {
          ...prev.summary,
          completed: prev.summary.completed + (currentState ? -1 : 1),
          percent: Math.round(
            ((prev.summary.completed + (currentState ? -1 : 1)) / prev.summary.total) * 100
          ),
        },
      };
    });

    try {
      const response = await fetch('/api/prep/lists', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: subRecipeId,
          table: 'tasks',
          completed: !currentState,
        }),
      });

      if (!response.ok) {
        throw new Error('Update failed');
      }
    } catch {
      // Revert on error
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          batches: prev.batches.map((b) => ({
            ...b,
            subRecipes: b.subRecipes.map((s) =>
              s.id === subRecipeId ? { ...s, isCompleted: currentState } : s
            ),
          })),
          summary: {
            ...prev.summary,
            completed: prev.summary.completed + (currentState ? 1 : -1),
            percent: Math.round(
              ((prev.summary.completed + (currentState ? 1 : -1)) / prev.summary.total) * 100
            ),
          },
        };
      });
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(subRecipeId);
        return next;
      });
    }
  }

  function toggleBatchExpand(batchId: string) {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  }

  function toggleSubRecipeExpand(subRecipeId: string) {
    setExpandedSubRecipes((prev) => {
      const next = new Set(prev);
      if (next.has(subRecipeId)) {
        next.delete(subRecipeId);
      } else {
        next.add(subRecipeId);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-48" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
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

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: '#4A5D23', fontFamily: 'var(--font-display)' }}
          >
            🍸 Ingredient Prep List
          </h1>
          <p className="text-sm" style={{ color: '#8a8a8a' }}>
            Sub-recipes grouped by batch
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/prep"
            className="text-sm px-3 py-2 rounded border"
            style={{ borderColor: '#e5e5e5', color: '#8a8a8a' }}
          >
            ← Dashboard
          </Link>
          {data.summary.completed > 0 && (
            <button
              onClick={() => {
                setData((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    batches: prev.batches.map((b) => ({
                      ...b,
                      subRecipes: b.subRecipes.map((s) => ({ ...s, isCompleted: false })),
                    })),
                    summary: { ...prev.summary, completed: 0, percent: 0 },
                  };
                });
              }}
              className="text-sm px-3 py-2 rounded border"
              style={{ borderColor: '#e5e5e5', color: '#8a8a8a' }}
            >
              Uncheck All
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#e5e5e5' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium">Overall Progress</span>
          <span className="text-sm" style={{ color: '#8a8a8a' }}>
            {data.summary.completed} of {data.summary.total} sub-recipes complete
          </span>
        </div>
        <ProgressBar
          completed={data.summary.completed}
          total={data.summary.total}
          color="green"
        />
      </div>

      {/* Feedback Link */}
      <div className="text-sm" style={{ color: '#8a8a8a' }}>
        Have feedback?{' '}
        <a
          href={`/feedback?docType=Ingredient%20Prep%20List&staffRole=Prep%20Team${data.prepRunId ? `&prepRunId=${data.prepRunId}` : ''}`}
          className="underline"
          style={{ color: '#007AFF' }}
        >
          Submit here
        </a>
      </div>

      {/* Batches with Sub-Recipes */}
      <div className="space-y-4">
        {data.batches.length === 0 ? (
          <div className="text-center py-8" style={{ color: '#8a8a8a' }}>
            No batches with sub-recipe prep requirements found.
          </div>
        ) : (
          data.batches.map((batch) => (
            <div
              key={batch.id}
              className="bg-white rounded-lg border overflow-hidden"
              style={{ borderColor: '#e5e5e5' }}
            >
              {/* Batch Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50"
                style={{ backgroundColor: '#f5f4f0' }}
                onClick={() => toggleBatchExpand(batch.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2
                      className="font-bold text-lg"
                      style={{ color: '#4A5D23' }}
                    >
                      {batch.name}
                    </h2>
                    <p className="text-sm" style={{ color: '#1a1a1a' }}>
                      <span className="underline font-bold">
                        {formatQty(batch.targetQty, batch.unit).split(' ')[0]}
                      </span>
                      {' '}
                      {formatQty(batch.targetQty, batch.unit).split(' ').slice(1).join(' ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm" style={{ color: '#8a8a8a' }}>
                      {batch.subRecipes.filter(s => s.isCompleted).length}/{batch.subRecipes.length}
                    </span>
                    <svg
                      className={`w-5 h-5 transition-transform ${
                        expandedBatches.has(batch.id) ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      style={{ color: '#8a8a8a' }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Sub-Recipes */}
              {expandedBatches.has(batch.id) && (
                <div className="border-t divide-y" style={{ borderColor: '#e5e5e5' }}>
                  {batch.subRecipes.map((subRecipe) => (
                    <div
                      key={subRecipe.id}
                      className={`transition-all ${subRecipe.isCompleted ? 'opacity-60' : ''}`}
                    >
                      {/* Sub-Recipe Header */}
                      <div
                        className="p-4 pl-8 flex items-start gap-3 cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleSubRecipeExpand(subRecipe.id)}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleComplete(subRecipe.id, subRecipe.isCompleted);
                          }}
                          disabled={updatingIds.has(subRecipe.id)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-colors ${
                            updatingIds.has(subRecipe.id) ? 'opacity-50' : ''
                          }`}
                          style={{
                            borderColor: subRecipe.isCompleted ? '#4A5D23' : '#ccc',
                            backgroundColor: subRecipe.isCompleted ? '#4A5D23' : 'white',
                          }}
                        >
                          {subRecipe.isCompleted && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <h3
                            className={`font-semibold ${subRecipe.isCompleted ? 'line-through' : ''}`}
                            style={{ color: '#d85a3a' }}
                          >
                            {subRecipe.name}
                          </h3>
                          <p className="text-sm" style={{ color: '#1a1a1a' }}>
                            <span className="underline font-bold">
                              {formatQty(subRecipe.targetQty, subRecipe.unit).split(' ')[0]}
                            </span>
                            {' '}
                            {formatQty(subRecipe.targetQty, subRecipe.unit).split(' ').slice(1).join(' ')}
                          </p>
                          {subRecipe.batches > 0 && (
                            <p className="text-xs" style={{ color: '#8a8a8a' }}>
                              {subRecipe.batches} batch{subRecipe.batches !== 1 ? 'es' : ''} needed
                            </p>
                          )}
                        </div>

                        <svg
                          className={`w-4 h-4 transition-transform ${
                            expandedSubRecipes.has(subRecipe.id) ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          style={{ color: '#8a8a8a' }}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {/* Sub-Recipe Expanded Content */}
                      {expandedSubRecipes.has(subRecipe.id) && (
                        <div className="px-4 pb-4 pl-16" style={{ borderColor: '#e5e5e5' }}>
                          {/* Recipe Scaler Link */}
                          {subRecipe.recipeId && (
                            <div className="mb-3">
                              <a
                                href={`/scaler?recipeId=${subRecipe.recipeId}`}
                                className="inline-flex items-center gap-1 text-sm"
                                style={{ color: '#007AFF' }}
                              >
                                📐 Scale this recipe
                              </a>
                            </div>
                          )}

                          {/* Ingredients */}
                          {subRecipe.ingredients.length > 0 && (
                            <div>
                              <ul className="space-y-1">
                                {subRecipe.ingredients.map((ing, idx) => (
                                  <li
                                    key={idx}
                                    className="flex items-center gap-2 text-sm"
                                    style={{ color: '#1a1a1a' }}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                    <span>
                                      <span className="font-medium">{ing.name}</span>{' '}
                                      <span className="underline font-bold">
                                        {formatQty(ing.quantity, ing.unit).split(' ')[0]}
                                      </span>
                                      {' '}
                                      {formatQty(ing.quantity, ing.unit).split(' ').slice(1).join(' ')}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Method */}
                          {subRecipe.method && (
                            <div className="mt-4">
                              <h4 className="text-sm font-semibold mb-2" style={{ color: '#1a1a1a' }}>
                                Method:
                              </h4>
                              <div className="text-sm whitespace-pre-wrap" style={{ color: '#1a1a1a' }}>
                                {subRecipe.method}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

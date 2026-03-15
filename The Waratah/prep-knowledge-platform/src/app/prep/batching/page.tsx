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

interface BatchTask {
  id: string;
  name: string;
  targetQty: number;
  unit: string;
  batches: number;
  notes: string;
  method: string;
  recipeId: string | null;
  ingredients: Ingredient[];
  isCompleted: boolean;
}

interface BatchingData {
  type: string;
  prepRunId?: string;
  tasks: BatchTask[];
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

export default function BatchingPage() {
  const [data, setData] = useState<BatchingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  async function fetchData() {
    try {
      const response = await fetch('/api/prep/lists?type=batching');
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch');
      }
      const result = await response.json();
      setData(result);
      setError(null);
      // Expand all tasks by default
      setExpandedTasks(new Set(result.tasks.map((t: BatchTask) => t.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load batching data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function toggleComplete(taskId: string, currentState: boolean) {
    if (!data) return;

    setUpdatingIds((prev) => new Set(prev).add(taskId));

    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, isCompleted: !currentState } : t
        ),
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
          id: taskId,
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
          tasks: prev.tasks.map((t) =>
            t.id === taskId ? { ...t, isCompleted: currentState } : t
          ),
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
        next.delete(taskId);
        return next;
      });
    }
  }

  function toggleExpand(taskId: string) {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
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
            <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />
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
            style={{ color: '#d85a3a', fontFamily: 'var(--font-display)' }}
          >
            🫙 Batching List
          </h1>
          <p className="text-sm" style={{ color: '#8a8a8a' }}>
            Batch tasks with ingredient requirements
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
                    tasks: prev.tasks.map((t) => ({ ...t, isCompleted: false })),
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
            {data.summary.completed} of {data.summary.total} batches complete
          </span>
        </div>
        <ProgressBar
          completed={data.summary.completed}
          total={data.summary.total}
          color="orange"
        />
      </div>

      {/* Feedback Link */}
      <div className="text-sm" style={{ color: '#8a8a8a' }}>
        Have feedback?{' '}
        <a
          href={`/feedback?docType=Batching%20List&staffRole=Prep%20Team${data.prepRunId ? `&prepRunId=${data.prepRunId}` : ''}`}
          className="underline"
          style={{ color: '#007AFF' }}
        >
          Submit here
        </a>
      </div>

      {/* Batch Tasks */}
      <div className="space-y-4">
        {data.tasks.length === 0 ? (
          <div className="text-center py-8" style={{ color: '#8a8a8a' }}>
            No batch tasks found for this prep run.
          </div>
        ) : (
          data.tasks.map((task) => (
            <div
              key={task.id}
              className={`bg-white rounded-lg border overflow-hidden transition-all ${
                task.isCompleted ? 'opacity-60' : ''
              }`}
              style={{ borderColor: '#e5e5e5' }}
            >
              {/* Task Header */}
              <div
                className="p-4 flex items-start gap-3 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleExpand(task.id)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleComplete(task.id, task.isCompleted);
                  }}
                  disabled={updatingIds.has(task.id)}
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-colors ${
                    updatingIds.has(task.id) ? 'opacity-50' : ''
                  }`}
                  style={{
                    borderColor: task.isCompleted ? '#d85a3a' : '#ccc',
                    backgroundColor: task.isCompleted ? '#d85a3a' : 'white',
                  }}
                >
                  {task.isCompleted && (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <h3
                    className={`font-bold text-lg ${task.isCompleted ? 'line-through' : ''}`}
                    style={{ color: '#d85a3a' }}
                  >
                    {task.name}
                  </h3>
                  <p className="text-sm font-medium" style={{ color: '#1a1a1a' }}>
                    <span className="underline font-bold">
                      {formatQty(task.targetQty, task.unit).split(' ')[0]}
                    </span>
                    {' '}
                    {formatQty(task.targetQty, task.unit).split(' ').slice(1).join(' ')}
                  </p>
                  {task.batches > 0 && (
                    <p className="text-xs" style={{ color: '#8a8a8a' }}>
                      {task.batches} batch{task.batches !== 1 ? 'es' : ''} needed
                    </p>
                  )}
                </div>

                <svg
                  className={`w-5 h-5 transition-transform ${
                    expandedTasks.has(task.id) ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  style={{ color: '#8a8a8a' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Expanded Content */}
              {expandedTasks.has(task.id) && (
                <div className="border-t px-4 pb-4" style={{ borderColor: '#e5e5e5' }}>
                  {/* Recipe Scaler Link */}
                  {task.recipeId && (
                    <div className="pt-3">
                      <a
                        href={`/scaler?recipeId=${task.recipeId}`}
                        className="inline-flex items-center gap-1 text-sm"
                        style={{ color: '#007AFF' }}
                      >
                        📐 Scale this recipe
                      </a>
                    </div>
                  )}

                  {/* Ingredients */}
                  {task.ingredients.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium mb-2" style={{ color: '#1a1a1a' }}>
                        Ingredients:
                      </h4>
                      <ul className="space-y-1 pl-4">
                        {task.ingredients.map((ing, idx) => (
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
                  {task.method && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2" style={{ color: '#1a1a1a' }}>
                        Method:
                      </h4>
                      <div className="text-sm whitespace-pre-wrap" style={{ color: '#1a1a1a' }}>
                        {task.method}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {task.notes && (
                    <div className="mt-4">
                      <h4 className="text-sm font-bold mb-1" style={{ color: '#1a1a1a' }}>
                        Notes:
                      </h4>
                      <div className="text-sm" style={{ color: '#8a8a8a' }}>
                        {task.notes}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

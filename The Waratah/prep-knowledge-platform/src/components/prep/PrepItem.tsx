'use client';

import { useState } from 'react';

const BUFFER_MULTIPLIER = 1.5;

function formatQty(qty: number, unit: string): string {
  const buffered = qty * BUFFER_MULTIPLIER;
  const qtyStr = Number.isInteger(qty) ? qty.toString() : qty.toFixed(2);
  const bufferedStr = Number.isInteger(buffered) ? buffered.toString() : buffered.toFixed(2);
  return `${qtyStr}${unit} (1.5× = ${bufferedStr}${unit})`;
}

interface PrepItemProps {
  id: string;
  name: string;
  quantity?: number | string;
  unit?: string;
  notes?: string;
  isCompleted?: boolean;
  onToggle?: (id: string, completed: boolean) => void;
  disabled?: boolean;
}

export function PrepItem({
  id,
  name,
  quantity,
  unit = '',
  notes,
  isCompleted = false,
  onToggle,
  disabled = false,
}: PrepItemProps) {
  const [completed, setCompleted] = useState(isCompleted);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async () => {
    if (disabled || isUpdating) return;

    setIsUpdating(true);
    const newValue = !completed;
    setCompleted(newValue);

    try {
      if (onToggle) {
        await onToggle(id, newValue);
      }
    } catch {
      // Revert on error
      setCompleted(!newValue);
    } finally {
      setIsUpdating(false);
    }
  };

  // Format quantity with buffer
  const formattedQty = typeof quantity === 'number'
    ? formatQty(quantity, unit)
    : quantity;

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
        completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
      } ${disabled ? 'opacity-60' : 'cursor-pointer hover:shadow-sm'}`}
      onClick={handleToggle}
    >
      {/* Checkbox */}
      <div
        className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors ${
          completed
            ? 'bg-green-500 border-green-500'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        {completed && (
          <svg
            className="w-3 h-3 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
        {isUpdating && (
          <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className={`font-medium ${completed ? 'line-through text-gray-500' : 'text-gray-900'}`}
          >
            {name}
          </span>
          {formattedQty && (
            <span
              className="text-sm"
              style={{
                color: completed ? '#8a8a8a' : '#1a1a1a',
              }}
            >
              <span className="font-bold underline">
                {typeof quantity === 'number'
                  ? `${Number.isInteger(quantity) ? quantity : quantity.toFixed(2)}${unit}`
                  : formattedQty}
              </span>
              {typeof quantity === 'number' && (
                <span className="text-gray-500">
                  {' '}(1.5× = {Number.isInteger(quantity * BUFFER_MULTIPLIER)
                    ? (quantity * BUFFER_MULTIPLIER)
                    : (quantity * BUFFER_MULTIPLIER).toFixed(2)}{unit})
                </span>
              )}
            </span>
          )}
        </div>
        {notes && (
          <p className="mt-1 text-sm text-gray-500">{notes}</p>
        )}
      </div>
    </div>
  );
}

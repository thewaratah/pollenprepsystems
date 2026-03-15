'use client';

import { ProgressBar } from './ProgressBar';
import { PrepItem } from './PrepItem';

interface SupplierItem {
  id: string;
  name: string;
  quantity?: number | string;
  unit?: string;
  isCompleted?: boolean;
}

interface SupplierSectionProps {
  name: string;
  contact?: string;
  items: SupplierItem[];
  onToggleItem?: (itemId: string, completed: boolean) => void;
}

export function SupplierSection({
  name,
  contact,
  items,
  onToggleItem,
}: SupplierSectionProps) {
  const completedCount = items.filter((item) => item.isCompleted).length;

  return (
    <div className="mb-6">
      {/* Supplier Header */}
      <div
        className="flex items-center justify-between p-4 rounded-t-lg border border-b-0"
        style={{ backgroundColor: '#4A5D23', borderColor: '#4A5D23' }}
      >
        <div>
          <h2 className="text-lg font-bold text-white">{name}</h2>
          {contact && (
            <p className="text-sm text-white/70 font-mono">{contact}</p>
          )}
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-white">
            {completedCount}/{items.length}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-2 border-x" style={{ backgroundColor: '#f5f4f0', borderColor: '#e5e5e5' }}>
        <ProgressBar
          completed={completedCount}
          total={items.length}
          showPercent={false}
        />
      </div>

      {/* Items */}
      <div className="border rounded-b-lg divide-y" style={{ borderColor: '#e5e5e5' }}>
        {items.map((item) => (
          <div key={item.id} className="p-2">
            <PrepItem
              id={item.id}
              name={item.name}
              quantity={item.quantity}
              unit={item.unit}
              isCompleted={item.isCompleted}
              onToggle={onToggleItem}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

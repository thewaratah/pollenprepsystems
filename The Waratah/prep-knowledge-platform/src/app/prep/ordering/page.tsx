'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProgressBar } from '@/components/prep/ProgressBar';
import { SupplierSection } from '@/components/prep/SupplierSection';

interface SupplierData {
  name: string;
  contact?: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
    isCompleted: boolean;
  }>;
}

interface OrderingData {
  type: string;
  prepRunId?: string;
  staff: string;
  suppliers: SupplierData[];
  summary: {
    total: number;
    completed: number;
    percent: number;
  };
}

function OrderingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialStaff = searchParams.get('staff') || 'all';

  const [data, setData] = useState<OrderingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffFilter, setStaffFilter] = useState<string>(initialStaff);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Update URL when filter changes
  const handleStaffFilterChange = (newFilter: string) => {
    setStaffFilter(newFilter);
    if (newFilter === 'all') {
      router.push('/prep/ordering');
    } else {
      router.push(`/prep/ordering?staff=${newFilter}`);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const url = staffFilter === 'all'
        ? '/api/prep/lists?type=ordering'
        : `/api/prep/lists?type=ordering&staff=${staffFilter}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch');
      }
      const result = await res.json();
      setData(result);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [staffFilter]);

  useEffect(() => {
    fetchData();
    // Poll every 30 seconds for real-time updates
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleToggleItem = async (itemId: string, completed: boolean) => {
    // Optimistically update UI
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        suppliers: prev.suppliers.map((supplier) => ({
          ...supplier,
          items: supplier.items.map((item) =>
            item.id === itemId ? { ...item, isCompleted: completed } : item
          ),
        })),
        summary: {
          ...prev.summary,
          completed: completed
            ? prev.summary.completed + 1
            : prev.summary.completed - 1,
          percent: Math.round(
            ((completed ? prev.summary.completed + 1 : prev.summary.completed - 1) /
              prev.summary.total) *
              100
          ),
        },
      };
    });

    // Note: Completion state is UI-only for now (Airtable doesn't have Completed field)
    // The optimistic update makes it feel responsive
  };

  const handleUncheckAll = () => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        suppliers: prev.suppliers.map((supplier) => ({
          ...supplier,
          items: supplier.items.map((item) => ({ ...item, isCompleted: false })),
        })),
        summary: {
          ...prev.summary,
          completed: 0,
          percent: 0,
        },
      };
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#4A5D23] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p style={{ color: '#8a8a8a' }}>Loading ordering list...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg border" style={{ backgroundColor: '#fff8f0', borderColor: '#d85a3a' }}>
        <p style={{ color: '#d85a3a' }}>Error: {error}</p>
        <button
          onClick={fetchData}
          className="mt-2 px-4 py-2 rounded text-white"
          style={{ backgroundColor: '#d85a3a' }}
        >
          Retry
        </button>
      </div>
    );
  }

  const staffLabel = staffFilter === 'andie' ? 'Andie' : staffFilter === 'blade' ? 'Blade' : 'All Staff';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#4A5D23', fontFamily: 'var(--font-display)' }}>
            📦 {staffLabel} Ordering List
          </h1>
          <p className="text-sm" style={{ color: '#8a8a8a' }}>
            Last updated: {lastUpdate.toLocaleTimeString()}
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

          {/* Staff Filter */}
          <select
            value={staffFilter}
            onChange={(e) => handleStaffFilterChange(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
            style={{ borderColor: '#e5e5e5' }}
          >
            <option value="all">All Staff</option>
            <option value="andie">Andie</option>
            <option value="blade">Blade</option>
          </select>

          {/* Uncheck All Button */}
          {data && data.summary.completed > 0 && (
            <button
              onClick={handleUncheckAll}
              className="px-3 py-2 rounded-lg text-sm border"
              style={{ borderColor: '#e5e5e5', color: '#8a8a8a' }}
            >
              Uncheck All
            </button>
          )}

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium print:hidden"
            style={{ backgroundColor: '#4A5D23' }}
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Overall Progress */}
      {data && (
        <div className="p-4 rounded-lg border" style={{ backgroundColor: 'white', borderColor: '#e5e5e5' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Overall Progress</span>
            <span className="text-sm" style={{ color: '#8a8a8a' }}>
              {data.summary.completed} of {data.summary.total} items ordered
            </span>
          </div>
          <ProgressBar
            completed={data.summary.completed}
            total={data.summary.total}
            color="orange"
          />
        </div>
      )}

      {/* Feedback Link */}
      {data && (
        <div className="text-sm" style={{ color: '#8a8a8a' }}>
          Have feedback?{' '}
          <a
            href={`/feedback?docType=${encodeURIComponent(staffLabel + ' Ordering')}&staffRole=${encodeURIComponent('Ordering - ' + staffLabel)}${data.prepRunId ? `&prepRunId=${data.prepRunId}` : ''}`}
            className="underline"
            style={{ color: '#007AFF' }}
          >
            Submit here
          </a>
        </div>
      )}

      {/* Supplier Sections */}
      {data?.suppliers.map((supplier) => (
        <SupplierSection
          key={supplier.name}
          name={supplier.name}
          contact={supplier.contact}
          items={supplier.items}
          onToggleItem={handleToggleItem}
        />
      ))}

      {/* Empty State */}
      {data?.suppliers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-lg" style={{ color: '#8a8a8a' }}>
            No ordering items found for {staffFilter === 'all' ? 'any staff' : staffFilter === 'andie' ? 'Andie' : 'Blade'}.
          </p>
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          header, footer, nav, .print\\:hidden {
            display: none !important;
          }
          body {
            background: white !important;
          }
          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  );
}

function OrderingLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-[#4A5D23] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p style={{ color: '#8a8a8a' }}>Loading...</p>
      </div>
    </div>
  );
}

export default function OrderingPage() {
  return (
    <Suspense fallback={<OrderingLoading />}>
      <OrderingContent />
    </Suspense>
  );
}

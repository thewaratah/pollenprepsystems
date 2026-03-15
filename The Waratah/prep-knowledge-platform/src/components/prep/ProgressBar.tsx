'use client';

interface ProgressBarProps {
  completed: number;
  total: number;
  label?: string;
  showPercent?: boolean;
  color?: 'green' | 'orange';
}

export function ProgressBar({
  completed,
  total,
  label,
  showPercent = true,
  color = 'green',
}: ProgressBarProps) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const barColor = color === 'orange' ? '#d85a3a' : '#4A5D23';

  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1">
          {label && (
            <span className="text-sm font-medium" style={{ color: '#1a1a1a' }}>
              {label}
            </span>
          )}
          {showPercent && (
            <span className="text-sm font-medium" style={{ color: barColor }}>
              {percent}%
            </span>
          )}
        </div>
      )}
      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: '#e5e5e5' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${percent}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
      {total > 0 && (
        <p className="mt-1 text-xs" style={{ color: '#8a8a8a' }}>
          {completed} of {total} complete
        </p>
      )}
    </div>
  );
}

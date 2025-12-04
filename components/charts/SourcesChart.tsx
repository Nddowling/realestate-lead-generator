'use client';

export interface SourceData {
  id: string;
  name: string;
  count: number;
  converted: number;
  color: string;
}

interface SourcesChartProps {
  sources: SourceData[];
  type?: 'pie' | 'bar';
  title?: string;
}

// Pie Chart Component
function PieChart({ sources }: { sources: SourceData[] }) {
  const total = sources.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return <div className="text-slate-500 text-center py-8">No data</div>;

  // Calculate pie segments
  let cumulativePercent = 0;
  const segments = sources.map((source) => {
    const percent = (source.count / total) * 100;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return { ...source, percent, startPercent };
  });

  // Create conic gradient
  const gradientStops = segments.map((s) =>
    `${s.color} ${s.startPercent}% ${s.startPercent + s.percent}%`
  ).join(', ');

  return (
    <div className="flex items-center gap-6">
      {/* Pie */}
      <div
        className="w-32 h-32 rounded-full flex-shrink-0"
        style={{
          background: `conic-gradient(${gradientStops})`,
        }}
      />

      {/* Legend */}
      <div className="flex-1 space-y-2">
        {segments.map((source) => (
          <div key={source.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: source.color }}
              />
              <span className="text-slate-300">{source.name}</span>
            </div>
            <div className="text-right">
              <span className="text-white font-medium">{source.count}</span>
              <span className="text-slate-500 ml-1">({source.percent.toFixed(1)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Bar Chart Component
function BarChart({ sources }: { sources: SourceData[] }) {
  const maxCount = Math.max(...sources.map((s) => s.count), 1);

  return (
    <div className="space-y-3">
      {sources.map((source) => {
        const widthPercent = (source.count / maxCount) * 100;
        const conversionRate = source.count > 0
          ? ((source.converted / source.count) * 100).toFixed(1)
          : '0';

        return (
          <div key={source.id}>
            {/* Label row */}
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-300">{source.name}</span>
              <span className="text-slate-400">
                {source.count} leads • <span className="text-primary-400">{conversionRate}% conv.</span>
              </span>
            </div>

            {/* Bar */}
            <div className="h-6 bg-dark-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                style={{
                  width: `${Math.max(widthPercent, 5)}%`,
                  backgroundColor: source.color,
                }}
              >
                {widthPercent > 15 && (
                  <span className="text-white text-xs font-medium">
                    {source.count}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Conversion by Source Chart
function ConversionChart({ sources }: { sources: SourceData[] }) {
  // Sort by conversion rate
  const sortedSources = [...sources]
    .map((s) => ({
      ...s,
      conversionRate: s.count > 0 ? (s.converted / s.count) * 100 : 0,
    }))
    .sort((a, b) => b.conversionRate - a.conversionRate);

  return (
    <div className="space-y-3">
      {sortedSources.map((source) => (
        <div key={source.id}>
          {/* Label row */}
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-300">{source.name}</span>
            <span className={`font-medium ${
              source.conversionRate >= 10 ? 'text-green-400' :
              source.conversionRate >= 5 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {source.conversionRate.toFixed(1)}%
            </span>
          </div>

          {/* Bar */}
          <div className="h-4 bg-dark-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                source.conversionRate >= 10 ? 'bg-green-500' :
                source.conversionRate >= 5 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(source.conversionRate * 2, 100)}%` }}
            />
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-xs text-slate-500 mt-1">
            <span>{source.count} leads</span>
            <span>{source.converted} converted</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SourcesChart({ sources, type = 'pie', title }: SourcesChartProps) {
  return (
    <div>
      {title && <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>}
      {type === 'pie' && <PieChart sources={sources} />}
      {type === 'bar' && <BarChart sources={sources} />}
    </div>
  );
}

// Export individual chart types
export { PieChart, BarChart, ConversionChart };

// Source type colors
export const SOURCE_COLORS: Record<string, string> = {
  tax_delinquent: '#f59e0b', // amber
  foreclosure: '#ef4444',    // red
  absentee: '#3b82f6',       // blue
  probate: '#a855f7',        // purple
  code_violation: '#f97316', // orange
  manual: '#6b7280',         // gray
};

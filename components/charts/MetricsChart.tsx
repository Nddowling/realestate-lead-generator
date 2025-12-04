'use client';

export interface DataPoint {
  label: string;
  value: number;
}

interface MetricsChartProps {
  data: DataPoint[];
  title?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  color?: string;
  height?: number;
}

export default function MetricsChart({
  data,
  title,
  valuePrefix = '',
  valueSuffix = '',
  color = '#22c55e',
  height = 120,
}: MetricsChartProps) {
  if (data.length === 0) {
    return <div className="text-slate-500 text-center py-8">No data</div>;
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const minValue = Math.min(...data.map((d) => d.value), 0);
  const range = maxValue - minValue || 1;

  // Calculate points for SVG path
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d.value - minValue) / range) * 100;
    return { x, y, ...d };
  });

  // Create SVG path
  const linePath = points.map((p, i) =>
    i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
  ).join(' ');

  // Create area path (for gradient fill)
  const areaPath = `${linePath} L 100 100 L 0 100 Z`;

  // Calculate totals
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const average = total / data.length;
  const trend = data.length >= 2
    ? ((data[data.length - 1].value - data[0].value) / (data[0].value || 1)) * 100
    : 0;

  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Trend:</span>
            <span className={trend >= 0 ? 'text-green-400' : 'text-red-400'}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="relative" style={{ height }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Gradient definition */}
          <defs>
            <linearGradient id={`gradient-${title}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="#334155"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
          ))}

          {/* Area fill */}
          <path
            d={areaPath}
            fill={`url(#gradient-${title})`}
          />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Data points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="3"
              fill={color}
              className="hover:r-4 transition-all cursor-pointer"
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${p.label}: ${valuePrefix}${p.value.toLocaleString()}${valueSuffix}`}</title>
            </circle>
          ))}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-slate-500 -ml-1 pointer-events-none">
          <span>{valuePrefix}{maxValue.toLocaleString()}{valueSuffix}</span>
          <span>{valuePrefix}{Math.round((maxValue + minValue) / 2).toLocaleString()}{valueSuffix}</span>
          <span>{valuePrefix}{minValue.toLocaleString()}{valueSuffix}</span>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-xs text-slate-500 mt-2">
        {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((d, i) => (
          <span key={i}>{d.label}</span>
        ))}
      </div>

      {/* Stats */}
      <div className="flex gap-6 mt-4 pt-4 border-t border-slate-700">
        <div>
          <p className="text-slate-400 text-xs">Total</p>
          <p className="text-white font-semibold">{valuePrefix}{total.toLocaleString()}{valueSuffix}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">Average</p>
          <p className="text-white font-semibold">{valuePrefix}{Math.round(average).toLocaleString()}{valueSuffix}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">Current</p>
          <p className="text-white font-semibold">
            {valuePrefix}{data[data.length - 1].value.toLocaleString()}{valueSuffix}
          </p>
        </div>
      </div>
    </div>
  );
}

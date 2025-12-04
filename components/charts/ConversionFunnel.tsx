'use client';

export interface FunnelStage {
  id: string;
  label: string;
  count: number;
  icon: string;
  color: string;
}

interface ConversionFunnelProps {
  stages: FunnelStage[];
  showPercentages?: boolean;
}

export default function ConversionFunnel({ stages, showPercentages = true }: ConversionFunnelProps) {
  // Calculate max count for scaling
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  // Calculate conversion rates
  const getConversionRate = (index: number): number => {
    if (index === 0) return 100;
    const prevCount = stages[index - 1].count;
    if (prevCount === 0) return 0;
    return Math.round((stages[index].count / prevCount) * 100);
  };

  // Calculate overall conversion (first to last)
  const overallConversion = stages[0].count > 0
    ? ((stages[stages.length - 1].count / stages[0].count) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-4">
      {/* Funnel visualization */}
      <div className="space-y-2">
        {stages.map((stage, index) => {
          const widthPercent = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
          const conversionRate = getConversionRate(index);

          return (
            <div key={stage.id} className="relative">
              {/* Stage bar */}
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className="w-8 text-center text-lg flex-shrink-0">{stage.icon}</div>

                {/* Bar container */}
                <div className="flex-1 relative">
                  <div
                    className={`h-10 rounded-lg ${stage.color} transition-all duration-500 flex items-center px-3`}
                    style={{
                      width: `${Math.max(widthPercent, 10)}%`,
                      minWidth: '80px',
                    }}
                  >
                    <span className="text-white font-bold text-sm">
                      {stage.count.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Label & conversion */}
                <div className="w-32 flex-shrink-0 text-right">
                  <p className="text-white text-sm font-medium">{stage.label}</p>
                  {showPercentages && index > 0 && (
                    <p className={`text-xs ${
                      conversionRate >= 50 ? 'text-green-400' :
                      conversionRate >= 25 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {conversionRate}% conversion
                    </p>
                  )}
                </div>
              </div>

              {/* Connector arrow */}
              {index < stages.length - 1 && (
                <div className="ml-11 h-4 flex items-center">
                  <div className="w-px h-full bg-slate-600 ml-4" />
                  <svg
                    className="w-3 h-3 text-slate-600 -ml-1.5 mt-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall conversion */}
      <div className="mt-6 pt-4 border-t border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-sm">Overall Conversion Rate</span>
          <span className={`text-lg font-bold ${
            parseFloat(overallConversion) >= 5 ? 'text-green-400' :
            parseFloat(overallConversion) >= 2 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {overallConversion}%
          </span>
        </div>
        <p className="text-slate-500 text-xs mt-1">
          {stages[0].label} to {stages[stages.length - 1].label}
        </p>
      </div>
    </div>
  );
}

// Default funnel stages for leads pipeline
export const DEFAULT_FUNNEL_STAGES: Omit<FunnelStage, 'count'>[] = [
  { id: 'total', label: 'Total Leads', icon: '🎯', color: 'bg-slate-500' },
  { id: 'contacted', label: 'Contacted', icon: '📞', color: 'bg-blue-500' },
  { id: 'appointment', label: 'Appointments', icon: '📅', color: 'bg-purple-500' },
  { id: 'offer', label: 'Offers', icon: '💵', color: 'bg-orange-500' },
  { id: 'contract', label: 'Contracts', icon: '📝', color: 'bg-yellow-500' },
  { id: 'closed', label: 'Closed', icon: '✅', color: 'bg-green-500' },
];

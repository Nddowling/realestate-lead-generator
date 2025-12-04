'use client';

import { useState, useEffect } from 'react';
import ConversionFunnel, { FunnelStage } from '@/components/charts/ConversionFunnel';
import SourcesChart, { SourceData, ConversionChart } from '@/components/charts/SourcesChart';
import MetricsChart, { DataPoint } from '@/components/charts/MetricsChart';

// Types
interface KPIs {
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  contactedLeads: number;
  closedDeals: number;
  totalRevenue: number;
  pipelineValue: number;
  leadsThisWeek: number;
  avgLeadScore: number;
}

interface AnalyticsData {
  kpis: KPIs;
  funnel: FunnelStage[];
  sources: SourceData[];
  bestSources: (SourceData & { conversionRate: number })[];
  pipelineTimeline: DataPoint[];
  activityCounts: Record<string, number>;
}

// KPI Card Component
function KPICard({
  label,
  value,
  icon,
  color = 'text-white',
  subValue,
  subLabel,
}: {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
  subValue?: string | number;
  subLabel?: string;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          {subValue !== undefined && (
            <p className="text-slate-500 text-sm mt-1">
              {subValue} {subLabel}
            </p>
          )}
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

// Activity type icons
const ACTIVITY_ICONS: Record<string, string> = {
  call: '📞',
  sms_sent: '💬',
  sms_received: '📩',
  email: '📧',
  note: '📝',
  status_change: '🔄',
  appointment: '📅',
  offer_made: '💵',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch('/api/analytics');
        const result = await response.json();
        if (result.success) {
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <span className="text-5xl mb-4 block">📊</span>
        <h2 className="text-xl font-semibold text-white">Failed to load analytics</h2>
        <p className="text-slate-400 mt-2">Please try refreshing the page.</p>
      </div>
    );
  }

  const { kpis, funnel, sources, bestSources, pipelineTimeline, activityCounts } = data;

  // Format currency
  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}k`;
    return `$${amount}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Analytics</h1>
        <p className="text-slate-400 mt-1">
          Performance metrics and insights for your lead generation
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          label="Total Leads"
          value={kpis.totalLeads.toLocaleString()}
          icon="🎯"
          subValue={kpis.leadsThisWeek}
          subLabel="this week"
        />
        <KPICard
          label="Hot Leads"
          value={kpis.hotLeads}
          icon="🔥"
          color="text-red-400"
          subValue={`${kpis.totalLeads > 0 ? Math.round((kpis.hotLeads / kpis.totalLeads) * 100) : 0}%`}
          subLabel="of total"
        />
        <KPICard
          label="Contacted"
          value={kpis.contactedLeads}
          icon="📞"
          color="text-blue-400"
          subValue={`${kpis.totalLeads > 0 ? Math.round((kpis.contactedLeads / kpis.totalLeads) * 100) : 0}%`}
          subLabel="contact rate"
        />
        <KPICard
          label="Closed Deals"
          value={kpis.closedDeals}
          icon="✅"
          color="text-green-400"
          subValue={`${kpis.totalLeads > 0 ? ((kpis.closedDeals / kpis.totalLeads) * 100).toFixed(1) : 0}%`}
          subLabel="close rate"
        />
        <KPICard
          label="Revenue"
          value={formatCurrency(kpis.totalRevenue)}
          icon="💰"
          color="text-primary-400"
          subValue={formatCurrency(kpis.pipelineValue)}
          subLabel="in pipeline"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-6">Conversion Funnel</h2>
          <ConversionFunnel stages={funnel} />
        </div>

        {/* Leads by Source */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-6">Leads by Source</h2>
          {sources.length > 0 ? (
            <SourcesChart sources={sources} type="pie" />
          ) : (
            <div className="text-slate-500 text-center py-8">No source data available</div>
          )}
        </div>
      </div>

      {/* Pipeline Value Over Time */}
      <div className="card">
        <MetricsChart
          data={pipelineTimeline}
          title="Pipeline Value (Last 30 Days)"
          valuePrefix="$"
          color="#22c55e"
          height={150}
        />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best Performing Sources */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-6">Conversion by Source</h2>
          {bestSources.length > 0 ? (
            <ConversionChart sources={bestSources} />
          ) : (
            <div className="text-slate-500 text-center py-8">No conversion data available</div>
          )}
        </div>

        {/* Activity Summary */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-6">Activity (Last 30 Days)</h2>
          <div className="space-y-4">
            {Object.entries(activityCounts).length > 0 ? (
              Object.entries(activityCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const maxCount = Math.max(...Object.values(activityCounts));
                  const widthPercent = (count / maxCount) * 100;

                  return (
                    <div key={type}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-300 flex items-center gap-2">
                          <span>{ACTIVITY_ICONS[type] || '•'}</span>
                          {type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                        <span className="text-white font-medium">{count}</span>
                      </div>
                      <div className="h-3 bg-dark-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full transition-all duration-500"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="text-slate-500 text-center py-8">No activities recorded</div>
            )}
          </div>
        </div>
      </div>

      {/* Temperature Distribution */}
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Lead Temperature Distribution</h2>
        <div className="flex gap-4 h-8">
          {kpis.hotLeads > 0 && (
            <div
              className="bg-red-500 rounded-lg flex items-center justify-center transition-all duration-500"
              style={{ width: `${(kpis.hotLeads / kpis.totalLeads) * 100}%` }}
              title={`Hot: ${kpis.hotLeads}`}
            >
              <span className="text-white text-sm font-bold px-2">
                🔥 {kpis.hotLeads}
              </span>
            </div>
          )}
          {kpis.warmLeads > 0 && (
            <div
              className="bg-orange-500 rounded-lg flex items-center justify-center transition-all duration-500"
              style={{ width: `${(kpis.warmLeads / kpis.totalLeads) * 100}%` }}
              title={`Warm: ${kpis.warmLeads}`}
            >
              <span className="text-white text-sm font-bold px-2">
                🌡️ {kpis.warmLeads}
              </span>
            </div>
          )}
          {kpis.coldLeads > 0 && (
            <div
              className="bg-blue-500 rounded-lg flex items-center justify-center transition-all duration-500"
              style={{ width: `${(kpis.coldLeads / kpis.totalLeads) * 100}%` }}
              title={`Cold: ${kpis.coldLeads}`}
            >
              <span className="text-white text-sm font-bold px-2">
                ❄️ {kpis.coldLeads}
              </span>
            </div>
          )}
        </div>
        <div className="flex justify-between mt-2 text-sm text-slate-400">
          <span>🔥 Hot (80+ score)</span>
          <span>🌡️ Warm (50-79)</span>
          <span>❄️ Cold (&lt;50)</span>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-dark-200/50 rounded-lg p-4 text-center">
          <p className="text-slate-400 text-sm">Avg. Lead Score</p>
          <p className="text-2xl font-bold text-white mt-1">{kpis.avgLeadScore}</p>
        </div>
        <div className="bg-dark-200/50 rounded-lg p-4 text-center">
          <p className="text-slate-400 text-sm">Contact Rate</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            {kpis.totalLeads > 0 ? Math.round((kpis.contactedLeads / kpis.totalLeads) * 100) : 0}%
          </p>
        </div>
        <div className="bg-dark-200/50 rounded-lg p-4 text-center">
          <p className="text-slate-400 text-sm">Close Rate</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {kpis.totalLeads > 0 ? ((kpis.closedDeals / kpis.totalLeads) * 100).toFixed(1) : 0}%
          </p>
        </div>
        <div className="bg-dark-200/50 rounded-lg p-4 text-center">
          <p className="text-slate-400 text-sm">Avg. Deal Size</p>
          <p className="text-2xl font-bold text-primary-400 mt-1">
            {kpis.closedDeals > 0 ? formatCurrency(kpis.totalRevenue / kpis.closedDeals) : '$0'}
          </p>
        </div>
      </div>
    </div>
  );
}

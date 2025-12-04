'use client';

import { useState, useEffect } from 'react';
import DataSourceCard, { DataSource } from '@/components/DataSourceCard';

// Import history type
interface ImportHistory {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  county: string;
  recordsFound: number;
  recordsImported: number;
  recordsUpdated: number;
  recordsSkipped: number;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  errorMessage?: string;
  duration?: number;
}

// Type icons
const TYPE_ICONS: Record<string, string> = {
  tax_delinquent: '💰',
  foreclosure: '🏠',
  absentee: '🚗',
  probate: '📜',
  code_violation: '⚠️',
};

export default function SourcesPage() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsInit, setNeedsInit] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [activeTab, setActiveTab] = useState<'sources' | 'history'>('sources');

  // Fetch sources
  const fetchSources = async () => {
    try {
      const response = await fetch('/api/sources');
      const data = await response.json();
      if (data.success) {
        setSources(data.sources || []);
        setNeedsInit(data.needsInit || false);
      }
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    }
  };

  // Fetch import history
  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/sources/history?limit=50');
      const data = await response.json();
      if (data.success) {
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  // Initialize sources
  const handleInitialize = async () => {
    setInitializing(true);
    try {
      const response = await fetch('/api/sources', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        await fetchSources();
        setNeedsInit(false);
      }
    } catch (error) {
      console.error('Failed to initialize:', error);
    } finally {
      setInitializing(false);
    }
  };

  // Run a single source
  const handleRunSource = async (sourceId: string) => {
    try {
      const response = await fetch(`/api/sources/${sourceId}/run`, {
        method: 'POST',
      });
      const data = await response.json();

      // Refresh data
      await fetchSources();
      await fetchHistory();

      if (!data.success) {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to run source:', error);
      throw error;
    }
  };

  // Run all sources
  const handleRunAll = async () => {
    if (runningAll) return;

    setRunningAll(true);
    try {
      const response = await fetch('/api/scrapers/run-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      await response.json();
      await fetchSources();
      await fetchHistory();
    } catch (error) {
      console.error('Failed to run all:', error);
    } finally {
      setRunningAll(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSources(), fetchHistory()]);
      setLoading(false);
    };
    loadData();
  }, []);

  // Auto-refresh when any source is running
  useEffect(() => {
    const hasRunning = sources.some((s) => s.status === 'running');
    if (hasRunning) {
      const interval = setInterval(() => {
        fetchSources();
        fetchHistory();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [sources]);

  // Group sources by county
  const sourcesByCounty: Record<string, DataSource[]> = {};
  for (const source of sources) {
    if (!sourcesByCounty[source.county]) {
      sourcesByCounty[source.county] = [];
    }
    sourcesByCounty[source.county].push(source);
  }

  // Calculate stats
  const totalRecords = sources.reduce((sum, s) => sum + s.recordsImported, 0);
  const activeSources = sources.filter((s) => !s.config?.comingSoon).length;
  const runningSources = sources.filter((s) => s.status === 'running').length;
  const errorSources = sources.filter((s) => s.status === 'error').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Show initialize prompt if no sources
  if (needsInit) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <span className="text-6xl mb-4 block">📊</span>
        <h1 className="text-2xl font-bold text-white mb-2">Initialize Data Sources</h1>
        <p className="text-slate-400 mb-6">
          Set up the default data sources to start importing leads from tax records,
          foreclosures, and more.
        </p>
        <button
          onClick={handleInitialize}
          disabled={initializing}
          className="btn-primary"
        >
          {initializing ? 'Initializing...' : 'Initialize Data Sources'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Data Sources</h1>
          <p className="text-slate-400 mt-1">
            {activeSources} active sources • {totalRecords.toLocaleString()} total records
            {runningSources > 0 && ` • ${runningSources} running`}
            {errorSources > 0 && ` • ${errorSources} errors`}
          </p>
        </div>
        <button
          onClick={handleRunAll}
          disabled={runningAll || runningSources > 0}
          className="btn-primary flex items-center gap-2"
        >
          {runningAll || runningSources > 0 ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              Running...
            </>
          ) : (
            <>
              🚀 Run All Sources
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('sources')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'sources'
              ? 'text-white border-b-2 border-primary-500'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          📁 Sources
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-white border-b-2 border-primary-500'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          📜 Import History
        </button>
      </div>

      {/* Sources Tab */}
      {activeTab === 'sources' && (
        <div className="space-y-8">
          {Object.entries(sourcesByCounty).map(([county, countySources]) => (
            <div key={county}>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">📍</span>
                {county} County
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {countySources.map((source) => (
                  <DataSourceCard
                    key={source.id}
                    source={source}
                    onRun={handleRunSource}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="card overflow-hidden">
          {history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Source</th>
                    <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Status</th>
                    <th className="text-right text-slate-400 text-sm font-medium px-4 py-3">Records</th>
                    <th className="text-right text-slate-400 text-sm font-medium px-4 py-3">Duration</th>
                    <th className="text-right text-slate-400 text-sm font-medium px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className="border-b border-slate-700/50 hover:bg-dark-200/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{TYPE_ICONS[item.sourceType] || '📄'}</span>
                          <div>
                            <p className="text-white text-sm font-medium">{item.sourceName}</p>
                            <p className="text-slate-500 text-xs">{item.county}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {item.status === 'running' ? (
                          <span className="flex items-center gap-1.5 text-blue-400 text-sm">
                            <div className="animate-spin w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full" />
                            Running
                          </span>
                        ) : item.status === 'completed' ? (
                          <span className="text-green-400 text-sm">✅ Completed</span>
                        ) : (
                          <span className="text-red-400 text-sm" title={item.errorMessage}>
                            ❌ Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm">
                          <span className="text-white">{item.recordsImported}</span>
                          <span className="text-slate-500"> imported</span>
                        </div>
                        {item.recordsUpdated > 0 && (
                          <div className="text-xs text-slate-500">
                            +{item.recordsUpdated} updated
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400 text-sm">
                        {item.duration ? `${item.duration}s` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400 text-sm">
                        {new Date(item.startedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <span className="text-4xl block mb-2">📭</span>
              No import history yet. Run a data source to get started.
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-3">Data Source Types</h3>
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span>💰</span>
            <span className="text-slate-400">Tax Delinquent - Properties with unpaid taxes</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🏠</span>
            <span className="text-slate-400">Foreclosure - Pre-foreclosure and auction listings</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🚗</span>
            <span className="text-slate-400">Absentee - Owner lives at different address</span>
          </div>
          <div className="flex items-center gap-2">
            <span>📜</span>
            <span className="text-slate-400">Probate - Estate/inheritance properties</span>
          </div>
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span className="text-slate-400">Code Violation - Properties with violations</span>
          </div>
        </div>
      </div>
    </div>
  );
}

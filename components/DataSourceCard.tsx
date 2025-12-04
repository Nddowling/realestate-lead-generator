'use client';

import { useState } from 'react';

export interface DataSource {
  id: string;
  name: string;
  type: 'tax_delinquent' | 'foreclosure' | 'absentee' | 'probate' | 'code_violation';
  county: string;
  url?: string;
  lastImportAt?: string;
  recordsImported: number;
  status: 'ready' | 'running' | 'error';
  errorMessage?: string;
  config?: {
    comingSoon?: boolean;
    description?: string;
    [key: string]: any;
  };
}

// Type icons and colors
const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  tax_delinquent: { icon: '💰', label: 'Tax Delinquent', color: 'text-amber-400' },
  foreclosure: { icon: '🏠', label: 'Foreclosure', color: 'text-red-400' },
  absentee: { icon: '🚗', label: 'Absentee Owner', color: 'text-blue-400' },
  probate: { icon: '📜', label: 'Probate', color: 'text-purple-400' },
  code_violation: { icon: '⚠️', label: 'Code Violation', color: 'text-orange-400' },
};

// Status config
const STATUS_CONFIG: Record<string, { icon: string; label: string; bgColor: string; textColor: string }> = {
  ready: { icon: '✅', label: 'Ready', bgColor: 'bg-green-500/20', textColor: 'text-green-400' },
  running: { icon: '🔄', label: 'Running', bgColor: 'bg-blue-500/20', textColor: 'text-blue-400' },
  error: { icon: '❌', label: 'Error', bgColor: 'bg-red-500/20', textColor: 'text-red-400' },
};

interface DataSourceCardProps {
  source: DataSource;
  onRun: (sourceId: string) => Promise<void>;
}

export default function DataSourceCard({ source, onRun }: DataSourceCardProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const typeConfig = TYPE_CONFIG[source.type] || TYPE_CONFIG.tax_delinquent;
  const statusConfig = STATUS_CONFIG[source.status] || STATUS_CONFIG.ready;
  const isComingSoon = source.config?.comingSoon;

  const handleRun = async () => {
    if (isRunning || source.status === 'running' || isComingSoon) return;

    setIsRunning(true);
    setProgress('Starting import...');

    try {
      await onRun(source.id);
      setProgress('Completed!');
      setTimeout(() => setProgress(null), 2000);
    } catch (error) {
      setProgress('Failed');
      setTimeout(() => setProgress(null), 3000);
    } finally {
      setIsRunning(false);
    }
  };

  // Format relative time
  const formatLastImport = (dateString?: string): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`card ${isComingSoon ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="text-2xl">{typeConfig.icon}</div>
          <div>
            <h3 className="text-white font-semibold">{source.name}</h3>
            <p className={`text-sm ${typeConfig.color}`}>{typeConfig.label}</p>
          </div>
        </div>

        {/* Status badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${statusConfig.bgColor}`}>
          {source.status === 'running' ? (
            <div className="animate-spin w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full" />
          ) : (
            <span className="text-xs">{statusConfig.icon}</span>
          )}
          <span className={`text-xs font-medium ${statusConfig.textColor}`}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Coming Soon Banner */}
      {isComingSoon && (
        <div className="bg-slate-700/50 text-slate-400 text-sm px-3 py-2 rounded-lg mb-4 text-center">
          Coming Soon
        </div>
      )}

      {/* Error message */}
      {source.status === 'error' && source.errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2 rounded-lg mb-4">
          {source.errorMessage}
        </div>
      )}

      {/* Stats */}
      {!isComingSoon && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-slate-400 text-xs mb-1">Last Import</p>
            <p className="text-white font-medium">{formatLastImport(source.lastImportAt)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">Total Records</p>
            <p className="text-white font-medium">{source.recordsImported.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Progress indicator */}
      {progress && (
        <div className="bg-primary-500/10 text-primary-400 text-sm px-3 py-2 rounded-lg mb-4 flex items-center gap-2">
          {isRunning && (
            <div className="animate-spin w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full" />
          )}
          {progress}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleRun}
          disabled={isRunning || source.status === 'running' || isComingSoon}
          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
            isRunning || source.status === 'running' || isComingSoon
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-primary-500 hover:bg-primary-600 text-white'
          }`}
        >
          {isRunning || source.status === 'running' ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              Running...
            </>
          ) : (
            <>
              ▶️ Run Now
            </>
          )}
        </button>

        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-3 rounded-lg bg-dark-200 text-slate-400 hover:text-white transition-colors"
            title="View source"
          >
            🔗
          </a>
        )}
      </div>
    </div>
  );
}

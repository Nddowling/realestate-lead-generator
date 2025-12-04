'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SkipTraceButton, { BatchSkipTraceButton } from '@/components/SkipTraceButton';

interface Lead {
  id: string;
  score: number;
  temperature: 'hot' | 'warm' | 'cold';
  status: string;
  phone?: string;
  last_contacted_at?: string;
  properties?: {
    address: string;
    city: string;
    county: string;
    owner_name?: string;
    is_absentee: boolean;
    equity_percentage?: number;
    assessed_value?: number;
  };
  distress_indicators?: Array<{
    distress_indicators: Array<{
      type: string;
      amount_owed?: number;
      auction_date?: string;
    }>;
  }>;
}

interface Summary {
  hot: number;
  warm: number;
  cold: number;
  avgScore: number;
  total: number;
}

// Temperature badge component
function TemperatureBadge({ temp, score }: { temp: string; score: number }) {
  const config = {
    hot: {
      bg: 'bg-red-500/20',
      border: 'border-red-500/50',
      text: 'text-red-400',
      icon: '🔥',
      glow: 'shadow-red-500/20',
    },
    warm: {
      bg: 'bg-orange-500/20',
      border: 'border-orange-500/50',
      text: 'text-orange-400',
      icon: '🌡️',
      glow: 'shadow-orange-500/20',
    },
    cold: {
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/50',
      text: 'text-blue-400',
      icon: '❄️',
      glow: '',
    },
  };

  const c = config[temp as keyof typeof config] || config.cold;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${c.bg} ${c.border} ${c.glow}`}>
      <span className="text-lg">{c.icon}</span>
      <span className={`font-bold ${c.text}`}>{score}</span>
    </div>
  );
}

// Distress badges
function DistressBadges({ indicators }: { indicators: any[] }) {
  const flatIndicators = indicators?.flatMap((i: any) => i.distress_indicators || []) || [];

  const typeLabels: Record<string, { label: string; color: string }> = {
    foreclosure: { label: 'Foreclosure', color: 'bg-red-600' },
    pre_foreclosure: { label: 'Pre-Foreclosure', color: 'bg-red-500' },
    tax_delinquent: { label: 'Tax Delinquent', color: 'bg-amber-500' },
    probate: { label: 'Probate', color: 'bg-purple-500' },
    code_violation: { label: 'Code Violation', color: 'bg-orange-500' },
    vacant: { label: 'Vacant', color: 'bg-slate-500' },
    bankruptcy: { label: 'Bankruptcy', color: 'bg-red-700' },
    divorce: { label: 'Divorce', color: 'bg-pink-500' },
  };

  if (flatIndicators.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {flatIndicators.map((ind: any, i: number) => {
        const config = typeLabels[ind.type] || { label: ind.type, color: 'bg-slate-500' };
        return (
          <span
            key={i}
            className={`${config.color} text-white text-xs px-2 py-0.5 rounded-full`}
          >
            {config.label}
            {ind.amount_owed && ` ($${ind.amount_owed.toLocaleString()})`}
          </span>
        );
      })}
    </div>
  );
}

// Lead card component
function LeadCard({ lead, onClick, onSkipTraceSuccess }: { lead: Lead; onClick: () => void; onSkipTraceSuccess?: () => void }) {
  const property = lead.properties;
  const isHot = lead.temperature === 'hot';

  return (
    <div
      className={`card-hover relative ${
        isHot ? 'ring-2 ring-red-500/50 shadow-lg shadow-red-500/10' : ''
      }`}
    >
      {/* Hot indicator */}
      {isHot && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
          <span>🔥</span> HOT
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        {/* Property Info */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
          <h3 className="text-white font-semibold truncate">
            {property?.address || 'Unknown Address'}
          </h3>
          <p className="text-slate-400 text-sm">
            {property?.city}, GA • {property?.county} County
          </p>

          {property?.owner_name && (
            <p className="text-slate-500 text-sm mt-1">
              Owner: {property.owner_name}
              {property.is_absentee && (
                <span className="ml-2 text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                  Absentee
                </span>
              )}
            </p>
          )}

          {/* Distress indicators */}
          <DistressBadges indicators={lead.distress_indicators || []} />

          {/* Quick stats */}
          <div className="flex gap-4 mt-3 text-sm">
            {property?.equity_percentage !== undefined && (
              <span className="text-slate-400">
                Equity: <span className="text-primary-400 font-medium">{property.equity_percentage}%</span>
              </span>
            )}
            {property?.assessed_value && (
              <span className="text-slate-400">
                Value: <span className="text-white">${property.assessed_value.toLocaleString()}</span>
              </span>
            )}
          </div>

          {/* Phone display if available */}
          {lead.phone && (
            <div className="mt-2">
              <a
                href={`tel:${lead.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1"
              >
                <span>📞</span> {formatPhone(lead.phone)}
              </a>
            </div>
          )}
        </div>

        {/* Right side: Score + Actions */}
        <div className="flex flex-col items-end gap-2">
          <TemperatureBadge temp={lead.temperature} score={lead.score} />
          <span className={`text-xs px-2 py-1 rounded-full ${
            lead.status === 'new' ? 'bg-blue-500/20 text-blue-400' :
            lead.status === 'contacted' ? 'bg-yellow-500/20 text-yellow-400' :
            lead.status === 'appointment' ? 'bg-purple-500/20 text-purple-400' :
            lead.status === 'offer' ? 'bg-orange-500/20 text-orange-400' :
            lead.status === 'contract' ? 'bg-green-500/20 text-green-400' :
            lead.status === 'closed' ? 'bg-emerald-500/20 text-emerald-400' :
            'bg-slate-500/20 text-slate-400'
          }`}>
            {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
          </span>

          {/* Skip Trace Button */}
          <SkipTraceButton
            leadId={lead.id}
            hasPhone={!!lead.phone}
            size="sm"
            onSuccess={() => onSkipTraceSuccess?.()}
          />
        </div>
      </div>
    </div>
  );
}

// Format phone for display
function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

// Filter button
function FilterButton({
  active,
  onClick,
  children,
  count,
  color = 'slate',
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
  color?: 'slate' | 'red' | 'orange' | 'blue';
}) {
  const colors = {
    slate: 'bg-slate-700 border-slate-600',
    red: 'bg-red-500/20 border-red-500/50 text-red-400',
    orange: 'bg-orange-500/20 border-orange-500/50 text-orange-400',
    blue: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
  };

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg border transition-all flex items-center gap-2 ${
        active
          ? colors[color]
          : 'bg-dark-100 border-slate-700 text-slate-400 hover:border-slate-600'
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
          active ? 'bg-white/20' : 'bg-slate-700'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<Summary>({ hot: 0, warm: 0, cold: 0, avgScore: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const [countyFilter, setCountyFilter] = useState<'all' | 'Chatham' | 'Effingham'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Get leads needing skip trace (no phone number)
  const leadsNeedingSkipTrace = leads.filter(lead => !lead.phone).map(lead => lead.id);

  // Fetch leads
  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('temperature', filter);
      if (countyFilter !== 'all') params.set('county', countyFilter);
      if (searchTerm) params.set('search', searchTerm);

      const response = await fetch(`/api/leads?${params}`);
      const data = await response.json();

      if (data.success) {
        setLeads(data.leads || []);
        setSummary(data.summary || { hot: 0, warm: 0, cold: 0, avgScore: 0, total: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [filter, countyFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeads();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Recalculate all scores
  const handleRecalculate = async () => {
    setLoading(true);
    try {
      await fetch('/api/leads/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recalculateAll: true }),
      });
      await fetchLeads();
    } catch (error) {
      console.error('Failed to recalculate:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Leads</h1>
          <p className="text-slate-400 mt-1">
            {summary.total} total leads • Avg score: {summary.avgScore}
          </p>
        </div>
        <div className="flex gap-3">
          {leadsNeedingSkipTrace.length > 0 && (
            <BatchSkipTraceButton
              leadIds={leadsNeedingSkipTrace.slice(0, 10)}
              onComplete={() => fetchLeads()}
            />
          )}
          <button
            onClick={handleRecalculate}
            className="btn-secondary flex items-center gap-2"
            disabled={loading}
          >
            🔄 Recalculate Scores
          </button>
          <Link href="/sources" className="btn-primary flex items-center gap-2">
            📥 Import More
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div
          onClick={() => setFilter(filter === 'hot' ? 'all' : 'hot')}
          className={`card cursor-pointer transition-all ${
            filter === 'hot' ? 'ring-2 ring-red-500/50' : 'hover:border-red-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Hot Leads</p>
              <p className="text-3xl font-bold text-red-400">{summary.hot}</p>
            </div>
            <span className="text-4xl">🔥</span>
          </div>
        </div>

        <div
          onClick={() => setFilter(filter === 'warm' ? 'all' : 'warm')}
          className={`card cursor-pointer transition-all ${
            filter === 'warm' ? 'ring-2 ring-orange-500/50' : 'hover:border-orange-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Warm Leads</p>
              <p className="text-3xl font-bold text-orange-400">{summary.warm}</p>
            </div>
            <span className="text-4xl">🌡️</span>
          </div>
        </div>

        <div
          onClick={() => setFilter(filter === 'cold' ? 'all' : 'cold')}
          className={`card cursor-pointer transition-all ${
            filter === 'cold' ? 'ring-2 ring-blue-500/50' : 'hover:border-blue-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Cold Leads</p>
              <p className="text-3xl font-bold text-blue-400">{summary.cold}</p>
            </div>
            <span className="text-4xl">❄️</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by address, owner, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field"
          />
        </div>

        <div className="flex gap-2">
          <FilterButton
            active={countyFilter === 'all'}
            onClick={() => setCountyFilter('all')}
          >
            All Counties
          </FilterButton>
          <FilterButton
            active={countyFilter === 'Chatham'}
            onClick={() => setCountyFilter('Chatham')}
          >
            Chatham (Savannah)
          </FilterButton>
          <FilterButton
            active={countyFilter === 'Effingham'}
            onClick={() => setCountyFilter('Effingham')}
          >
            Effingham (Rincon)
          </FilterButton>
        </div>
      </div>

      {/* Leads List */}
      <div className="space-y-4">
        {loading ? (
          <div className="card text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-slate-400">Loading leads...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="card text-center py-12">
            <span className="text-5xl mb-4 block">📭</span>
            <h3 className="text-white text-lg font-semibold mb-2">No leads found</h3>
            <p className="text-slate-400 mb-4">
              {filter !== 'all'
                ? `No ${filter} leads match your criteria`
                : 'Import data from sources to get started'}
            </p>
            <Link href="/sources" className="btn-primary inline-flex items-center gap-2">
              📥 Import Data
            </Link>
          </div>
        ) : (
          leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onClick={() => {
                // TODO: Navigate to lead detail page
                console.log('View lead:', lead.id);
              }}
              onSkipTraceSuccess={() => fetchLeads()}
            />
          ))
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import PipelineBoard, { PipelineLead, DEFAULT_PIPELINE_STAGES } from '@/components/PipelineBoard';

export default function PipelinePage() {
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [temperatureFilter, setTemperatureFilter] = useState<string>('all');
  const [countyFilter, setCountyFilter] = useState<string>('all');
  const [distressFilter, setDistressFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch leads
  const fetchLeads = async () => {
    try {
      const response = await fetch('/api/leads?limit=200');
      const data = await response.json();

      if (data.success && data.leads) {
        const formattedLeads: PipelineLead[] = data.leads.map((lead: any) => ({
          id: lead.id,
          score: lead.score,
          temperature: lead.temperature,
          status: lead.status,
          phone: lead.phone,
          lastContactedAt: lead.last_contacted_at,
          nextFollowUp: lead.next_follow_up,
          address: lead.properties?.address || 'Unknown',
          city: lead.properties?.city || '',
          county: lead.properties?.county || '',
          ownerName: lead.properties?.owner_name,
          distressTypes: lead.distress_indicators?.flatMap((d: any) =>
            d.distress_indicators?.map((i: any) => i.type) || []
          ) || [],
          askingPrice: lead.asking_price,
          offerAmount: lead.offer_amount,
        }));
        setLeads(formattedLeads);
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Get unique counties and distress types for filter dropdowns
  const counties = useMemo(() => {
    const unique = new Set(leads.map((l) => l.county).filter(Boolean));
    return Array.from(unique).sort();
  }, [leads]);

  const distressTypes = useMemo(() => {
    const unique = new Set(leads.flatMap((l) => l.distressTypes));
    return Array.from(unique).sort();
  }, [leads]);

  // Apply filters
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Temperature filter
      if (temperatureFilter !== 'all' && lead.temperature !== temperatureFilter) {
        return false;
      }

      // County filter
      if (countyFilter !== 'all' && lead.county !== countyFilter) {
        return false;
      }

      // Distress type filter
      if (distressFilter !== 'all' && !lead.distressTypes.includes(distressFilter)) {
        return false;
      }

      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesAddress = lead.address.toLowerCase().includes(query);
        const matchesCity = lead.city.toLowerCase().includes(query);
        const matchesOwner = lead.ownerName?.toLowerCase().includes(query);
        if (!matchesAddress && !matchesCity && !matchesOwner) {
          return false;
        }
      }

      return true;
    });
  }, [leads, temperatureFilter, countyFilter, distressFilter, searchQuery]);

  // Handle status change (optimistic update)
  const handleStatusChange = async (leadId: string, newStatus: string): Promise<boolean> => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return false;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        // Revert on error
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: lead.status } : l))
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Failed to update lead status:', error);
      // Revert on error
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: lead.status } : l))
      );
      return false;
    }
  };

  // Calculate pipeline stats
  const totalLeads = filteredLeads.length;
  const totalValue = filteredLeads.reduce((sum, lead) => sum + (lead.offerAmount || lead.askingPrice || 0), 0);
  const hotLeads = filteredLeads.filter((l) => l.temperature === 'hot').length;
  const dealsInProgress = filteredLeads.filter((l) => ['offer', 'contract'].includes(l.status)).length;

  // Clear all filters
  const clearFilters = () => {
    setTemperatureFilter('all');
    setCountyFilter('all');
    setDistressFilter('all');
    setSearchQuery('');
  };

  const hasActiveFilters = temperatureFilter !== 'all' || countyFilter !== 'all' || distressFilter !== 'all' || searchQuery !== '';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Pipeline</h1>
          <p className="text-slate-400 mt-1">
            {totalLeads} leads • {hotLeads} hot • {dealsInProgress} in progress • ${(totalValue / 1000).toFixed(0)}k potential
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/leads" className="btn-secondary">
            📋 List View
          </Link>
          <Link href="/analyzer" className="btn-primary">
            🔢 Analyze Deal
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-slate-400 mb-1 block">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Address, city, or owner..."
              className="input text-sm"
            />
          </div>

          {/* Temperature */}
          <div className="w-40">
            <label className="text-xs text-slate-400 mb-1 block">Temperature</label>
            <select
              value={temperatureFilter}
              onChange={(e) => setTemperatureFilter(e.target.value)}
              className="input text-sm"
            >
              <option value="all">All Temperatures</option>
              <option value="hot">🔥 Hot</option>
              <option value="warm">🌡️ Warm</option>
              <option value="cold">❄️ Cold</option>
            </select>
          </div>

          {/* County */}
          <div className="w-48">
            <label className="text-xs text-slate-400 mb-1 block">County</label>
            <select
              value={countyFilter}
              onChange={(e) => setCountyFilter(e.target.value)}
              className="input text-sm"
            >
              <option value="all">All Counties</option>
              {counties.map((county) => (
                <option key={county} value={county}>
                  {county}
                </option>
              ))}
            </select>
          </div>

          {/* Distress Type */}
          <div className="w-48">
            <label className="text-xs text-slate-400 mb-1 block">Distress Type</label>
            <select
              value={distressFilter}
              onChange={(e) => setDistressFilter(e.target.value)}
              className="input text-sm"
            >
              <option value="all">All Types</option>
              {distressTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="btn-secondary text-sm py-2"
            >
              ✕ Clear Filters
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <p className="text-sm text-slate-400 mt-3">
            Showing {filteredLeads.length} of {leads.length} leads
          </p>
        )}
      </div>

      {/* Pipeline board */}
      <PipelineBoard
        leads={filteredLeads}
        stages={DEFAULT_PIPELINE_STAGES}
        onStatusChange={handleStatusChange}
      />

      {/* Legend */}
      <div className="card">
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span>🔥</span>
            <span className="text-slate-400">Hot Lead (80+ score)</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🌡️</span>
            <span className="text-slate-400">Warm Lead (50-79 score)</span>
          </div>
          <div className="flex items-center gap-2">
            <span>❄️</span>
            <span className="text-slate-400">Cold Lead (&lt;50 score)</span>
          </div>
          <div className="flex items-center gap-2">
            <span>📱</span>
            <span className="text-slate-400">Has phone number</span>
          </div>
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span className="text-slate-400">Follow-up overdue</span>
          </div>
        </div>
        <p className="text-slate-500 text-xs mt-3">
          Drag and drop leads between columns to update their status
        </p>
      </div>
    </div>
  );
}

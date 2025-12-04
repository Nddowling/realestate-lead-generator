/**
 * Analytics API Route
 *
 * GET: Fetch comprehensive analytics data
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Get date ranges
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch all necessary data in parallel
    const [
      leadsResult,
      closedDealsResult,
      activitiesResult,
    ] = await Promise.all([
      // All leads with status, temperature, source, and created date
      supabase
        .from('leads')
        .select(`
          id,
          status,
          temperature,
          score,
          offer_amount,
          contract_price,
          created_at,
          properties (
            id
          ),
          distress_indicators:properties(
            distress_indicators(type, source)
          )
        `),

      // Closed deals for revenue calculation
      supabase
        .from('leads')
        .select('id, contract_price, offer_amount, created_at')
        .eq('status', 'closed'),

      // Activities for engagement metrics
      supabase
        .from('activities')
        .select('id, type, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString()),
    ]);

    const leads = leadsResult.data || [];
    const closedDeals = closedDealsResult.data || [];
    const activities = activitiesResult.data || [];

    // === KPIs ===
    const totalLeads = leads.length;
    const hotLeads = leads.filter((l) => l.temperature === 'hot').length;
    const warmLeads = leads.filter((l) => l.temperature === 'warm').length;
    const coldLeads = leads.filter((l) => l.temperature === 'cold').length;

    const contactedLeads = leads.filter((l) =>
      ['contacted', 'appointment', 'offer', 'contract', 'closed'].includes(l.status)
    ).length;

    const closedCount = closedDeals.length;
    const totalRevenue = closedDeals.reduce((sum, d) =>
      sum + (d.contract_price || d.offer_amount || 0), 0
    );

    // Pipeline value (offers + contracts)
    const pipelineValue = leads
      .filter((l) => ['offer', 'contract'].includes(l.status))
      .reduce((sum, l) => sum + (l.offer_amount || 0), 0);

    // Leads this week
    const leadsThisWeek = leads.filter((l) =>
      new Date(l.created_at) >= sevenDaysAgo
    ).length;

    // === Conversion Funnel ===
    const statusCounts: Record<string, number> = {
      new: 0,
      contacted: 0,
      appointment: 0,
      offer: 0,
      contract: 0,
      closed: 0,
    };

    for (const lead of leads) {
      if (lead.status in statusCounts) {
        statusCounts[lead.status]++;
      }
      // Also count leads that have passed through earlier stages
      if (['contacted', 'appointment', 'offer', 'contract', 'closed'].includes(lead.status)) {
        // These leads have been contacted
      }
    }

    // Build cumulative funnel (everyone who reached that stage or beyond)
    const funnel = [
      { id: 'total', label: 'Total Leads', count: totalLeads, icon: '🎯', color: 'bg-slate-500' },
      { id: 'contacted', label: 'Contacted', count: contactedLeads, icon: '📞', color: 'bg-blue-500' },
      {
        id: 'appointment',
        label: 'Appointments',
        count: leads.filter((l) => ['appointment', 'offer', 'contract', 'closed'].includes(l.status)).length,
        icon: '📅',
        color: 'bg-purple-500'
      },
      {
        id: 'offer',
        label: 'Offers',
        count: leads.filter((l) => ['offer', 'contract', 'closed'].includes(l.status)).length,
        icon: '💵',
        color: 'bg-orange-500'
      },
      {
        id: 'contract',
        label: 'Contracts',
        count: leads.filter((l) => ['contract', 'closed'].includes(l.status)).length,
        icon: '📝',
        color: 'bg-yellow-500'
      },
      { id: 'closed', label: 'Closed', count: closedCount, icon: '✅', color: 'bg-green-500' },
    ];

    // === Leads by Source ===
    const sourceCounts: Record<string, { count: number; converted: number }> = {
      tax_delinquent: { count: 0, converted: 0 },
      foreclosure: { count: 0, converted: 0 },
      absentee: { count: 0, converted: 0 },
      probate: { count: 0, converted: 0 },
      code_violation: { count: 0, converted: 0 },
      manual: { count: 0, converted: 0 },
    };

    // Count leads by their distress indicator types
    for (const lead of leads) {
      const indicators = lead.distress_indicators?.[0]?.distress_indicators || [];
      const typesSet = new Set(indicators.map((i: any) => i.type));
      const types = Array.from(typesSet);

      if (types.length === 0) {
        sourceCounts.manual.count++;
        if (lead.status === 'closed') sourceCounts.manual.converted++;
      } else {
        for (const type of types) {
          if (type in sourceCounts) {
            sourceCounts[type].count++;
            if (lead.status === 'closed') sourceCounts[type].converted++;
          }
        }
      }
    }

    const sourceColors: Record<string, string> = {
      tax_delinquent: '#f59e0b',
      foreclosure: '#ef4444',
      absentee: '#3b82f6',
      probate: '#a855f7',
      code_violation: '#f97316',
      manual: '#6b7280',
    };

    const sourceLabels: Record<string, string> = {
      tax_delinquent: 'Tax Delinquent',
      foreclosure: 'Foreclosure',
      absentee: 'Absentee Owner',
      probate: 'Probate',
      code_violation: 'Code Violation',
      manual: 'Manual Entry',
    };

    const sources = Object.entries(sourceCounts)
      .filter(([_, data]) => data.count > 0)
      .map(([type, data]) => ({
        id: type,
        name: sourceLabels[type] || type,
        count: data.count,
        converted: data.converted,
        color: sourceColors[type] || '#6b7280',
      }))
      .sort((a, b) => b.count - a.count);

    // === Pipeline Value Over Time (last 30 days) ===
    const pipelineByDay: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      pipelineByDay[dateKey] = 0;
    }

    // Calculate cumulative pipeline value
    let runningTotal = 0;
    for (const lead of leads.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )) {
      const dateKey = new Date(lead.created_at).toISOString().split('T')[0];
      if (dateKey in pipelineByDay) {
        runningTotal += lead.offer_amount || 0;
        pipelineByDay[dateKey] = runningTotal;
      }
    }

    // Forward fill the values
    let lastValue = 0;
    for (const dateKey of Object.keys(pipelineByDay).sort()) {
      if (pipelineByDay[dateKey] === 0 && lastValue > 0) {
        pipelineByDay[dateKey] = lastValue;
      }
      lastValue = pipelineByDay[dateKey];
    }

    const pipelineTimeline = Object.entries(pipelineByDay).map(([date, value]) => ({
      label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value,
    }));

    // === Activity Metrics ===
    const activityCounts: Record<string, number> = {};
    for (const activity of activities) {
      activityCounts[activity.type] = (activityCounts[activity.type] || 0) + 1;
    }

    // === Best Performing Sources ===
    const bestSources = [...sources]
      .map((s) => ({
        ...s,
        conversionRate: s.count > 0 ? (s.converted / s.count) * 100 : 0,
      }))
      .sort((a, b) => b.conversionRate - a.conversionRate)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      kpis: {
        totalLeads,
        hotLeads,
        warmLeads,
        coldLeads,
        contactedLeads,
        closedDeals: closedCount,
        totalRevenue,
        pipelineValue,
        leadsThisWeek,
        avgLeadScore: leads.length > 0
          ? Math.round(leads.reduce((sum, l) => sum + l.score, 0) / leads.length)
          : 0,
      },
      funnel,
      sources,
      bestSources,
      pipelineTimeline,
      activityCounts,
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

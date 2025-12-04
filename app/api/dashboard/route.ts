/**
 * Dashboard API Route
 *
 * Returns all dashboard data:
 * - Stats (counts by temperature, pipeline stages, etc.)
 * - Hot leads
 * - Recent activities
 * - Upcoming follow-ups
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Get current date info
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch all stats in parallel
    const [
      totalLeadsResult,
      temperatureCountsResult,
      pipelineCountsResult,
      contactedThisWeekResult,
      followUpsTodayResult,
      hotLeadsResult,
      activitiesResult,
      upcomingFollowUpsResult,
    ] = await Promise.all([
      // Total leads count
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true }),

      // Temperature counts
      supabase
        .from('leads')
        .select('temperature'),

      // Pipeline status counts
      supabase
        .from('leads')
        .select('status'),

      // Contacted this week
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .gte('last_contacted_at', startOfWeek.toISOString()),

      // Follow-ups due today
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .lte('next_follow_up', endOfDay.toISOString())
        .gte('next_follow_up', startOfDay.toISOString()),

      // Hot leads with property info
      supabase
        .from('leads')
        .select(`
          id,
          score,
          phone,
          status,
          last_contacted_at,
          properties (
            address,
            city,
            county,
            owner_name
          ),
          distress_indicators:properties(
            distress_indicators(type)
          )
        `)
        .eq('temperature', 'hot')
        .order('score', { ascending: false })
        .limit(10),

      // Recent activities
      supabase
        .from('activities')
        .select(`
          id,
          type,
          content,
          lead_id,
          created_at,
          leads (
            properties (
              address
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10),

      // Upcoming follow-ups
      supabase
        .from('leads')
        .select(`
          id,
          phone,
          status,
          next_follow_up,
          properties (
            address,
            city,
            owner_name
          )
        `)
        .not('next_follow_up', 'is', null)
        .lte('next_follow_up', new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('next_follow_up', { ascending: true })
        .limit(10),
    ]);

    // Calculate temperature counts
    const temperatureCounts = { hot: 0, warm: 0, cold: 0 };
    if (temperatureCountsResult.data) {
      for (const lead of temperatureCountsResult.data) {
        const temp = lead.temperature as keyof typeof temperatureCounts;
        if (temp in temperatureCounts) {
          temperatureCounts[temp]++;
        }
      }
    }

    // Calculate pipeline counts
    const pipelineCounts = {
      new: 0,
      contacted: 0,
      appointment: 0,
      offer: 0,
      contract: 0,
      closed: 0,
    };
    if (pipelineCountsResult.data) {
      for (const lead of pipelineCountsResult.data) {
        const status = lead.status as keyof typeof pipelineCounts;
        if (status in pipelineCounts) {
          pipelineCounts[status]++;
        }
      }
    }

    // Format hot leads
    const hotLeads = (hotLeadsResult.data || []).map((lead: any) => {
      const distressTypes = lead.distress_indicators?.[0]?.distress_indicators?.map((d: any) => d.type) || [];
      return {
        id: lead.id,
        score: lead.score,
        phone: lead.phone,
        status: lead.status,
        address: lead.properties?.address || 'Unknown',
        city: lead.properties?.city || '',
        county: lead.properties?.county || '',
        ownerName: lead.properties?.owner_name,
        distressTypes,
        lastContacted: lead.last_contacted_at,
      };
    });

    // Format activities
    const recentActivities = (activitiesResult.data || []).map((activity: any) => ({
      id: activity.id,
      type: activity.type,
      content: activity.content,
      leadId: activity.lead_id,
      leadAddress: activity.leads?.properties?.address,
      createdAt: activity.created_at,
    }));

    // Format follow-ups
    const upcomingFollowUps = (upcomingFollowUpsResult.data || []).map((lead: any) => ({
      id: lead.id,
      address: lead.properties?.address || 'Unknown',
      city: lead.properties?.city || '',
      ownerName: lead.properties?.owner_name,
      phone: lead.phone,
      nextFollowUp: lead.next_follow_up,
      status: lead.status,
    }));

    return NextResponse.json({
      success: true,
      stats: {
        totalLeads: totalLeadsResult.count || 0,
        hotLeads: temperatureCounts.hot,
        warmLeads: temperatureCounts.warm,
        coldLeads: temperatureCounts.cold,
        contactedThisWeek: contactedThisWeekResult.count || 0,
        followUpsToday: followUpsTodayResult.count || 0,
        pipeline: pipelineCounts,
      },
      hotLeads,
      recentActivities,
      upcomingFollowUps,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

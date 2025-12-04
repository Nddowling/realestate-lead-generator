/**
 * Lead Scoring API
 * POST: Recalculate scores for leads
 * GET: Get score breakdown for a specific lead
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  recalculateLeadScore,
  recalculateAllScores,
  calculateLeadScore,
  getLeadScoringFactors,
  getLeadsByTemperature,
  getScoreDistribution,
} from '@/lib/lead-scoring';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, county, recalculateAll } = body;

    // Recalculate single lead
    if (leadId) {
      const scoreBreakdown = await recalculateLeadScore(leadId);

      if (!scoreBreakdown) {
        return NextResponse.json(
          { error: 'Lead not found or could not be scored' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        leadId,
        score: scoreBreakdown.total,
        temperature: scoreBreakdown.temperature,
        breakdown: scoreBreakdown,
      });
    }

    // Recalculate all leads
    if (recalculateAll) {
      const result = await recalculateAllScores(county);

      return NextResponse.json({
        success: result.errors.length === 0,
        message: `Recalculated scores for ${result.updated} of ${result.processed} leads`,
        stats: result,
      });
    }

    return NextResponse.json(
      { error: 'Either leadId or recalculateAll=true is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Score API error:', error);
    return NextResponse.json(
      { error: 'Scoring failed', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get('leadId');
  const temperature = searchParams.get('temperature') as 'hot' | 'warm' | 'cold' | null;
  const county = searchParams.get('county') as 'Chatham' | 'Effingham' | null;
  const statsOnly = searchParams.get('stats') === 'true';

  try {
    // Get distribution stats
    if (statsOnly) {
      const distribution = await getScoreDistribution(county || undefined);
      return NextResponse.json({
        success: true,
        distribution,
      });
    }

    // Get score breakdown for specific lead
    if (leadId) {
      const factors = await getLeadScoringFactors(leadId);

      if (!factors) {
        return NextResponse.json(
          { error: 'Lead not found' },
          { status: 404 }
        );
      }

      const breakdown = calculateLeadScore(factors);

      return NextResponse.json({
        success: true,
        leadId,
        factors,
        breakdown,
      });
    }

    // Get leads by temperature
    if (temperature) {
      const leads = await getLeadsByTemperature(temperature, county || undefined);

      return NextResponse.json({
        success: true,
        temperature,
        count: leads.length,
        leads,
      });
    }

    // Default: return documentation
    return NextResponse.json({
      endpoint: '/api/leads/score',
      methods: {
        GET: {
          params: {
            leadId: 'Get score breakdown for specific lead',
            temperature: 'Get leads by temperature (hot/warm/cold)',
            county: 'Filter by county',
            stats: 'Set to true to get distribution stats only',
          },
        },
        POST: {
          body: {
            leadId: 'Recalculate score for specific lead',
            recalculateAll: 'Set to true to recalculate all leads',
            county: 'Filter by county when recalculating all',
          },
        },
      },
    });
  } catch (error) {
    console.error('Score API error:', error);
    return NextResponse.json(
      { error: 'Failed to get score data', details: String(error) },
      { status: 500 }
    );
  }
}

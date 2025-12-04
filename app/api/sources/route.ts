/**
 * Data Sources API Route
 *
 * GET: Fetch all data sources with their status
 * POST: Initialize default data sources (if not exist)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Default data sources configuration
const DEFAULT_SOURCES = [
  {
    name: 'Chatham Tax Delinquent',
    type: 'tax_delinquent',
    county: 'Chatham',
    url: 'https://qpublic.schneidercorp.com/Application.aspx?AppID=1043&LayerID=24263',
    config: { scraper: 'tax-delinquent' },
  },
  {
    name: 'Effingham Tax Delinquent',
    type: 'tax_delinquent',
    county: 'Effingham',
    url: 'https://qpublic.schneidercorp.com/Application.aspx?AppID=1042&LayerID=24245',
    config: { scraper: 'tax-delinquent' },
  },
  {
    name: 'Chatham Pre-Foreclosure',
    type: 'foreclosure',
    county: 'Chatham',
    url: 'https://www.foreclosure.com/listings/GA/Chatham_County/',
    config: { scraper: 'foreclosure' },
  },
  {
    name: 'Effingham Pre-Foreclosure',
    type: 'foreclosure',
    county: 'Effingham',
    url: 'https://www.foreclosure.com/listings/GA/Effingham_County/',
    config: { scraper: 'foreclosure' },
  },
  {
    name: 'Chatham Absentee Owners',
    type: 'absentee',
    county: 'Chatham',
    url: null,
    config: { scraper: 'absentee', description: 'Detects absentee owners from existing property data' },
  },
  {
    name: 'Effingham Absentee Owners',
    type: 'absentee',
    county: 'Effingham',
    url: null,
    config: { scraper: 'absentee', description: 'Detects absentee owners from existing property data' },
  },
  {
    name: 'Chatham Probate',
    type: 'probate',
    county: 'Chatham',
    url: null,
    config: { scraper: 'probate', comingSoon: true },
  },
  {
    name: 'Effingham Probate',
    type: 'probate',
    county: 'Effingham',
    url: null,
    config: { scraper: 'probate', comingSoon: true },
  },
  {
    name: 'Chatham Code Violations',
    type: 'code_violation',
    county: 'Chatham',
    url: null,
    config: { scraper: 'code-violation', comingSoon: true },
  },
  {
    name: 'Effingham Code Violations',
    type: 'code_violation',
    county: 'Effingham',
    url: null,
    config: { scraper: 'code-violation', comingSoon: true },
  },
];

/**
 * GET - Fetch all data sources
 */
export async function GET() {
  try {
    const { data: sources, error } = await supabase
      .from('data_sources')
      .select('*')
      .order('county')
      .order('type');

    if (error) {
      console.error('Data sources fetch error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch data sources' },
        { status: 500 }
      );
    }

    // If no sources exist, return empty with a hint to initialize
    if (!sources || sources.length === 0) {
      return NextResponse.json({
        success: true,
        sources: [],
        needsInit: true,
        message: 'No data sources configured. POST to initialize defaults.',
      });
    }

    // Format response
    const formattedSources = sources.map((source) => ({
      id: source.id,
      name: source.name,
      type: source.type,
      county: source.county,
      url: source.url,
      lastImportAt: source.last_import_at,
      recordsImported: source.records_imported,
      status: source.status,
      errorMessage: source.error_message,
      config: source.config,
      createdAt: source.created_at,
    }));

    return NextResponse.json({
      success: true,
      sources: formattedSources,
    });
  } catch (error) {
    console.error('Get data sources error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data sources' },
      { status: 500 }
    );
  }
}

/**
 * POST - Initialize default data sources
 */
export async function POST() {
  try {
    // Check if sources already exist
    const { data: existing } = await supabase
      .from('data_sources')
      .select('id')
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Data sources already initialized',
      }, { status: 400 });
    }

    // Insert default sources
    const { data: sources, error } = await supabase
      .from('data_sources')
      .insert(DEFAULT_SOURCES)
      .select();

    if (error) {
      console.error('Data sources init error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to initialize data sources' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Data sources initialized',
      count: sources?.length || 0,
    });
  } catch (error) {
    console.error('Init data sources error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initialize data sources' },
      { status: 500 }
    );
  }
}

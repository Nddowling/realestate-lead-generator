/**
 * Buyers API Route
 *
 * GET: Get all buyers or filter by matching criteria
 * POST: Create a new buyer
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface BuyBox {
  counties?: string[];
  property_types?: string[];
  max_price?: number;
  min_price?: number;
  conditions_accepted?: string[];
  deal_types?: string[];
}

/**
 * GET - Fetch buyers
 *
 * Query params:
 * - county: Filter buyers whose buy box includes this county
 * - maxPrice: Filter buyers whose max_price >= this value
 * - leadId: Find buyers matching a specific lead's criteria
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const county = searchParams.get('county');
    const maxPrice = searchParams.get('maxPrice');
    const leadId = searchParams.get('leadId');

    // If leadId provided, fetch lead first to get matching criteria
    let leadCounty: string | null = null;
    let leadPrice: number | null = null;

    if (leadId) {
      const { data: lead } = await supabase
        .from('leads')
        .select(`
          asking_price,
          offer_amount,
          properties (county)
        `)
        .eq('id', leadId)
        .single();

      if (lead) {
        leadCounty = (lead.properties as any)?.county || null;
        leadPrice = lead.offer_amount || lead.asking_price || null;
      }
    }

    const filterCounty = county || leadCounty;
    const filterPrice = maxPrice ? parseInt(maxPrice) : leadPrice;

    // Fetch all buyers
    const { data: buyers, error } = await supabase
      .from('buyers')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Buyers fetch error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch buyers' },
        { status: 500 }
      );
    }

    // Filter buyers by criteria in application logic (JSONB filtering)
    let filteredBuyers = buyers || [];

    if (filterCounty) {
      filteredBuyers = filteredBuyers.filter((buyer) => {
        const buyBox = buyer.buy_box as BuyBox;
        return buyBox?.counties?.some(
          (c) => c.toLowerCase() === filterCounty.toLowerCase()
        );
      });
    }

    if (filterPrice) {
      filteredBuyers = filteredBuyers.filter((buyer) => {
        const buyBox = buyer.buy_box as BuyBox;
        const buyerMax = buyBox?.max_price || 999999999;
        const buyerMin = buyBox?.min_price || 0;
        return filterPrice >= buyerMin && filterPrice <= buyerMax;
      });
    }

    // Format response
    const formattedBuyers = filteredBuyers.map((buyer) => ({
      id: buyer.id,
      name: buyer.name,
      company: buyer.company,
      email: buyer.email,
      phone: buyer.phone,
      buyBox: buyer.buy_box,
      isActive: buyer.is_active,
      totalDeals: buyer.total_deals,
      lastDealAt: buyer.last_deal_at,
      notes: buyer.notes,
      createdAt: buyer.created_at,
    }));

    return NextResponse.json({
      success: true,
      buyers: formattedBuyers,
      totalMatching: formattedBuyers.length,
    });
  } catch (error) {
    console.error('Get buyers error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch buyers' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new buyer
 *
 * Body: {
 *   name: string,
 *   company?: string,
 *   email: string,
 *   phone: string,
 *   buyBox: {
 *     counties?: string[],
 *     property_types?: string[],
 *     max_price?: number,
 *     min_price?: number,
 *     conditions_accepted?: string[],
 *     deal_types?: string[]
 *   },
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, company, email, phone, buyBox, notes } = body;

    if (!name || !email || !phone) {
      return NextResponse.json(
        { success: false, error: 'name, email, and phone are required' },
        { status: 400 }
      );
    }

    const { data: buyer, error } = await supabase
      .from('buyers')
      .insert({
        name,
        company: company || null,
        email,
        phone,
        buy_box: buyBox || {
          counties: [],
          property_types: ['single_family'],
          max_price: 200000,
          conditions_accepted: ['cosmetic', 'moderate', 'heavy'],
          deal_types: ['wholesale'],
        },
        notes: notes || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Buyer creation error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create buyer' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      buyer: {
        id: buyer.id,
        name: buyer.name,
        company: buyer.company,
        email: buyer.email,
        phone: buyer.phone,
        buyBox: buyer.buy_box,
        isActive: buyer.is_active,
        createdAt: buyer.created_at,
      },
    });
  } catch (error) {
    console.error('Create buyer error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create buyer' },
      { status: 500 }
    );
  }
}

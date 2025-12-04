// Lead/Property Types
export interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: 'Chatham' | 'Effingham';
  owner_name: string;
  owner_mailing_address?: string;
  owner_mailing_city?: string;
  owner_mailing_state?: string;
  owner_mailing_zip?: string;
  is_absentee: boolean;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  year_built?: number;
  lot_size?: number;
  assessed_value?: number;
  estimated_value?: number;
  estimated_equity?: number;
  equity_percentage?: number;
  created_at: string;
  updated_at: string;
}

export interface DistressIndicator {
  id: string;
  property_id: string;
  type: 'tax_delinquent' | 'pre_foreclosure' | 'foreclosure' | 'probate' | 'code_violation' | 'vacant';
  source: string;
  amount_owed?: number;
  auction_date?: string;
  filing_date?: string;
  details?: string;
  created_at: string;
}

export interface Lead {
  id: string;
  property_id: string;
  property?: Property;
  distress_indicators?: DistressIndicator[];
  score: number;
  temperature: 'hot' | 'warm' | 'cold';
  status: 'new' | 'contacted' | 'appointment' | 'offer' | 'contract' | 'closed' | 'dead';
  phone?: string;
  email?: string;
  phone_confidence?: number;
  skip_traced_at?: string;
  last_contacted_at?: string;
  next_follow_up?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  lead_id: string;
  type: 'call' | 'sms' | 'email' | 'note' | 'status_change' | 'skip_trace';
  content: string;
  metadata?: Record<string, any>;
  created_by?: string;
  created_at: string;
}

// Buyer Types
export interface BuyBox {
  counties: ('Chatham' | 'Effingham')[];
  property_types: ('single_family' | 'multi_family' | 'land' | 'commercial')[];
  min_price?: number;
  max_price?: number;
  min_arv?: number;
  max_arv?: number;
  min_sqft?: number;
  max_sqft?: number;
  min_beds?: number;
  max_beds?: number;
  conditions_accepted: ('turnkey' | 'cosmetic' | 'moderate' | 'heavy' | 'gut')[];
  deal_types: ('wholesale' | 'fix_and_flip' | 'buy_and_hold' | 'subject_to' | 'seller_finance')[];
}

export interface Buyer {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone: string;
  buy_box: BuyBox;
  deals_closed: number;
  avg_purchase_price?: number;
  preferred_contact: 'phone' | 'email' | 'text';
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Deal Analysis Types
export interface DealAnalysis {
  property_id: string;
  arv: number;
  arv_confidence: 'low' | 'medium' | 'high';
  repair_estimate: number;
  repair_breakdown?: {
    category: string;
    amount: number;
  }[];
  condition: 'turnkey' | 'cosmetic' | 'moderate' | 'heavy' | 'gut';
  mao_conservative: number;
  mao_moderate: number;
  mao_aggressive: number;
  wholesale_fee: number;
  deal_score: number;
  deal_grade: 'A' | 'B' | 'C' | 'D' | 'F';
  warnings: string[];
  created_at: string;
}

// SMS Types
export interface SMSMessage {
  id: string;
  lead_id: string;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  body: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'received';
  twilio_sid?: string;
  created_at: string;
}

export interface SMSTemplate {
  id: string;
  name: string;
  category: 'initial' | 'follow_up' | 'foreclosure' | 'probate' | 'custom';
  body: string;
  is_active: boolean;
  created_at: string;
}

// Data Source Types
export interface DataSource {
  id: string;
  name: string;
  type: 'tax_delinquent' | 'foreclosure' | 'absentee' | 'probate' | 'code_violation';
  county: 'Chatham' | 'Effingham';
  last_import_at?: string;
  records_imported: number;
  status: 'ready' | 'running' | 'error';
  error_message?: string;
}

// Dashboard Stats
export interface DashboardStats {
  total_leads: number;
  hot_leads: number;
  warm_leads: number;
  contacted_this_week: number;
  appointments_scheduled: number;
  deals_in_pipeline: number;
  deals_closed_this_month: number;
  revenue_this_month: number;
}

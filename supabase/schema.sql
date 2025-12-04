-- REI Lead Generator Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROPERTIES TABLE
-- Core property data from county records
-- ============================================================
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'GA',
  zip TEXT,
  county TEXT NOT NULL CHECK (county IN ('Chatham', 'Effingham')),

  -- Owner info
  owner_name TEXT,
  owner_mailing_address TEXT,
  owner_mailing_city TEXT,
  owner_mailing_state TEXT,
  owner_mailing_zip TEXT,
  is_absentee BOOLEAN DEFAULT FALSE,

  -- Property details
  bedrooms INTEGER,
  bathrooms NUMERIC(3,1),
  sqft INTEGER,
  year_built INTEGER,
  lot_size NUMERIC(10,2),
  property_type TEXT DEFAULT 'single_family',

  -- Value estimates
  assessed_value NUMERIC(12,2),
  estimated_value NUMERIC(12,2),
  estimated_equity NUMERIC(12,2),
  equity_percentage NUMERIC(5,2),

  -- Metadata
  source TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(address, city, state)
);

-- ============================================================
-- DISTRESS INDICATORS TABLE
-- Tax liens, foreclosures, code violations, etc.
-- ============================================================
CREATE TABLE distress_indicators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN (
    'tax_delinquent',
    'pre_foreclosure',
    'foreclosure',
    'probate',
    'code_violation',
    'vacant',
    'divorce',
    'bankruptcy'
  )),

  source TEXT NOT NULL,
  amount_owed NUMERIC(12,2),
  auction_date DATE,
  filing_date DATE,
  case_number TEXT,
  details JSONB,

  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEADS TABLE
-- Actionable leads with scoring and status
-- ============================================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

  -- Scoring
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  temperature TEXT DEFAULT 'cold' CHECK (temperature IN ('hot', 'warm', 'cold')),

  -- Pipeline status
  status TEXT DEFAULT 'new' CHECK (status IN (
    'new',
    'contacted',
    'appointment',
    'offer',
    'contract',
    'closed',
    'dead'
  )),

  -- Contact info (from skip tracing)
  phone TEXT,
  phone_alt TEXT,
  email TEXT,
  phone_confidence INTEGER,
  skip_traced_at TIMESTAMPTZ,

  -- Follow-up tracking
  last_contacted_at TIMESTAMPTZ,
  next_follow_up TIMESTAMPTZ,
  contact_attempts INTEGER DEFAULT 0,

  -- Deal info
  asking_price NUMERIC(12,2),
  offer_amount NUMERIC(12,2),
  contract_price NUMERIC(12,2),

  -- Notes
  notes TEXT,
  tags TEXT[],

  -- Assignment
  assigned_to TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(property_id)
);

-- ============================================================
-- ACTIVITIES TABLE
-- All interactions and events for leads
-- ============================================================
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN (
    'call',
    'sms_sent',
    'sms_received',
    'email',
    'note',
    'status_change',
    'skip_trace',
    'appointment',
    'offer_made',
    'contract_signed'
  )),

  content TEXT,
  metadata JSONB,

  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SMS MESSAGES TABLE
-- Track all SMS communications
-- ============================================================
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,

  status TEXT DEFAULT 'queued' CHECK (status IN (
    'queued',
    'sent',
    'delivered',
    'failed',
    'received'
  )),

  twilio_sid TEXT,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SMS TEMPLATES TABLE
-- Reusable message templates
-- ============================================================
CREATE TABLE sms_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'initial',
    'follow_up',
    'foreclosure',
    'probate',
    'absentee',
    'custom'
  )),
  body TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default templates
INSERT INTO sms_templates (name, category, body) VALUES
('Initial Outreach', 'initial', 'Hi {{ownerName}}, I noticed your property at {{address}} in {{city}}. I buy houses in the area and wondered if you''d consider selling? - Nick'),
('Follow Up 1', 'follow_up', 'Hi {{ownerName}}, just following up on my message about {{address}}. Would you have a few minutes to chat this week?'),
('Foreclosure Specific', 'foreclosure', 'Hi {{ownerName}}, I help homeowners facing foreclosure find solutions. I saw your property at {{address}} and may be able to help. Can we talk?'),
('Probate Specific', 'probate', 'Hi, I understand you may have inherited property at {{address}}. I buy houses as-is and can close quickly. Would you like to discuss options?');

-- ============================================================
-- BUYERS TABLE
-- Cash buyer list
-- ============================================================
CREATE TABLE buyers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,

  -- Buy box criteria
  buy_box JSONB NOT NULL DEFAULT '{
    "counties": ["Chatham", "Effingham"],
    "property_types": ["single_family"],
    "max_price": 200000,
    "conditions_accepted": ["cosmetic", "moderate", "heavy"],
    "deal_types": ["wholesale", "fix_and_flip"]
  }'::JSONB,

  deals_closed INTEGER DEFAULT 0,
  avg_purchase_price NUMERIC(12,2),
  preferred_contact TEXT DEFAULT 'phone',

  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEAL ANALYSES TABLE
-- Saved deal calculations
-- ============================================================
CREATE TABLE deal_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  arv NUMERIC(12,2) NOT NULL,
  arv_confidence TEXT CHECK (arv_confidence IN ('low', 'medium', 'high')),

  repair_estimate NUMERIC(12,2) NOT NULL,
  repair_breakdown JSONB,
  condition TEXT CHECK (condition IN ('turnkey', 'cosmetic', 'moderate', 'heavy', 'gut')),

  mao_conservative NUMERIC(12,2),
  mao_moderate NUMERIC(12,2),
  mao_aggressive NUMERIC(12,2),
  wholesale_fee NUMERIC(12,2) DEFAULT 10000,

  deal_score INTEGER,
  deal_grade TEXT CHECK (deal_grade IN ('A', 'B', 'C', 'D', 'F')),
  warnings TEXT[],

  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DATA SOURCES TABLE
-- Track import sources and status
-- ============================================================
CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'tax_delinquent',
    'foreclosure',
    'absentee',
    'probate',
    'code_violation'
  )),
  county TEXT NOT NULL CHECK (county IN ('Chatham', 'Effingham')),

  url TEXT,
  last_import_at TIMESTAMPTZ,
  records_imported INTEGER DEFAULT 0,

  status TEXT DEFAULT 'ready' CHECK (status IN ('ready', 'running', 'error')),
  error_message TEXT,

  config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default data sources
INSERT INTO data_sources (name, type, county) VALUES
('Chatham County Tax Delinquent', 'tax_delinquent', 'Chatham'),
('Effingham County Tax Delinquent', 'tax_delinquent', 'Effingham'),
('Chatham County Pre-Foreclosure', 'foreclosure', 'Chatham'),
('Effingham County Pre-Foreclosure', 'foreclosure', 'Effingham');

-- ============================================================
-- IMPORT HISTORY TABLE
-- Track all data imports
-- ============================================================
CREATE TABLE import_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,

  records_found INTEGER DEFAULT 0,
  records_imported INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT,

  details JSONB
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_properties_county ON properties(county);
CREATE INDEX idx_properties_address ON properties(address);
CREATE INDEX idx_distress_type ON distress_indicators(type);
CREATE INDEX idx_distress_property ON distress_indicators(property_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_temperature ON leads(temperature);
CREATE INDEX idx_leads_score ON leads(score DESC);
CREATE INDEX idx_activities_lead ON activities(lead_id);
CREATE INDEX idx_sms_lead ON sms_messages(lead_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER buyers_updated_at
  BEFORE UPDATE ON buyers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to calculate lead score based on distress indicators
CREATE OR REPLACE FUNCTION calculate_lead_score(p_property_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 0;
  v_indicator RECORD;
  v_property RECORD;
BEGIN
  -- Get property info
  SELECT * INTO v_property FROM properties WHERE id = p_property_id;

  -- Base score for equity
  IF v_property.equity_percentage > 50 THEN
    v_score := v_score + 20;
  ELSIF v_property.equity_percentage > 30 THEN
    v_score := v_score + 10;
  END IF;

  -- Score for each distress indicator
  FOR v_indicator IN
    SELECT * FROM distress_indicators
    WHERE property_id = p_property_id AND is_resolved = FALSE
  LOOP
    CASE v_indicator.type
      WHEN 'foreclosure' THEN v_score := v_score + 30;
      WHEN 'pre_foreclosure' THEN v_score := v_score + 25;
      WHEN 'tax_delinquent' THEN v_score := v_score + 20;
      WHEN 'probate' THEN v_score := v_score + 20;
      WHEN 'code_violation' THEN v_score := v_score + 15;
      WHEN 'vacant' THEN v_score := v_score + 15;
      WHEN 'bankruptcy' THEN v_score := v_score + 20;
      WHEN 'divorce' THEN v_score := v_score + 15;
      ELSE v_score := v_score + 10;
    END CASE;
  END LOOP;

  -- Absentee owner bonus
  IF v_property.is_absentee THEN
    v_score := v_score + 10;
  END IF;

  -- Cap at 100
  IF v_score > 100 THEN
    v_score := 100;
  END IF;

  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- Function to determine temperature from score
CREATE OR REPLACE FUNCTION get_temperature(p_score INTEGER)
RETURNS TEXT AS $$
BEGIN
  IF p_score >= 80 THEN
    RETURN 'hot';
  ELSIF p_score >= 50 THEN
    RETURN 'warm';
  ELSE
    RETURN 'cold';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update lead score when distress indicators change
CREATE OR REPLACE FUNCTION update_lead_score()
RETURNS TRIGGER AS $$
DECLARE
  v_score INTEGER;
  v_lead_id UUID;
BEGIN
  -- Get the lead for this property
  SELECT id INTO v_lead_id FROM leads WHERE property_id = COALESCE(NEW.property_id, OLD.property_id);

  IF v_lead_id IS NOT NULL THEN
    v_score := calculate_lead_score(COALESCE(NEW.property_id, OLD.property_id));

    UPDATE leads
    SET score = v_score,
        temperature = get_temperature(v_score)
    WHERE id = v_lead_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER distress_score_update
  AFTER INSERT OR UPDATE OR DELETE ON distress_indicators
  FOR EACH ROW EXECUTE FUNCTION update_lead_score();

-- ============================================================
-- ROW LEVEL SECURITY (Optional - Enable if needed)
-- ============================================================
-- ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- etc.

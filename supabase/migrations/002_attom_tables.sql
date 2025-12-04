-- ATTOM Property Data Tables
-- Run this in your Supabase SQL Editor

-- Main property table from ATTOM
CREATE TABLE IF NOT EXISTS attom_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attom_id BIGINT UNIQUE, -- ATTOM's property ID

  -- Address Info
  street_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  county TEXT,
  fips_code TEXT,
  apn TEXT, -- Assessor's Parcel Number

  -- Property Characteristics
  property_type TEXT,
  year_built INTEGER,
  bedrooms INTEGER,
  bathrooms_total DECIMAL(3,1),
  living_sqft INTEGER,
  lot_sqft INTEGER,
  stories INTEGER,
  pool BOOLEAN DEFAULT FALSE,
  garage_sqft INTEGER,

  -- Location
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),

  -- Owner Information
  owner_name TEXT,
  owner_name_2 TEXT,
  owner_mailing_address TEXT,
  owner_mailing_city TEXT,
  owner_mailing_state TEXT,
  owner_mailing_zip TEXT,
  is_absentee_owner BOOLEAN DEFAULT FALSE, -- Calculated field
  owner_occupied BOOLEAN,

  -- Valuation
  avm_value INTEGER, -- Automated Valuation Model
  avm_high INTEGER,
  avm_low INTEGER,
  avm_confidence_score DECIMAL(5,2),
  assessed_value INTEGER,
  market_value INTEGER,
  tax_amount DECIMAL(10,2),

  -- Last Sale Info
  last_sale_date DATE,
  last_sale_price INTEGER,

  -- Calculated Fields (for lead scoring)
  estimated_equity INTEGER, -- AVM - last_sale_price (rough estimate)
  equity_percent DECIMAL(5,2),
  years_owned INTEGER,

  -- Metadata
  data_source TEXT DEFAULT 'attom',
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB -- Store full API response for reference
);

-- ATTOM Sales History
CREATE TABLE IF NOT EXISTS attom_sales_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attom_property_id UUID REFERENCES attom_properties(id) ON DELETE CASCADE,
  attom_id BIGINT,

  sale_date DATE,
  sale_price INTEGER,
  sale_type TEXT,
  seller_name TEXT,
  buyer_name TEXT,
  document_type TEXT,
  recording_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ATTOM Import Logs
CREATE TABLE IF NOT EXISTS attom_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  endpoint TEXT NOT NULL, -- Which API endpoint was called
  query_params JSONB, -- Parameters used

  records_fetched INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,

  api_calls_used INTEGER DEFAULT 1,

  status TEXT DEFAULT 'pending', -- pending, success, failed
  error_message TEXT,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_attom_properties_zip ON attom_properties(zip_code);
CREATE INDEX IF NOT EXISTS idx_attom_properties_county ON attom_properties(county);
CREATE INDEX IF NOT EXISTS idx_attom_properties_absentee ON attom_properties(is_absentee_owner) WHERE is_absentee_owner = TRUE;
CREATE INDEX IF NOT EXISTS idx_attom_properties_equity ON attom_properties(estimated_equity DESC);
CREATE INDEX IF NOT EXISTS idx_attom_properties_avm ON attom_properties(avm_value);
CREATE INDEX IF NOT EXISTS idx_attom_properties_type ON attom_properties(property_type);
CREATE INDEX IF NOT EXISTS idx_attom_sales_property ON attom_sales_history(attom_property_id);

-- Function to calculate absentee owner status
CREATE OR REPLACE FUNCTION calculate_absentee_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark as absentee if mailing address differs from property address
  IF NEW.owner_mailing_address IS NOT NULL AND NEW.street_address IS NOT NULL THEN
    NEW.is_absentee_owner := (
      LOWER(TRIM(NEW.owner_mailing_address)) != LOWER(TRIM(NEW.street_address))
      OR LOWER(TRIM(COALESCE(NEW.owner_mailing_city, ''))) != LOWER(TRIM(COALESCE(NEW.city, '')))
    );
  END IF;

  -- Calculate equity if we have both values
  IF NEW.avm_value IS NOT NULL AND NEW.last_sale_price IS NOT NULL AND NEW.last_sale_price > 0 THEN
    NEW.estimated_equity := NEW.avm_value - NEW.last_sale_price;
    NEW.equity_percent := ((NEW.avm_value - NEW.last_sale_price)::DECIMAL / NEW.last_sale_price) * 100;
  END IF;

  -- Calculate years owned
  IF NEW.last_sale_date IS NOT NULL THEN
    NEW.years_owned := EXTRACT(YEAR FROM AGE(CURRENT_DATE, NEW.last_sale_date));
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-calculations
DROP TRIGGER IF EXISTS trg_calculate_attom_fields ON attom_properties;
CREATE TRIGGER trg_calculate_attom_fields
  BEFORE INSERT OR UPDATE ON attom_properties
  FOR EACH ROW
  EXECUTE FUNCTION calculate_absentee_owner();

-- View for lead-worthy properties (high equity absentee owners)
CREATE OR REPLACE VIEW attom_hot_leads AS
SELECT
  p.*,
  CASE
    WHEN p.is_absentee_owner AND p.equity_percent > 30 AND p.years_owned > 5 THEN 'hot'
    WHEN p.is_absentee_owner AND p.equity_percent > 20 THEN 'warm'
    ELSE 'cold'
  END as lead_temperature
FROM attom_properties p
WHERE p.is_absentee_owner = TRUE
  AND p.estimated_equity > 50000
ORDER BY p.estimated_equity DESC;

-- Grant permissions
GRANT ALL ON attom_properties TO authenticated;
GRANT ALL ON attom_sales_history TO authenticated;
GRANT ALL ON attom_import_logs TO authenticated;
GRANT SELECT ON attom_hot_leads TO authenticated;

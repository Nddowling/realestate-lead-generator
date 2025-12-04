// ATTOM Data API Integration
// Documentation: https://api.developer.attomdata.com/docs

const ATTOM_BASE_URL = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';
const ATTOM_API_KEY = process.env.ATTOM_API_KEY || '';

export interface AttomProperty {
  attom_id: number;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  county: string;
  fips_code?: string;
  apn?: string;
  property_type?: string;
  year_built?: number;
  bedrooms?: number;
  bathrooms_total?: number;
  living_sqft?: number;
  lot_sqft?: number;
  stories?: number;
  pool?: boolean;
  garage_sqft?: number;
  latitude?: number;
  longitude?: number;
  owner_name?: string;
  owner_name_2?: string;
  owner_mailing_address?: string;
  owner_mailing_city?: string;
  owner_mailing_state?: string;
  owner_mailing_zip?: string;
  owner_occupied?: boolean;
  avm_value?: number;
  avm_high?: number;
  avm_low?: number;
  avm_confidence_score?: number;
  assessed_value?: number;
  market_value?: number;
  tax_amount?: number;
  last_sale_date?: string;
  last_sale_price?: number;
  raw_data: object;
}

export interface AttomSale {
  attom_id: number;
  sale_date?: string;
  sale_price?: number;
  sale_type?: string;
  seller_name?: string;
  buyer_name?: string;
  document_type?: string;
  recording_date?: string;
}

export interface AttomApiResponse {
  status: {
    version: string;
    code: number;
    msg: string;
    total: number;
    page: number;
    pagesize: number;
  };
  property?: any[];
  sale?: any[];
}

// Savannah/Rincon area ZIP codes
export const CHATHAM_COUNTY_ZIPS = [
  '31401', '31404', '31405', '31406', '31407', '31408', '31409',
  '31410', '31411', '31415', '31419', '31421'
];

export const EFFINGHAM_COUNTY_ZIPS = [
  '31326', '31329', '31312', '31308'
];

export const ALL_TARGET_ZIPS = [...CHATHAM_COUNTY_ZIPS, ...EFFINGHAM_COUNTY_ZIPS];

class AttomClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetch(endpoint: string, params: Record<string, string>): Promise<AttomApiResponse> {
    const queryString = new URLSearchParams(params).toString();
    const url = `${ATTOM_BASE_URL}${endpoint}?${queryString}`;

    console.log(`[ATTOM] Fetching: ${endpoint}`, params);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'APIKey': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`ATTOM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status?.code !== 0 && data.status?.code !== 400) {
      throw new Error(`ATTOM API error: ${data.status?.msg || 'Unknown error'}`);
    }

    return data;
  }

  // Get properties with owner details by ZIP code
  async getPropertiesWithOwner(
    postalCode: string,
    options: {
      propertyType?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<AttomProperty[]> {
    const params: Record<string, string> = {
      postalcode: postalCode,
      pageSize: String(options.pageSize || 100),
      page: String(options.page || 1),
    };

    if (options.propertyType) {
      params.propertytype = options.propertyType;
    }

    const response = await this.fetch('/property/detailowner', params);

    if (!response.property || response.property.length === 0) {
      return [];
    }

    return response.property.map((p: any) => this.transformProperty(p));
  }

  // Get property assessment/tax data
  async getAssessments(
    postalCode: string,
    options: { page?: number; pageSize?: number } = {}
  ): Promise<AttomProperty[]> {
    const params: Record<string, string> = {
      postalcode: postalCode,
      pageSize: String(options.pageSize || 100),
      page: String(options.page || 1),
    };

    const response = await this.fetch('/assessment/detail', params);

    if (!response.property || response.property.length === 0) {
      return [];
    }

    return response.property.map((p: any) => this.transformAssessment(p));
  }

  // Get AVM (Automated Valuation Model) data
  async getAVM(
    postalCode: string,
    options: { page?: number; pageSize?: number } = {}
  ): Promise<AttomProperty[]> {
    const params: Record<string, string> = {
      postalcode: postalCode,
      pageSize: String(options.pageSize || 100),
      page: String(options.page || 1),
    };

    const response = await this.fetch('/attomavm/detail', params);

    if (!response.property || response.property.length === 0) {
      return [];
    }

    return response.property.map((p: any) => this.transformAVM(p));
  }

  // Get sales history for properties
  async getSalesHistory(
    postalCode: string,
    options: { page?: number; pageSize?: number } = {}
  ): Promise<{ attom_id: number; sales: AttomSale[] }[]> {
    const params: Record<string, string> = {
      postalcode: postalCode,
      pageSize: String(options.pageSize || 100),
      page: String(options.page || 1),
    };

    const response = await this.fetch('/saleshistory/detail', params);

    if (!response.property || response.property.length === 0) {
      return [];
    }

    return response.property.map((p: any) => ({
      attom_id: p.identifier?.attomId || p.identifier?.Id,
      sales: this.transformSalesHistory(p),
    }));
  }

  // Transform raw property data to our schema
  private transformProperty(raw: any): AttomProperty {
    const identifier = raw.identifier || {};
    const address = raw.address || {};
    const building = raw.building || {};
    const lot = raw.lot || {};
    const owner = raw.owner || {};
    const sale = raw.sale || {};
    const location = raw.location || {};

    // Owner mailing address
    const ownerMail = owner.mailingAddress || owner.mailingaddress || {};

    // Extract attom_id from multiple possible locations
    const attom_id = identifier.attomId || identifier.Id || identifier.id ||
                     raw.attomId || raw.Id || raw.id || null;

    return {
      attom_id,
      street_address: address.oneLine || address.line1 || '',
      city: address.locality || '',
      state: address.countrySubd || 'GA',
      zip_code: address.postal1 || '',
      county: address.countrySecSubd || '',
      fips_code: identifier.fips,
      apn: identifier.apn,
      property_type: building.construction?.propertyType || lot.propertyType,
      year_built: building.construction?.yearBuilt || building.yearBuilt,
      bedrooms: building.rooms?.beds || building.bedrooms,
      bathrooms_total: building.rooms?.bathsTotal || building.bathrooms,
      living_sqft: building.size?.universalSize || building.size?.livingSize,
      lot_sqft: lot.lotSize1 || lot.lotsize1,
      stories: building.construction?.stories,
      pool: building.construction?.pool === 'Y' || building.pool === true,
      garage_sqft: building.parking?.garageSquareFeet,
      latitude: location.latitude || address.latitude,
      longitude: location.longitude || address.longitude,
      owner_name: owner.owner1?.fullName || owner.owner1FullName || owner.ownerName,
      owner_name_2: owner.owner2?.fullName || owner.owner2FullName,
      owner_mailing_address: ownerMail.oneLine || ownerMail.line1,
      owner_mailing_city: ownerMail.locality,
      owner_mailing_state: ownerMail.countrySubd,
      owner_mailing_zip: ownerMail.postal1,
      owner_occupied: owner.absenteeOwnerStatus === 'O' || owner.ownerOccupied === 'Y',
      last_sale_date: sale.saleTransDate || sale.salesearchdate,
      last_sale_price: sale.saleAmountData?.saleAmt || sale.amount?.saleAmt,
      raw_data: raw,
    };
  }

  // Transform assessment data
  private transformAssessment(raw: any): AttomProperty {
    const identifier = raw.identifier || {};
    const address = raw.address || {};
    const assessment = raw.assessment || {};
    const tax = assessment.tax || {};
    const assessed = assessment.assessed || {};
    const market = assessment.market || {};

    const attom_id = identifier.attomId || identifier.Id || identifier.id ||
                     raw.attomId || raw.Id || raw.id || null;

    return {
      attom_id,
      street_address: address.oneLine || address.line1 || '',
      city: address.locality || '',
      state: address.countrySubd || 'GA',
      zip_code: address.postal1 || '',
      county: address.countrySecSubd || '',
      assessed_value: assessed.assdTtlValue || assessed.assessedTotalValue,
      market_value: market.mktTtlValue || market.marketTotalValue,
      tax_amount: tax.taxAmt || tax.amount,
      raw_data: raw,
    };
  }

  // Transform AVM data
  private transformAVM(raw: any): AttomProperty {
    const identifier = raw.identifier || {};
    const address = raw.address || {};
    const avm = raw.avm || {};

    const attom_id = identifier.attomId || identifier.Id || identifier.id ||
                     raw.attomId || raw.Id || raw.id || null;

    return {
      attom_id,
      street_address: address.oneLine || address.line1 || '',
      city: address.locality || '',
      state: address.countrySubd || 'GA',
      zip_code: address.postal1 || '',
      county: address.countrySecSubd || '',
      avm_value: avm.amount?.value || avm.avmValue,
      avm_high: avm.amount?.high || avm.avmHigh,
      avm_low: avm.amount?.low || avm.avmLow,
      avm_confidence_score: avm.amount?.confidence || avm.confidenceScore,
      raw_data: raw,
    };
  }

  // Transform sales history
  private transformSalesHistory(raw: any): AttomSale[] {
    const identifier = raw.identifier || {};
    const saleHistory = raw.saleHistory || raw.salesHistory || [];

    if (!Array.isArray(saleHistory)) {
      return [];
    }

    return saleHistory.map((sale: any) => ({
      attom_id: identifier.attomId || identifier.Id,
      sale_date: sale.saleTransDate || sale.saleDate,
      sale_price: sale.amount?.saleAmt || sale.salePrice,
      sale_type: sale.saleTransType,
      seller_name: sale.sellerName,
      buyer_name: sale.buyerName,
      document_type: sale.documentType,
      recording_date: sale.recordingDate,
    }));
  }
}

// Export singleton instance
export const attomClient = new AttomClient(ATTOM_API_KEY);

// Helper to check API call budget
export async function getApiCallsRemaining(): Promise<number> {
  // ATTOM doesn't have a direct endpoint for this
  // We track it ourselves in attom_import_logs
  return 100; // Start with 100 for trial
}

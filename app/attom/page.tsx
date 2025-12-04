'use client';

import { useState, useEffect, useCallback } from 'react';
import { CHATHAM_COUNTY_ZIPS, EFFINGHAM_COUNTY_ZIPS } from '@/lib/attom';

interface AttomProperty {
  id: string;
  attom_id: number;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  county: string;
  property_type: string;
  year_built: number;
  bedrooms: number;
  bathrooms_total: number;
  living_sqft: number;
  lot_sqft: number;
  owner_name: string;
  owner_mailing_address: string;
  owner_mailing_city: string;
  owner_mailing_state: string;
  is_absentee_owner: boolean;
  avm_value: number;
  assessed_value: number;
  last_sale_price: number;
  last_sale_date: string;
  estimated_equity: number;
  equity_percent: number;
  years_owned: number;
  imported_at: string;
}

interface ImportLog {
  id: string;
  endpoint: string;
  query_params: any;
  records_fetched: number;
  records_inserted: number;
  records_updated: number;
  api_calls_used: number;
  status: string;
  error_message: string;
  started_at: string;
  completed_at: string;
}

interface Stats {
  totalApiCallsUsed: number;
  apiCallsRemaining: number;
  trialLimit: number;
  totalProperties: number;
  absenteeOwners: number;
}

export default function AttomPage() {
  const [activeTab, setActiveTab] = useState<'import' | 'properties' | 'history'>('properties');
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [properties, setProperties] = useState<AttomProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    absenteeOnly: true,
    minEquity: '50000',
    county: '',
    search: '',
  });

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Import settings
  const [importSettings, setImportSettings] = useState({
    endpoint: 'detailowner',
    county: 'chatham',
    propertyType: 'sfr',
    selectionMode: 'county' as 'county' | 'zip',
    selectedZips: [] as string[],
  });

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/attom/import');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '25',
        absenteeOnly: String(filters.absenteeOnly),
        sortBy: 'estimated_equity',
        sortOrder: 'desc',
      });

      if (filters.minEquity) params.set('minEquity', filters.minEquity);
      if (filters.county) params.set('county', filters.county);
      if (filters.search) params.set('search', filters.search);

      const res = await fetch(`/api/attom/properties?${params}`);
      const data = await res.json();

      if (data.success) {
        setProperties(data.properties);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'properties') {
      fetchProperties();
    }
  }, [activeTab, fetchProperties]);

  const handleImport = async () => {
    if (!stats || stats.apiCallsRemaining <= 0) {
      setMessage({ type: 'error', text: 'No API calls remaining in trial' });
      return;
    }

    // Validate ZIP selection if in zip mode
    if (importSettings.selectionMode === 'zip' && importSettings.selectedZips.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one ZIP code' });
      return;
    }

    setImporting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/attom/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: importSettings.endpoint,
          county: importSettings.selectionMode === 'county' ? importSettings.county : undefined,
          zipCodes: importSettings.selectionMode === 'zip' ? importSettings.selectedZips : [],
          propertyType: importSettings.propertyType,
          pageSize: 100,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: `Fetched ${data.stats.recordsFetched} properties, saved ${data.stats.recordsInserted} to database (${data.stats.apiCallsUsed} API calls used)`,
        });
        fetchStats();
        fetchProperties();
      } else {
        setMessage({ type: 'error', text: data.error || 'Import failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Import request failed' });
    } finally {
      setImporting(false);
    }
  };

  const handleConvertToLead = async (propertyId: string) => {
    setConvertingId(propertyId);
    try {
      const res = await fetch('/api/attom/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attomPropertyId: propertyId }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Lead created successfully!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create lead' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Request failed' });
    } finally {
      setConvertingId(null);
    }
  };

  const formatCurrency = (amount: number | null): string => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string | null): string => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">ATTOM Data</h1>
          <p className="text-slate-400 mt-1">
            Property data from ATTOM API - 30 day trial
          </p>
        </div>

        {/* API Budget */}
        {stats && (
          <div className="bg-dark-100 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary-400">{stats.apiCallsRemaining}</p>
                <p className="text-slate-400 text-sm">calls remaining</p>
              </div>
              <div className="h-12 w-px bg-slate-700" />
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{stats.totalProperties}</p>
                <p className="text-slate-400 text-sm">properties</p>
              </div>
              <div className="h-12 w-px bg-slate-700" />
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-400">{stats.absenteeOwners}</p>
                <p className="text-slate-400 text-sm">absentee</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="h-2 bg-dark-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all"
                  style={{ width: `${(stats.apiCallsRemaining / stats.trialLimit) * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1 text-right">
                {stats.totalApiCallsUsed} of {stats.trialLimit} used
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {[
          { id: 'properties', label: 'Properties', icon: '🏠' },
          { id: 'import', label: 'Import Data', icon: '📥' },
          { id: 'history', label: 'Import History', icon: '📜' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-500 text-white'
                : 'bg-dark-200 text-slate-400 hover:text-white'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Import from ATTOM API</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Data Type</label>
              <select
                value={importSettings.endpoint}
                onChange={(e) => setImportSettings({ ...importSettings, endpoint: e.target.value })}
                className="input w-full"
              >
                <option value="detailowner">Property + Owner Info</option>
                <option value="assessment">Tax Assessments</option>
                <option value="avm">Valuations (AVM)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Property Type</label>
              <select
                value={importSettings.propertyType}
                onChange={(e) => setImportSettings({ ...importSettings, propertyType: e.target.value })}
                className="input w-full"
              >
                <option value="sfr">Single Family</option>
                <option value="apartment">Multi-Family</option>
                <option value="condo">Condo</option>
                <option value="">All Types</option>
              </select>
            </div>
          </div>

          {/* Selection Mode Toggle */}
          <div className="mb-4">
            <label className="block text-sm text-slate-400 mb-2">Select By</label>
            <div className="flex gap-2">
              <button
                onClick={() => setImportSettings({ ...importSettings, selectionMode: 'county', selectedZips: [] })}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  importSettings.selectionMode === 'county'
                    ? 'bg-primary-500 text-white'
                    : 'bg-dark-200 text-slate-400 hover:text-white'
                }`}
              >
                County
              </button>
              <button
                onClick={() => setImportSettings({ ...importSettings, selectionMode: 'zip' })}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  importSettings.selectionMode === 'zip'
                    ? 'bg-primary-500 text-white'
                    : 'bg-dark-200 text-slate-400 hover:text-white'
                }`}
              >
                ZIP Codes
              </button>
            </div>
          </div>

          {/* County Selection */}
          {importSettings.selectionMode === 'county' && (
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-1">County</label>
              <select
                value={importSettings.county}
                onChange={(e) => setImportSettings({ ...importSettings, county: e.target.value })}
                className="input w-full"
              >
                <option value="chatham">Chatham (Savannah) - {CHATHAM_COUNTY_ZIPS.length} ZIPs</option>
                <option value="effingham">Effingham (Rincon) - {EFFINGHAM_COUNTY_ZIPS.length} ZIPs</option>
                <option value="all">All Target Areas</option>
              </select>
            </div>
          )}

          {/* ZIP Code Selection */}
          {importSettings.selectionMode === 'zip' && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm text-slate-400">Select ZIP Codes</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportSettings({
                      ...importSettings,
                      selectedZips: [...CHATHAM_COUNTY_ZIPS, ...EFFINGHAM_COUNTY_ZIPS]
                    })}
                    className="text-xs text-primary-400 hover:text-primary-300"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setImportSettings({ ...importSettings, selectedZips: [] })}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Chatham County ZIPs */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">Chatham County (Savannah)</p>
                  <button
                    onClick={() => {
                      const allChatham = CHATHAM_COUNTY_ZIPS.every(z => importSettings.selectedZips.includes(z));
                      if (allChatham) {
                        setImportSettings({
                          ...importSettings,
                          selectedZips: importSettings.selectedZips.filter(z => !CHATHAM_COUNTY_ZIPS.includes(z))
                        });
                      } else {
                        setImportSettings({
                          ...importSettings,
                          selectedZips: Array.from(new Set([...importSettings.selectedZips, ...CHATHAM_COUNTY_ZIPS]))
                        });
                      }
                    }}
                    className="text-xs text-primary-400 hover:text-primary-300"
                  >
                    {CHATHAM_COUNTY_ZIPS.every(z => importSettings.selectedZips.includes(z)) ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {CHATHAM_COUNTY_ZIPS.map(zip => (
                    <label
                      key={zip}
                      className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                        importSettings.selectedZips.includes(zip)
                          ? 'bg-primary-500 text-white'
                          : 'bg-dark-200 text-slate-400 hover:text-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={importSettings.selectedZips.includes(zip)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setImportSettings({
                              ...importSettings,
                              selectedZips: [...importSettings.selectedZips, zip]
                            });
                          } else {
                            setImportSettings({
                              ...importSettings,
                              selectedZips: importSettings.selectedZips.filter(z => z !== zip)
                            });
                          }
                        }}
                        className="sr-only"
                      />
                      {zip}
                    </label>
                  ))}
                </div>
              </div>

              {/* Effingham County ZIPs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">Effingham County (Rincon)</p>
                  <button
                    onClick={() => {
                      const allEffingham = EFFINGHAM_COUNTY_ZIPS.every(z => importSettings.selectedZips.includes(z));
                      if (allEffingham) {
                        setImportSettings({
                          ...importSettings,
                          selectedZips: importSettings.selectedZips.filter(z => !EFFINGHAM_COUNTY_ZIPS.includes(z))
                        });
                      } else {
                        setImportSettings({
                          ...importSettings,
                          selectedZips: Array.from(new Set([...importSettings.selectedZips, ...EFFINGHAM_COUNTY_ZIPS]))
                        });
                      }
                    }}
                    className="text-xs text-primary-400 hover:text-primary-300"
                  >
                    {EFFINGHAM_COUNTY_ZIPS.every(z => importSettings.selectedZips.includes(z)) ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {EFFINGHAM_COUNTY_ZIPS.map(zip => (
                    <label
                      key={zip}
                      className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                        importSettings.selectedZips.includes(zip)
                          ? 'bg-primary-500 text-white'
                          : 'bg-dark-200 text-slate-400 hover:text-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={importSettings.selectedZips.includes(zip)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setImportSettings({
                              ...importSettings,
                              selectedZips: [...importSettings.selectedZips, zip]
                            });
                          } else {
                            setImportSettings({
                              ...importSettings,
                              selectedZips: importSettings.selectedZips.filter(z => z !== zip)
                            });
                          }
                        }}
                        className="sr-only"
                      />
                      {zip}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="bg-dark-200/50 rounded-lg p-4 mb-6">
            <h3 className="text-white font-medium mb-2">Import Preview</h3>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>
                This will fetch <strong className="text-white">up to 100 properties</strong> per ZIP code
              </li>
              <li>
                {importSettings.selectionMode === 'county' && (
                  <>
                    {importSettings.county === 'chatham' && `${CHATHAM_COUNTY_ZIPS.length} ZIP codes = ${CHATHAM_COUNTY_ZIPS.length} API calls`}
                    {importSettings.county === 'effingham' && `${EFFINGHAM_COUNTY_ZIPS.length} ZIP codes = ${EFFINGHAM_COUNTY_ZIPS.length} API calls`}
                    {importSettings.county === 'all' && `${CHATHAM_COUNTY_ZIPS.length + EFFINGHAM_COUNTY_ZIPS.length} ZIP codes = ${CHATHAM_COUNTY_ZIPS.length + EFFINGHAM_COUNTY_ZIPS.length} API calls`}
                  </>
                )}
                {importSettings.selectionMode === 'zip' && (
                  <>{importSettings.selectedZips.length} ZIP codes = {importSettings.selectedZips.length} API calls</>
                )}
              </li>
              <li>
                Remaining budget: <strong className={stats?.apiCallsRemaining && stats.apiCallsRemaining > 0 ? 'text-green-400' : 'text-red-400'}>
                  {stats?.apiCallsRemaining || 0} calls
                </strong>
              </li>
            </ul>
          </div>

          <button
            onClick={handleImport}
            disabled={importing || !stats || stats.apiCallsRemaining <= 0}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {importing ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Importing...
              </>
            ) : (
              <>
                <span>📥</span>
                Start Import
              </>
            )}
          </button>
        </div>
      )}

      {/* Properties Tab */}
      {activeTab === 'properties' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="card">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Search</label>
                <input
                  type="text"
                  placeholder="Address, owner..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && fetchProperties()}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Min Equity</label>
                <select
                  value={filters.minEquity}
                  onChange={(e) => setFilters({ ...filters, minEquity: e.target.value })}
                  className="input w-full"
                >
                  <option value="">Any</option>
                  <option value="25000">$25,000+</option>
                  <option value="50000">$50,000+</option>
                  <option value="100000">$100,000+</option>
                  <option value="150000">$150,000+</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">County</label>
                <select
                  value={filters.county}
                  onChange={(e) => setFilters({ ...filters, county: e.target.value })}
                  className="input w-full"
                >
                  <option value="">All Counties</option>
                  <option value="chatham">Chatham</option>
                  <option value="effingham">Effingham</option>
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.absenteeOnly}
                    onChange={(e) => setFilters({ ...filters, absenteeOnly: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-dark-200 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-slate-300">Absentee Owners Only</span>
                </label>
              </div>
            </div>
          </div>

          {/* Properties Table */}
          <div className="card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
              </div>
            ) : properties.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-5xl mb-4 block">🏠</span>
                <h3 className="text-lg text-white">No properties found</h3>
                <p className="text-slate-400 mt-1">
                  {stats?.totalProperties === 0
                    ? 'Import data from ATTOM to get started'
                    : 'Try adjusting your filters'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-dark-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Property</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Owner</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">AVM Value</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Est. Equity</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Years Owned</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-slate-400">Status</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {properties.map((property) => (
                      <tr key={property.id} className="hover:bg-dark-200/50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-white font-medium">{property.street_address}</p>
                            <p className="text-slate-400 text-sm">
                              {property.city}, {property.state} {property.zip_code}
                            </p>
                            <p className="text-slate-500 text-xs">
                              {property.bedrooms}bd / {property.bathrooms_total}ba • {property.living_sqft?.toLocaleString()} sqft
                              {property.year_built && ` • Built ${property.year_built}`}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-white">{property.owner_name || '-'}</p>
                            {property.is_absentee_owner && property.owner_mailing_city && (
                              <p className="text-orange-400 text-xs">
                                Mails to: {property.owner_mailing_city}, {property.owner_mailing_state}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="text-white">{formatCurrency(property.avm_value)}</p>
                          <p className="text-slate-500 text-xs">
                            Bought: {formatCurrency(property.last_sale_price)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className={`font-bold ${
                            property.estimated_equity > 100000 ? 'text-green-400' :
                            property.estimated_equity > 50000 ? 'text-yellow-400' : 'text-slate-400'
                          }`}>
                            {formatCurrency(property.estimated_equity)}
                          </p>
                          {property.equity_percent && (
                            <p className="text-slate-500 text-xs">{property.equity_percent.toFixed(0)}%</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="text-white">{property.years_owned || '-'}</p>
                          <p className="text-slate-500 text-xs">
                            {property.last_sale_date && formatDate(property.last_sale_date)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {property.is_absentee_owner ? (
                            <span className="px-2 py-1 rounded-full text-xs bg-orange-500/20 text-orange-400">
                              Absentee
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs bg-slate-500/20 text-slate-400">
                              Owner Occ
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleConvertToLead(property.id)}
                            disabled={convertingId === property.id}
                            className="btn-primary text-sm py-1 px-3"
                          >
                            {convertingId === property.id ? '...' : 'Add Lead'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {properties.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
                <p className="text-sm text-slate-400">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="btn-secondary text-sm py-1 px-3 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="btn-secondary text-sm py-1 px-3 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Import History</h2>

          {logs.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No imports yet</p>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-4 rounded-lg border ${
                    log.status === 'success'
                      ? 'border-green-500/30 bg-green-500/10'
                      : log.status === 'failed'
                      ? 'border-red-500/30 bg-red-500/10'
                      : 'border-slate-700 bg-dark-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">
                        {log.endpoint} - {log.query_params?.county || 'custom'} county
                      </p>
                      <p className="text-slate-400 text-sm">
                        {formatDate(log.started_at)} at{' '}
                        {new Date(log.started_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white">
                        {log.records_fetched} fetched • {log.records_inserted} new • {log.records_updated} updated
                      </p>
                      <p className="text-slate-400 text-sm">
                        {log.api_calls_used} API calls used
                      </p>
                    </div>
                  </div>
                  {log.error_message && (
                    <p className="text-red-400 text-sm mt-2">{log.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

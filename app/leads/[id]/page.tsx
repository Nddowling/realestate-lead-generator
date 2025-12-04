'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SMSComposer from '@/components/SMSComposer';

// Types
interface Buyer {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone: string;
  buyBox: {
    counties?: string[];
    property_types?: string[];
    max_price?: number;
    min_price?: number;
    conditions_accepted?: string[];
    deal_types?: string[];
  };
  totalDeals?: number;
  lastDealAt?: string;
}

interface Lead {
  id: string;
  score: number;
  temperature: 'hot' | 'warm' | 'cold';
  status: string;
  phone?: string;
  phoneAlt?: string;
  email?: string;
  phoneConfidence?: number;
  skipTracedAt?: string;
  lastContactedAt?: string;
  nextFollowUp?: string;
  contactAttempts: number;
  askingPrice?: number;
  offerAmount?: number;
  contractPrice?: number;
  notes?: string;
  tags?: string[];
  assignedTo?: string;
  createdAt: string;
  property: {
    id: string;
    address: string;
    city: string;
    state: string;
    zip?: string;
    county: string;
    ownerName?: string;
    ownerMailingAddress?: string;
    isAbsentee: boolean;
    bedrooms?: number;
    bathrooms?: number;
    sqft?: number;
    yearBuilt?: number;
    assessedValue?: number;
    estimatedValue?: number;
    equityPercentage?: number;
  };
  distressIndicators: Array<{
    id: string;
    type: string;
    amountOwed?: number;
    auctionDate?: string;
    filingDate?: string;
    source: string;
  }>;
}

interface Activity {
  id: string;
  type: string;
  content: string;
  metadata?: Record<string, any>;
  createdBy?: string;
  createdAt: string;
}

// Status options
const STATUS_OPTIONS = [
  { value: 'new', label: 'New', icon: '🆕', color: 'bg-slate-500' },
  { value: 'contacted', label: 'Contacted', icon: '📞', color: 'bg-blue-500' },
  { value: 'appointment', label: 'Appointment', icon: '📅', color: 'bg-purple-500' },
  { value: 'offer', label: 'Offer Made', icon: '💵', color: 'bg-orange-500' },
  { value: 'contract', label: 'Under Contract', icon: '📝', color: 'bg-yellow-500' },
  { value: 'closed', label: 'Closed', icon: '✅', color: 'bg-green-500' },
  { value: 'dead', label: 'Dead', icon: '❌', color: 'bg-red-500' },
];

// Temperature badge
function TemperatureBadge({ temp, score }: { temp: string; score: number }) {
  const config = {
    hot: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400', icon: '🔥' },
    warm: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-400', icon: '🌡️' },
    cold: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400', icon: '❄️' },
  };
  const c = config[temp as keyof typeof config] || config.cold;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${c.bg} ${c.border}`}>
      <span className="text-2xl">{c.icon}</span>
      <div>
        <div className={`text-2xl font-bold ${c.text}`}>{score}</div>
        <div className="text-xs text-slate-400 capitalize">{temp}</div>
      </div>
    </div>
  );
}

// Activity item
function ActivityItem({ activity }: { activity: Activity }) {
  const typeConfig: Record<string, { icon: string; label: string }> = {
    call: { icon: '📞', label: 'Phone Call' },
    sms_sent: { icon: '📤', label: 'SMS Sent' },
    sms_received: { icon: '📥', label: 'SMS Received' },
    email: { icon: '📧', label: 'Email' },
    note: { icon: '📝', label: 'Note' },
    status_change: { icon: '🔄', label: 'Status Changed' },
    skip_trace: { icon: '🔍', label: 'Skip Traced' },
    appointment: { icon: '📅', label: 'Appointment' },
    offer_made: { icon: '💵', label: 'Offer Made' },
    contract_signed: { icon: '📄', label: 'Contract Signed' },
  };

  const config = typeConfig[activity.type] || { icon: '•', label: activity.type };

  return (
    <div className="flex gap-4 py-4 border-b border-slate-700 last:border-0">
      <div className="flex-shrink-0 w-10 h-10 bg-dark-200 rounded-full flex items-center justify-center text-xl">
        {config.icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-300">{config.label}</span>
          <span className="text-xs text-slate-500">
            {new Date(activity.createdAt).toLocaleString()}
          </span>
        </div>
        <p className="text-white mt-1">{activity.content}</p>
        {activity.createdBy && (
          <p className="text-xs text-slate-500 mt-1">by {activity.createdBy}</p>
        )}
      </div>
    </div>
  );
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [matchingBuyers, setMatchingBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSMS, setShowSMS] = useState(false);
  const [loadingBuyers, setLoadingBuyers] = useState(false);

  // Form state
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [newNote, setNewNote] = useState('');

  // Fetch lead data
  const fetchLead = async () => {
    try {
      const response = await fetch(`/api/leads/${leadId}`);
      const data = await response.json();

      if (data.success && data.lead) {
        setLead(data.lead);
        setStatus(data.lead.status);
        setNotes(data.lead.notes || '');
        setNextFollowUp(data.lead.nextFollowUp ? data.lead.nextFollowUp.split('T')[0] : '');
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error('Failed to fetch lead:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch matching buyers
  const fetchMatchingBuyers = async () => {
    setLoadingBuyers(true);
    try {
      const response = await fetch(`/api/buyers?leadId=${leadId}`);
      const data = await response.json();
      if (data.success) {
        setMatchingBuyers(data.buyers || []);
      }
    } catch (error) {
      console.error('Failed to fetch buyers:', error);
    } finally {
      setLoadingBuyers(false);
    }
  };

  useEffect(() => {
    fetchLead();
    fetchMatchingBuyers();
  }, [leadId]);

  // Update lead
  const handleUpdateLead = async (updates: Partial<Lead>) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      if (data.success) {
        await fetchLead();
      }
    } catch (error) {
      console.error('Failed to update lead:', error);
    } finally {
      setSaving(false);
    }
  };

  // Add note
  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          type: 'note',
          content: newNote,
        }),
      });

      setNewNote('');
      await fetchLead();
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  // Log call
  const handleLogCall = async () => {
    const callNotes = prompt('Call notes:');
    if (callNotes === null) return;

    try {
      await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          type: 'call',
          content: callNotes || 'Call logged',
        }),
      });

      // Update last contacted
      await handleUpdateLead({ lastContactedAt: new Date().toISOString() } as any);
    } catch (error) {
      console.error('Failed to log call:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <span className="text-5xl mb-4 block">🚫</span>
        <h2 className="text-xl font-semibold text-white">Lead not found</h2>
        <p className="text-slate-400 mt-2">This lead may have been deleted.</p>
        <Link href="/leads" className="btn-primary mt-4 inline-block">
          ← Back to Leads
        </Link>
      </div>
    );
  }

  const distressLabels: Record<string, { label: string; color: string }> = {
    tax_delinquent: { label: 'Tax Delinquent', color: 'bg-amber-500' },
    pre_foreclosure: { label: 'Pre-Foreclosure', color: 'bg-red-500' },
    foreclosure: { label: 'Foreclosure', color: 'bg-red-600' },
    probate: { label: 'Probate', color: 'bg-purple-500' },
    code_violation: { label: 'Code Violation', color: 'bg-orange-500' },
    vacant: { label: 'Vacant', color: 'bg-slate-500' },
    bankruptcy: { label: 'Bankruptcy', color: 'bg-red-700' },
    divorce: { label: 'Divorce', color: 'bg-pink-500' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/leads" className="text-slate-400 hover:text-white text-sm mb-2 inline-block">
            ← Back to Leads
          </Link>
          <h1 className="text-2xl font-bold text-white">{lead.property.address}</h1>
          <p className="text-slate-400">
            {lead.property.city}, {lead.property.state} {lead.property.zip} • {lead.property.county} County
          </p>
        </div>
        <TemperatureBadge temp={lead.temperature} score={lead.score} />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Property & Contact Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Distress Indicators */}
          {lead.distressIndicators.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">Distress Indicators</h2>
              <div className="space-y-3">
                {lead.distressIndicators.map((indicator) => {
                  const config = distressLabels[indicator.type] || { label: indicator.type, color: 'bg-slate-500' };
                  return (
                    <div key={indicator.id} className="flex items-center justify-between p-3 bg-dark-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className={`${config.color} text-white text-xs px-2 py-1 rounded-full`}>
                          {config.label}
                        </span>
                        <span className="text-slate-400 text-sm">{indicator.source}</span>
                      </div>
                      <div className="text-right">
                        {indicator.amountOwed && (
                          <div className="text-white font-semibold">
                            ${indicator.amountOwed.toLocaleString()} owed
                          </div>
                        )}
                        {indicator.auctionDate && (
                          <div className="text-red-400 text-sm">
                            Auction: {new Date(indicator.auctionDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Property Details */}
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Property Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {lead.property.bedrooms && (
                <div>
                  <p className="text-slate-400 text-sm">Bedrooms</p>
                  <p className="text-white font-medium">{lead.property.bedrooms}</p>
                </div>
              )}
              {lead.property.bathrooms && (
                <div>
                  <p className="text-slate-400 text-sm">Bathrooms</p>
                  <p className="text-white font-medium">{lead.property.bathrooms}</p>
                </div>
              )}
              {lead.property.sqft && (
                <div>
                  <p className="text-slate-400 text-sm">Sq Ft</p>
                  <p className="text-white font-medium">{lead.property.sqft.toLocaleString()}</p>
                </div>
              )}
              {lead.property.yearBuilt && (
                <div>
                  <p className="text-slate-400 text-sm">Year Built</p>
                  <p className="text-white font-medium">{lead.property.yearBuilt}</p>
                </div>
              )}
              {lead.property.assessedValue && (
                <div>
                  <p className="text-slate-400 text-sm">Assessed Value</p>
                  <p className="text-white font-medium">${lead.property.assessedValue.toLocaleString()}</p>
                </div>
              )}
              {lead.property.estimatedValue && (
                <div>
                  <p className="text-slate-400 text-sm">Est. Value</p>
                  <p className="text-white font-medium">${lead.property.estimatedValue.toLocaleString()}</p>
                </div>
              )}
              {lead.property.equityPercentage && (
                <div>
                  <p className="text-slate-400 text-sm">Equity</p>
                  <p className="text-primary-400 font-medium">{lead.property.equityPercentage}%</p>
                </div>
              )}
              <div>
                <p className="text-slate-400 text-sm">Absentee</p>
                <p className="text-white font-medium">{lead.property.isAbsentee ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>

          {/* Owner Info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Owner Information</h2>
            <div className="space-y-4">
              {lead.property.ownerName && (
                <div>
                  <p className="text-slate-400 text-sm">Name</p>
                  <p className="text-white font-medium">{lead.property.ownerName}</p>
                </div>
              )}
              {lead.property.ownerMailingAddress && (
                <div>
                  <p className="text-slate-400 text-sm">Mailing Address</p>
                  <p className="text-white">{lead.property.ownerMailingAddress}</p>
                </div>
              )}

              {/* Contact Info */}
              <div className="border-t border-slate-700 pt-4 mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-400 text-sm">Contact Info</p>
                  {lead.skipTracedAt && (
                    <span className="text-xs text-slate-500">
                      Skip traced {new Date(lead.skipTracedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {lead.phone ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <a
                        href={`tel:${lead.phone}`}
                        className="text-primary-400 hover:text-primary-300 font-medium text-lg"
                      >
                        📞 {formatPhone(lead.phone)}
                      </a>
                      {lead.phoneConfidence && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          lead.phoneConfidence >= 80 ? 'bg-green-500/20 text-green-400' :
                          lead.phoneConfidence >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {lead.phoneConfidence}% confident
                        </span>
                      )}
                    </div>
                    {lead.phoneAlt && (
                      <a href={`tel:${lead.phoneAlt}`} className="text-slate-400 hover:text-white text-sm block">
                        Alt: {formatPhone(lead.phoneAlt)}
                      </a>
                    )}
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className="text-slate-400 hover:text-white text-sm block">
                        ✉️ {lead.email}
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500">No contact info - needs skip trace</p>
                )}
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Activity Timeline</h2>
            {activities.length > 0 ? (
              <div className="space-y-0">
                {activities.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No activity yet</p>
            )}
          </div>
        </div>

        {/* Right Column - Actions & Status */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
            <div className="space-y-3">
              {lead.phone && (
                <>
                  <a
                    href={`tel:${lead.phone}`}
                    onClick={handleLogCall}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    📞 Call Owner
                  </a>
                  <button
                    onClick={() => setShowSMS(true)}
                    className="btn-secondary w-full flex items-center justify-center gap-2"
                  >
                    📱 Send SMS
                  </button>
                </>
              )}
              <Link
                href={`/analyzer?sqft=${lead.property.sqft || 1500}&price=${lead.property.assessedValue || 150000}`}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                🔢 Analyze Deal
              </Link>
            </div>
          </div>

          {/* Status */}
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Status</h2>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                handleUpdateLead({ status: e.target.value } as any);
              }}
              className="input-field w-full"
              disabled={saving}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.icon} {opt.label}
                </option>
              ))}
            </select>

            <div className="mt-4">
              <label className="text-sm text-slate-400">Next Follow-up</label>
              <input
                type="date"
                value={nextFollowUp}
                onChange={(e) => {
                  setNextFollowUp(e.target.value);
                  handleUpdateLead({ nextFollowUp: e.target.value ? new Date(e.target.value).toISOString() : null } as any);
                }}
                className="input-field w-full mt-1"
              />
            </div>

            <div className="mt-4 text-sm text-slate-400">
              <p>Contact Attempts: {lead.contactAttempts}</p>
              {lead.lastContactedAt && (
                <p>Last Contact: {new Date(lead.lastContactedAt).toLocaleDateString()}</p>
              )}
            </div>
          </div>

          {/* Add Note */}
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Add Note</h2>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Type a note..."
              className="input-field w-full h-24 resize-none"
            />
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim()}
              className="btn-secondary w-full mt-2"
            >
              Add Note
            </button>
          </div>

          {/* Deal Info */}
          {(lead.askingPrice || lead.offerAmount || lead.contractPrice) && (
            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">Deal Info</h2>
              <div className="space-y-2">
                {lead.askingPrice && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Asking Price</span>
                    <span className="text-white">${lead.askingPrice.toLocaleString()}</span>
                  </div>
                )}
                {lead.offerAmount && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Our Offer</span>
                    <span className="text-primary-400">${lead.offerAmount.toLocaleString()}</span>
                  </div>
                )}
                {lead.contractPrice && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Contract Price</span>
                    <span className="text-green-400">${lead.contractPrice.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Matching Buyers */}
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">
              Matching Buyers
              {matchingBuyers.length > 0 && (
                <span className="ml-2 text-sm font-normal text-primary-400">
                  ({matchingBuyers.length} found)
                </span>
              )}
            </h2>
            {loadingBuyers ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
              </div>
            ) : matchingBuyers.length > 0 ? (
              <div className="space-y-3">
                {matchingBuyers.map((buyer) => (
                  <div key={buyer.id} className="p-3 bg-dark-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-white font-medium">{buyer.name}</p>
                        {buyer.company && (
                          <p className="text-slate-400 text-sm">{buyer.company}</p>
                        )}
                      </div>
                      {buyer.totalDeals && buyer.totalDeals > 0 && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                          {buyer.totalDeals} deals
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <a
                        href={`tel:${buyer.phone}`}
                        className="text-primary-400 hover:text-primary-300"
                      >
                        📞 {buyer.phone}
                      </a>
                      <a
                        href={`mailto:${buyer.email}`}
                        className="text-slate-400 hover:text-white"
                      >
                        ✉️ {buyer.email}
                      </a>
                    </div>
                    {buyer.buyBox.max_price && (
                      <p className="text-xs text-slate-500 mt-2">
                        Max: ${buyer.buyBox.max_price.toLocaleString()}
                        {buyer.buyBox.deal_types && (
                          <span> • {buyer.buyBox.deal_types.join(', ')}</span>
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm text-center py-4">
                No matching buyers found for this property
              </p>
            )}
          </div>
        </div>
      </div>

      {/* SMS Modal */}
      {showSMS && lead.phone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-100 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Send SMS</h2>
                <button onClick={() => setShowSMS(false)} className="text-slate-400 hover:text-white">
                  ✕
                </button>
              </div>
              <SMSComposer
                leadId={lead.id}
                phone={lead.phone}
                ownerName={lead.property.ownerName}
                address={lead.property.address}
                city={lead.property.city}
                distressTypes={lead.distressIndicators.map(d => d.type)}
                onSent={() => {
                  setShowSMS(false);
                  fetchLead();
                }}
                onClose={() => setShowSMS(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: Format phone
function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

'use client';

import { useState, useEffect, useMemo } from 'react';

interface SMSTemplate {
  id: string;
  name: string;
  category: string;
  body: string;
  description: string;
}

interface SMSComposerProps {
  leadId: string;
  phone: string;
  ownerName?: string;
  address?: string;
  city?: string;
  distressTypes?: string[];
  onSent?: () => void;
  onClose?: () => void;
}

interface SegmentInfo {
  segments: number;
  characters: number;
  isUnicode: boolean;
  maxPerSegment: number;
}

export default function SMSComposer({
  leadId,
  phone,
  ownerName,
  address,
  city,
  distressTypes = [],
  onSent,
  onClose,
}: SMSComposerProps) {
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/sms/send');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  // Calculate segments when message changes
  const segmentInfo = useMemo((): SegmentInfo => {
    const gsmChars = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-.\/0-9:;<=>?¡A-ZÄÖÑܧ¿a-zäöñüà]*$/;
    const isUnicode = !gsmChars.test(message);
    const maxPerSegment = isUnicode ? 70 : 160;
    const characters = message.length;

    if (characters <= maxPerSegment) {
      return { segments: 1, characters, isUnicode, maxPerSegment };
    }

    const multiPartMax = isUnicode ? 67 : 153;
    const segments = Math.ceil(characters / multiPartMax);

    return { segments, characters, isUnicode, maxPerSegment };
  }, [message]);

  // Preview message with variables replaced
  const previewMessage = useMemo(() => {
    if (!message) return '';

    let preview = message;
    const firstName = ownerName?.split(/[\s,]+/)[ownerName.includes(',') ? 1 : 0] || 'Owner';
    const capitalizedFirst = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

    preview = preview.replace(/\{\{firstName\}\}/g, capitalizedFirst);
    preview = preview.replace(/\{\{ownerName\}\}/g, ownerName || 'Owner');
    preview = preview.replace(/\{\{address\}\}/g, address || 'the property');
    preview = preview.replace(/\{\{city\}\}/g, city || 'your area');
    preview = preview.replace(/\{\{[^}]+\}\}/g, ''); // Remove unmatched

    return preview.replace(/\s+/g, ' ').trim();
  }, [message, ownerName, address, city]);

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setMessage(template.body);
    }
  };

  // Filter templates based on distress types
  const filteredTemplates = useMemo(() => {
    const recommended: SMSTemplate[] = [];
    const other: SMSTemplate[] = [];

    templates.forEach(t => {
      const isRelevant =
        (distressTypes.includes('foreclosure') && t.category === 'foreclosure') ||
        (distressTypes.includes('pre_foreclosure') && t.category === 'foreclosure') ||
        (distressTypes.includes('tax_delinquent') && t.category === 'tax_delinquent') ||
        (distressTypes.includes('probate') && t.category === 'probate');

      if (isRelevant) {
        recommended.push(t);
      } else {
        other.push(t);
      }
    });

    return { recommended, other };
  }, [templates, distressTypes]);

  // Send the SMS
  const handleSend = async () => {
    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    setSending(true);
    setError('');

    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          message: previewMessage,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send SMS');
      }

      setSuccess(true);
      onSent?.();

      // Reset after delay
      setTimeout(() => {
        setMessage('');
        setSelectedTemplateId('');
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  // Format phone for display
  const formatPhone = (ph: string): string => {
    const cleaned = ph.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return ph;
  };

  return (
    <div className="bg-dark-100 rounded-xl border border-slate-700 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            <span>📱</span> Send SMS
          </h3>
          <p className="text-slate-400 text-sm">
            To: {formatPhone(phone)}
            {ownerName && <span className="text-slate-500"> ({ownerName})</span>}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* Template Selector */}
      <div>
        <label className="block text-sm text-slate-400 mb-2">Select Template</label>
        <select
          value={selectedTemplateId}
          onChange={(e) => handleTemplateSelect(e.target.value)}
          className="input-field"
        >
          <option value="">Choose a template or write custom...</option>

          {filteredTemplates.recommended.length > 0 && (
            <optgroup label="Recommended for this lead">
              {filteredTemplates.recommended.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} - {t.description}
                </option>
              ))}
            </optgroup>
          )}

          <optgroup label="Initial Outreach">
            {filteredTemplates.other
              .filter(t => t.category === 'initial')
              .map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </optgroup>

          <optgroup label="Follow-ups">
            {filteredTemplates.other
              .filter(t => t.category === 'follow_up')
              .map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </optgroup>

          <optgroup label="Distress-Specific">
            {filteredTemplates.other
              .filter(t => ['foreclosure', 'tax_delinquent', 'probate'].includes(t.category))
              .map(t => (
                <option key={t.id} value={t.id}>
                  [{t.category}] {t.name}
                </option>
              ))}
          </optgroup>
        </select>
      </div>

      {/* Message Input */}
      <div>
        <label className="block text-sm text-slate-400 mb-2">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message or select a template above..."
          rows={4}
          className="input-field resize-none"
        />

        {/* Character/Segment Counter */}
        <div className="flex items-center justify-between mt-2 text-xs">
          <span className="text-slate-500">
            Variables: {'{{firstName}}'}, {'{{address}}'}, {'{{city}}'}
          </span>
          <span className={`${
            segmentInfo.segments > 2 ? 'text-orange-400' :
            segmentInfo.segments > 1 ? 'text-yellow-400' :
            'text-slate-400'
          }`}>
            {segmentInfo.characters} chars • {segmentInfo.segments} segment{segmentInfo.segments !== 1 ? 's' : ''}
            {segmentInfo.isUnicode && ' (Unicode)'}
          </span>
        </div>
      </div>

      {/* Preview */}
      {previewMessage && (
        <div>
          <label className="block text-sm text-slate-400 mb-2">Preview</label>
          <div className="bg-dark-200 rounded-lg p-3 border border-slate-600">
            <p className="text-white text-sm whitespace-pre-wrap">{previewMessage}</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3">
          <p className="text-green-400 text-sm flex items-center gap-2">
            <span>✓</span> Message sent successfully!
          </p>
        </div>
      )}

      {/* Send Button */}
      <div className="flex gap-3">
        {onClose && (
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSend}
          disabled={sending || !message.trim() || success}
          className={`btn-primary flex-1 flex items-center justify-center gap-2 ${
            sending ? 'opacity-50 cursor-wait' : ''
          }`}
        >
          {sending ? (
            <>
              <span className="animate-spin">⏳</span>
              Sending...
            </>
          ) : success ? (
            <>
              <span>✓</span>
              Sent!
            </>
          ) : (
            <>
              <span>📤</span>
              Send SMS
            </>
          )}
        </button>
      </div>

      {/* Cost Notice */}
      <p className="text-xs text-slate-500 text-center">
        SMS sent via Twilio • {segmentInfo.segments} segment{segmentInfo.segments !== 1 ? 's' : ''} ≈ ${(segmentInfo.segments * 0.0079).toFixed(4)}
      </p>
    </div>
  );
}

/**
 * Quick SMS Button - Inline button that expands to composer
 */
interface QuickSMSButtonProps {
  leadId: string;
  phone: string;
  ownerName?: string;
  address?: string;
  city?: string;
  distressTypes?: string[];
  onSent?: () => void;
}

export function QuickSMSButton({
  leadId,
  phone,
  ownerName,
  address,
  city,
  distressTypes,
  onSent,
}: QuickSMSButtonProps) {
  const [showComposer, setShowComposer] = useState(false);

  if (!phone) {
    return (
      <button
        disabled
        className="px-3 py-1.5 text-sm rounded-lg bg-slate-600/50 text-slate-500 cursor-not-allowed"
        title="No phone number available"
      >
        <span>📱</span> No Phone
      </button>
    );
  }

  if (showComposer) {
    return (
      <div className="mt-4">
        <SMSComposer
          leadId={leadId}
          phone={phone}
          ownerName={ownerName}
          address={address}
          city={city}
          distressTypes={distressTypes}
          onSent={() => {
            onSent?.();
            setShowComposer(false);
          }}
          onClose={() => setShowComposer(false)}
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowComposer(true)}
      className="px-3 py-1.5 text-sm rounded-lg bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 border border-primary-500/30 flex items-center gap-1"
    >
      <span>📱</span> Send SMS
    </button>
  );
}

/**
 * Bulk SMS Button - For sending to multiple leads
 */
interface BulkSMSButtonProps {
  leadIds: string[];
  onComplete?: () => void;
}

export function BulkSMSButton({ leadIds, onComplete }: BulkSMSButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  useEffect(() => {
    if (showModal) {
      fetchTemplates();
    }
  }, [showModal]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/sms/send');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  const handleSend = async () => {
    if (!selectedTemplateId && !customMessage) return;

    setSending(true);
    try {
      const response = await fetch('/api/sms/send', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds,
          templateId: selectedTemplateId || undefined,
          message: customMessage || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({ sent: data.sent, failed: data.failed });
        onComplete?.();

        setTimeout(() => {
          setShowModal(false);
          setResult(null);
        }, 3000);
      }
    } catch (err) {
      console.error('Bulk SMS error:', err);
    } finally {
      setSending(false);
    }
  };

  if (!showModal) {
    return (
      <button
        onClick={() => setShowModal(true)}
        disabled={leadIds.length === 0}
        className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
          leadIds.length > 0
            ? 'bg-primary-500 text-white hover:bg-primary-400'
            : 'bg-slate-600 text-slate-400 cursor-not-allowed'
        }`}
      >
        📱 SMS {leadIds.length} Lead{leadIds.length !== 1 ? 's' : ''}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-100 rounded-xl border border-slate-700 p-6 max-w-lg w-full space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-lg">
            Bulk SMS Campaign
          </h3>
          <button
            onClick={() => setShowModal(false)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <p className="text-slate-400">
          Send SMS to {leadIds.length} selected lead{leadIds.length !== 1 ? 's' : ''}
        </p>

        <div>
          <label className="block text-sm text-slate-400 mb-2">Template</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => {
              setSelectedTemplateId(e.target.value);
              if (e.target.value) setCustomMessage('');
            }}
            className="input-field"
          >
            <option value="">Select a template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                [{t.category}] {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">Or Custom Message</label>
          <textarea
            value={customMessage}
            onChange={(e) => {
              setCustomMessage(e.target.value);
              if (e.target.value) setSelectedTemplateId('');
            }}
            placeholder="Use {{firstName}}, {{address}}, {{city}} for personalization"
            rows={3}
            className="input-field resize-none"
          />
        </div>

        {result && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3">
            <p className="text-green-400">
              Sent: {result.sent} | Failed: {result.failed}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setShowModal(false)}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || (!selectedTemplateId && !customMessage)}
            className="btn-primary flex-1"
          >
            {sending ? 'Sending...' : `Send to ${leadIds.length} Leads`}
          </button>
        </div>
      </div>
    </div>
  );
}

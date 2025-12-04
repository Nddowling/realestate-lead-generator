'use client';

import { useState } from 'react';

interface SkipTraceButtonProps {
  leadId: string;
  hasPhone?: boolean;
  onSuccess?: (result: SkipTraceResult) => void;
  onError?: (error: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'button' | 'icon';
}

interface SkipTraceResult {
  success: boolean;
  leadId: string;
  phones: { number: string; type: string }[];
  emails: string[];
  confidence: number;
  source: string;
  error?: string;
}

type ButtonState = 'idle' | 'loading' | 'success' | 'error';

export default function SkipTraceButton({
  leadId,
  hasPhone = false,
  onSuccess,
  onError,
  className = '',
  size = 'md',
  variant = 'button',
}: SkipTraceButtonProps) {
  const [state, setState] = useState<ButtonState>('idle');
  const [result, setResult] = useState<SkipTraceResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const iconSizeClasses = {
    sm: 'w-6 h-6 text-sm',
    md: 'w-8 h-8 text-base',
    lg: 'w-10 h-10 text-lg',
  };

  const handleSkipTrace = async () => {
    if (state === 'loading') return;

    setState('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/scrapers/skip-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });

      const data: SkipTraceResult = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Skip trace failed');
      }

      setResult(data);
      setState('success');
      onSuccess?.(data);

      // Reset to idle after 5 seconds
      setTimeout(() => {
        setState('idle');
      }, 5000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(message);
      setState('error');
      onError?.(message);

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setState('idle');
      }, 3000);
    }
  };

  // If already has phone, show a different state
  if (hasPhone && state === 'idle') {
    if (variant === 'icon') {
      return (
        <div
          className={`${iconSizeClasses[size]} flex items-center justify-center rounded-full bg-green-500/20 text-green-400 ${className}`}
          title="Phone number available"
        >
          <span>&#128222;</span>
        </div>
      );
    }
    return (
      <button
        disabled
        className={`${sizeClasses[size]} rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 cursor-default ${className}`}
      >
        <span className="mr-1">&#128222;</span> Has Phone
      </button>
    );
  }

  // Icon variant
  if (variant === 'icon') {
    return (
      <button
        onClick={handleSkipTrace}
        disabled={state === 'loading'}
        className={`
          ${iconSizeClasses[size]}
          flex items-center justify-center rounded-full
          transition-all duration-200
          ${state === 'idle' ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30' : ''}
          ${state === 'loading' ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30 cursor-wait' : ''}
          ${state === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : ''}
          ${state === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : ''}
          ${className}
        `}
        title={
          state === 'idle'
            ? 'Skip Trace'
            : state === 'loading'
            ? 'Searching...'
            : state === 'success'
            ? `Found ${result?.phones.length || 0} phone(s)`
            : errorMessage
        }
      >
        {state === 'idle' && <span>&#128269;</span>}
        {state === 'loading' && (
          <span className="animate-spin">&#9696;</span>
        )}
        {state === 'success' && <span>&#10003;</span>}
        {state === 'error' && <span>&#10007;</span>}
      </button>
    );
  }

  // Button variant
  return (
    <button
      onClick={handleSkipTrace}
      disabled={state === 'loading'}
      className={`
        ${sizeClasses[size]}
        rounded-lg font-medium
        transition-all duration-200
        flex items-center gap-1.5
        ${state === 'idle' ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30' : ''}
        ${state === 'loading' ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30 cursor-wait' : ''}
        ${state === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : ''}
        ${state === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : ''}
        ${className}
      `}
    >
      {state === 'idle' && (
        <>
          <span>&#128269;</span>
          <span>Skip Trace</span>
        </>
      )}

      {state === 'loading' && (
        <>
          <span className="animate-spin">&#9696;</span>
          <span>Searching...</span>
        </>
      )}

      {state === 'success' && (
        <>
          <span>&#10003;</span>
          <span>
            Found {result?.phones.length || 0} phone{(result?.phones.length || 0) !== 1 ? 's' : ''}
            {result?.emails.length ? `, ${result.emails.length} email${result.emails.length !== 1 ? 's' : ''}` : ''}
          </span>
        </>
      )}

      {state === 'error' && (
        <>
          <span>&#10007;</span>
          <span>Failed</span>
        </>
      )}
    </button>
  );
}

/**
 * Batch Skip Trace Button
 * Used for skip tracing multiple leads at once
 */
interface BatchSkipTraceButtonProps {
  leadIds: string[];
  onComplete?: (results: BatchSkipTraceResult) => void;
  className?: string;
}

interface BatchSkipTraceResult {
  success: boolean;
  processed: number;
  successful: number;
  failed: number;
  totalPhonesFound: number;
  totalEmailsFound: number;
}

export function BatchSkipTraceButton({
  leadIds,
  onComplete,
  className = '',
}: BatchSkipTraceButtonProps) {
  const [state, setState] = useState<ButtonState>('idle');
  const [progress, setProgress] = useState<string>('');

  const handleBatchSkipTrace = async () => {
    if (state === 'loading' || leadIds.length === 0) return;

    setState('loading');
    setProgress(`Processing ${leadIds.length} leads...`);

    try {
      const response = await fetch('/api/scrapers/skip-trace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds }),
      });

      const data: BatchSkipTraceResult = await response.json();

      if (!response.ok) {
        throw new Error('Batch skip trace failed');
      }

      setProgress(`Found ${data.totalPhonesFound} phones from ${data.successful} leads`);
      setState('success');
      onComplete?.(data);

      setTimeout(() => {
        setState('idle');
        setProgress('');
      }, 5000);
    } catch (error) {
      setProgress('Batch skip trace failed');
      setState('error');

      setTimeout(() => {
        setState('idle');
        setProgress('');
      }, 3000);
    }
  };

  return (
    <button
      onClick={handleBatchSkipTrace}
      disabled={state === 'loading' || leadIds.length === 0}
      className={`
        px-4 py-2 rounded-lg font-medium
        transition-all duration-200
        flex items-center gap-2
        ${state === 'idle' && leadIds.length > 0 ? 'bg-blue-500 text-white hover:bg-blue-400' : ''}
        ${state === 'idle' && leadIds.length === 0 ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : ''}
        ${state === 'loading' ? 'bg-blue-500/50 text-white cursor-wait' : ''}
        ${state === 'success' ? 'bg-green-500 text-white' : ''}
        ${state === 'error' ? 'bg-red-500 text-white' : ''}
        ${className}
      `}
    >
      {state === 'idle' && (
        <>
          <span>&#128269;</span>
          <span>Skip Trace {leadIds.length} Lead{leadIds.length !== 1 ? 's' : ''}</span>
        </>
      )}

      {state === 'loading' && (
        <>
          <span className="animate-spin">&#9696;</span>
          <span>{progress}</span>
        </>
      )}

      {state === 'success' && (
        <>
          <span>&#10003;</span>
          <span>{progress}</span>
        </>
      )}

      {state === 'error' && (
        <>
          <span>&#10007;</span>
          <span>{progress}</span>
        </>
      )}
    </button>
  );
}

/**
 * Skip Trace Result Display
 * Shows the result of a skip trace
 */
interface SkipTraceResultDisplayProps {
  phones: { number: string; type: string }[];
  emails: string[];
  confidence: number;
}

export function SkipTraceResultDisplay({
  phones,
  emails,
  confidence,
}: SkipTraceResultDisplayProps) {
  return (
    <div className="bg-dark-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">Skip Trace Result</span>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            confidence >= 70
              ? 'bg-green-500/20 text-green-400'
              : confidence >= 40
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {confidence}% confidence
        </span>
      </div>

      {phones.length > 0 && (
        <div>
          <span className="text-xs text-slate-500">Phone Numbers:</span>
          <div className="space-y-1 mt-1">
            {phones.map((phone, i) => (
              <div key={i} className="flex items-center gap-2">
                <a
                  href={`tel:${phone.number}`}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  {formatPhoneNumber(phone.number)}
                </a>
                <span className="text-xs text-slate-500">({phone.type})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {emails.length > 0 && (
        <div>
          <span className="text-xs text-slate-500">Emails:</span>
          <div className="space-y-1 mt-1">
            {emails.map((email, i) => (
              <a
                key={i}
                href={`mailto:${email}`}
                className="text-blue-400 hover:text-blue-300 text-sm block"
              >
                {email}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Format phone number for display
 */
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

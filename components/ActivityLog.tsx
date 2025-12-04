'use client';

import { useState } from 'react';

// Activity types with their icons and labels
export const ACTIVITY_TYPES = {
  call: { icon: '📞', label: 'Call', color: 'text-blue-400' },
  sms_sent: { icon: '💬', label: 'SMS Sent', color: 'text-green-400' },
  sms_received: { icon: '📩', label: 'SMS Received', color: 'text-green-300' },
  email: { icon: '📧', label: 'Email', color: 'text-purple-400' },
  note: { icon: '📝', label: 'Note', color: 'text-yellow-400' },
  status_change: { icon: '🔄', label: 'Status Change', color: 'text-orange-400' },
  skip_trace: { icon: '🔍', label: 'Skip Trace', color: 'text-cyan-400' },
  appointment: { icon: '📅', label: 'Appointment', color: 'text-pink-400' },
  offer_made: { icon: '💵', label: 'Offer Made', color: 'text-emerald-400' },
  contract_signed: { icon: '✍️', label: 'Contract Signed', color: 'text-amber-400' },
} as const;

export type ActivityType = keyof typeof ACTIVITY_TYPES;

export interface Activity {
  id: string;
  type: ActivityType;
  content: string;
  metadata?: Record<string, any>;
  createdBy?: string;
  createdAt: string;
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Single activity item
function ActivityItem({ activity }: { activity: Activity }) {
  const typeInfo = ACTIVITY_TYPES[activity.type] || ACTIVITY_TYPES.note;

  return (
    <div className="flex gap-3 p-3 rounded-lg hover:bg-dark-200/50 transition-colors">
      {/* Icon */}
      <div className="flex-shrink-0 w-8 h-8 bg-dark-200 rounded-full flex items-center justify-center">
        <span className="text-sm">{typeInfo.icon}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className={`text-xs font-medium ${typeInfo.color}`}>
            {typeInfo.label}
          </span>
          <span className="text-xs text-slate-500 flex-shrink-0">
            {formatRelativeTime(activity.createdAt)}
          </span>
        </div>
        <p className="text-slate-300 text-sm mt-1 whitespace-pre-wrap break-words">
          {activity.content}
        </p>
        {activity.createdBy && (
          <p className="text-slate-500 text-xs mt-1">by {activity.createdBy}</p>
        )}
      </div>
    </div>
  );
}

// Add activity form
interface AddActivityFormProps {
  onSubmit: (type: ActivityType, content: string) => Promise<void>;
  isSubmitting: boolean;
}

function AddActivityForm({ onSubmit, isSubmitting }: AddActivityFormProps) {
  const [type, setType] = useState<ActivityType>('note');
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    await onSubmit(type, content.trim());
    setContent('');
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full p-3 border-2 border-dashed border-slate-700 rounded-lg text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors text-sm"
      >
        + Add activity
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-dark-200 rounded-lg p-4 space-y-3">
      {/* Type selector */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Activity Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ActivityType)}
          className="input text-sm"
        >
          {Object.entries(ACTIVITY_TYPES).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Details</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            type === 'call' ? 'Call notes...' :
            type === 'note' ? 'Add a note...' :
            type === 'appointment' ? 'Appointment details...' :
            'Enter details...'
          }
          rows={3}
          className="input text-sm resize-none"
          autoFocus
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => {
            setIsExpanded(false);
            setContent('');
          }}
          className="btn-secondary text-sm py-1.5 px-3"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!content.trim() || isSubmitting}
          className="btn-primary text-sm py-1.5 px-3"
        >
          {isSubmitting ? 'Adding...' : 'Add Activity'}
        </button>
      </div>
    </form>
  );
}

// Main ActivityLog component
interface ActivityLogProps {
  activities: Activity[];
  leadId?: string;
  onAddActivity?: (type: ActivityType, content: string) => Promise<void>;
  showAddForm?: boolean;
  maxItems?: number;
  emptyMessage?: string;
}

export default function ActivityLog({
  activities,
  leadId,
  onAddActivity,
  showAddForm = true,
  maxItems,
  emptyMessage = 'No activities yet',
}: ActivityLogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddActivity = async (type: ActivityType, content: string) => {
    if (!onAddActivity) return;

    setIsSubmitting(true);
    try {
      await onAddActivity(type, content);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayActivities = maxItems ? activities.slice(0, maxItems) : activities;

  return (
    <div className="space-y-3">
      {/* Add activity form */}
      {showAddForm && onAddActivity && (
        <AddActivityForm onSubmit={handleAddActivity} isSubmitting={isSubmitting} />
      )}

      {/* Activity list */}
      {displayActivities.length > 0 ? (
        <div className="divide-y divide-slate-700/50">
          {displayActivities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500 text-sm">
          {emptyMessage}
        </div>
      )}

      {/* Show more indicator */}
      {maxItems && activities.length > maxItems && (
        <p className="text-center text-sm text-slate-400">
          + {activities.length - maxItems} more activities
        </p>
      )}
    </div>
  );
}

// Export individual components for flexibility
export { ActivityItem, AddActivityForm };

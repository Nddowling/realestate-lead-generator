'use client';

import { useState } from 'react';
import Link from 'next/link';

// Types
export interface PipelineLead {
  id: string;
  score: number;
  temperature: 'hot' | 'warm' | 'cold';
  status: string;
  phone?: string;
  lastContactedAt?: string;
  nextFollowUp?: string;
  address: string;
  city: string;
  county: string;
  ownerName?: string;
  distressTypes: string[];
  askingPrice?: number;
  offerAmount?: number;
}

export interface PipelineStage {
  id: string;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

// Default pipeline stages
export const DEFAULT_PIPELINE_STAGES: PipelineStage[] = [
  { id: 'new', label: 'New', icon: '🆕', color: 'border-slate-500', bgColor: 'bg-slate-500/10' },
  { id: 'contacted', label: 'Contacted', icon: '📞', color: 'border-blue-500', bgColor: 'bg-blue-500/10' },
  { id: 'appointment', label: 'Appointment', icon: '📅', color: 'border-purple-500', bgColor: 'bg-purple-500/10' },
  { id: 'offer', label: 'Offer', icon: '💵', color: 'border-orange-500', bgColor: 'bg-orange-500/10' },
  { id: 'contract', label: 'Contract', icon: '📝', color: 'border-yellow-500', bgColor: 'bg-yellow-500/10' },
  { id: 'closed', label: 'Closed', icon: '✅', color: 'border-green-500', bgColor: 'bg-green-500/10' },
];

// Lead card component
function LeadCard({
  lead,
  onDragStart,
  compact = false,
}: {
  lead: PipelineLead;
  onDragStart: (e: React.DragEvent, leadId: string) => void;
  compact?: boolean;
}) {
  const tempColors = {
    hot: 'border-l-red-500',
    warm: 'border-l-orange-500',
    cold: 'border-l-blue-500',
  };

  const isOverdue = lead.nextFollowUp && new Date(lead.nextFollowUp) < new Date();

  return (
    <Link href={`/leads/${lead.id}`}>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, lead.id)}
        className={`bg-dark-200 rounded-lg p-3 border-l-4 ${tempColors[lead.temperature]} cursor-move hover:bg-dark-100 transition-colors mb-3`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm truncate">{lead.address}</p>
            <p className="text-slate-500 text-xs">{lead.city}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-sm">
              {lead.temperature === 'hot' ? '🔥' : lead.temperature === 'warm' ? '🌡️' : '❄️'}
            </span>
            <span className={`text-xs font-bold ${
              lead.temperature === 'hot' ? 'text-red-400' :
              lead.temperature === 'warm' ? 'text-orange-400' : 'text-blue-400'
            }`}>{lead.score}</span>
          </div>
        </div>

        {!compact && (
          <>
            {/* Owner */}
            {lead.ownerName && (
              <p className="text-slate-400 text-xs mb-2 truncate">{lead.ownerName}</p>
            )}

            {/* Distress badges */}
            {lead.distressTypes.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {lead.distressTypes.slice(0, 2).map((type, i) => (
                  <span key={i} className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded">
                    {type.replace('_', ' ').replace('tax delinquent', 'Tax').replace('pre foreclosure', 'Pre-FC').replace('foreclosure', 'FC')}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs">
          {/* Contact status */}
          <div className="flex items-center gap-2">
            {lead.phone ? (
              <span className="text-green-400">📱</span>
            ) : (
              <span className="text-slate-500">No phone</span>
            )}
            {isOverdue && (
              <span className="text-red-400 flex items-center gap-1">
                ⚠️ Overdue
              </span>
            )}
          </div>

          {/* Price */}
          {(lead.offerAmount || lead.askingPrice) ? (
            <span className="text-primary-400 font-medium">
              ${((lead.offerAmount ?? lead.askingPrice ?? 0) / 1000).toFixed(0)}k
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

// Pipeline column component
function PipelineColumn({
  stage,
  leads,
  onDragStart,
  onDragOver,
  onDrop,
  isDropTarget,
  compact = false,
}: {
  stage: PipelineStage;
  leads: PipelineLead[];
  onDragStart: (e: React.DragEvent, leadId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: string) => void;
  isDropTarget: boolean;
  compact?: boolean;
}) {
  const totalValue = leads.reduce((sum, lead) => sum + (lead.offerAmount || lead.askingPrice || 0), 0);

  return (
    <div
      className={`flex-1 min-w-[280px] ${stage.bgColor} rounded-xl border-2 ${
        isDropTarget ? 'border-primary-500 border-dashed' : `${stage.color} border-opacity-30`
      } transition-colors`}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, stage.id)}
    >
      {/* Column header */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">{stage.icon}</span>
            <h3 className="text-white font-semibold">{stage.label}</h3>
          </div>
          <span className="bg-dark-200 text-white text-sm font-bold px-2 py-0.5 rounded-full">
            {leads.length}
          </span>
        </div>
        {totalValue > 0 && (
          <p className="text-slate-400 text-xs">
            ${(totalValue / 1000).toFixed(0)}k potential
          </p>
        )}
      </div>

      {/* Cards */}
      <div className="p-3 max-h-[calc(100vh-300px)] overflow-y-auto">
        {leads.length > 0 ? (
          leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onDragStart={onDragStart} compact={compact} />
          ))
        ) : (
          <div className="text-center py-8 text-slate-500 text-sm">
            No leads
          </div>
        )}
      </div>
    </div>
  );
}

// Main PipelineBoard component
interface PipelineBoardProps {
  leads: PipelineLead[];
  stages?: PipelineStage[];
  onStatusChange: (leadId: string, newStatus: string) => Promise<boolean>;
  compact?: boolean;
}

export default function PipelineBoard({
  leads,
  stages = DEFAULT_PIPELINE_STAGES,
  onStatusChange,
  compact = false,
}: PipelineBoardProps) {
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<string | null>(null);

  // Group leads by status
  const leadsByStatus: Record<string, PipelineLead[]> = {};
  for (const stage of stages) {
    leadsByStatus[stage.id] = leads.filter((lead) => lead.status === stage.id);
  }

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDropTargetStatus(status);
  };

  // Handle drop
  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDropTargetStatus(null);

    if (!draggedLeadId) return;

    const lead = leads.find((l) => l.id === draggedLeadId);
    if (!lead || lead.status === newStatus) {
      setDraggedLeadId(null);
      return;
    }

    // Call the status change handler
    await onStatusChange(draggedLeadId, newStatus);
    setDraggedLeadId(null);
  };

  // Handle drag end (cleanup)
  const handleDragEnd = () => {
    setDraggedLeadId(null);
    setDropTargetStatus(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" onDragEnd={handleDragEnd}>
      {stages.map((stage) => (
        <PipelineColumn
          key={stage.id}
          stage={stage}
          leads={leadsByStatus[stage.id] || []}
          onDragStart={handleDragStart}
          onDragOver={(e) => handleDragOver(e, stage.id)}
          onDrop={handleDrop}
          isDropTarget={dropTargetStatus === stage.id}
          compact={compact}
        />
      ))}
    </div>
  );
}

// Export LeadCard for use elsewhere
export { LeadCard };

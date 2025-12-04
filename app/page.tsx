'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Types
interface DashboardStats {
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  contactedThisWeek: number;
  followUpsToday: number;
  pipeline: {
    new: number;
    contacted: number;
    appointment: number;
    offer: number;
    contract: number;
    closed: number;
  };
}

interface HotLead {
  id: string;
  score: number;
  phone?: string;
  status: string;
  address: string;
  city: string;
  county: string;
  ownerName?: string;
  distressTypes: string[];
  lastContacted?: string;
}

interface Activity {
  id: string;
  type: string;
  content: string;
  leadId: string;
  leadAddress?: string;
  createdAt: string;
}

interface FollowUp {
  id: string;
  address: string;
  city: string;
  ownerName?: string;
  phone?: string;
  nextFollowUp: string;
  status: string;
}

// Stat Card Component
function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = 'primary',
  onClick,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color?: 'primary' | 'red' | 'orange' | 'blue' | 'purple' | 'green';
  onClick?: () => void;
}) {
  const colorClasses = {
    primary: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  return (
    <div
      className={`card ${onClick ? 'cursor-pointer hover:border-slate-600 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${colorClasses[color]}`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}

// Pipeline Stage Card
function PipelineStage({
  stage,
  count,
  icon,
  color,
}: {
  stage: string;
  count: number;
  icon: string;
  color: string;
}) {
  return (
    <div className={`flex flex-col items-center p-4 rounded-lg ${color}`}>
      <span className="text-2xl mb-1">{icon}</span>
      <span className="text-2xl font-bold text-white">{count}</span>
      <span className="text-xs text-slate-400 text-center">{stage}</span>
    </div>
  );
}

// Hot Lead Card
function HotLeadCard({ lead }: { lead: HotLead }) {
  const typeLabels: Record<string, string> = {
    tax_delinquent: 'Tax',
    pre_foreclosure: 'Pre-FC',
    foreclosure: 'FC',
    probate: 'Probate',
    vacant: 'Vacant',
    code_violation: 'Code',
  };

  return (
    <Link href={`/leads/${lead.id}`}>
      <div className="card-hover flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">{lead.address}</p>
          <p className="text-slate-500 text-sm">{lead.city}, {lead.county}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {lead.distressTypes.slice(0, 3).map((type, i) => (
              <span key={i} className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">
                {typeLabels[type] || type}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right ml-4">
          <div className="flex items-center gap-1 text-red-400">
            <span className="text-xl">🔥</span>
            <span className="font-bold text-xl">{lead.score}</span>
          </div>
          {lead.phone ? (
            <span className="text-xs text-green-400">Has Phone</span>
          ) : (
            <span className="text-xs text-slate-500">Needs Skip Trace</span>
          )}
        </div>
      </div>
    </Link>
  );
}

// Activity Item
function ActivityItem({ activity }: { activity: Activity }) {
  const typeConfig: Record<string, { icon: string; color: string }> = {
    call: { icon: '📞', color: 'text-blue-400' },
    sms_sent: { icon: '📤', color: 'text-green-400' },
    sms_received: { icon: '📥', color: 'text-purple-400' },
    email: { icon: '📧', color: 'text-orange-400' },
    note: { icon: '📝', color: 'text-slate-400' },
    status_change: { icon: '🔄', color: 'text-yellow-400' },
    skip_trace: { icon: '🔍', color: 'text-cyan-400' },
    appointment: { icon: '📅', color: 'text-pink-400' },
    offer_made: { icon: '💵', color: 'text-green-400' },
    contract_signed: { icon: '📄', color: 'text-emerald-400' },
  };

  const config = typeConfig[activity.type] || { icon: '•', color: 'text-slate-400' };
  const timeAgo = getTimeAgo(activity.createdAt);

  return (
    <div className="flex items-start gap-3 p-3 bg-dark-200 rounded-lg">
      <span className="text-xl">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm">{activity.content}</p>
        {activity.leadAddress && (
          <p className="text-slate-500 text-xs truncate">{activity.leadAddress}</p>
        )}
      </div>
      <span className="text-slate-500 text-xs whitespace-nowrap">{timeAgo}</span>
    </div>
  );
}

// Follow-up Item
function FollowUpItem({ followUp }: { followUp: FollowUp }) {
  const isOverdue = new Date(followUp.nextFollowUp) < new Date();

  return (
    <Link href={`/leads/${followUp.id}`}>
      <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
        isOverdue ? 'bg-red-500/10 hover:bg-red-500/20' : 'bg-dark-200 hover:bg-dark-100'
      }`}>
        <span className="text-xl">{isOverdue ? '⚠️' : '📅'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm truncate">{followUp.address}</p>
          <p className="text-slate-500 text-xs">
            {followUp.ownerName || followUp.city}
          </p>
        </div>
        <div className="text-right">
          <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
            {formatFollowUpTime(followUp.nextFollowUp)}
          </span>
          {followUp.phone && (
            <a
              href={`tel:${followUp.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="block text-primary-400 text-xs mt-1 hover:underline"
            >
              Call now
            </a>
          )}
        </div>
      </div>
    </Link>
  );
}

// Helper: Time ago
function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
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

// Helper: Format follow-up time
function formatFollowUpTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (date < now) return 'Overdue';
  if (isToday) return `Today ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (isTomorrow) return 'Tomorrow';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    hotLeads: 0,
    warmLeads: 0,
    coldLeads: 0,
    contactedThisWeek: 0,
    followUpsToday: 0,
    pipeline: { new: 0, contacted: 0, appointment: 0, offer: 0, contract: 0, closed: 0 },
  });
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch dashboard data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();

        if (data.success) {
          setStats(data.stats);
          setHotLeads(data.hotLeads || []);
          setActivities(data.recentActivities || []);
          setFollowUps(data.upcomingFollowUps || []);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/leads" className="btn-secondary flex items-center gap-2">
            📋 All Leads
          </Link>
          <Link href="/analyzer" className="btn-primary flex items-center gap-2">
            🔢 Analyze Deal
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Total Leads"
          value={stats.totalLeads}
          icon="🎯"
          color="primary"
        />
        <StatCard
          title="Hot Leads"
          value={stats.hotLeads}
          subtitle={`${stats.warmLeads} warm`}
          icon="🔥"
          color="red"
        />
        <StatCard
          title="Contacted"
          value={stats.contactedThisWeek}
          subtitle="This week"
          icon="📞"
          color="blue"
        />
        <StatCard
          title="Follow-ups"
          value={stats.followUpsToday}
          subtitle="Due today"
          icon="📅"
          color="purple"
        />
        <StatCard
          title="In Pipeline"
          value={stats.pipeline.offer + stats.pipeline.contract}
          subtitle="Offers + Contracts"
          icon="💰"
          color="orange"
        />
        <StatCard
          title="Closed"
          value={stats.pipeline.closed}
          subtitle="All time"
          icon="✅"
          color="green"
        />
      </div>

      {/* Pipeline Overview */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span>📊</span> Pipeline Overview
        </h2>
        <div className="grid grid-cols-6 gap-2">
          <PipelineStage stage="New" count={stats.pipeline.new} icon="🆕" color="bg-slate-700/50" />
          <PipelineStage stage="Contacted" count={stats.pipeline.contacted} icon="📞" color="bg-blue-500/20" />
          <PipelineStage stage="Appointment" count={stats.pipeline.appointment} icon="📅" color="bg-purple-500/20" />
          <PipelineStage stage="Offer" count={stats.pipeline.offer} icon="💵" color="bg-orange-500/20" />
          <PipelineStage stage="Contract" count={stats.pipeline.contract} icon="📝" color="bg-yellow-500/20" />
          <PipelineStage stage="Closed" count={stats.pipeline.closed} icon="✅" color="bg-green-500/20" />
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hot Leads */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>🔥</span> Hot Leads
            </h2>
            <Link href="/leads?temperature=hot" className="text-primary-400 text-sm hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="card text-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : hotLeads.length > 0 ? (
              hotLeads.slice(0, 5).map((lead) => (
                <HotLeadCard key={lead.id} lead={lead} />
              ))
            ) : (
              <div className="card text-center py-8">
                <span className="text-3xl mb-2 block">📭</span>
                <p className="text-slate-500 text-sm">No hot leads yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Follow-ups Due */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>📅</span> Follow-ups Due
            </h2>
            <Link href="/leads?hasFollowUp=true" className="text-primary-400 text-sm hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {loading ? (
              <div className="card text-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : followUps.length > 0 ? (
              followUps.slice(0, 5).map((followUp) => (
                <FollowUpItem key={followUp.id} followUp={followUp} />
              ))
            ) : (
              <div className="card text-center py-8">
                <span className="text-3xl mb-2 block">✨</span>
                <p className="text-slate-500 text-sm">No follow-ups due</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>⚡</span> Recent Activity
            </h2>
          </div>
          <div className="space-y-2">
            {loading ? (
              <div className="card text-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : activities.length > 0 ? (
              activities.slice(0, 5).map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))
            ) : (
              <div className="card text-center py-8">
                <span className="text-3xl mb-2 block">📝</span>
                <p className="text-slate-500 text-sm">No recent activity</p>
                <p className="text-slate-600 text-xs mt-1">Start by contacting a lead</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>⚡</span> Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/leads?temperature=hot&!phone" className="card-hover text-center">
            <span className="text-3xl">🔍</span>
            <p className="text-white font-medium mt-2">Skip Trace</p>
            <p className="text-slate-500 text-sm">Find phone numbers</p>
          </Link>
          <Link href="/leads?temperature=hot" className="card-hover text-center">
            <span className="text-3xl">📱</span>
            <p className="text-white font-medium mt-2">SMS Campaign</p>
            <p className="text-slate-500 text-sm">Text hot leads</p>
          </Link>
          <Link href="/analyzer" className="card-hover text-center">
            <span className="text-3xl">🔢</span>
            <p className="text-white font-medium mt-2">Analyze Deal</p>
            <p className="text-slate-500 text-sm">Calculate MAO</p>
          </Link>
          <Link href="/pipeline" className="card-hover text-center">
            <span className="text-3xl">📊</span>
            <p className="text-white font-medium mt-2">Pipeline</p>
            <p className="text-slate-500 text-sm">Manage deals</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

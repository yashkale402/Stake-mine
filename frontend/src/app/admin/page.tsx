'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import { ShieldCheck, Save, Clock, Database, Wallet, Activity, Users, LineChart } from 'lucide-react';

interface GlobalConfig {
  config_key: string;
  config_value: any;
  version: number;
}

interface SlotConfig {
  id: number;
  slot_name: string;
  start_hour: number;
  end_hour: number;
  budget_paise: number;
  pacing_strategy: string;
}

interface AdminSummary {
  userMetrics: {
    total_users: number;
    total_players: number;
    total_admins: number;
    active_users: number;
    total_balance_paise: number;
  };
  gameMetrics: {
    active_games: number;
    lifetime_sessions: number;
    settled_games: number;
    total_wagered_paise: number;
    total_paid_paise: number;
    net_house_paise: number;
    average_multiplier: number;
    outcomes: Record<string, number>;
  };
  slotMetrics: {
    total_slots: number;
    total_budget_paise: number;
  };
  kpis: {
    retention_pct: number;
    arpu_paise: number;
    wager_volume_paise: number;
    payout_ratio_pct: number;
    churn_risk_pct: number;
    active_7d: number;
    active_30d: number;
  };
  experiments: Array<{
    id: string;
    status: string;
    variants: string[];
  }>;
}

interface PlayerRow {
  id: number;
  username: string;
  email: string;
  balance_paise: number;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AuditRow {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, isHydrated, user } = useAuthStore();
  const [configs, setConfigs] = useState<GlobalConfig[]>([]);
  const [slots, setSlots] = useState<SlotConfig[]>([]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [history, setHistory] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, configRes, slotRes, playersRes, historyRes]: any[] = await Promise.all([
        api.get('/admin/summary'),
        api.get('/admin/config'),
        api.get('/admin/slots'),
        api.get('/admin/players'),
        api.get('/admin/config-history'),
      ]);
      setSummary(summaryRes.data || null);
      setConfigs(configRes.data || []);
      setSlots(slotRes.data || []);
      setPlayers(playersRes.data || []);
      setHistory(historyRes.data || []);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isHydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [mounted, isHydrated, isAuthenticated, router]);

  useEffect(() => {
    if (mounted && isHydrated && isAuthenticated && user && user.role !== 'ADMIN') {
      router.replace('/');
    }
  }, [mounted, isHydrated, isAuthenticated, user, router]);

  useEffect(() => {
    if (mounted && isHydrated && isAuthenticated && user?.role === 'ADMIN') {
      fetchData();
    }
  }, [mounted, isHydrated, isAuthenticated, user]);

  if (!mounted || !isHydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-stake-text">
        Loading Admin Control Panel...
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'ADMIN') return null;

  const handleSaveConfig = async (key: string) => {
    try {
      let parsedValue: any = editValue;
      try {
        parsedValue = JSON.parse(editValue);
      } catch {
        // Keep as string if not valid JSON.
      }

      await api.put('/admin/config', { key, value: parsedValue });
      setMessage(`Updated ${key}`);
      setEditingKey(null);
      fetchData();
    } catch (err: any) {
      setMessage(`Failed to update ${key}: ${err.message}`);
    }
  };

  return (
    <div className="mx-auto max-w-6xl animate-float-in space-y-8 py-2">
      <div className="hero-shell rounded-[28px] border border-white/8 px-6 py-6">
        <p className="label-caps mb-1 text-stake-accent">Runtime Control</p>
        <h1 className="font-display text-2xl font-extrabold text-white">Admin Panel</h1>
        <p className="mt-1 text-sm text-stake-text">
          Live dashboard, player visibility, config audit trail, slot analytics, and A/B-ready KPI reporting.
        </p>
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={<Users className="h-5 w-5 text-stake-accent" />} label="Players" value={String(summary.userMetrics.total_players)} meta={`${summary.userMetrics.active_users} active accounts`} />
            <SummaryCard icon={<Activity className="h-5 w-5 text-cyan-300" />} label="Live Games" value={String(summary.gameMetrics.active_games)} meta={`${summary.gameMetrics.lifetime_sessions} total sessions`} />
            <SummaryCard icon={<Wallet className="h-5 w-5 text-stake-gold" />} label="Wagered" value={`Rs ${(summary.gameMetrics.total_wagered_paise / 100).toFixed(2)}`} meta={`Payout ratio ${summary.kpis.payout_ratio_pct}%`} />
            <SummaryCard icon={<ShieldCheck className="h-5 w-5 text-emerald-300" />} label="House Net" value={`Rs ${(summary.gameMetrics.net_house_paise / 100).toFixed(2)}`} meta={`Churn risk ${summary.kpis.churn_risk_pct}%`} />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="panel p-5">
              <div className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
                <LineChart className="h-5 w-5 text-stake-gold" /> KPI Snapshot
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <MetricTile label="Retention" value={`${summary.kpis.retention_pct}%`} />
                <MetricTile label="ARPU" value={`Rs ${(summary.kpis.arpu_paise / 100).toFixed(2)}`} />
                <MetricTile label="7D Active" value={String(summary.kpis.active_7d)} />
                <MetricTile label="30D Active" value={String(summary.kpis.active_30d)} />
              </div>
            </div>

            <div className="panel p-5">
              <div className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
                <ShieldCheck className="h-5 w-5 text-stake-gold" /> Experiments
              </div>
              <div className="space-y-3">
                {summary.experiments.map((experiment) => (
                  <div key={experiment.id} className="rounded-2xl border border-white/6 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-white">{experiment.id}</p>
                      <span className="rounded-full bg-stake-accent/10 px-2.5 py-1 text-[11px] font-bold text-stake-accent">
                        {experiment.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-stake-text">Variants: {experiment.variants.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {message && (
        <div className="rounded-xl border border-stake-accent/30 bg-stake-accent/10 p-4 text-sm font-semibold text-stake-accent">
          {message}
        </div>
      )}

      <div className="panel p-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
          <Database className="h-5 w-5 text-stake-gold" /> Global Configuration
        </h2>

        {loading ? (
          <p className="text-stake-text">Loading...</p>
        ) : (
          <div className="divide-y divide-white/5">
            {configs.map((item) => (
              <div key={item.config_key} className="flex flex-col justify-between gap-4 py-4 md:flex-row md:items-center">
                <div>
                  <span className="block font-mono text-sm font-bold text-white">{item.config_key}</span>
                  <span className="text-xs text-stake-text">Version {item.version}</span>
                </div>

                <div className="flex w-full items-center gap-3 md:w-auto">
                  {editingKey === item.config_key ? (
                    <div className="flex w-full items-center gap-2 md:w-auto">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="input-field w-full font-mono text-sm md:w-64 !py-2"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveConfig(item.config_key)}
                        className="rounded-xl bg-stake-accent p-2 text-stake-dark transition hover:bg-stake-accentHover"
                        title="Save"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <code className="rounded-lg border border-white/5 bg-stake-dark px-3 py-1.5 font-mono text-sm text-stake-accent">
                        {JSON.stringify(item.config_value)}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingKey(item.config_key);
                          setEditValue(typeof item.config_value === 'object' ? JSON.stringify(item.config_value) : String(item.config_value));
                        }}
                        className="rounded-lg bg-stake-cardHover px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#274556]"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="panel p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
            <Clock className="h-5 w-5 text-emerald-400" /> Time Slot Budgets
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {slots.map((slot) => (
              <div key={slot.id} className="panel-inset p-4">
                <h3 className="mb-1 font-display font-bold text-white">{slot.slot_name}</h3>
                <p className="mb-3 text-xs text-stake-text">
                  {String(slot.start_hour).padStart(2, '0')}:00 - {String(slot.end_hour).padStart(2, '0')}:00
                </p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-stake-text">Budget</span>
                    <span className="font-bold text-stake-gold">Rs {(slot.budget_paise / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stake-text">Pacing</span>
                    <span className="font-bold text-stake-accent">{slot.pacing_strategy}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
            <Users className="h-5 w-5 text-stake-accent" /> Recent Players
          </h2>
          <div className="space-y-3">
            {players.map((player) => (
              <div key={player.id} className="rounded-2xl border border-white/6 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{player.username}</p>
                    <p className="text-xs text-stake-text">{player.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-stake-gold">Rs {(player.balance_paise / 100).toFixed(2)}</p>
                    <p className="text-xs text-stake-text">{player.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
          <Database className="h-5 w-5 text-stake-gold" /> Config History
        </h2>
        <div className="space-y-3">
          {history.map((row) => (
            <div key={row.id} className="rounded-2xl border border-white/6 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{row.entity_id}</p>
                  <p className="text-xs text-stake-text">{row.action} by {row.actor}</p>
                </div>
                <p className="text-xs text-stake-text">{new Date(row.created_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  meta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="panel overflow-hidden p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04]">
        {icon}
      </div>
      <p className="label-caps mb-1">{label}</p>
      <p className="font-display text-2xl font-extrabold text-white">{value}</p>
      <p className="mt-1 text-xs text-stake-text">{meta}</p>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-3">
      <p className="label-caps mb-1">{label}</p>
      <p className="font-display text-lg font-bold text-white">{value}</p>
    </div>
  );
}

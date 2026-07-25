'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import {
  ShieldCheck, Save, Clock, Database, Wallet, Activity,
  Users, LineChart, Ban, CheckCircle, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, isHydrated, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<'overview'|'players'|'slots'|'config'|'logs'>('overview');
  const [summary, setSummary] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{text:string; ok:boolean}|null>(null);
  const [editingConfig, setEditingConfig] = useState<string|null>(null);
  const [editConfigVal, setEditConfigVal] = useState('');
  const [editingSlot, setEditingSlot] = useState<number|null>(null);
  const [editSlot, setEditSlot] = useState<any>({});
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [balanceAdj, setBalanceAdj] = useState('');
  const [balanceReason, setBalanceReason] = useState('');

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (mounted && isHydrated && !isAuthenticated) router.push('/login');
  }, [mounted, isHydrated, isAuthenticated, router]);
  useEffect(() => {
    if (mounted && isHydrated && isAuthenticated && user && user.role !== 'ADMIN') router.replace('/');
  }, [mounted, isHydrated, isAuthenticated, user, router]);

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };

  const load = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'ADMIN') return;
    setLoading(true);
    try {
      const [sumRes, playRes, slotRes, budRes, cfgRes, logRes]: any[] = await Promise.all([
        api.get('/admin/summary'),
        api.get('/admin/players'),
        api.get('/admin/slots'),
        api.get('/admin/slots/budget-status'),
        api.get('/admin/config'),
        api.get('/admin/config-history'),
      ]);
      setSummary(sumRes.data);
      setPlayers(playRes.data || []);
      setSlots(slotRes.data || []);
      setBudgetStatus(budRes.data || []);
      setConfigs(cfgRes.data || []);
      setLogs(logRes.data || []);
    } catch { flash('Failed to load data', false); }
    finally { setLoading(false); }
  }, [isAuthenticated, user]);

  useEffect(() => { if (mounted && isHydrated && isAuthenticated && user?.role === 'ADMIN') load(); }, [mounted, isHydrated, isAuthenticated, user, load]);

  if (!mounted || !isHydrated || !isAuthenticated || user?.role !== 'ADMIN') return null;

  const handleSaveConfig = async (key: string) => {
    try {
      let val: any = editConfigVal;
      try { val = JSON.parse(editConfigVal); } catch {}
      await api.put('/admin/config', { key, value: val });
      flash(`Updated ${key}`);
      setEditingConfig(null);
      load();
    } catch (e: any) { flash(e.message, false); }
  };

  const handleSaveSlot = async (id: number) => {
    try {
      await api.put(`/admin/slots/${id}`, editSlot);
      flash('Slot updated');
      setEditingSlot(null);
      load();
    } catch (e: any) { flash(e.message, false); }
  };

  const handleSuspend = async (id: number) => {
    try {
      await api.post(`/admin/players/${id}/suspend`, {});
      flash('Player suspended');
      load();
      if (selectedPlayer?.user?.id === id) setSelectedPlayer((p: any) => ({ ...p, user: { ...p.user, status: 'SUSPENDED' } }));
    } catch (e: any) { flash(e.message, false); }
  };

  const handleActivate = async (id: number) => {
    try {
      await api.post(`/admin/players/${id}/activate`, {});
      flash('Player activated');
      load();
      if (selectedPlayer?.user?.id === id) setSelectedPlayer((p: any) => ({ ...p, user: { ...p.user, status: 'ACTIVE' } }));
    } catch (e: any) { flash(e.message, false); }
  };

  const handleBalanceAdj = async (id: number) => {
    try {
      const paise = Math.round(parseFloat(balanceAdj) * 100);
      await api.post(`/admin/players/${id}/balance`, { amountPaise: paise, reason: balanceReason });
      flash('Balance adjusted');
      setBalanceAdj(''); setBalanceReason('');
      load();
    } catch (e: any) { flash(e.message, false); }
  };

  const loadPlayerDetail = async (id: number) => {
    try {
      const res: any = await api.get(`/admin/players/${id}`);
      setSelectedPlayer(res.data);
    } catch (e: any) { flash(e.message, false); }
  };

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'players',  label: 'Players' },
    { key: 'slots',    label: 'Slots & Budget' },
    { key: 'config',   label: 'Config' },
    { key: 'logs',     label: 'Audit Logs' },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl animate-float-in space-y-6 py-2">
      {/* Header */}
      <div className="hero-shell rounded-[28px] border border-white/8 px-6 py-5 flex items-center justify-between">
        <div>
          <p className="label-caps mb-1 text-stake-accent">Admin Control Panel</p>
          <h1 className="font-display text-2xl font-extrabold text-white">Stake Mine — Management</h1>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-stake-text hover:text-white transition">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Flash message */}
      {msg && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${msg.ok ? 'border-stake-accent/30 bg-stake-accent/10 text-stake-accent' : 'border-rose-500/30 bg-rose-950/50 text-rose-300'}`}>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-white/5 bg-stake-dark/70 p-1.5">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${tab === t.key ? 'bg-stake-accent text-stake-dark' : 'text-stake-text hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="panel p-8 text-center text-stake-text">Loading...</div>}

      {/* ── OVERVIEW ── */}
      {!loading && tab === 'overview' && summary && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <KpiCard icon={<Users className="h-5 w-5 text-stake-accent"/>} label="Players" value={String(summary.userMetrics?.total_players || 0)} sub={`${summary.userMetrics?.active_users || 0} active`}/>
            <KpiCard icon={<Activity className="h-5 w-5 text-cyan-300"/>} label="Live Games" value={String(summary.gameMetrics?.active_games || 0)} sub={`${summary.gameMetrics?.lifetime_sessions || 0} total`}/>
            <KpiCard icon={<Wallet className="h-5 w-5 text-stake-gold"/>} label="Total Wagered" value={`₹${((summary.gameMetrics?.total_wagered_paise||0)/100).toFixed(0)}`} sub={`Payout ${summary.kpis?.payout_ratio_pct||0}%`}/>
            <KpiCard icon={<ShieldCheck className="h-5 w-5 text-emerald-300"/>} label="House Net" value={`₹${((summary.gameMetrics?.net_house_paise||0)/100).toFixed(0)}`} sub={`Churn risk ${summary.kpis?.churn_risk_pct||0}%`}/>
          </div>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <KpiCard icon={<LineChart className="h-5 w-5 text-stake-gold"/>} label="Retention" value={`${summary.kpis?.retention_pct||0}%`} sub="30-day"/>
            <KpiCard icon={<LineChart className="h-5 w-5 text-stake-gold"/>} label="ARPU" value={`₹${((summary.kpis?.arpu_paise||0)/100).toFixed(0)}`} sub="per player"/>
            <KpiCard icon={<Activity className="h-5 w-5 text-cyan-300"/>} label="7D Active" value={String(summary.kpis?.active_7d||0)} sub="players"/>
            <KpiCard icon={<Activity className="h-5 w-5 text-cyan-300"/>} label="30D Active" value={String(summary.kpis?.active_30d||0)} sub="players"/>
          </div>
        </div>
      )}

      {/* ── PLAYERS ── */}
      {!loading && tab === 'players' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="panel p-5">
            <h2 className="mb-4 font-display text-lg font-bold text-white flex items-center gap-2"><Users className="h-5 w-5 text-stake-accent"/> Players</h2>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {players.map(p => (
                <div key={p.id} onClick={() => loadPlayerDetail(p.id)}
                  className={`cursor-pointer rounded-xl border p-3 transition hover:border-stake-accent/30 ${selectedPlayer?.user?.id === p.id ? 'border-stake-accent/40 bg-stake-accent/5' : 'border-white/5 bg-white/[0.02]'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{p.username}</p>
                      <p className="text-xs text-stake-text">{p.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-stake-gold">₹{(p.balance_paise/100).toFixed(2)}</p>
                      <span className={`text-xs font-bold ${p.status === 'ACTIVE' ? 'text-stake-accent' : 'text-rose-400'}`}>{p.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedPlayer && (
            <div className="panel p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-white">{selectedPlayer.user.username}</h2>
                <div className="flex gap-2">
                  {selectedPlayer.user.status === 'ACTIVE'
                    ? <button onClick={() => handleSuspend(selectedPlayer.user.id)} className="flex items-center gap-1 rounded-lg bg-rose-950 border border-rose-800 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-900 transition"><Ban className="h-3.5 w-3.5"/> Suspend</button>
                    : <button onClick={() => handleActivate(selectedPlayer.user.id)} className="flex items-center gap-1 rounded-lg bg-emerald-950 border border-emerald-800 px-3 py-1.5 text-xs font-bold text-stake-accent hover:bg-emerald-900 transition"><CheckCircle className="h-3.5 w-3.5"/> Activate</button>
                  }
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <StatBox label="Total Games" value={String(selectedPlayer.stats?.total_games||0)}/>
                <StatBox label="Cashouts" value={String(selectedPlayer.stats?.cashouts||0)}/>
                <StatBox label="Losses" value={String(selectedPlayer.stats?.losses||0)}/>
                <StatBox label="Net P&L" value={`₹${((selectedPlayer.stats?.net_profit_paise||0)/100).toFixed(2)}`}/>
                <StatBox label="Total Wagered" value={`₹${((selectedPlayer.stats?.total_wagered_paise||0)/100).toFixed(2)}`}/>
                <StatBox label="Balance" value={`₹${(selectedPlayer.user.balance_paise/100).toFixed(2)}`}/>
              </div>

              <div className="rounded-xl border border-white/5 bg-stake-dark/60 p-3">
                <p className="label-caps mb-2">Adjust Balance (₹)</p>
                <div className="flex gap-2">
                  <input type="number" placeholder="e.g. 100 or -50" value={balanceAdj} onChange={e => setBalanceAdj(e.target.value)}
                    className="input-field !py-2 text-sm flex-1"/>
                  <input type="text" placeholder="Reason" value={balanceReason} onChange={e => setBalanceReason(e.target.value)}
                    className="input-field !py-2 text-sm flex-1"/>
                  <button onClick={() => handleBalanceAdj(selectedPlayer.user.id)}
                    className="rounded-xl bg-stake-accent px-3 py-2 text-xs font-bold text-stake-dark hover:bg-stake-accentHover transition">
                    Apply
                  </button>
                </div>
              </div>

              {selectedPlayer.history?.length > 0 && (
                <div>
                  <p className="label-caps mb-2">Recent Games</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {selectedPlayer.history.map((h: any) => (
                      <div key={h.game_uuid} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
                        <span className="text-stake-text">{h.mine_count} mines · {h.cells_revealed} reveals</span>
                        <span className={`font-bold ${h.outcome === 'LOSS' ? 'text-rose-400' : 'text-stake-accent'}`}>{h.outcome}</span>
                        <span className="text-stake-gold">₹{(h.payout_paise/100).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── SLOTS & BUDGET ── */}
      {!loading && tab === 'slots' && (
        <div className="space-y-4">
          <p className="text-sm text-stake-text">Budget is shared across ALL players per slot window. The risk engine tightens mines automatically as budget is consumed.</p>
          {budgetStatus.map((slot: any) => {
            const isEditing = editingSlot === slot.id;
            return (
              <div key={slot.id} className="panel p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-display font-bold text-white text-lg">{slot.slot_name}</p>
                    <p className="text-xs text-stake-text">{String(slot.start_hour).padStart(2,'0')}:00 – {String(slot.end_hour).padStart(2,'0')}:00 · {slot.is_active ? <span className="text-stake-accent">Active</span> : <span className="text-rose-400">Inactive</span>}</p>
                  </div>
                  <button onClick={() => { setEditingSlot(isEditing ? null : slot.id); setEditSlot({ budget_paise: slot.budget_paise, slot_name: slot.slot_name, is_active: slot.is_active }); }}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition flex items-center gap-1">
                    {isEditing ? <><ChevronUp className="h-3.5 w-3.5"/> Cancel</> : <><ChevronDown className="h-3.5 w-3.5"/> Edit</>}
                  </button>
                </div>

                {/* Budget bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stake-text">Budget used: <span className="font-bold text-white">{slot.spent_pct}%</span></span>
                    <span className="text-stake-text">₹{(slot.spent_paise/100).toFixed(0)} / ₹{(slot.total_budget_paise/100).toFixed(0)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${slot.spent_pct >= 90 ? 'bg-rose-500' : slot.spent_pct >= 70 ? 'bg-amber-400' : 'bg-stake-accent'}`}
                      style={{ width: `${slot.spent_pct}%` }}/>
                  </div>
                  <p className="mt-1 text-xs text-stake-text">
                    Remaining: <span className="font-bold text-stake-gold">₹{(slot.remaining_paise/100).toFixed(0)}</span>
                    {' · '}{slot.game_count} games today
                    {slot.spent_pct >= 90 && <span className="ml-2 text-rose-400 font-bold">⚠ CRITICAL — mines auto-tightened</span>}
                    {slot.spent_pct >= 70 && slot.spent_pct < 90 && <span className="ml-2 text-amber-400 font-bold">⚠ HIGH — mines tightened</span>}
                  </p>
                </div>

                {isEditing && (
                  <div className="rounded-xl border border-white/5 bg-stake-dark/60 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label-caps mb-1 block">Slot Name</label>
                        <input className="input-field !py-2 text-sm" value={editSlot.slot_name||''} onChange={e => setEditSlot((s:any) => ({...s, slot_name: e.target.value}))}/>
                      </div>
                      <div>
                        <label className="label-caps mb-1 block">Daily Budget (₹)</label>
                        <input type="number" className="input-field !py-2 text-sm" value={(editSlot.budget_paise||0)/100} onChange={e => setEditSlot((s:any) => ({...s, budget_paise: Math.round(parseFloat(e.target.value)*100)}))}/>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-stake-text cursor-pointer">
                        <input type="checkbox" checked={!!editSlot.is_active} onChange={e => setEditSlot((s:any) => ({...s, is_active: e.target.checked}))} className="rounded"/>
                        Active
                      </label>
                      <button onClick={() => handleSaveSlot(slot.id)} className="ml-auto flex items-center gap-1.5 rounded-xl bg-stake-accent px-4 py-2 text-sm font-bold text-stake-dark hover:bg-stake-accentHover transition">
                        <Save className="h-4 w-4"/> Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── CONFIG ── */}
      {!loading && tab === 'config' && (
        <div className="panel p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white"><Database className="h-5 w-5 text-stake-gold"/> Global Config</h2>
          <div className="divide-y divide-white/5">
            {configs.map((item: any) => (
              <div key={item.config_key} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-mono text-sm font-bold text-white">{item.config_key}</p>
                  <p className="text-xs text-stake-text">v{item.version}</p>
                </div>
                {editingConfig === item.config_key ? (
                  <div className="flex items-center gap-2">
                    <input value={editConfigVal} onChange={e => setEditConfigVal(e.target.value)} className="input-field !py-2 font-mono text-sm w-64"/>
                    <button onClick={() => handleSaveConfig(item.config_key)} className="rounded-xl bg-stake-accent p-2 text-stake-dark hover:bg-stake-accentHover transition"><Save className="h-4 w-4"/></button>
                    <button onClick={() => setEditingConfig(null)} className="rounded-xl bg-white/5 p-2 text-stake-text hover:text-white transition">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <code className="rounded-lg border border-white/5 bg-stake-dark px-3 py-1.5 font-mono text-sm text-stake-accent">{JSON.stringify(item.config_value)}</code>
                    <button onClick={() => { setEditingConfig(item.config_key); setEditConfigVal(typeof item.config_value === 'object' ? JSON.stringify(item.config_value) : String(item.config_value)); }}
                      className="rounded-lg bg-stake-cardHover px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#274556] transition">Edit</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AUDIT LOGS ── */}
      {!loading && tab === 'logs' && (
        <div className="panel p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white"><Clock className="h-5 w-5 text-stake-gold"/> Audit Logs</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {logs.map((row: any) => (
              <div key={row.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">{row.action} <span className="text-stake-text font-normal">on</span> {row.entity_type}:{row.entity_id}</p>
                  <p className="text-xs text-stake-text">by {row.actor}</p>
                </div>
                <p className="text-xs text-stake-text">{new Date(row.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="panel p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04]">{icon}</div>
      <p className="label-caps mb-1">{label}</p>
      <p className="font-display text-2xl font-extrabold text-white">{value}</p>
      <p className="mt-1 text-xs text-stake-text">{sub}</p>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <p className="label-caps mb-1">{label}</p>
      <p className="font-display text-base font-bold text-white">{value}</p>
    </div>
  );
}

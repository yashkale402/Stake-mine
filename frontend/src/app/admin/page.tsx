'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import {
  ShieldCheck, Save, Clock, Database, Wallet, Activity,
  Users, LineChart, Ban, CheckCircle, ChevronDown, ChevronUp, RefreshCw,
  Search, SlidersHorizontal, Layers, Info, Loader2
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
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [draftConfig, setDraftConfig] = useState<Record<string, any>>({});
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({ game: true, bet: true, budget: true, performance: true });
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<number|null>(null);
  const [editSlot, setEditSlot] = useState<any>({});
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [balanceAdj, setBalanceAdj] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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

  const CONFIG_DEFINITIONS = [
    {
      key: 'game',
      title: 'Game Configuration',
      description: 'Core board and round mechanics that shape every game.',
      icon: Layers,
      fields: [
        { key: 'board_size', label: 'Board Size', type: 'integer', helper: 'Total number of visible cells in the board. Must be larger than maximum mines.', suffix: 'cells', tooltip: 'A larger board increases game length and makes safe reveals more likely. Should be greater than max mines.' },
        { key: 'min_mines', label: 'Minimum Mines', type: 'integer', helper: 'Smallest mine count a player can choose for a round.', tooltip: 'Lower mine counts make games easier and reduce house edge slightly.' },
        { key: 'max_mines', label: 'Maximum Mines', type: 'integer', helper: 'Largest mine count a player can choose for a round.', tooltip: 'Higher mine counts increase volatility and payout potential.' },
        { key: 'game_expiry_seconds', label: 'Game Expiry Time', type: 'seconds', helper: 'Idle active games expire after this many seconds.', suffix: 'sec', tooltip: 'Controls how long a game can remain open without action before it is automatically invalidated.' },
        { key: 'multiplier_formula', label: 'Multiplier Formula', type: 'formula', helper: 'Determines multiplier progression as safe cells are revealed.', tooltip: 'Defines how payouts scale based on current safe reveal probability and house edge.' },
      ],
    },
    {
      key: 'bet',
      title: 'Bet Configuration',
      description: 'Wagering limits and house edge settings for betting behavior.',
      icon: SlidersHorizontal,
      fields: [
        { key: 'min_bet_paise', label: 'Minimum Bet', type: 'money', helper: 'Smallest bet a player can place. Displayed in rupees.', placeholder: 'e.g. 1.00', tooltip: 'This value is stored in paise and displayed in rupees to the admin.' },
        { key: 'max_bet_paise', label: 'Maximum Bet', type: 'money', helper: 'Largest bet a player can place. Displayed in rupees.', placeholder: 'e.g. 1000.00', tooltip: 'This value is stored in paise and displayed in rupees to the admin.' },
        { key: 'house_edge', label: 'House Edge', type: 'fraction', helper: 'The casino advantage applied to multiplier payouts.', suffix: '%', placeholder: 'e.g. 5', tooltip: 'Enter the house edge as a percentage. Stored as a decimal fraction (0.05 means 5%).' },
      ],
    },
    {
      key: 'budget',
      title: 'Budget & Risk Engine',
      description: 'Live budget thresholds and risk controls that protect slot performance.',
      icon: ShieldCheck,
      fields: [
        { key: 'budget_tolerance_pct', label: 'Budget Tolerance', type: 'percent_decimal', helper: 'Buffer percentage allowed beyond budget before risk tightens.', suffix: '%', placeholder: 'e.g. 10', tooltip: 'Stored internally as a decimal (0.10 means 10% tolerance beyond the configured budget).' },
        { key: 'risk_normal_threshold_pct', label: 'Normal Risk Threshold', type: 'percent', helper: 'Budget usage percentage for normal risk mode.', suffix: '%', tooltip: 'Below this threshold the engine remains in standard risk mode.' },
        { key: 'risk_low_threshold_pct', label: 'Low Risk Threshold', type: 'percent', helper: 'Budget usage percentage where low risk begins.', suffix: '%', tooltip: 'Enables modest risk reduction when budget usage rises above this level.' },
        { key: 'risk_medium_threshold_pct', label: 'Medium Risk Threshold', type: 'percent', helper: 'Budget usage percentage where medium risk begins.', suffix: '%', tooltip: 'Tightens risk and reduces high payout exposure when reached.' },
        { key: 'risk_high_threshold_pct', label: 'High Risk Threshold', type: 'percent', helper: 'Budget usage percentage where high risk begins.', suffix: '%', tooltip: 'Activates stronger protections to preserve budget capacity.' },
        { key: 'risk_critical_threshold_pct', label: 'Critical Protection Threshold', type: 'percent', helper: 'Budget usage percentage above which critical protection is enforced.', suffix: '%', tooltip: 'Triggers the strictest risk limits and payout moderation.' },
      ],
    },
    {
      key: 'performance',
      title: 'Frontend Performance',
      description: 'Runtime caching and admin config refresh settings.',
      icon: Clock,
      fields: [
        { key: 'config_cache_ttl', label: 'Configuration Cache TTL', type: 'seconds', helper: 'How long global config stays cached in Redis.', suffix: 'sec', placeholder: 'e.g. 300', tooltip: 'Shorter values make config updates visible faster but increase Redis load.' },
      ],
    },
  ];

  const configMap = React.useMemo(() => Object.fromEntries(configs.map((item) => {
    let value = item.config_value;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch {}
    }
    return [item.config_key, value];
  })), [configs]);

  const totalConfigFields = React.useMemo(() => CONFIG_DEFINITIONS.reduce((count, section) => count + section.fields.length, 0), []);

  const modifiedFieldsCount = React.useMemo(() => {
    return Object.keys(draftConfig).filter((fieldKey) => {
      const current = configMap[fieldKey];
      return String(current) !== String(draftConfig[fieldKey]);
    }).length;
  }, [configMap, draftConfig]);

  const validationErrorCount = React.useMemo(() => Object.values(sectionErrors).filter(Boolean).length, [sectionErrors]);

  const lastUpdatedTime = React.useMemo(() => {
    const dates = configs.map((item: any) => item.updated_at).filter(Boolean).map((value: any) => new Date(value));
    const latest = dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null;
    return latest ? latest.toLocaleString() : null;
  }, [configs]);

  const getFieldValue = (key: string) => (draftConfig?.hasOwnProperty(key) ? draftConfig[key] : configMap[key]);

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const highlightMatch = (text: string, term: string) => {
    const normalized = term.trim();
    if (!normalized) return text;
    const regex = new RegExp(`(${escapeRegExp(normalized)})`, 'gi');
    return String(text).split(regex).map((part, index) => (
      regex.test(part)
        ? <span key={index} className="rounded bg-stake-accent/20 px-1 text-stake-accent">{part}</span>
        : <span key={index}>{part}</span>
    ));
  };

  const formatDisplayValue = (field: any, value: any) => {
    if (value === undefined || value === null || value === '') return '—';
    switch (field.type) {
      case 'money':
        return `₹${(Number(value) / 100).toFixed(2)}`;
      case 'seconds':
        const seconds = Number(value);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const summary = hours ? `${hours}h ${minutes}m` : `${seconds} sec`;
        return `${seconds} sec${seconds === 1 ? '' : 's'}${hours || minutes ? ` (${summary})` : ''}`;
      case 'percent':
        return `${Number(value)}%`;
      case 'percent_decimal':
        return `${(Number(value) * 100).toFixed(2)}%`;
      case 'fraction':
        return `${(Number(value) * 100).toFixed(2)}%`;
      case 'formula':
        return String(value);
      default:
        return String(value);
    }
  };

  const parseInputValue = (field: any, raw: any) => {
    if (raw === '' || raw === null || raw === undefined) return '';
    if (typeof raw === 'string') raw = raw.trim();
    if (field.type === 'money') {
      const parsed = Number(raw.replace(/,/g, ''));
      return Number.isFinite(parsed) ? Math.round(parsed * 100) : raw;
    }
    if (field.type === 'percent_decimal' || field.type === 'fraction') {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed / 100 : raw;
    }
    if (field.type === 'percent' || field.type === 'seconds' || field.type === 'integer') {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : raw;
    }
    return raw;
  };

  const getInputValue = (field: any) => {
    const current = getFieldValue(field.key);
    if (current === undefined || current === null) return '';
    switch (field.type) {
      case 'money':
        return (Number(current) / 100).toFixed(2);
      case 'percent_decimal':
      case 'fraction':
        return (Number(current) * 100).toFixed(2);
      default:
        return String(current);
    }
  };

  const updateDraftField = (field: any, raw: any) => {
    const parsed = parseInputValue(field, raw);
    setDraftConfig((prev) => ({ ...prev, [field.key]: parsed }));
    setSectionErrors((prev) => ({ ...prev, [field.key]: '' }));
  };

  const validateSection = (section: any) => {
    const errors: Record<string, string> = {};
    const values = Object.fromEntries(section.fields.map((field: any) => [field.key, getFieldValue(field.key)]));

    if (section.key === 'bet') {
      const minBet = Number(values.min_bet_paise);
      const maxBet = Number(values.max_bet_paise);
      if (Number.isFinite(minBet) && Number.isFinite(maxBet) && minBet >= maxBet) {
        errors.max_bet_paise = 'Maximum bet must be greater than minimum bet.';
      }
    }
    if (section.key === 'game') {
      const boardSize = Number(values.board_size);
      const maxMines = Number(values.max_mines);
      if (Number.isFinite(boardSize) && Number.isFinite(maxMines) && boardSize <= maxMines) {
        errors.board_size = 'Board size must be greater than maximum mines.';
      }
    }
    if (section.key === 'budget') {
      const normal = Number(values.risk_normal_threshold_pct);
      const low = Number(values.risk_low_threshold_pct);
      const medium = Number(values.risk_medium_threshold_pct);
      const high = Number(values.risk_high_threshold_pct);
      const critical = Number(values.risk_critical_threshold_pct);
      if (!(normal < low && low < medium && medium < high && high <= critical)) {
        errors.risk_critical_threshold_pct = 'Thresholds must increase: Normal < Low < Medium < High <= Critical.';
      }
    }
    if (section.key === 'bet') {
      const edge = Number(values.house_edge);
      if (Number.isFinite(edge) && (edge < 0 || edge > 1)) {
        errors.house_edge = 'House edge must be between 0% and 100%.';
      }
    }
    if (section.key === 'performance') {
      const ttl = Number(values.config_cache_ttl);
      if (!Number.isInteger(ttl) || ttl < 1) {
        errors.config_cache_ttl = 'Cache TTL must be a positive integer.';
      }
    }

    setSectionErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveSection = async (section: any) => {
    if (!validateSection(section)) return;
    const changedFields = section.fields.filter((field: any) => {
      const current = configMap[field.key];
      const draft = draftConfig.hasOwnProperty(field.key) ? draftConfig[field.key] : current;
      return String(current) !== String(draft);
    });
    if (changedFields.length === 0) {
      setEditingSection(null);
      return;
    }
    try {
      setSavingSection(section.key);
      await Promise.all(changedFields.map((field: any) => {
        return api.put('/admin/config', { key: field.key, value: draftConfig[field.key] });
      }));
      flash(`Saved ${section.title}`);
      setEditingSection(null);
      setDraftConfig((prev) => {
        const next = { ...prev };
        changedFields.forEach((field: any) => delete next[field.key]);
        return next;
      });
      setSectionErrors({});
      load();
    } catch (e: any) {
      flash(e.message || 'Save failed', false);
    } finally {
      setSavingSection(null);
    }
  };

  const discardChanges = (section: any) => {
    const next = { ...draftConfig };
    section.fields.forEach((field: any) => delete next[field.key]);
    setDraftConfig(next);
    setSectionErrors({});
    setEditingSection(null);
  };

  const filteredSections = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return CONFIG_DEFINITIONS;
    return CONFIG_DEFINITIONS.map((section) => ({
      ...section,
      fields: section.fields.filter((field) =>
        field.key.includes(term) || field.label.toLowerCase().includes(term) || field.helper.toLowerCase().includes(term)
      ),
    })).filter((section) => section.fields.length > 0);
  }, [searchTerm]);

  const hasUnsavedChanges = React.useMemo(() => {
    return Object.keys(draftConfig).length > 0;
  }, [draftConfig]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

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

      {loading && (
        <div className="panel p-8 space-y-5">
          <div className="h-6 w-3/5 rounded-full bg-white/5" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-28 rounded-3xl bg-white/5" />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {[...Array(2)].map((_, index) => (
              <div key={index} className="h-56 rounded-3xl bg-white/5" />
            ))}
          </div>
        </div>
      )}

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
            const startHour = slot?.start_hour ?? null;
            const endHour = slot?.end_hour ?? null;
            const totalBudgetPaise = Number(slot.total_budget_paise || 0);
            const spentPaise = Number(slot.spent_paise || 0);
            const reservedPaise = Number(slot.reserved_paise || 0);
            const remainingPaise = Number(slot.remaining_paise ?? Math.max(0, totalBudgetPaise - spentPaise - reservedPaise));
            const spentPct = Number.isFinite(Number(slot.spent_pct)) ? Number(slot.spent_pct) : (totalBudgetPaise > 0 ? Math.round((spentPaise / totalBudgetPaise) * 100 * 100) / 100 : 0);
            const riskMeta: Record<string, { badge: string; className: string }> = {
              NORMAL: { badge: '🟢 Normal', className: 'text-stake-accent' },
              LOW: { badge: '🟡 Low Risk', className: 'text-yellow-300' },
              MEDIUM: { badge: '🟠 Medium Risk', className: 'text-orange-400' },
              HIGH: { badge: '🔴 High Risk', className: 'text-rose-400' },
              CRITICAL: { badge: '⚫ Critical Protection', className: 'text-slate-300' },
            };
            const risk = riskMeta[slot.current_risk_level] || riskMeta.NORMAL;
            return (
              <div key={slot.id} className="panel p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-display font-bold text-white text-lg">{slot.slot_name || 'Slot'}</p>
                    <p className="text-xs text-stake-text">{startHour !== null ? String(startHour).padStart(2,'0') + ':00' : '--:--'} · {endHour !== null ? String(endHour).padStart(2,'0') + ':00' : '--:--'} · {slot.is_active ? <span className="text-stake-accent">Active</span> : <span className="text-rose-400">Inactive</span>}</p>
                  </div>
                  <div className={`text-xs font-bold ${risk.className}`}>{risk.badge}</div>
                  <button onClick={() => { setEditingSlot(isEditing ? null : slot.id); setEditSlot({ budget_paise: slot.budget_paise ?? slot.configured_budget_paise ?? 0, slot_name: slot.slot_name, is_active: slot.is_active }); }}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition flex items-center gap-1">
                    {isEditing ? <><ChevronUp className="h-3.5 w-3.5"/> Cancel</> : <><ChevronDown className="h-3.5 w-3.5"/> Edit</>}
                  </button>
                </div>

                {/* Budget bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stake-text">Budget usage: <span className="font-bold text-white">{slot.budget_usage_pct ?? slot.spent_pct}%</span></span>
                    <span className="text-stake-text">₹{(spentPaise/100).toFixed(0)} / ₹{(totalBudgetPaise/100).toFixed(0)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${spentPct >= 90 ? 'bg-rose-500' : spentPct >= 70 ? 'bg-amber-400' : 'bg-stake-accent'}`}
                      style={{ width: `${Math.min(100, slot.budget_usage_pct ?? spentPct)}%` }}/>
                  </div>
                  <p className="mt-1 text-xs text-stake-text">
                    Remaining: <span className="font-bold text-stake-gold">₹{(remainingPaise/100).toFixed(0)}</span>
                    {' · '}{slot.game_count || 0} games today
                    {spentPct >= 90 && <span className="ml-2 text-rose-400 font-bold">⚠ CRITICAL — mines auto-tightened</span>}
                    {spentPct >= 70 && spentPct < 90 && <span className="ml-2 text-amber-400 font-bold">⚠ HIGH — mines tightened</span>}
                  </p>
                </div>

                <p className="mb-3 text-xs text-stake-text">
                  Protection: <span className="font-bold text-white">{slot.protection_status || 'INACTIVE'}</span>
                  {slot.last_risk_level_change && <> · Last change: {new Date(slot.last_risk_level_change).toLocaleString()} · Active since: {new Date(slot.active_since).toLocaleString()}</>}
                </p>

                {isEditing && (
                  <div className="rounded-xl border border-white/5 bg-stake-dark/60 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label-caps mb-1 block">Slot Name</label>
                        <input className="input-field !py-2 text-sm" value={editSlot.slot_name||''} onChange={e => setEditSlot((s:any) => ({...s, slot_name: e.target.value}))}/>
                      </div>
                      <div>
                        <label className="label-caps mb-1 block">Daily Budget (₹)</label>
                        <input type="number" className="input-field !py-2 text-sm" value={(editSlot.budget_paise || 0) / 100} onChange={e => setEditSlot((s:any) => ({...s, budget_paise: Math.round(parseFloat(e.target.value) * 100)}))}/>
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
        <div className="panel p-6 space-y-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="mb-2 flex items-center gap-2 font-display text-2xl font-bold text-white"><Database className="h-6 w-6 text-stake-gold"/> Global Config</h2>
              <p className="max-w-2xl text-sm leading-6 text-stake-text">Fine-tune runtime game, budget, betting, and cache behavior from a single admin dashboard. Search, edit, and save each section independently.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-[320px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stake-text" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search configuration fields..."
                  aria-label="Search configuration fields"
                  className="input-field w-full rounded-3xl border border-white/10 bg-white/5 px-10 py-3 text-sm text-white placeholder:text-stake-text focus:border-stake-accent focus:outline-none focus:ring-2 focus:ring-stake-accent/20"
                />
              </div>
              {hasUnsavedChanges && (
                <div className="rounded-2xl border border-stake-accent/20 bg-stake-accent/10 px-4 py-2 text-sm font-semibold text-stake-accent">
                  Unsaved changes pending
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatBox label="Total Configurations" value={`${totalConfigFields}`} />
            <StatBox label="Modified Fields" value={`${modifiedFieldsCount}`} />
            <StatBox label="Validation Errors" value={`${validationErrorCount}`} />
            <StatBox label="Last Updated" value={lastUpdatedTime || '—'} />
          </div>

          {filteredSections.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-stake-text">
              <p className="text-sm font-semibold text-white">No settings found</p>
              <p className="mt-2 text-sm">Try a different keyword or clear the search filter.</p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredSections.map((section) => {
                const sectionDirty = section.fields.some((field: any) => {
                  const current = configMap[field.key];
                  const draft = draftConfig.hasOwnProperty(field.key) ? draftConfig[field.key] : current;
                  return String(current) !== String(draft);
                });
                return (
                  <div key={section.key} className="group rounded-[28px] border border-white/10 bg-stake-dark/50 p-6 shadow-[0_20px_80px_-60px_rgba(0,0,0,0.8)] transition duration-300 hover:-translate-y-0.5 hover:border-stake-accent/20 hover:bg-white/5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/5 text-stake-gold shadow-sm">
                          <section.icon className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                            {sectionDirty && <span className="rounded-full bg-stake-accent/15 px-2 py-1 text-xs font-semibold text-stake-accent">Modified</span>}
                          </div>
                          <p className="mt-2 text-sm text-stake-text">{section.description}</p>
                          <p className="mt-3 text-xs text-stake-text">Group key: <code className="rounded bg-white/5 px-2 py-1 font-mono text-xs text-stake-accent">{section.key}</code></p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSectionOpen((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
                        aria-expanded={sectionOpen[section.key]}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-stake-accent/20 hover:text-stake-accent"
                      >
                        {sectionOpen[section.key] ? 'Collapse section' : 'Expand section'}
                        {sectionOpen[section.key] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>

                    {sectionDirty && (
                      <div className="mt-4 rounded-3xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
                        Unsaved changes detected in this section.
                      </div>
                    )}

                    {sectionOpen[section.key] && (
                      <div className="mt-6 space-y-4">
                        {section.fields.map((field: any) => {
                          const fieldValue = getFieldValue(field.key);
                          const inputValue = getInputValue(field);
                          const fieldDirty = draftConfig.hasOwnProperty(field.key) && String(configMap[field.key]) !== String(draftConfig[field.key]);
                          return (
                            <div key={field.key} className={`rounded-3xl border px-5 py-5 transition ${fieldDirty ? 'border-stake-accent/40 bg-stake-accent/5 shadow-[0_20px_45px_-32px_rgba(251,191,36,0.7)]' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}>
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-white">{highlightMatch(field.label, searchTerm)}</p>
                                    {field.suffix && <span className="text-xs text-stake-text">{field.suffix}</span>}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stake-text">
                                    <span>{field.helper}</span>
                                    <span className="text-stake-text/70">Key: <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-[11px] text-stake-accent">{field.key}</code></span>
                                  </div>
                                </div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-stake-text">
                                  {field.tooltip ? <Info className="h-4 w-4" aria-hidden="true" /> : null}
                                  <span>{field.type === 'formula' ? 'Formula' : field.type === 'seconds' ? 'Duration' : field.type === 'money' ? 'Currency' : field.type}</span>
                                </div>
                              </div>

                              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_260px] lg:items-start">
                                <div>
                                  <p className="text-sm text-stake-text">Current value: <span className="font-semibold text-white">{formatDisplayValue(field, fieldValue)}</span></p>
                                </div>
                                <div className="space-y-2">
                                  <input
                                    value={inputValue}
                                    onChange={(e) => updateDraftField(field, e.target.value)}
                                    placeholder={field.placeholder || `Update ${field.label}`}
                                    aria-label={`Edit ${field.label}`}
                                    className="input-field w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-stake-text focus:border-stake-accent focus:outline-none focus:ring-2 focus:ring-stake-accent/20"
                                  />
                                  {field.tooltip && (
                                    <p className="text-xs text-stake-text">{field.tooltip}</p>
                                  )}
                                  {sectionErrors[field.key] && (
                                    <p className="text-sm text-rose-300">{sectionErrors[field.key]}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-stake-text">{section.fields.length} fields in this section</p>
                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => discardChanges(section)}
                              disabled={!sectionDirty}
                              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-stake-text transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Discard
                            </button>
                            <button
                              type="button"
                              onClick={() => saveSection(section)}
                              disabled={!sectionDirty || savingSection === section.key}
                              aria-disabled={!sectionDirty || savingSection === section.key}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stake-accent px-4 py-2 text-sm font-semibold text-stake-dark transition hover:bg-stake-accentHover disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {savingSection === section.key ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Save changes
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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

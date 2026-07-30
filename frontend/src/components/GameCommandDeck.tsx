'use client';

import { motion } from 'framer-motion';
import { Activity, Gem, ShieldCheck, Zap } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';

export default function GameCommandDeck() {
  const { activeGame, isLoading } = useGameStore();
  const isLive = activeGame?.status === 'ACTIVE';
  const multiplier = Number(activeGame?.current_multiplier || 1).toFixed(2);
  const gems = activeGame ? Math.max(0, activeGame.board_size - activeGame.mine_count) : 0;
  const picks = activeGame?.revealed_cells?.length || 0;

  const cards = [
    { label: 'Round state', value: isLive ? 'LIVE' : isLoading ? 'SYNCING' : 'READY', icon: Activity, tone: isLive ? 'green' : 'slate' },
    { label: 'Current multiplier', value: `${multiplier}×`, icon: Zap, tone: isLive ? 'gold' : 'slate' },
    { label: 'Safe picks', value: `${picks}${activeGame ? ` / ${gems}` : ''}`, icon: Gem, tone: 'green' },
    { label: 'Fair play', value: 'SECURED', icon: ShieldCheck, tone: 'blue' },
  ];

  return (
    <section className="command-deck grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] sm:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, tone }, index) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 + index * 0.06, type: 'spring', stiffness: 220, damping: 24 }}
          className="command-deck-item group px-4 py-3.5"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="label-caps !text-[9px]">{label}</span>
            <Icon className={`h-3.5 w-3.5 command-icon-${tone}`} />
          </div>
          <div className={`font-display text-base font-extrabold tracking-wide command-value-${tone}`}>{value}</div>
          {label === 'Round state' && <span className={`mt-1 block h-1 w-12 rounded-full ${isLive ? 'bg-stake-accent animate-live-dot' : 'bg-white/15'}`} />}
        </motion.div>
      ))}
    </section>
  );
}

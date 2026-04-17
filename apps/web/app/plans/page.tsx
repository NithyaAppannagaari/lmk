'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchPlans, type Plan } from '@/lib/api';
import { useUserId } from '@/lib/user';

const CATEGORY_EMOJI: Record<string, string> = {
  llm: '🧠',
  defi: '⛓️',
  quant: '📊',
  general: '⚙️',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function PlanCard({ plan }: { plan: Plan }) {
  const categories = plan.categories ?? [];
  const tasks = plan.plan_tasks ?? [];
  const done = tasks.filter(t => t.completed_at).length;
  const isDone = !!plan.completed_at;

  return (
    <Link href={`/plans/${plan.id}`} className={`block border rounded-lg p-4 transition-colors ${isDone ? 'border-neutral-700 opacity-50' : 'border-neutral-700 hover:border-neutral-400'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-2 text-sm">
          {categories.map(c => (
            <span key={c} className="text-neutral-400">
              {CATEGORY_EMOJI[c] ?? '📌'} {c.toUpperCase()}
            </span>
          ))}
        </div>
        <span className="text-xs text-neutral-500">{formatDate(plan.created_at)}</span>
      </div>
      <div className="text-xs text-neutral-500 mt-1">
        {done}/{tasks.length} tasks done {isDone && '· completed'}
      </div>
    </Link>
  );
}

export default function PlansPage() {
  const [userId, setUserId] = useUserId();
  const [inputId, setInputId] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInputId(userId);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    fetchPlans(userId)
      .then(setPlans)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-sm text-neutral-400 uppercase tracking-widest">Plans</h1>
        <div className="flex-1 border-t border-neutral-800" />
      </div>

      <div className="flex gap-2 mb-8">
        <input
          type="text"
          value={inputId}
          onChange={e => setInputId(e.target.value)}
          placeholder="user id"
          className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-400"
        />
        <button
          onClick={() => setUserId(inputId)}
          className="px-3 py-1.5 text-sm border border-neutral-700 rounded hover:border-neutral-400 transition-colors"
        >
          load
        </button>
      </div>

      {loading && <p className="text-neutral-500 text-sm">loading...</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {!loading && !error && plans.length === 0 && (
        <p className="text-neutral-500 text-sm">no plans found for <span className="text-neutral-300">{userId}</span></p>
      )}
      <div className="flex flex-col gap-3">
        {plans.map(plan => <PlanCard key={plan.id} plan={plan} />)}
      </div>
    </div>
  );
}

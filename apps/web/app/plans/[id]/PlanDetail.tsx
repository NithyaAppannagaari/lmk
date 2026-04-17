'use client';

import { useState } from 'react';
import Link from 'next/link';
import { completeTask, completePlan, type Plan, type PlanTask } from '@/lib/api';

const TYPE_EMOJI: Record<string, string> = {
  build: '🛠',
  learn: '📚',
  explore: '🔍',
};

const CATEGORY_EMOJI: Record<string, string> = {
  llm: '🧠',
  defi: '⛓️',
  quant: '📊',
  general: '⚙️',
};

function TaskRow({ task, planId, done, onDone }: { task: PlanTask; planId: string; done: boolean; onDone: () => void }) {
  const [loading, setLoading] = useState(false);

  async function handleCheck(e: React.MouseEvent) {
    e.preventDefault();
    if (done || loading) return;
    setLoading(true);
    try {
      await completeTask(planId, task.id);
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`flex items-start gap-3 py-3 group ${done ? 'opacity-40' : ''}`}>
      <button
        onClick={handleCheck}
        disabled={done || loading}
        className="mt-0.5 w-4 h-4 border rounded flex-shrink-0 flex items-center justify-center border-neutral-600 hover:border-neutral-300 transition-colors"
        aria-label="Mark done"
      >
        {done && <span className="text-xs leading-none">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <Link
          href={`/plans/${planId}/tasks/${task.id}`}
          className="block hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">{TYPE_EMOJI[task.type]}</span>
            <span className="text-xs text-neutral-500 uppercase tracking-wide">{task.type}</span>
            <span className="text-sm text-neutral-200 group-hover:text-white">{task.title}</span>
            <span className="text-neutral-600 text-xs ml-auto">→</span>
          </div>
          {task.description && (
            <p className="text-xs text-neutral-500 mt-0.5 ml-6">{task.description}</p>
          )}
        </Link>
      </div>
    </div>
  );
}

export default function PlanDetail({ plan }: { plan: Plan }) {
  const [planDone, setPlanDone] = useState(!!plan.completed_at);
  const [completing, setCompleting] = useState(false);

  const tasks = plan.plan_tasks ?? [];
  const [doneTasks, setDoneTasks] = useState<Set<string>>(
    new Set(tasks.filter(t => t.completed_at).map(t => t.id))
  );

  const allTasksDone = tasks.length > 0 && doneTasks.size === tasks.length;

  async function markPlanDone() {
    if (planDone || completing) return;
    setCompleting(true);
    try {
      await completePlan(plan.id);
      setPlanDone(true);
    } finally {
      setCompleting(false);
    }
  }

  const categories = plan.categories ?? [];
  const label = categories.map(c => `${CATEGORY_EMOJI[c] ?? '📌'} ${c.toUpperCase()}`).join('  ');

  return (
    <div>
      <Link href="/plans" className="text-neutral-500 hover:text-neutral-300 text-sm">← plans</Link>

      <div className="flex items-center justify-between mt-4 mb-6">
        <h1 className="text-sm text-neutral-300">{label}</h1>
        <span className="text-xs text-neutral-600">
          {new Date(plan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>

      <div className="flex flex-col divide-y divide-neutral-800">
        {tasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            planId={plan.id}
            done={doneTasks.has(task.id)}
            onDone={() => setDoneTasks(prev => new Set([...prev, task.id]))}
          />
        ))}
      </div>

      {tasks.length > 0 && (
        <div className="mt-6">
          <button
            onClick={markPlanDone}
            disabled={planDone || completing || !allTasksDone}
            className={`text-xs px-3 py-1.5 border rounded transition-colors ${
              planDone
                ? 'border-neutral-700 text-neutral-500 cursor-default'
                : allTasksDone
                ? 'border-neutral-400 text-neutral-200 hover:border-white'
                : 'border-neutral-800 text-neutral-600 cursor-not-allowed'
            }`}
          >
            {planDone ? 'completed ✓' : 'mark plan done'}
          </button>
          {!allTasksDone && !planDone && (
            <p className="text-xs text-neutral-600 mt-1">complete all tasks first</p>
          )}
        </div>
      )}
    </div>
  );
}

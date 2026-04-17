'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { type Plan, type PlanTask, type TaskDetail, type TaskStep, type TaskResource } from '@/lib/api';

const TYPE_EMOJI: Record<string, string> = { build: '🛠', learn: '📚', explore: '🔍' };
const TYPE_LABEL: Record<string, string> = { docs: 'Docs', repo: 'Repo', article: 'Article', paper: 'Paper' };

// ── Highlight logic ──────────────────────────────────────────────────────────

function useHighlights(storageKey: string) {
  const [highlights, setHighlights] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    } catch {
      return [];
    }
  });

  function addHighlight(text: string) {
    setHighlights(prev => {
      const next = prev.includes(text) ? prev : [...prev, text];
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  function removeHighlight(text: string) {
    setHighlights(prev => {
      const next = prev.filter(h => h !== text);
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  return { highlights, addHighlight, removeHighlight };
}

function applyHighlights(text: string, highlights: string[]): React.ReactNode[] {
  if (!highlights.length) return [text];

  const sorted = [...highlights].sort((a, b) => b.length - a.length);
  const pattern = sorted.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const isHighlighted = highlights.some(h => h.toLowerCase() === part.toLowerCase());
    return isHighlighted
      ? <mark key={i} className="bg-yellow-300/30 text-yellow-100 rounded px-0.5">{part}</mark>
      : part;
  });
}

// ── Highlight toolbar ────────────────────────────────────────────────────────

function HighlightToolbar({ onHighlight }: { onHighlight: (text: string) => void }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    function handleMouseUp(e: MouseEvent) {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      if (text.length > 2) {
        setSelected(text);
        setPos({ x: e.clientX, y: e.clientY });
      } else {
        setPos(null);
        setSelected('');
      }
    }
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  if (!pos || !selected) return null;

  return (
    <div
      className="fixed z-50 bg-neutral-800 border border-neutral-600 rounded shadow-lg px-2 py-1"
      style={{ left: pos.x - 40, top: pos.y - 40 }}
    >
      <button
        onMouseDown={e => {
          e.preventDefault();
          onHighlight(selected);
          setPos(null);
          window.getSelection()?.removeAllRanges();
        }}
        className="text-xs text-yellow-300 hover:text-yellow-100"
      >
        highlight
      </button>
    </div>
  );
}

// ── Resource card ────────────────────────────────────────────────────────────

function ResourceCard({ resource }: { resource: TaskResource }) {
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 p-3 border border-neutral-800 rounded-lg hover:border-neutral-500 transition-colors group"
    >
      <span className="text-xs text-neutral-500 border border-neutral-700 rounded px-1.5 py-0.5 flex-shrink-0 mt-0.5">
        {TYPE_LABEL[resource.type] ?? resource.type}
      </span>
      <div className="min-w-0">
        <p className="text-sm text-neutral-200 group-hover:text-white truncate">{resource.title}</p>
        {resource.why && <p className="text-xs text-neutral-500 mt-0.5">{resource.why}</p>}
        <p className="text-xs text-neutral-700 truncate mt-0.5">{resource.url}</p>
      </div>
      <span className="text-neutral-600 ml-auto flex-shrink-0 text-xs">↗</span>
    </a>
  );
}

// ── Step card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  highlights,
  read,
  onMarkRead,
}: {
  step: TaskStep;
  index: number;
  highlights: string[];
  read: boolean;
  onMarkRead: () => void;
}) {
  return (
    <div className={`border rounded-lg p-4 transition-all ${read ? 'border-neutral-800 opacity-50' : 'border-neutral-700'}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-600 tabular-nums w-4">{index + 1}.</span>
          <h3 className="text-sm font-medium text-neutral-100">{step.title}</h3>
        </div>
        <button
          onClick={onMarkRead}
          disabled={read}
          className={`text-xs flex-shrink-0 px-2 py-0.5 border rounded transition-colors ${
            read ? 'border-neutral-800 text-neutral-600' : 'border-neutral-700 text-neutral-400 hover:border-neutral-400'
          }`}
        >
          {read ? 'read ✓' : 'mark read'}
        </button>
      </div>

      <p className="text-sm text-neutral-400 leading-relaxed ml-6 select-text">
        {applyHighlights(step.content, highlights)}
      </p>

      {step.code && (
        <pre className="mt-3 ml-6 bg-neutral-900 border border-neutral-800 rounded p-3 text-xs text-neutral-300 overflow-x-auto select-text">
          <code>{step.code}</code>
        </pre>
      )}

      {step.resource && (
        <div className="mt-3 ml-6">
          <ResourceCard resource={step.resource} />
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function TaskContent({
  plan,
  task,
  detail,
}: {
  plan: Plan;
  task: PlanTask;
  detail: TaskDetail;
}) {
  const storageKey = `highlights:${task.id}`;
  const { highlights, addHighlight, removeHighlight } = useHighlights(storageKey);
  const [readSteps, setReadSteps] = useState<Set<number>>(new Set());

  function toggleRead(i: number) {
    setReadSteps(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  const progress = readSteps.size;
  const total = detail.steps.length;

  return (
    <div>
      <HighlightToolbar onHighlight={addHighlight} />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-neutral-600 mb-6">
        <Link href="/plans" className="hover:text-neutral-300">plans</Link>
        <span>/</span>
        <Link href={`/plans/${plan.id}`} className="hover:text-neutral-300">
          {plan.categories?.[0]?.toUpperCase() ?? 'plan'}
        </Link>
        <span>/</span>
        <span className="text-neutral-400">{task.type}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{TYPE_EMOJI[task.type]}</span>
          <span className="text-xs text-neutral-500 uppercase tracking-wide">{task.type}</span>
        </div>
        <h1 className="text-lg font-medium text-white">{task.title}</h1>
      </div>

      {/* Overview */}
      <p className="text-sm text-neutral-400 leading-relaxed mb-8 select-text border-l-2 border-neutral-700 pl-4">
        {applyHighlights(detail.overview, highlights)}
      </p>

      {/* Progress */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-neutral-500">{progress}/{total} steps read</span>
        <div className="flex-1 h-px bg-neutral-800">
          <div
            className="h-px bg-neutral-400 transition-all"
            style={{ width: total > 0 ? `${(progress / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-3 mb-10">
        {detail.steps.map((step, i) => (
          <StepCard
            key={i}
            step={step}
            index={i}
            highlights={highlights}
            read={readSteps.has(i)}
            onMarkRead={() => toggleRead(i)}
          />
        ))}
      </div>

      {/* Resources */}
      {detail.resources.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-neutral-500 uppercase tracking-widest">Resources</span>
            <div className="flex-1 border-t border-neutral-800" />
          </div>
          <div className="flex flex-col gap-2">
            {detail.resources.map((r, i) => <ResourceCard key={i} resource={r} />)}
          </div>
        </div>
      )}

      {/* Active highlights list */}
      {highlights.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-neutral-500 uppercase tracking-widest">Your highlights</span>
            <div className="flex-1 border-t border-neutral-800" />
          </div>
          <div className="flex flex-wrap gap-2">
            {highlights.map((h, i) => (
              <span
                key={i}
                className="text-xs bg-yellow-300/20 text-yellow-200 rounded px-2 py-1 flex items-center gap-1"
              >
                {h.length > 60 ? h.slice(0, 60) + '…' : h}
                <button onClick={() => removeHighlight(h)} className="text-yellow-500 hover:text-yellow-200 ml-1">×</button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

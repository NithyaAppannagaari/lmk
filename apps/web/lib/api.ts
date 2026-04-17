const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/v1';

export interface PlanTask {
  id: string;
  plan_id: string;
  type: 'build' | 'learn' | 'explore';
  title: string;
  description: string;
  completed_at: string | null;
}

export interface Plan {
  id: string;
  user_id: string;
  categories: string[];
  created_at: string;
  completed_at: string | null;
  plan_tasks: PlanTask[];
}

export async function fetchPlans(userId: string): Promise<Plan[]> {
  const res = await fetch(`${API_URL}/plans?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch plans');
  return res.json();
}

export async function fetchPlan(planId: string): Promise<Plan> {
  const res = await fetch(`${API_URL}/plans/${planId}`);
  if (!res.ok) throw new Error('Failed to fetch plan');
  return res.json();
}

export async function completePlan(planId: string): Promise<void> {
  const res = await fetch(`${API_URL}/plans/${planId}`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Failed to update plan');
}

export async function completeTask(planId: string, taskId: string): Promise<void> {
  const res = await fetch(`${API_URL}/plans/${planId}/tasks/${taskId}`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Failed to update task');
}

export interface TaskResource {
  title: string;
  url: string;
  type: 'docs' | 'repo' | 'article' | 'paper';
  why?: string;
}

export interface TaskStep {
  title: string;
  content: string;
  code: string | null;
  resource: TaskResource | null;
}

export interface TaskDetail {
  overview: string;
  steps: TaskStep[];
  resources: TaskResource[];
}

export async function fetchTaskDetail(planId: string, taskId: string): Promise<TaskDetail> {
  const res = await fetch(`${API_URL}/plans/${planId}/tasks/${taskId}/detail`);
  if (!res.ok) throw new Error('Failed to fetch task detail');
  return res.json();
}

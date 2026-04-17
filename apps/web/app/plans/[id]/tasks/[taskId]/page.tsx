import { fetchPlan, fetchTaskDetail } from '@/lib/api';
import TaskContent from './TaskContent';

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id: planId, taskId } = await params;
  const [plan, detail] = await Promise.all([
    fetchPlan(planId),
    fetchTaskDetail(planId, taskId),
  ]);

  const task = plan.plan_tasks?.find(t => t.id === taskId);
  if (!task) return <p className="text-neutral-500 text-sm">Task not found.</p>;

  return <TaskContent plan={plan} task={task} detail={detail} />;
}

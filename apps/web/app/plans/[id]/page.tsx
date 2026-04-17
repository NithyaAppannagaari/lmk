import { fetchPlan } from '@/lib/api';
import PlanDetail from './PlanDetail';

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await fetchPlan(id);
  return <PlanDetail plan={plan} />;
}

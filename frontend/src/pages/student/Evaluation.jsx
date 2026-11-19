import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ClipboardCheck } from 'lucide-react';
import { DashboardLayout } from '../../components/common/Layout';
import { EmptyState, SkeletonCard } from '../../components/common';
import { evaluationAPI } from '../../api';
import { getData, errorMessage } from '../evaluation/shared';

const StudentEvaluation = () => {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    evaluationAPI.mine().then(res => {
      const data = getData(res);
      setGrades(Array.isArray(data) ? data : data?.grades || []);
    }).catch(e => toast.error(errorMessage(e))).finally(() => setLoading(false));
  }, []);
  return <DashboardLayout><div className="space-y-5">
    <div><h1 className="text-2xl font-bold dark:text-white">My Evaluation</h1><p className="text-sm text-gray-500">Published scores and component breakdown.</p></div>
    {loading ? <div className="grid gap-4 md:grid-cols-2"><SkeletonCard /><SkeletonCard /></div>
      : grades.length ? grades.map((grade, index) => {
        const parts = grade.breakdown || [];
        return <article className="card p-5 space-y-4" key={grade.event?._id || grade.event || index}>
          <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold dark:text-white">{grade.event?.title || grade.event?.name || grade.event || 'Event evaluation'}</h2>
            <strong className="text-xl">{grade.final_score ?? grade.computed_score ?? '—'}</strong></div>
          {grade.partial && <p className="text-sm text-amber-700 dark:text-amber-300">Partial evaluation{grade.missing?.length ? ` — missing: ${grade.missing.join(', ')}` : ''}</p>}
          {parts.length ? <div className="space-y-2"><div className="flex h-4 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" aria-label="Weighted component breakdown">{parts.map((part, i) => <div key={part.key || i} title={`${part.key}: ${part.score ?? '—'} × ${part.effective_weight ?? 0}% = ${part.points ?? 0}`} className={['bg-blue-600','bg-emerald-500','bg-violet-500','bg-amber-500','bg-rose-500'][i % 5]} style={{ width: `${Math.max(0, Number(part.effective_weight || 0))}%` }} />)}</div>
            <div className="grid sm:grid-cols-2 gap-1">{parts.map((part, i) => <p key={part.key || i} className="text-xs text-gray-500 capitalize">{part.key}: {part.score ?? '—'} × {part.effective_weight ?? 0}% = {part.points ?? 0}</p>)}</div></div> : <p className="text-sm text-gray-500">Breakdown has not been published.</p>}
          {grade.override_reason && <p className="text-sm text-blue-700 dark:text-blue-300">Guide override: {grade.override_reason}</p>}
        </article>;
      }) : <div className="card"><EmptyState icon={ClipboardCheck} title="Your evaluation has not been published yet." /></div>}
  </div></DashboardLayout>;
};
export default StudentEvaluation;

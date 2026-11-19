import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ClipboardCheck } from 'lucide-react';
import { DashboardLayout } from '../../components/common/Layout';
import { Badge, EmptyState, SkeletonCard } from '../../components/common';
import { evaluationAPI } from '../../api';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import { getData, errorMessage, formatIST } from '../evaluation/shared';

const COLORS = ['bg-blue-600', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500'];
const score = (value) => (value == null ? '—' : Number(value).toFixed(1));
const eventTitle = (grade) => grade.event?.title || grade.event?.name || (typeof grade.event === 'string' ? grade.event : 'Event evaluation');

const Breakdown = ({ parts }) => parts?.length ? (
  <div className="space-y-2">
    <div className="flex h-4 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" aria-label="Weighted component breakdown">
      {parts.map((part, i) => (
        <div key={part.key || i} title={`${part.key}: ${part.score ?? '—'} × ${part.effective_weight ?? 0}% = ${part.points ?? 0}`}
          className={COLORS[i % COLORS.length]} style={{ width: `${Math.max(0, Number(part.effective_weight || 0))}%` }} />
      ))}
    </div>
    <div className="grid sm:grid-cols-2 gap-1">
      {parts.map((part, i) => (
        <p key={part.key || i} className="text-xs text-gray-500 capitalize">
          {part.key}: {part.score ?? '—'} × {part.effective_weight ?? 0}% = {part.points ?? 0}
        </p>
      ))}
    </div>
  </div>
) : null;

const StudentEvaluation = () => {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchGrades = useCallback(async () => {
    try {
      const data = getData(await evaluationAPI.mine());
      setGrades(Array.isArray(data) ? data : data?.grades || []);
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchGrades(); }, [fetchGrades]);
  useRefetchOnFocus(fetchGrades, { liveScopes: ['evaluation', 'dashboard'] });

  return <DashboardLayout><div className="space-y-5">
    <div>
      <h1 className="text-2xl font-bold dark:text-white">My Evaluation</h1>
      <p className="text-sm text-gray-500">Marks appear here as soon as faculty save them. Final scores are shown once the evaluation is published.</p>
    </div>
    {loading ? <div className="grid gap-4 md:grid-cols-2"><SkeletonCard /><SkeletonCard /></div>
      : grades.length ? grades.map((grade, index) => {
        const marks = grade.marks || [];
        const live = grade.live;
        const breakdown = grade.published ? grade.breakdown : live?.breakdown;
        return <article className="card p-5 space-y-4" key={grade.event_id || grade.event || index}>
          <div className="flex flex-wrap justify-between items-start gap-2">
            <div>
              <h2 className="font-semibold dark:text-white">{eventTitle(grade)}</h2>
              {grade.team_name && <p className="text-xs text-gray-500">{grade.team_name}</p>}
            </div>
            {grade.published
              ? <div className="text-right"><p className="text-xs text-gray-500">Final score</p><strong className="text-xl">{score(grade.final_score)}</strong></div>
              : <Badge variant="pending">Marks in progress</Badge>}
          </div>

          {(grade.summary?.presentation != null || grade.report_score != null) && (
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-300">
              {grade.summary?.presentation != null && <span>Presentation average: <strong>{score(grade.summary.presentation)}%</strong></span>}
              {grade.summary?.attendance != null && <span>Attendance: <strong>{score(grade.summary.attendance)}%</strong></span>}
              {grade.report_score != null && <span>Report score: <strong>{score(grade.report_score)}</strong></span>}
            </div>
          )}

          {!grade.published && live && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Projected score (not yet published): <strong>{score(live.computed_score)}</strong>
              {live.partial ? ` — still missing: ${(live.missing || []).join(', ')}` : ''}
            </p>
          )}
          {grade.published && grade.partial && <p className="text-sm text-amber-700 dark:text-amber-300">Partial evaluation{grade.missing?.length ? ` — missing: ${grade.missing.join(', ')}` : ''}</p>}
          <Breakdown parts={breakdown} />
          {grade.override_reason && <p className="text-sm text-blue-700 dark:text-blue-300">Guide override: {grade.override_reason}</p>}

          {marks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-left">
                  <tr>{['Presentation', 'Marks', 'Attendance', 'Awarded by', 'Updated'].map((h) => <th key={h} className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {marks.map((mark) => (
                    <tr key={mark.id}>
                      <td className="px-3 py-2">
                        {mark.presentation_title}
                        {mark.labels?.length > 1 && (
                          <span className="block text-xs text-gray-500">{mark.labels.map((l) => `${l.label} ${l.marks}/${l.out_of}`).join(' · ')}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap"><strong>{score(mark.marks)}</strong> / {score(mark.out_of)}{mark.percent != null && <span className="text-xs text-gray-500"> ({score(mark.percent)}%)</span>}</td>
                      <td className="px-3 py-2 capitalize">{mark.attendance === 'not_marked' ? '—' : mark.attendance}</td>
                      <td className="px-3 py-2">{mark.awarded_by || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatIST(mark.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-gray-500">{grade.published ? 'Breakdown has not been published.' : 'No marks entered yet.'}</p>}
        </article>;
      }) : <div className="card"><EmptyState icon={ClipboardCheck} title="No marks have been entered by faculty yet." /></div>}
  </div></DashboardLayout>;
};
export default StudentEvaluation;

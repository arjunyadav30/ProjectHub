import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, SkeletonCard } from '../../components/common';
import { panelAPI } from '../../api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { errorMessage, formatIST, getData } from './shared';

const LiveScoresheet = () => {
  const { slotId } = useParams();
  const [sheetData, setSheetData] = useState(null);
  const [criteria, setCriteria] = useState([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now());
  const fetchSheet = useCallback(async () => {
    try {
      const d = getData(await panelAPI.scoresheet(slotId));
      setSheetData(d);
      setCriteria((d.sheet?.criteria || []).map(c => {
        const saved = d.my_score?.criteria?.find(s => String(s.label_id) === String(c.label_id));
        return { label_id: c.label_id, label: c.label, marks: Number(saved?.marks ?? 0), marks_out_of: Number(c.marks_out_of), weight_percent: Number(c.weight_percent) };
      }));
      setComment(d.my_score?.comment || '');
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setLoading(false); }
  }, [slotId]);
  useEffect(() => { fetchSheet(); }, [fetchSheet]);
  useLiveRefresh(fetchSheet, ['panel', 'schedule']);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const total = useMemo(() => criteria.reduce((sum, c) => sum + (c.marks / Math.max(c.marks_out_of, 1)) * c.weight_percent, 0), [criteria]);
  if (loading) return <DashboardLayout><SkeletonCard /></DashboardLayout>;
  if (!sheetData) return <DashboardLayout><p className="text-red-500">Scoresheet unavailable.</p></DashboardLayout>;
  const { slot = {}, team = {}, sheet = {} } = sheetData;
  const elapsed = slot.started_at ? Math.max(0, Math.ceil((new Date(slot.started_at).getTime() + (sheetData.time_limit_minutes || 0) * 60000 - now) / 1000)) : null;
  const canEdit = sheetData.can_score && !slot.scores_locked && ['in_progress', 'completed'].includes(slot.status);
  const start = async () => { try { await panelAPI.start(slotId); toast.success('Presentation started'); fetchSheet(); } catch (e) { toast.error(errorMessage(e)); } };
  const complete = async () => { try { await panelAPI.complete(slotId); toast.success('Presentation completed'); fetchSheet(); } catch (e) { toast.error(errorMessage(e)); } };
  const save = async () => {
    if (criteria.some(c => !Number.isFinite(c.marks) || c.marks < 0 || c.marks > c.marks_out_of)) return toast.error('Scores must be within each criterion range.');
    setSaving(true);
    try { await panelAPI.submitScore(slotId, criteria, comment); toast.success('Score saved'); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setSaving(false); }
  };
  return <DashboardLayout><div className="max-w-3xl mx-auto space-y-4">
    <header className="card p-4"><h1 className="text-xl font-bold dark:text-white">{team.team_name}</h1><p className="text-sm text-gray-500">{team.project_title} · {sheetData.presentation_title} · {formatIST(slot.start_at)}</p>
      {elapsed !== null && <p className={`text-3xl font-bold mt-3 ${elapsed === 0 ? 'text-red-600' : 'text-blue-600'}`}>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</p>}
      <p className="text-sm mt-2">Judges submitted {sheetData.judges_submitted} of {sheetData.judges_expected}</p>
      <div className="flex gap-2 mt-3">{slot.status === 'scheduled' && <Button onClick={start}>Start</Button>}{slot.status === 'in_progress' && <Button onClick={complete}>Complete</Button>}</div>
    </header>
    {sheetData.conflict_of_interest && <p className="p-3 rounded-lg bg-amber-100 text-amber-900">You mentor this team, so you cannot score it.</p>}
    {!sheetData.can_score && !sheetData.conflict_of_interest && <p className="text-sm text-gray-500">You are not an examiner for this slot.</p>}
    {slot.scores_locked && <p className="text-sm text-gray-500">Scores are finalized and locked.</p>}
    <section className="card p-4 space-y-4">{criteria.map((criterion, index) => <label key={criterion.label_id || index} className="block p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
      <span className="flex justify-between font-medium text-sm"><span>{criterion.label}</span><span>{criterion.weight_percent}%</span></span>
      <span className="flex items-center gap-3 mt-2"><button type="button" className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 text-xl" disabled={!canEdit} onClick={() => setCriteria(prev => prev.map((c, i) => i === index ? { ...c, marks: Math.max(0, c.marks - 1) } : c))}>−</button>
        <input aria-label={`${criterion.label} score`} className="input text-center text-lg" type="number" min="0" max={criterion.marks_out_of} value={criterion.marks} disabled={!canEdit} onChange={e => setCriteria(prev => prev.map((c, i) => i === index ? { ...c, marks: Number(e.target.value) } : c))} />
        <span className="text-sm text-gray-500">/ {criterion.marks_out_of}</span>
        <button type="button" className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 text-xl" disabled={!canEdit} onClick={() => setCriteria(prev => prev.map((c, i) => i === index ? { ...c, marks: Math.min(c.marks_out_of, c.marks + 1) } : c))}>+</button>
      </span></label>)}
      <p className="text-lg font-semibold">Running total: {total.toFixed(1)}%</p>
      <textarea className="input min-h-24" aria-label="Score comment" placeholder="Comment" value={comment} disabled={!canEdit} onChange={e => setComment(e.target.value)} />
      <Button className="w-full min-h-12" loading={saving} disabled={!canEdit} onClick={save}>Save score</Button>
    </section>
  </div></DashboardLayout>;
};
export default LiveScoresheet;

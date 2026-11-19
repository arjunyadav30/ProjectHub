import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, EmptyState, Modal, SkeletonCard, StatsCard } from '../../components/common';
import { evaluationAPI } from '../../api';
import { downloadCSV } from '../../utils';
import { errorMessage, getData, ScoreBar } from './shared';

const COMPONENTS = ['presentation', 'viva', 'contribution', 'report', 'attendance'];
const UnifiedGrades = () => {
  const { eventId } = useParams();
  const [data, setData] = useState({ rows: [], weights: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overrideRow, setOverrideRow] = useState(null);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [reportScores, setReportScores] = useState({});
  const fetchData = useCallback(async () => {
    try { setData(getData(await evaluationAPI.eventGrades(eventId)) || { rows: [], weights: {} }); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setLoading(false); }
  }, [eventId]);
  useEffect(() => { fetchData(); }, [fetchData]);
  const rows = data.rows || [];
  const [weights, setWeights] = useState({});
  const totalWeight = COMPONENTS.reduce((sum, key) => sum + (Number(weights[key]) || 0), 0);
  useEffect(() => setWeights(data.weights || {}), [data.weights]);
  const saveWeights = async () => {
    if (COMPONENTS.some(k => !Number.isFinite(Number(weights[k])) || Number(weights[k]) < 0 || Number(weights[k]) > 100)) return toast.error('Weights must be 0–100.');
    setSaving(true); try { await evaluationAPI.setWeights(eventId, Object.fromEntries(COMPONENTS.map(k => [k, Number(weights[k])]))); toast.success('Weights saved'); fetchData(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  const finalize = async () => {
    if (!window.confirm('Finalize and publish event grades?')) return;
    try { await evaluationAPI.finalize(eventId); toast.success('Grades finalized'); fetchData(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const saveReportScore = async teamId => {
    const value = Number(reportScores[teamId]);
    if (!Number.isFinite(value) || value < 0 || value > 100) return toast.error('Report score must be 0–100.');
    setSaving(true);
    try { await evaluationAPI.setReportScore(teamId, value); toast.success('Report score saved'); fetchData(); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setSaving(false); }
  };
  const saveOverride = async () => {
    if (overrideScore !== '' && (!Number.isFinite(Number(overrideScore)) || Number(overrideScore) < 0 || Number(overrideScore) > 100)) return toast.error('Override must be 0–100 or blank to clear.');
    if (overrideScore !== '' && overrideReason.trim().length < 10) return toast.error('Reason must be at least 10 characters.');
    setSaving(true);
    try { await evaluationAPI.override(overrideRow.grade_id, overrideScore === '' ? null : Number(overrideScore), overrideReason); toast.success('Override saved'); setOverrideRow(null); fetchData(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  return <DashboardLayout><div className="space-y-5">
    <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-bold dark:text-white">Final Evaluation</h1><p className="text-sm text-gray-500">Component weights and published student grades.</p></div>
      <div className="flex gap-2"><Button variant="secondary" onClick={async () => { try { const r = await evaluationAPI.exportCsv(eventId); downloadCSV(r.data, 'event-grades.csv'); } catch (e) { toast.error(errorMessage(e)); } }}>Export CSV</Button><Button onClick={finalize}>Finalize and publish</Button></div></div>
    <section className="card p-4 space-y-3"><h2 className="font-semibold dark:text-white">Evaluation weights</h2><div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {COMPONENTS.map(key => <label key={key} className="text-sm capitalize">{key}<input className="input mt-1" type="number" min="0" max="100" value={weights[key] ?? 0} onChange={e => setWeights(prev => ({ ...prev, [key]: e.target.value }))} /><span className="block text-xs text-gray-500 mt-1">Normalized preview: {totalWeight ? ((Number(weights[key]) || 0) / totalWeight * 100).toFixed(1) : '0.0'}%</span></label>)}</div>
      <p className="text-xs text-gray-500">Missing components are re-normalized per student.</p><Button size="sm" loading={saving} onClick={saveWeights}>Save weights</Button></section>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3"><StatsCard label="Students" value={rows.length} /><StatsCard label="Partial" value={rows.filter(r => r.partial).length} /><StatsCard label="Average final" value={rows.length ? (rows.reduce((s, r) => s + (Number(r.final_score) || 0), 0) / rows.length).toFixed(1) : '—'} /></div>
    {!!rows.length && <section className="card p-4 space-y-3"><h2 className="font-semibold dark:text-white">Report scores by team</h2>{[...new Map(rows.map(row => [String(row.team_id), row])).values()].map(row => { const teamId = String(row.team_id); return <div key={teamId} className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm">{row.team_name}</span><div className="flex gap-2"><input aria-label={`${row.team_name} report score`} className="input w-28" type="number" min="0" max="100" value={reportScores[teamId] ?? row.components?.report ?? ''} onChange={e=>setReportScores(prev=>({...prev,[teamId]:e.target.value}))}/><Button size="sm" loading={saving} onClick={()=>saveReportScore(teamId)}>Save report score</Button></div></div>; })}</section>}
    {loading ? <div className="grid gap-3 md:grid-cols-2"><SkeletonCard /><SkeletonCard /></div> : rows.length ? <div className="card overflow-x-auto"><table className="w-full text-sm min-w-[1050px]"><thead><tr className="text-left border-b dark:border-gray-700">{['Team / student', 'Enrollment', ...COMPONENTS, 'Computed', 'Override', 'Final', 'Status', ''].map(h => <th key={h} className="p-3 capitalize">{h}</th>)}</tr></thead><tbody>
      {rows.map((row, i) => <tr key={row.grade_id || row.student_id || i} className="border-b dark:border-gray-800"><td className="p-3">{row.team_name}<br /><span className="text-gray-500">{row.name}</span><details className="mt-2 text-xs"><summary className="cursor-pointer text-blue-600">Breakdown and sources</summary><div className="mt-2 space-y-1">{(row.breakdown||[]).map((part,index)=><p key={part.key||index} className="capitalize">{part.key}: {part.score ?? '—'} × {part.effective_weight ?? part.configured_weight ?? 0}% = {part.points ?? 0} points</p>)}<p>Contribution: {row.sources?.contribution === 'guide_decision' ? 'Guide decision' : row.sources?.contribution === 'git_suggestion' ? 'Git suggestion' : '—'}</p><p>Viva method: {row.sources?.viva_method || '—'} · Trust: {row.sources?.viva_trust || '—'}</p></div></details></td><td className="p-3">{row.enrollment_no}</td>{COMPONENTS.map(k => <td key={k} className="p-3" title={row.components?.[k] == null ? 'Missing component' : ''}>{row.components?.[k] ?? '—'}</td>)}<td className="p-3">{row.computed_score ?? '—'}</td><td className="p-3">{row.override?.score ?? '—'}</td><td className="p-3 font-semibold">{row.final_score ?? '—'}</td><td className="p-3">{row.partial ? 'Partial' : 'Complete'}</td><td className="p-3"><Button size="sm" variant="secondary" disabled={!row.grade_id} onClick={() => { setOverrideRow(row); setOverrideScore(row.override?.score ?? ''); setOverrideReason(row.override?.reason || ''); }}>Override</Button></td></tr>)}
    </tbody></table></div> : <div className="card"><EmptyState title="No grades available" /></div>}
    {rows.some(r => r.breakdown?.length) && <section className="card p-4 space-y-3"><h2 className="font-semibold">Breakdown preview</h2>{rows.slice(0, 6).map(row => <div key={row.student_id}><p className="text-sm mb-1">{row.name} · {row.team_name}</p><ScoreBar value={row.final_score || 0} /></div>)}</section>}
    <Modal open={!!overrideRow} onClose={() => setOverrideRow(null)} title="Override final score"><div className="space-y-3"><label className="text-sm">Score (0–100, blank to clear)<input className="input mt-1" type="number" min="0" max="100" value={overrideScore} onChange={e => setOverrideScore(e.target.value)} /></label><label className="text-sm">Reason<textarea className="input mt-1" value={overrideReason} onChange={e => setOverrideReason(e.target.value)} /></label><Button loading={saving} onClick={saveOverride}>Save override</Button></div></Modal>
  </div></DashboardLayout>;
};
export default UnifiedGrades;

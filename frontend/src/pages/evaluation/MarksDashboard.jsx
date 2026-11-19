import { Fragment, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, EmptyState, SkeletonCard, StatsCard } from '../../components/common';
import { eventAPI, panelAPI } from '../../api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { errorMessage, formatIST, getData, StatusPill } from './shared';

const MarksDashboard = () => {
  const { eventId } = useParams();
  const [presentations, setPresentations] = useState([]);
  const [presentationId, setPresentationId] = useState('');
  const [data, setData] = useState({ rows: [], summary: {}, examiner_stats: [] });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState('');
  const fetchEvent = useCallback(async () => {
    try { const event = getData(await eventAPI.getById(eventId)); const ev = event.event || event; const items = ev.presentation_schedules || []; setPresentations(items); setPresentationId(prev => prev || items[0]?._id || ''); }
    catch (e) { toast.error(errorMessage(e)); }
  }, [eventId]);
  const fetchData = useCallback(async () => {
    if (!presentationId) return;
    try { setData(getData(await panelAPI.dashboard(eventId, presentationId)) || {}); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setLoading(false); }
  }, [eventId, presentationId]);
  useEffect(() => { fetchEvent(); }, [fetchEvent]);
  useEffect(() => { fetchData(); }, [fetchData]);
  useLiveRefresh(fetchData, ['panel', 'dashboard', 'schedule']);
  const finalize = async (force = false) => {
    if (!window.confirm(force ? 'Finalize anyway with teams that have no scores?' : 'Finalize and publish marks?')) return;
    try { await panelAPI.finalize(eventId, presentationId, force); toast.success('Marks finalized'); fetchData(); }
    catch (e) {
      if (e.response?.status === 409 && !force) {
        if (window.confirm(`${e.response.data?.message || 'Some teams have no scores.'} Finalize anyway?`)) finalize(true);
      } else toast.error(errorMessage(e));
    }
  };
  const summary = data.summary || {};
  return <DashboardLayout><div className="space-y-5">
    <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-bold dark:text-white">Marks Dashboard</h1><p className="text-sm text-gray-500">Examiner-normalized presentation marks.</p></div><Button onClick={() => finalize()}>Finalize and publish marks</Button></div>
    <select className="input max-w-md" value={presentationId} onChange={e => setPresentationId(e.target.value)}><option value="">Select presentation</option>{presentations.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}</select>
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[['total','Total'],['completed','Completed'],['in_progress','In progress'],['pending_reschedule','Pending reschedule'],['finalized','Finalized']].map(([key,label]) => <StatsCard key={key} label={label} value={summary[key] || 0} />)}</div>
    {loading ? <SkeletonCard /> : data.rows?.length ? <div className="card overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr className="text-left border-b dark:border-gray-700">{['Time','Team','Panel / room','Status','Judges','Raw mean','Normalized mean','Rank'].map(v => <th className="p-3" key={v}>{v}</th>)}</tr></thead><tbody>{data.rows.map((row, i) => <Fragment key={row.slot_id || i}><tr className="border-b dark:border-gray-800"><td className="p-3">{formatIST(row.start_at)}</td><td className="p-3"><button className="text-left font-medium hover:text-blue-600" onClick={()=>setExpanded(expanded===String(row.slot_id)?'':String(row.slot_id))}>{row.team_name} {expanded===String(row.slot_id)?'−':'+'}</button></td><td className="p-3">{row.panel?.name || row.panel} / {row.room || '—'}</td><td className="p-3"><StatusPill status={row.status} /></td><td className="p-3">{row.judges_submitted}/{row.judges_expected}</td><td className="p-3">{row.raw_mean ?? '—'}</td><td className="p-3">{row.normalized_mean ?? '—'}</td><td className="p-3">{row.raw_rank ?? '—'} → {row.normalized_rank ?? '—'}</td></tr>{expanded===String(row.slot_id)&&<tr><td className="p-3 bg-gray-50 dark:bg-gray-800" colSpan="8">{(row.students||[]).map((student,index)=><p key={student.student_id||index}>{student.name} ({student.enrollment_no}) · {student.marks ?? '—'}/{student.out_of ?? '—'} · {student.attendance}</p>)}</td></tr>}</Fragment>)}</tbody></table></div> : <div className="card"><EmptyState title="No results available yet" /></div>}
    <p className="card p-4 text-sm text-gray-600 dark:text-gray-300">Marks are normalized per examiner inside each panel using z-scores. Differences between panels are not corrected.</p>
    {!!data.examiner_stats?.length && <div className="card p-4 space-y-3"><h2 className="font-semibold dark:text-white">Examiner fairness</h2>{data.examiner_stats.map((e, i) => <div key={e.examinerId || i} className="text-sm"><p>{e.name}: {e.count} scores · mean {e.mean} · std {e.std} · {Number(e.leniency)>0?'+':''}{e.leniency} {Number(e.leniency)>0?'lenient':Number(e.leniency)<0?'strict':'neutral'} · {e.method}{e.reason ? ` (${e.reason})` : ''}</p><div className="relative my-1 h-2 max-w-sm rounded bg-gray-200 dark:bg-gray-700"><div className="absolute left-1/2 top-0 h-2 w-px bg-gray-500"/><div className={`absolute top-0 h-2 rounded ${Number(e.leniency)>=0?'bg-emerald-500':'bg-amber-500'}`} style={{left:Number(e.leniency)>=0?'50%':`${50-Math.min(50,Math.abs(Number(e.leniency)||0))}%`,width:`${Math.min(50,Math.abs(Number(e.leniency)||0))}%`}}/></div></div>)}</div>}
  </div></DashboardLayout>;
};
export default MarksDashboard;

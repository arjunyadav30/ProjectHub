import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, EmptyState, Modal, SkeletonCard } from '../common';
import { contributionAPI, teamAPI } from '../../api';
import { errorMessage, getData } from '../../pages/evaluation/shared';

const FLAG_LABELS = {
  no_mapped_commits: 'No commits could be attributed to this member',
  bulk_dump: 'Large one-time code dump detected',
  last_minute_surge: 'Activity increased sharply near the deadline',
};

const ContributionPanel = ({ teamId }) => {
  const [data, setData] = useState(null);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [scores, setScores] = useState({});
  const [comment, setComment] = useState('');
  const [mappings, setMappings] = useState([]);
  const [mappingOpen, setMappingOpen] = useState(false);
  const fetchData = useCallback(async () => {
    try {
      const [reportRes, teamRes] = await Promise.all([contributionAPI.latest(teamId), teamAPI.getById(teamId)]);
      const latest = getData(reportRes) || {};
      setData(latest);
      setTeam(getData(teamRes));
      const report = latest.report;
      if (report) {
        setScores(Object.fromEntries((report.members || []).map(m => [String(m.student_id?._id || m.student_id), report.guide_decision?.scores?.find(s => String(s.student_id?._id || s.student_id) === String(m.student_id?._id || m.student_id))?.score_100 ?? m.suggested_score_100 ?? 0])));
        setComment(report.guide_decision?.comment || '');
      }
      setMappings((latest.author_map || []).map(m => ({ student_id: String(m.student_id?._id || m.student_id), github_login: m.github_login || '', emails: (m.emails || []).join(', ') })));
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setLoading(false); }
  }, [teamId]);
  useEffect(() => { fetchData(); }, [fetchData]);
  const generate = async () => {
    setBusy(true);
    try { setData(prev => ({ ...prev, generating: true })); await contributionAPI.generate(teamId, { since: since || undefined, until: until || undefined }); toast.success('Contribution report generated'); await fetchData(); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); setData(prev => ({ ...prev, generating: false })); }
  };
  const saveMap = async () => {
    setBusy(true);
    try {
      await contributionAPI.setAuthorMap(teamId, mappings.map(m => ({ student_id: m.student_id, github_login: m.github_login.trim(), emails: m.emails.split(',').map(e => e.trim()).filter(Boolean) })));
      toast.success('GitHub identities saved'); setMappingOpen(false); await fetchData();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const saveDecision = async () => {
    const report = data?.report;
    if (!report?._id) return;
    const values = Object.values(scores).map(Number);
    if (values.some(value => !Number.isFinite(value) || value < 0 || value > 100)) return toast.error('Scores must be from 0 to 100.');
    setBusy(true);
    try { await contributionAPI.saveDecision(report._id, Object.entries(scores).map(([student_id, score_100]) => ({ student_id, score_100: Number(score_100) })), comment); toast.success('Guide decision saved'); fetchData(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const report = data?.report;
  if (loading) return <div className="grid gap-3"><SkeletonCard /></div>;
  return <div className="space-y-4">
    <div className="card p-4 space-y-3"><h2 className="font-semibold dark:text-white">Git Contribution</h2><p className="text-sm text-gray-500">Generate an evidence report from the linked repository.</p>
      <div className="grid sm:grid-cols-2 gap-3"><label className="text-sm">Since<input className="input mt-1" type="date" value={since} onChange={e => setSince(e.target.value)} /></label><label className="text-sm">Until<input className="input mt-1" type="date" value={until} onChange={e => setUntil(e.target.value)} /></label></div>
      <Button loading={busy} onClick={generate}>{data?.generating ? 'Generating report… this may take a minute' : 'Generate report'}</Button>
    </div>
    {!report ? <div className="card"><EmptyState title="No contribution report yet" /></div> : <>
      <section className="card p-4 space-y-3"><h3 className="font-semibold dark:text-white">{report.repo_full_name}</h3><p className="text-sm text-gray-500">{report.fetched_commits} fetched · {report.analyzed_commits} analyzed · {report.detail_commits_fetched} detailed</p>
        {report.truncated && <p className="text-sm text-amber-700">Commit history was truncated.</p>}{report.notes?.map((note, i) => <p className="text-sm" key={i}>{note}</p>)}
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead><tr className="text-left border-b dark:border-gray-700">{['Student','Commits','Lines','Active days','PRs','Quality','Share','Suggested score','Flags'].map(h=><th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>
          {(report.members || []).map((member, i) => { const student = typeof member.student_id === 'object' ? member.student_id : null; return <tr className="border-b dark:border-gray-800" key={String(student?._id || member.student_id || i)}><td className="p-2">{member.name || student?.name || 'Student'}</td><td className="p-2">{member.commits}</td><td className="p-2">{member.effective_lines}</td><td className="p-2">{member.active_days}</td><td className="p-2">{member.pull_requests}</td><td className="p-2">{Math.round((member.message_quality || 0) * 100)}%</td><td className="p-2"><div className="relative min-w-24 h-5"><div className="absolute inset-y-1 left-0 bg-blue-200 dark:bg-blue-900/50 rounded" style={{width:`${Math.min(100,member.share_percent||0)}%`}}/><div className="absolute inset-y-0 border-l-2 border-dashed border-red-500" style={{left:`${Math.min(100,member.equal_share_percent||0)}%`}}/><span className="relative px-1 text-xs">{member.share_percent}%</span></div></td><td className="p-2">{member.suggested_score_100}</td><td className="p-2">{(member.flags || []).map(flag => <span key={flag} title={FLAG_LABELS[flag] || flag} className="mr-1 rounded bg-amber-100 px-2 py-1 text-xs">{FLAG_LABELS[flag] || flag}</span>)}</td></tr>; })}
        </tbody></table></div>
      </section>
      {!!report.unmapped_authors?.length && <div className="card p-4 bg-amber-50 dark:bg-amber-900/20"><h3 className="font-semibold">Unmapped GitHub authors</h3>{report.unmapped_authors.map((a,i)=><p key={`${a.login}-${i}`} className="text-sm">{a.login} · {a.commits} commits</p>)}<p className="text-xs mt-2">Edit GitHub identity mappings below and regenerate the report.</p></div>}
      <section className="card p-4 space-y-3"><h3 className="font-semibold dark:text-white">GitHub identity mapping</h3><p className="text-sm text-gray-500">Used to attribute commits correctly.</p><Button size="sm" variant="secondary" onClick={()=>setMappingOpen(true)}>Edit GitHub mapping</Button></section>
      <section className="card p-4 space-y-3"><h3 className="font-semibold dark:text-white">Guide decision</h3>{(report.members || []).map((m,i)=>{const sid=String(m.student_id?._id || m.student_id);return <label key={sid||i} className="flex items-center justify-between gap-3 text-sm">{m.name || m.student_id?.name || 'Student'}<input className="input max-w-28" type="number" min="0" max="100" value={scores[sid] ?? m.suggested_score_100 ?? 0} onChange={e=>setScores(prev=>({...prev,[sid]:e.target.value}))}/></label>;})}
        <textarea className="input min-h-20" placeholder="Guide comment" value={comment} onChange={e=>setComment(e.target.value)}/><p className="text-sm font-medium">These numbers are suggestions computed from commit data. The guide makes the final decision.</p>
        <Button loading={busy} onClick={saveDecision}>Save guide decision</Button>{report.guide_decision?.decided_at && <p className="text-xs text-gray-500">Finalized by guide on {new Date(report.guide_decision.decided_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})}</p>}
      </section>
    </>}
    <Modal open={mappingOpen} onClose={()=>setMappingOpen(false)} title="Edit GitHub mapping" size="lg"><div className="space-y-3">{mappings.map((mapping,index)=>{const member=team?.members?.find(m=>String(m.student_id?._id || m.student_id)===mapping.student_id);return <div key={mapping.student_id || index} className="grid sm:grid-cols-3 gap-2"><p className="text-sm self-center">{member?.student_id?.name || 'Team member'}</p><input className="input" placeholder="GitHub username" value={mapping.github_login} onChange={e=>setMappings(prev=>prev.map((m,i)=>i===index?{...m,github_login:e.target.value}:m))}/><input className="input" placeholder="Emails, comma-separated" value={mapping.emails} onChange={e=>setMappings(prev=>prev.map((m,i)=>i===index?{...m,emails:e.target.value}:m))}/></div>;})}<Button size="sm" variant="secondary" loading={busy} onClick={saveMap}>Save identity mappings</Button></div></Modal>
  </div>;
};
export default ContributionPanel;

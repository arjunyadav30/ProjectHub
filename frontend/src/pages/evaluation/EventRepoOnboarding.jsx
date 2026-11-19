import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, EmptyState, ProgressBar, SkeletonCard } from '../../components/common';
import { contributionAPI } from '../../api';
import { errorMessage, formatIST, getData } from './shared';
import OnboardingStatus, { statusLabel } from '../../components/contribution/OnboardingStatus';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import { downloadCSV } from '../../utils';
import { BellRing, Download, Play, RefreshCw, Search } from 'lucide-react';

const FUNNEL = [
  { key: 'total', label: 'Approved teams', className: 'text-gray-900 dark:text-white' },
  { key: 'no_repo', label: 'No repository', className: 'text-red-600' },
  { key: 'mapping_needed', label: 'Mapping needed', className: 'text-amber-600' },
  { key: 'ready', label: 'Ready', className: 'text-blue-600' },
  { key: 'analyzed', label: 'Analyzed', className: 'text-green-600' },
  { key: 'decided', label: 'Decided', className: 'text-teal-600' },
];

const csvCell = (value) => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const EventRepoOnboarding = () => {
  const { eventId } = useParams();
  const [data, setData] = useState({ funnel: {}, rows: [] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('total');
  const [search, setSearch] = useState('');
  const [reminding, setReminding] = useState('');
  const [starting, setStarting] = useState('');
  const [job, setJob] = useState(null);
  const [reanalyzingId, setReanalyzingId] = useState('');

  const load = useCallback(async () => {
    try {
      setData(getData(await contributionAPI.eventOnboarding(eventId)) || { funnel: {}, rows: [] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useRefetchOnFocus(load, { liveScopes: ['teams', 'dashboard'] });

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!job?.id || job.status !== 'running') return undefined;
    let active = true;
    const tick = async () => {
      try {
        const status = getData(await contributionAPI.analyzeAllStatus(eventId, job.id));
        if (!active) return;
        setJob((prev) => ({ ...prev, ...status }));
        if (status.status !== 'running') {
          if (status.status === 'done') toast.success(`Analysis finished: ${status.done}/${status.total} team(s).`);
          else if (status.status === 'paused_rate_limit') toast.error(status.message || 'Paused by the GitHub rate limit.');
          else toast.error(status.message || 'Analysis job failed.');
          load();
        }
      } catch (e) {
        if (active) { toast.error(errorMessage(e)); setJob(null); }
      }
    };
    const timer = setInterval(tick, 3000);
    tick();
    return () => { active = false; clearInterval(timer); };
  }, [job?.id, job?.status, eventId, load]);

  const rows = data?.rows || [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== 'total' && row.status !== filter) return false;
      if (!term) return true;
      return [row.team_name, row.repo_full_name, row.mentor_name].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [rows, filter, search]);

  const staleCount = rows.filter((row) => row.stale && row.status === 'analyzed').length;

  const remind = async (statuses, label) => {
    if (!window.confirm(`Send a reminder to ${label}? Teams already reminded in the last 24 hours will be skipped.`)) return;
    setReminding(statuses[0]);
    try {
      const result = getData(await contributionAPI.remindOnboarding(eventId, { statuses }));
      toast.success(`Reminded ${result.notified_count || 0} team(s)${result.skipped_count ? `, skipped ${result.skipped_count}` : ''}.`);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setReminding('');
    }
  };

  const startAnalysis = async (onlyStale) => {
    setStarting(onlyStale ? 'stale' : 'all');
    try {
      const result = getData(await contributionAPI.analyzeAll(eventId, onlyStale ? { only_stale: true } : {}));
      if (!result.total) {
        toast('No eligible teams found.');
        await load();
        return;
      }
      setJob({ id: result.job_id, status: 'running', total: result.total, done: 0, failed: [], message: '' });
      toast.success(`Analysis started for ${result.total} team(s).`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setStarting('');
    }
  };

  const reanalyze = async (teamId) => {
    setReanalyzingId(String(teamId));
    try {
      await contributionAPI.generate(teamId, {});
      toast.success('Contribution report regenerated.');
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setReanalyzingId('');
    }
  };

  const exportCsv = () => {
    const header = ['Team', 'Mentor', 'Repository', 'Mapped', 'Members', 'Status', 'Stale', 'Last analysis'];
    const lines = [header, ...filtered.map((row) => [
      row.team_name,
      row.mentor_name,
      row.repo_full_name,
      row.mapped_count,
      row.members_count,
      statusLabel(row.status),
      row.stale ? 'yes' : 'no',
      row.last_report_at ? formatIST(row.last_report_at) : '',
    ])].map((values) => values.map(csvCell).join(','));
    downloadCSV(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }), `repo-onboarding-${eventId}.csv`);
  };

  const running = job?.status === 'running';

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Repository onboarding</h1>
            <p className="text-sm text-gray-500">Link public repositories, map contributors, and run contribution analysis across the event.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!filtered.length}><Download className="w-4 h-4" /> Export CSV</Button>
            <Button size="sm" variant="secondary" loading={starting === 'stale'} disabled={running || !staleCount} onClick={() => startAnalysis(true)}><RefreshCw className="w-4 h-4" /> Re-analyze stale ({staleCount})</Button>
            <Button size="sm" loading={starting === 'all'} disabled={running || !data?.funnel?.ready} onClick={() => startAnalysis(false)}><Play className="w-4 h-4" /> Analyze ready teams</Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" loading={reminding === 'no_repo'} disabled={!!reminding || !data?.funnel?.no_repo} onClick={() => remind(['no_repo'], 'teams without a repository')}><BellRing className="w-4 h-4" /> Remind no-repo ({data?.funnel?.no_repo || 0})</Button>
          <Button size="sm" variant="secondary" loading={reminding === 'mapping_needed'} disabled={!!reminding || !data?.funnel?.mapping_needed} onClick={() => remind(['mapping_needed'], 'teams with unmapped contributors')}><BellRing className="w-4 h-4" /> Remind unmapped ({data?.funnel?.mapping_needed || 0})</Button>
        </div>

        {running && (
          <div className="card p-4 space-y-2">
            <div className="flex justify-between text-sm"><span>Analyzing teams…</span><span>{job.done}/{job.total}</span></div>
            <ProgressBar percent={job.total ? (job.done / job.total) * 100 : 0} />
            {!!job.failed?.length && <p className="text-xs text-amber-700 dark:text-amber-400">{job.failed.length} team(s) failed. See the report status after the job completes.</p>}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {FUNNEL.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`card p-3 text-left transition-colors ${filter === item.key ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              <p className={`text-2xl font-bold ${item.className}`}>{data?.funnel?.[item.key] || 0}</p>
              <p className="text-xs text-gray-500">{item.label}</p>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search team, repository, or mentor" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? <SkeletonCard /> : (
          <div className="card overflow-x-auto">
            {!filtered.length ? <EmptyState title="No teams match this view" description="Adjust the status filter or search term." /> : (
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="text-left border-b dark:border-gray-700">
                    {['Team', 'Mentor', 'Repository', 'Contributors', 'Status', 'Last analysis', ''].map((heading) => <th key={heading} className="p-3">{heading}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={String(row.team_id)} className="border-b dark:border-gray-800">
                      <td className="p-3 font-medium dark:text-white">{row.team_name}</td>
                      <td className="p-3">{row.mentor_name || '—'}</td>
                      <td className="p-3 break-all">{row.repo_full_name || <span className="text-gray-400">not linked</span>}</td>
                      <td className="p-3">{row.mapped_count}/{row.members_count}</td>
                      <td className="p-3"><OnboardingStatus status={row.status} stale={row.stale} /></td>
                      <td className="p-3">{row.last_report_at ? formatIST(row.last_report_at) : '—'}</td>
                      <td className="p-3 text-right">
                        {row.status === 'analyzed' && row.stale && (
                          <Button size="sm" variant="secondary" loading={reanalyzingId === String(row.team_id)} disabled={!!reanalyzingId || running} onClick={() => reanalyze(row.team_id)}>
                            Re-analyze
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default EventRepoOnboarding;

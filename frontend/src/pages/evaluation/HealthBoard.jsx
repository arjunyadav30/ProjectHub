import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Activity } from 'lucide-react';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, EmptyState, Modal, SkeletonCard, StatsCard } from '../../components/common';
import { healthMonitorAPI } from '../../api';
import { errorMessage, formatIST, getData, StatusPill } from './shared';

const HealthBoard = () => {
  const { eventId } = useParams();
  const [data, setData] = useState({ summary: {}, rows: [] });
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState(null);
  const [checking, setChecking] = useState('');
  const fetchData = useCallback(async () => {
    try { setData(getData(await healthMonitorAPI.event(eventId)) || { summary: {}, rows: [] }); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setLoading(false); }
  }, [eventId]);
  useEffect(() => { fetchData(); const timer = setInterval(fetchData, 60000); return () => clearInterval(timer); }, [fetchData]);
  const checkNow = async teamId => {
    setChecking(teamId);
    try { await healthMonitorAPI.checkNow(teamId); await fetchData(); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setChecking(''); }
  };
  const summary = data.summary || {};
  return <DashboardLayout><div className="space-y-5">
    <div><h1 className="text-2xl font-bold dark:text-white">Live Links Health</h1><p className="text-sm text-gray-500">Checks refresh every 60 seconds.</p></div>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{['up', 'slow', 'down', 'unknown', 'no_link'].map((key, i) => <StatsCard key={key} label={key.replace('_', ' ')} value={summary[key] || 0} color={['green', 'amber', 'red', 'blue', 'teal'][i]} />)}</div>
    {loading ? <div className="grid gap-3 md:grid-cols-2"><SkeletonCard /><SkeletonCard /></div>
      : data.rows?.length ? <div className="grid gap-4 md:grid-cols-2">{data.rows.map(team => <article key={team.team_id} className="card p-4 space-y-3">
        <div className="flex justify-between gap-2"><div><h2 className="font-semibold dark:text-white">{team.team_name}</h2><p className="text-sm text-gray-500">{team.project_title || 'Project'}</p></div><StatusPill status={team.status} /></div>
        {team.live_link && <a className="text-sm text-blue-600 hover:underline break-all" href={team.live_link} target="_blank" rel="noopener noreferrer">{team.live_link}</a>}
        <p className="text-xs text-gray-500">Uptime {team.uptime_percent ?? '—'}% · Avg {team.avg_response_ms ?? '—'}ms · Last {team.last_response_ms ?? '—'}ms · {formatIST(team.last_checked_at)}</p>
        {team.last_error && <p className="text-sm text-red-600 dark:text-red-400">{team.last_error}</p>}
        <div className="flex gap-2"><Button size="sm" loading={checking === team.team_id} onClick={() => checkNow(team.team_id)}>Check now</Button><Button size="sm" variant="secondary" onClick={async () => {
          try { setHistory({ name: team.team_name, ...(getData(await healthMonitorAPI.team(team.team_id)) || {}) }); }
          catch (e) { toast.error(errorMessage(e)); }
        }}>History</Button></div>
      </article>)}</div> : <div className="card"><EmptyState icon={Activity} title="No team health data available" /></div>}
    <Modal open={!!history} onClose={() => setHistory(null)} title={`${history?.name || 'Team'} health history`} size="lg">
      <div className="space-y-2">{history?.health && <StatusPill status={history.health.status} />}
        {!!history?.history?.length && <svg viewBox="0 0 600 120" className="w-full h-32 rounded bg-gray-50 dark:bg-gray-800" role="img" aria-label="Recent response time history">
          <polyline fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500" points={history.history.slice(0, 30).reverse().map((item, index, list) => {
            const max = Math.max(1, ...list.map(point => Number(point.response_ms) || 0));
            const x = list.length < 2 ? 300 : index * 580 / (list.length - 1) + 10;
            const y = 105 - ((Number(item.response_ms) || 0) / max) * 90;
            return `${x},${y}`;
          }).join(' ')} />
          {history.history.slice(0, 30).reverse().map((item, index, list) => {
            const max = Math.max(1, ...list.map(point => Number(point.response_ms) || 0));
            const x = list.length < 2 ? 300 : index * 580 / (list.length - 1) + 10;
            const y = 105 - ((Number(item.response_ms) || 0) / max) * 90;
            const fill = item.status === 'up' ? '#16a34a' : item.status === 'slow' ? '#d97706' : '#dc2626';
            return <circle key={item._id || index} cx={x} cy={y} r="4" fill={fill}><title>{`${item.status}: ${item.response_ms ?? '—'}ms`}</title></circle>;
          })}
        </svg>}
        {(history?.history || []).map((item, index) => <div key={item._id || index} className="flex justify-between border-b border-gray-100 dark:border-gray-700 py-2 text-sm"><span>{formatIST(item.checked_at)}</span><span>{item.response_ms ?? '—'} ms · {item.http_status || item.error || item.status}</span></div>)}
      </div>
    </Modal>
  </div></DashboardLayout>;
};
export default HealthBoard;

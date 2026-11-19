import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, SkeletonCard } from '../../components/common';
import { healthMonitorAPI } from '../../api';
import { errorMessage, formatIST, getData, StatusPill } from './shared';

const TeamHealthPanel = ({ teamId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const load = useCallback(async () => {
    try { setData(getData(await healthMonitorAPI.team(teamId))); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setLoading(false); }
  }, [teamId]);
  useEffect(() => { load(); }, [load]);
  const checkNow = async () => {
    setChecking(true);
    try { await healthMonitorAPI.checkNow(teamId); toast.success('Health check complete'); await load(); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setChecking(false); }
  };
  if (loading) return <SkeletonCard />;
  const health = data?.health || {};
  return <section className="card p-4 space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold dark:text-white">Live link health</h2><StatusPill status={health.status} /></div>
    {data?.live_link ? <a href={data.live_link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 break-all hover:underline">{data.live_link}</a> : <p className="text-sm text-gray-500">No live link configured.</p>}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm"><p>Checked: {formatIST(health.last_checked_at)}</p><p>Response: {health.last_response_ms ?? '—'} ms</p><p>Uptime 7d: {data?.uptime_7d?.uptime_percent ?? '—'}%</p><p>Uptime 30d: {data?.uptime_30d?.uptime_percent ?? '—'}%</p></div>
    {health.last_error && <p className="text-sm text-red-600 dark:text-red-400">{health.last_error}</p>}
    <Button size="sm" loading={checking} onClick={checkNow}>Check now</Button>
    {!!data?.history?.length && <div className="max-h-52 overflow-auto">{data.history.map((item, index) => <div key={item._id || index} className="flex justify-between border-t dark:border-gray-700 py-2 text-xs"><span>{formatIST(item.checked_at)}</span><span>{item.response_ms ?? '—'}ms · {item.error || item.status}</span></div>)}</div>}
  </section>;
};
export default TeamHealthPanel;

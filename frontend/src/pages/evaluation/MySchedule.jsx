import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, EmptyState, SkeletonCard } from '../../components/common';
import { scheduleAPI } from '../../api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { downloadCSV } from '../../utils';
import { errorMessage, formatIST, getData, StatusPill } from './shared';

const MySchedule = () => {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchSlots = useCallback(async () => {
    try { const data = getData(await scheduleAPI.mine()); setSlots(data?.slots || data || []); }
    catch (e) { toast.error(e.response?.status === 403 ? 'You are not an examiner for this slot.' : errorMessage(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchSlots(); }, [fetchSlots]);
  useLiveRefresh(fetchSlots, ['schedule', 'dashboard']);
  return <DashboardLayout><div className="space-y-5">
    <div className="flex justify-between gap-3"><div><h1 className="text-2xl font-bold dark:text-white">My Schedule</h1><p className="text-sm text-gray-500">Slots you mentor or examine.</p></div>
      <Button onClick={async () => { try { const r = await scheduleAPI.myCalendar(); downloadCSV(r.data, 'projecthub-schedule.ics'); } catch (e) { toast.error(errorMessage(e)); } }}>Add all upcoming</Button></div>
    {loading ? <div className="grid gap-4 md:grid-cols-2"><SkeletonCard /><SkeletonCard /></div>
      : slots.length ? slots.map(slot => <article key={slot._id} className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold dark:text-white">{slot.team?.team_name || slot.team_name}</h2><p className="text-sm text-gray-500">{formatIST(slot.start_at)} · {slot.panel?.name} {slot.panel?.room && `· ${slot.panel.room}`}</p></div>
        <div className="flex items-center gap-2"><StatusPill status={slot.status} /><Button size="sm" variant="secondary" onClick={async () => { try { const r = await scheduleAPI.slotCalendar(slot._id); downloadCSV(r.data, `slot-${slot._id}.ics`); } catch (e) { toast.error(errorMessage(e)); } }}>Calendar</Button><Link to={`/panel/slots/${slot._id}`} className="btn-primary px-3 py-2 rounded-lg text-sm">Score</Link></div>
      </article>) : <div className="card"><EmptyState title="No schedule slots found" />{null}</div>}
  </div></DashboardLayout>;
};
export default MySchedule;

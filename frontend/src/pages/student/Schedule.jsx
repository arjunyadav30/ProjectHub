import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarClock } from 'lucide-react';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, EmptyState, Modal, SkeletonCard } from '../../components/common';
import { scheduleAPI } from '../../api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { downloadCSV } from '../../utils';
import { errorMessage, formatIST, getData, StatusPill, useCountdown } from '../evaluation/shared';

const SlotCard = ({ slot, onRequest }) => {
  const countdown = useCountdown(slot.start_at);
  return (
    <article className="card p-5 space-y-3">
      <div className="flex flex-wrap justify-between gap-2">
        <div><h2 className="font-semibold text-gray-900 dark:text-white">{slot.team_id?.team_name || slot.team_name || 'Team presentation'}</h2>
          <p className="text-sm text-gray-500">{slot.panel_id?.name || 'Panel'}{slot.panel_id?.room ? ` · ${slot.panel_id.room}` : ''}</p></div>
        <StatusPill status={slot.status} />
      </div>
      <p className="text-sm">{formatIST(slot.start_at)} – {formatIST(slot.end_at)}</p>
      {slot.status === 'scheduled' && <p className="text-sm text-blue-600 dark:text-blue-400">Starts in {countdown}</p>}
      {slot.reschedule_request?.status && slot.reschedule_request.status !== 'none' && <div className="text-sm rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3">
        <StatusPill status={slot.reschedule_request.status} />
        {slot.reschedule_request.decision_note && <p className="mt-1">{slot.reschedule_request.decision_note}</p>}
      </div>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={async () => {
          try { const r = await scheduleAPI.slotCalendar(slot._id); downloadCSV(r.data, `projecthub-slot-${slot._id}.ics`); }
          catch (e) { toast.error(errorMessage(e)); }
        }}>Add to calendar</Button>
        <Button size="sm" variant="secondary" disabled={slot.status !== 'scheduled'} onClick={() => onRequest(slot)}>Request change</Button>
      </div>
    </article>
  );
};

const StudentSchedule = () => {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');
  const [preferredAt, setPreferredAt] = useState('');
  const [saving, setSaving] = useState(false);
  const fetchSlots = useCallback(async () => {
    try { const data = getData(await scheduleAPI.mine()); setSlots(data?.slots || data || []); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchSlots(); }, [fetchSlots]);
  useLiveRefresh(fetchSlots, ['schedule', 'dashboard']);
  const submitRequest = async () => {
    if (reason.trim().length < 10) return toast.error('Please provide a reason of at least 10 characters.');
    setSaving(true);
    try {
      await scheduleAPI.requestReschedule(selected._id, { reason: reason.trim(), preferred_start: preferredAt || undefined });
      toast.success('Change request submitted'); setSelected(null); setReason(''); setPreferredAt(''); fetchSlots();
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setSaving(false); }
  };
  return <DashboardLayout><div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold dark:text-white">My Schedule</h1><p className="text-sm text-gray-500">Published team presentation slots in India time.</p></div>
      <Button onClick={async () => { try { const r = await scheduleAPI.myCalendar(); downloadCSV(r.data, 'projecthub-schedule.ics'); } catch (e) { toast.error(errorMessage(e)); } }}>Add all upcoming</Button></div>
    {loading ? <div className="grid gap-4 md:grid-cols-2"><SkeletonCard /><SkeletonCard /></div>
      : slots.length ? <div className="grid gap-4 md:grid-cols-2">{slots.map(slot => <SlotCard key={slot._id} slot={slot} onRequest={setSelected} />)}</div>
        : <div className="card"><EmptyState icon={CalendarClock} title="No published slots yet" /></div>}
    <Modal open={!!selected} onClose={() => setSelected(null)} title="Request schedule change">
      <div className="space-y-3"><label className="block text-sm">Reason<textarea className="input mt-1 min-h-24" value={reason} onChange={e => setReason(e.target.value)} minLength={10} /></label>
        <label className="block text-sm">Preferred date and time (optional)<input className="input mt-1" type="datetime-local" value={preferredAt} onChange={e => setPreferredAt(e.target.value)} /></label>
        <Button loading={saving} onClick={submitRequest}>Submit request</Button></div>
    </Modal>
  </div></DashboardLayout>;
};

export default StudentSchedule;

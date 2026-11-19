import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, EmptyState, MultiSelect, Modal, SkeletonCard } from '../../components/common';
import { eventAPI, scheduleAPI, userAPI } from '../../api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { errorMessage, formatIST, getData, StatusPill } from './shared';

const EventSchedule = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [panels, setPanels] = useState([]);
  const [slots, setSlots] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [presentationId, setPresentationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [panelForm, setPanelForm] = useState({ name: '', room: '', examiners: [] });
  const [dates, setDates] = useState('');
  const [scheduleConfig, setScheduleConfig] = useState({ day_start: '09:30', day_end: '16:30', slot_minutes: 15, buffer_minutes: 5, break_start: '13:00', break_end: '14:00', avoid_mentor_on_panel: true });
  const [preview, setPreview] = useState(null);
  const fetchData = useCallback(async () => {
    try {
      const [eventRes, panelRes, facultyRes] = await Promise.all([eventAPI.getById(eventId), scheduleAPI.listPanels(eventId), userAPI.getAllFaculty()]);
      const ev = getData(eventRes); setEvent(ev.event || ev);
      const presentations = (ev.event || ev).presentation_schedules || [];
      setPresentationId(prev => prev || presentations[0]?._id || '');
      setPanels(getData(panelRes) || []);
      const f = getData(facultyRes); setFaculty(Array.isArray(f) ? f : f.faculty || []);
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setLoading(false); }
  }, [eventId]);
  const fetchSlots = useCallback(async () => {
    if (!presentationId) return;
    try { const d = getData(await scheduleAPI.slots(eventId, presentationId)); setSlots(d.slots || d || []); }
    catch (e) { toast.error(errorMessage(e)); }
  }, [eventId, presentationId]);
  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchSlots(); }, [fetchSlots]);
  useLiveRefresh(fetchSlots, ['schedule', 'dashboard']);
  const panelSave = async () => {
    setBusy(true);
    try { if (panelForm._id) await scheduleAPI.updatePanel(eventId, panelForm._id, panelForm); else await scheduleAPI.createPanel(eventId, panelForm); setModal(false); setPanelForm({name:'',room:'',examiners:[]}); fetchData(); toast.success('Panel saved'); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const runAuto = async dry_run => {
    if (!dates.trim()) return toast.error('Enter at least one date (YYYY-MM-DD).');
    if (!dry_run && !window.confirm('Generate schedule? Existing unpublished slots will be replaced.')) return;
    const config = { days: dates.split(',').map(x=>x.trim()).filter(Boolean), day_start:scheduleConfig.day_start, day_end:scheduleConfig.day_end, slot_minutes:Number(scheduleConfig.slot_minutes), buffer_minutes:Number(scheduleConfig.buffer_minutes), breaks:[{start:scheduleConfig.break_start,end:scheduleConfig.break_end}], avoid_mentor_on_panel:scheduleConfig.avoid_mentor_on_panel, dry_run };
    setBusy(true);
    try { const d=getData(await scheduleAPI.auto(eventId,presentationId,config)); setPreview(d); if(!dry_run){toast.success('Schedule generated');fetchSlots();} }
    catch(e){toast.error(errorMessage(e));} finally{setBusy(false);}
  };
  const publish = async () => { if(!window.confirm('Publish schedule and notify everyone?'))return; try{await scheduleAPI.publish(eventId,presentationId);toast.success('Schedule published');fetchSlots();}catch(e){toast.error(errorMessage(e));} };
  const presentations=event?.presentation_schedules||[];
  return <DashboardLayout><div className="space-y-5">
    <h1 className="text-2xl font-bold dark:text-white">Event Schedule · {event?.title || ''}</h1>
    {loading?<SkeletonCard/>:<>
      <select className="input max-w-lg" value={presentationId} onChange={e=>setPresentationId(e.target.value)}><option value="">Select presentation</option>{presentations.map(p=><option key={p._id} value={p._id}>{p.title}</option>)}</select>
      <section className="card p-4 space-y-3"><div className="flex justify-between"><h2 className="font-semibold dark:text-white">Panels</h2><Button size="sm" onClick={()=>{setPanelForm({name:'',room:'',examiners:[]});setModal(true);}}>Add panel</Button></div>
        {panels.length?panels.map(p=><div key={p._id} className="flex flex-wrap justify-between border-b dark:border-gray-700 py-2"><span>{p.name} · {p.room || 'No room'} · {(p.examiners||[]).map(f=>f.name||f).join(', ')}</span><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={()=>{setPanelForm({...p,examiners:(p.examiners||[]).map(f=>String(f._id||f))});setModal(true);}}>Edit</Button><Button size="sm" variant="danger" onClick={async()=>{if(!window.confirm('Delete this panel?'))return;try{await scheduleAPI.deletePanel(eventId,p._id);fetchData();}catch(e){toast.error(errorMessage(e));}}}>Delete</Button></div></div>):<EmptyState title="No panels configured"/>}
      </section>
      <section className="card p-4 space-y-3"><h2 className="font-semibold dark:text-white">Auto-schedule</h2><label className="block text-sm">Dates, comma-separated<input className="input mt-1" placeholder="2026-11-01, 2026-11-02" value={dates} onChange={e=>setDates(e.target.value)}/></label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{[['day_start','Day starts'],['day_end','Day ends'],['break_start','Break starts'],['break_end','Break ends']].map(([key,label])=><label key={key} className="text-sm">{label}<input className="input mt-1" type="time" value={scheduleConfig[key]} onChange={e=>setScheduleConfig(p=>({...p,[key]:e.target.value}))}/></label>)}{[['slot_minutes','Slot minutes',5,120],['buffer_minutes','Buffer minutes',0,60]].map(([key,label,min,max])=><label key={key} className="text-sm">{label}<input className="input mt-1" type="number" min={min} max={max} value={scheduleConfig[key]} onChange={e=>setScheduleConfig(p=>({...p,[key]:e.target.value}))}/></label>)}</div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={scheduleConfig.avoid_mentor_on_panel} onChange={e=>setScheduleConfig(p=>({...p,avoid_mentor_on_panel:e.target.checked}))}/>Keep a mentor off their own team's panel</label>
        <div className="flex gap-2"><Button variant="secondary" loading={busy} onClick={()=>runAuto(true)}>Preview</Button><Button loading={busy} onClick={()=>runAuto(false)}>Generate schedule</Button></div>
        {preview&&<div className="space-y-2"><h3 className="font-medium">Preview assignments</h3>{(preview.assignments||[]).map((a,i)=><p key={`${a.team_id}-${i}`} className="text-sm">{a.team_name||'Team'} · {panels.find(p=>String(p._id)===String(a.panel_id))?.name||'Panel'} · {formatIST(a.start_at)}</p>)}{(preview.unscheduled||[]).map((u,i)=><p key={`${u.team_id}-${i}`} className="text-sm text-red-600">{u.team_name||'Team'}: {({not_enough_slots:'Not enough available slots',mentor_on_every_available_panel:'Mentor is on every available panel',mentor_busy_examining:'Mentor is busy examining'})[u.reason]||u.reason}</p>)}</div>}
      </section>
      <section className="card p-4 space-y-3"><div className="flex justify-between"><h2 className="font-semibold dark:text-white">Timetable</h2><Button size="sm" onClick={publish} disabled={!slots.length}>Publish schedule</Button></div>
        {slots.length?slots.map(slot=><div key={slot._id} className="flex flex-wrap justify-between gap-2 border-b dark:border-gray-700 py-3"><div><p className="font-medium">{slot.team_id?.team_name||slot.team_name||'Team'} · {slot.panel_id?.name||slot.panel_name}</p><p className="text-sm text-gray-500">{formatIST(slot.start_at)} – {formatIST(slot.end_at)} <StatusPill status={slot.status}/> <span className="text-xs">{slot.published?'Published':'Draft'}</span></p>{slot.reschedule_request?.reason&&<p className="text-xs text-amber-600">Reschedule ({slot.reschedule_request.status}): {slot.reschedule_request.reason} {slot.reschedule_request.decision_note}</p>}</div><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={async()=>{const newStart=window.prompt('New start date/time',new Date(slot.start_at).toISOString().slice(0,16));if(!newStart)return;const panelName=window.prompt('Panel name',slot.panel_id?.name||'');if(!panelName)return;const panel=panels.find(p=>p.name.toLowerCase()===panelName.trim().toLowerCase());if(!panel)return toast.error('Panel name not found.');try{await scheduleAPI.updateSlot(slot._id,{start_at:new Date(newStart).toISOString(),panel_id:panel._id});fetchSlots();}catch(e){toast.error(errorMessage(e));}}}>Edit time / panel</Button>{slot.reschedule_request?.status==='pending'&&<><Button size="sm" onClick={async()=>{const proposed=window.prompt('New start time (optional, ISO/local date-time)',slot.reschedule_request.preferred_start?new Date(slot.reschedule_request.preferred_start).toISOString().slice(0,16):'');const note=window.prompt('Decision note (optional)','')||'';try{await scheduleAPI.decideReschedule(slot._id,{decision:'approved',new_start_at:proposed?new Date(proposed).toISOString():undefined,note});fetchSlots();}catch(e){toast.error(errorMessage(e));}}}>Approve</Button><Button size="sm" variant="danger" onClick={async()=>{const note=window.prompt('Reason for rejection (optional)','')||'';try{await scheduleAPI.decideReschedule(slot._id,{decision:'rejected',note});fetchSlots();}catch(e){toast.error(errorMessage(e));}}}>Reject</Button></>}</div></div>):<EmptyState title="No slots generated yet"/>}
      </section>
    </>}
    <Modal open={modal} onClose={()=>setModal(false)} title={panelForm._id?'Edit panel':'Create panel'}><div className="space-y-3"><input className="input" placeholder="Panel name" value={panelForm.name||''} onChange={e=>setPanelForm(p=>({...p,name:e.target.value}))}/><input className="input" placeholder="Room" value={panelForm.room||''} onChange={e=>setPanelForm(p=>({...p,room:e.target.value}))}/><MultiSelect label="Examiners" options={faculty.map(f=>f.name || f.faculty_id).filter(Boolean)} value={(panelForm.examiners||[]).map(id=>faculty.find(f=>String(f._id)===String(id))?.name).filter(Boolean)} onChange={names=>setPanelForm(p=>({...p,examiners:names.map(n=>faculty.find(f=>(f.name||f.faculty_id)===n)?._id).filter(Boolean)}))}/>{!faculty.length&&<p className="text-xs text-amber-600">No faculty list returned by the existing API.</p>}<Button loading={busy} onClick={panelSave}>Save panel</Button></div></Modal>
  </div></DashboardLayout>;
};
export default EventSchedule;

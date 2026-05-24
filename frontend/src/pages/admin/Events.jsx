import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventAPI, adminAPI } from '../../api';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, Input, Badge, Modal } from '../../components/common';
import { Plus, Calendar, Users, Eye, Pencil, Trash2, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage, formatDate } from '../../utils';

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const BRANCHES = ['CSE', 'IT', 'ECE', 'ME', 'CE', 'EE'];

const defaultForm = {
  title: '', description: '',
  min_team_size: 1, max_team_size: 4,
  registration_start: '', registration_end: '', event_end_date: '',
  allowed_semesters: [], allowed_branches: [],
};

const AdminEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await eventAPI.getAll();
      setEvents(res.data.data?.events || res.data.data || []);
    } catch (e) { toast.error('Failed to load events'); }
    finally { setLoading(false); }
  }, []);

  useRefetchOnFocus(fetchEvents);

  const openCreate = () => { setEditEvent(null); setForm(defaultForm); setShowModal(true); };
  const openEdit = (ev) => {
    setEditEvent(ev);
    setForm({
      title: ev.title, description: ev.description,
      min_team_size: ev.min_team_size || 1, max_team_size: ev.max_team_size || 4,
      registration_start: ev.registration_start?.slice(0, 10) || '',
      registration_end: ev.registration_end?.slice(0, 10) || '',
      event_end_date: ev.event_end_date?.slice(0, 10) || '',
      allowed_semesters: ev.allowed_semesters || [],
      allowed_branches: ev.allowed_branches || [],
    });
    setShowModal(true);
  };

  const toggleSemester = (s) => {
    setForm(f => ({
      ...f,
      allowed_semesters: f.allowed_semesters.includes(s)
        ? f.allowed_semesters.filter(x => x !== s)
        : [...f.allowed_semesters, s],
    }));
  };

  const toggleBranch = (b) => {
    setForm(f => ({
      ...f,
      allowed_branches: f.allowed_branches.includes(b)
        ? f.allowed_branches.filter(x => x !== b)
        : [...f.allowed_branches, b],
    }));
  };

  const handleSave = async () => {
    if (!form.title || !form.registration_end || !form.event_end_date) {
      return toast.error('Title, registration end, and event end date are required');
    }
    setSaving(true);
    try {
      if (editEvent) {
        await eventAPI.update(editEvent._id, form);
        toast.success('Event updated');
      } else {
        await eventAPI.create(form);
        toast.success('Event created');
      }
      setShowModal(false);
      fetchEvents();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this event?')) return;
    try {
      await eventAPI.delete(id);
      toast.success('Event deleted');
      fetchEvents();
    } catch (e) { toast.error(getErrorMessage(e)); }
  };

  const getStatusBadge = (ev) => {
    const now = new Date();
    const regEnd = new Date(ev.registration_end);
    const evEnd = new Date(ev.event_end_date);
    const regStart = new Date(ev.registration_start || ev.created_at);
    if (now > evEnd) return { label: 'Closed', variant: 'rejected' };
    if (now > regEnd) return { label: 'In Progress', variant: 'approved' };
    if (now >= regStart) return { label: 'Registration Open', variant: 'pending' };
    return { label: 'Upcoming', variant: 'default' };
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Events</h1>
          <Button onClick={openCreate}><Plus className="w-4 h-4" /> Create Event</Button>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="card p-5 animate-pulse space-y-3">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="card p-12 text-center text-gray-400">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No events yet. Create your first event.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(ev => {
              const status = getStatusBadge(ev);
              return (
                <div key={ev._id} className="card p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white leading-tight">{ev.title}</h3>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{ev.description}</p>
                  <div className="space-y-1 text-xs text-gray-500 mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Reg ends: {formatDate(ev.registration_end)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>Team: {ev.min_team_size}–{ev.max_team_size} members</span>
                    </div>
                    {ev.allowed_semesters?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {ev.allowed_semesters.map(s => (
                          <span key={s} className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-xs">Sem {s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/admin/events/${ev._id}`} className="flex-1">
                      <Button size="sm" variant="secondary" className="w-full">
                        <Eye className="w-3.5 h-3.5" /> View
                      </Button>
                    </Link>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(ev)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(ev._id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editEvent ? 'Edit Event' : 'Create Event'} size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Input label="Event Title *" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
            <textarea className="input w-full h-24 resize-none" value={form.description}
              onChange={e => setForm(f => ({...f, description: e.target.value}))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Min Team Size" type="number" min={1} value={form.min_team_size}
              onChange={e => setForm(f => ({...f, min_team_size: parseInt(e.target.value)}))} />
            <Input label="Max Team Size" type="number" min={1} value={form.max_team_size}
              onChange={e => setForm(f => ({...f, max_team_size: parseInt(e.target.value)}))} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input label="Registration Start" type="date" value={form.registration_start}
              onChange={e => setForm(f => ({...f, registration_start: e.target.value}))} />
            <Input label="Registration End *" type="date" value={form.registration_end}
              onChange={e => setForm(f => ({...f, registration_end: e.target.value}))} />
            <Input label="Event End Date *" type="date" value={form.event_end_date}
              onChange={e => setForm(f => ({...f, event_end_date: e.target.value}))} />
          </div>

          {/* Allowed Semesters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Allowed Semesters</label>
            <div className="flex flex-wrap gap-2">
              {SEMESTERS.map(s => (
                <button key={s} type="button"
                  onClick={() => toggleSemester(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    form.allowed_semesters.includes(s)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}>
                  Sem {s}
                </button>
              ))}
            </div>
          </div>

          {/* Allowed Branches */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Allowed Branches (leave empty for all)</label>
            <div className="flex flex-wrap gap-2">
              {BRANCHES.map(b => (
                <button key={b} type="button"
                  onClick={() => toggleBranch(b)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    form.allowed_branches.includes(b)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                  }`}>
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editEvent ? 'Update Event' : 'Create Event'}</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default AdminEvents;

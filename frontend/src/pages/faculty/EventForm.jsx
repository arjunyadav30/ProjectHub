import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, Input, Textarea, MultiSelect } from '../../components/common';
import { eventAPI } from '../../api';
import { getErrorMessage } from '../../utils';
import toast from 'react-hot-toast';

const BRANCHES = ['CSE', 'IT', 'ECE', 'ME', 'CE', 'EE'];
const YEARS = ['1', '2', '3', '4'];

const EventFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  const [form, setForm] = useState({
    title: '',
    description: '',
    allowed_years: [],
    allowed_branches: [],
    min_team_size: 2,
    max_team_size: 5,
    registration_start: new Date().toISOString().slice(0, 16),
    registration_end: '',
    event_end_date: '',
  });

  useEffect(() => {
    if (!isEdit) return;
    eventAPI.getById(id)
      .then(r => {
        const e = r.data.data;
        setForm({
          title: e.title,
          description: e.description,
          allowed_years: e.allowed_years.map(String),
          allowed_branches: e.allowed_branches,
          min_team_size: e.min_team_size,
          max_team_size: e.max_team_size,
          registration_start: e.registration_start?.slice(0, 16) || '',
          registration_end: e.registration_end?.slice(0, 16) || '',
          event_end_date: e.event_end_date?.slice(0, 16) || '',
        });
      })
      .catch(() => toast.error('Failed to load event'))
      .finally(() => setFetching(false));
  }, [id, isEdit]);

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title required');
    if (!form.registration_end) return toast.error('Registration end date required');
    if (!form.event_end_date) return toast.error('Event end date required');
    if (form.allowed_years.length === 0) return toast.error('Select at least one year');
    if (form.allowed_branches.length === 0) return toast.error('Select at least one branch');
    if (Number(form.max_team_size) < Number(form.min_team_size)) return toast.error('Max size must be >= min size');

    setLoading(true);
    try {
      const payload = {
        ...form,
        allowed_years: form.allowed_years.map(Number),
        min_team_size: Number(form.min_team_size),
        max_team_size: Number(form.max_team_size),
      };

      if (isEdit) {
        await eventAPI.update(id, payload);
        toast.success('Event updated!');
      } else {
        await eventAPI.create(payload);
        toast.success('Event created!');
      }
      navigate('/events');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <DashboardLayout><div className="animate-pulse space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-12 bg-gray-200 rounded" />)}</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 block">← Back</button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Event' : 'Create New Event'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Fill in the event details for student registration</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <Input
            label="Event Title *"
            value={form.title}
            onChange={e => setField('title', e.target.value)}
            placeholder="e.g. Final Year Project Exhibition 2025"
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description *</label>
            <textarea
              value={form.description}
              onChange={e => setField('description', e.target.value)}
              placeholder="Describe the event, goals, rules, and any other relevant information..."
              className="input min-h-[120px] resize-y"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <MultiSelect
              label="Allowed Years *"
              options={YEARS.map(y => y)}
              value={form.allowed_years}
              onChange={val => setField('allowed_years', val)}
              placeholder="Select years..."
            />
            <MultiSelect
              label="Allowed Branches *"
              options={BRANCHES}
              value={form.allowed_branches}
              onChange={val => setField('allowed_branches', val)}
              placeholder="Select branches..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Min Team Size *</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.min_team_size}
                onChange={e => setField('min_team_size', e.target.value)}
                className="input"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Max Team Size *</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.max_team_size}
                onChange={e => setField('max_team_size', e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Registration Start</label>
            <input
              type="datetime-local"
              value={form.registration_start}
              onChange={e => setField('registration_start', e.target.value)}
              className="input"
            />
            <p className="text-xs text-gray-400">Defaults to now if not changed</p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Registration End Date *</label>
            <input
              type="datetime-local"
              value={form.registration_end}
              onChange={e => setField('registration_end', e.target.value)}
              className="input"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event End Date *</label>
            <input
              type="datetime-local"
              value={form.event_end_date}
              onChange={e => setField('event_end_date', e.target.value)}
              className="input"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" loading={loading}>
              {isEdit ? 'Save Changes' : 'Create Event'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default EventFormPage;

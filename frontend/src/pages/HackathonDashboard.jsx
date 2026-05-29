import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { hackathonAPI } from '../api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils';

const initialForm = {
  title: '',
  description: '',
  registration_start: '',
  registration_end: '',
  submission_deadline: '',
  max_team_size: 4,
  scope_type: 'inter_college',
  team_college_rule: 'same_college',
  status: 'draft',
};

const HackathonDashboard = () => {
  const [mine, setMine] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState('');

  const loadMine = async () => {
    try {
      const res = await hackathonAPI.getMine();
      setMine(res.data.data || []);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  useEffect(() => { loadMine(); }, []);

  const submit = async () => {
    try {
      if (editingId) {
        await hackathonAPI.update(editingId, form);
        toast.success('Hackathon updated');
      } else {
        await hackathonAPI.create(form);
        toast.success('Hackathon created');
      }
      setForm(initialForm);
      setEditingId('');
      loadMine();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const onEdit = (h) => {
    setEditingId(h._id);
    setForm({
      title: h.title || '',
      description: h.description || '',
      registration_start: h.registration_start ? new Date(h.registration_start).toISOString().slice(0, 16) : '',
      registration_end: h.registration_end ? new Date(h.registration_end).toISOString().slice(0, 16) : '',
      submission_deadline: h.submission_deadline ? new Date(h.submission_deadline).toISOString().slice(0, 16) : '',
      max_team_size: h.max_team_size || 4,
      scope_type: h.scope_type || 'inter_college',
      team_college_rule: h.team_college_rule || 'same_college',
      status: h.status || 'draft',
    });
  };

  const remove = async (id) => {
    if (!confirm('Delete this hackathon?')) return;
    try {
      await hackathonAPI.delete(id);
      toast.success('Deleted');
      loadMine();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Hackathon Admin Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">Project Management se alag creator-only management panel.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/hackathonhub" className="px-4 py-2 rounded-xl border border-gray-700 hover:border-blue-500">Public Listing</Link>
            <Link to="/hackathonhub/create" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold">Create New</Link>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 grid md:grid-cols-2 gap-3 text-white">
          <input className="bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <input className="bg-gray-800 border border-gray-700 rounded-xl p-2" type="number" min="1" placeholder="Max Team Size" value={form.max_team_size} onChange={(e) => setForm((f) => ({ ...f, max_team_size: Number(e.target.value) }))} />
          <textarea className="md:col-span-2 bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />

          <label className="text-sm">Type
            <select className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-xl p-2" value={form.scope_type} onChange={(e) => setForm((f) => ({ ...f, scope_type: e.target.value }))}>
              <option value="inter_college">Inter College</option>
              <option value="global">Global</option>
            </select>
          </label>

          <label className="text-sm">Team Policy
            <select className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-xl p-2" value={form.team_college_rule} onChange={(e) => setForm((f) => ({ ...f, team_college_rule: e.target.value }))}>
              <option value="same_college">Only same-college teams</option>
              <option value="mixed_college">Mixed-college teams allowed</option>
            </select>
          </label>

          <input className="bg-gray-800 border border-gray-700 rounded-xl p-2" type="datetime-local" value={form.registration_start} onChange={(e) => setForm((f) => ({ ...f, registration_start: e.target.value }))} />
          <input className="bg-gray-800 border border-gray-700 rounded-xl p-2" type="datetime-local" value={form.registration_end} onChange={(e) => setForm((f) => ({ ...f, registration_end: e.target.value }))} />
          <input className="bg-gray-800 border border-gray-700 rounded-xl p-2" type="datetime-local" value={form.submission_deadline} onChange={(e) => setForm((f) => ({ ...f, submission_deadline: e.target.value }))} />

          <button onClick={submit} className="md:col-span-2 rounded-xl px-4 py-2 bg-blue-600 hover:bg-blue-500 font-semibold">{editingId ? 'Update' : 'Create'} Hackathon</button>
        </div>

        <div className="grid gap-4">
          {mine.map((h) => (
            <div key={h._id} className="bg-gray-900 border border-gray-700 rounded-2xl p-5 text-white">
              <h3 className="text-lg font-semibold">{h.title}</h3>
              <p className="text-sm text-gray-300 mt-1">{h.description}</p>
              <p className="text-xs text-gray-400 mt-2">{h.scope_type} • {h.team_college_rule} • {h.status}</p>
              <div className="mt-3 flex gap-2 flex-wrap">
                <button onClick={() => onEdit(h)} className="rounded-xl px-4 py-2 bg-blue-600 hover:bg-blue-500">Edit</button>
                <button onClick={() => remove(h._id)} className="rounded-xl px-4 py-2 bg-red-600 hover:bg-red-500">Delete</button>
                <button onClick={() => hackathonAPI.publishResults(h._id).then(() => { toast.success('Results published'); loadMine(); }).catch((e) => toast.error(getErrorMessage(e)))} className="rounded-xl px-4 py-2 bg-purple-600 hover:bg-purple-500">Publish Results</button>
              </div>
            </div>
          ))}
          {mine.length === 0 && (
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 text-gray-400">Aapne abhi tak koi hackathon create nahi kiya.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HackathonDashboard;


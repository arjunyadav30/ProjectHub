import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { hackathonAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils';

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

const HackathonCreatePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    if (!user) {
      toast.error('Login required to create hackathon');
      navigate('/login');
      return;
    }

    try {
      setSaving(true);
      await hackathonAPI.create(form);
      toast.success('Hackathon created');
      navigate('/hackathonhub/dashboard');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Create Hackathon</h1>
          <Link to="/hackathonhub" className="px-4 py-2 rounded-xl border border-gray-700 hover:border-blue-500">Back</Link>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 grid md:grid-cols-2 gap-3">
          <input className="bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <input type="number" min="1" className="bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder="Max Team Size" value={form.max_team_size} onChange={(e) => setForm((f) => ({ ...f, max_team_size: Number(e.target.value) }))} />
          <textarea className="md:col-span-2 bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />

          <label className="text-sm">Type
            <select className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-xl p-2" value={form.scope_type} onChange={(e) => setForm((f) => ({ ...f, scope_type: e.target.value }))}>
              <option value="inter_college">Inter College</option>
              <option value="global">Global</option>
            </select>
          </label>

          <label className="text-sm">Team Rule
            <select className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-xl p-2" value={form.team_college_rule} onChange={(e) => setForm((f) => ({ ...f, team_college_rule: e.target.value }))}>
              <option value="same_college">Same college teams only</option>
              <option value="mixed_college">Mixed college teams allowed</option>
            </select>
          </label>

          <input type="datetime-local" className="bg-gray-800 border border-gray-700 rounded-xl p-2" value={form.registration_start} onChange={(e) => setForm((f) => ({ ...f, registration_start: e.target.value }))} />
          <input type="datetime-local" className="bg-gray-800 border border-gray-700 rounded-xl p-2" value={form.registration_end} onChange={(e) => setForm((f) => ({ ...f, registration_end: e.target.value }))} />
          <input type="datetime-local" className="bg-gray-800 border border-gray-700 rounded-xl p-2" value={form.submission_deadline} onChange={(e) => setForm((f) => ({ ...f, submission_deadline: e.target.value }))} />

          <button disabled={saving} onClick={onSubmit} className="md:col-span-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold disabled:opacity-60">{saving ? 'Creating...' : 'Create Hackathon'}</button>
        </div>
      </div>
    </div>
  );
};

export default HackathonCreatePage;

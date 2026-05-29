import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/common/Layout';
import { hackathonAPI, userAPI } from '../../api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils';

const initialForm = {
  title: '', description: '', banner_image_url: '', registration_start: '', registration_end: '', submission_deadline: '',
  max_team_size: 4, tracks: '', rules: '', status: 'draft',
};

const AdminHackathons = () => {
  const [hackathons, setHackathons] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [judgeIds, setJudgeIds] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(initialForm);

  const load = () => {
    Promise.all([hackathonAPI.getAll(), userAPI.getAllFaculty()])
      .then(([hRes, fRes]) => {
        setHackathons(hRes.data.data || []);
        setFaculty(fRes.data.data || []);
      })
      .catch((e) => toast.error(getErrorMessage(e)));
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload = {
        ...form,
        tracks: form.tracks.split(',').map((t) => t.trim()).filter(Boolean),
      };
      if (selectedId) await hackathonAPI.update(selectedId, payload);
      else await hackathonAPI.create(payload);
      toast.success(selectedId ? 'Hackathon updated' : 'Hackathon created');
      setForm(initialForm);
      setSelectedId('');
      load();
    } catch (e) { toast.error(getErrorMessage(e)); }
  };

  const edit = (h) => {
    setSelectedId(h._id);
    setForm({
      title: h.title || '', description: h.description || '', banner_image_url: h.banner_image_url || '',
      registration_start: h.registration_start?.slice(0, 16) || '', registration_end: h.registration_end?.slice(0, 16) || '',
      submission_deadline: h.submission_deadline?.slice(0, 16) || '', max_team_size: h.max_team_size || 4,
      tracks: (h.tracks || []).join(', '), rules: h.rules || '', status: h.status || 'draft',
    });
    setJudgeIds(h.judges || []);
  };

  const remove = async (id) => {
    if (!confirm('Delete hackathon?')) return;
    try { await hackathonAPI.delete(id); toast.success('Deleted'); load(); } catch (e) { toast.error(getErrorMessage(e)); }
  };

  const assignJudges = async (id) => {
    try { await hackathonAPI.assignJudges(id, { judge_ids: judgeIds }); toast.success('Judges assigned'); load(); } catch (e) { toast.error(getErrorMessage(e)); }
  };

  const publish = async (id) => {
    try { await hackathonAPI.publishResults(id); toast.success('Results published'); load(); } catch (e) { toast.error(getErrorMessage(e)); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hackathons</h1>

        <div className="bg-gray-900 text-white border border-gray-700 rounded-2xl p-6 grid md:grid-cols-2 gap-3">
          <input className="bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder="Title" value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} />
          <input className="bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder="Banner URL" value={form.banner_image_url} onChange={(e) => setForm((s) => ({ ...s, banner_image_url: e.target.value }))} />
          <textarea className="md:col-span-2 bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder="Description" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
          <input type="datetime-local" className="bg-gray-800 border border-gray-700 rounded-xl p-2" value={form.registration_start} onChange={(e) => setForm((s) => ({ ...s, registration_start: e.target.value }))} />
          <input type="datetime-local" className="bg-gray-800 border border-gray-700 rounded-xl p-2" value={form.registration_end} onChange={(e) => setForm((s) => ({ ...s, registration_end: e.target.value }))} />
          <input type="datetime-local" className="bg-gray-800 border border-gray-700 rounded-xl p-2" value={form.submission_deadline} onChange={(e) => setForm((s) => ({ ...s, submission_deadline: e.target.value }))} />
          <input type="number" className="bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder="Max Team Size" value={form.max_team_size} onChange={(e) => setForm((s) => ({ ...s, max_team_size: e.target.value }))} />
          <input className="bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder="Tracks comma separated" value={form.tracks} onChange={(e) => setForm((s) => ({ ...s, tracks: e.target.value }))} />
          <input className="bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder="Rules" value={form.rules} onChange={(e) => setForm((s) => ({ ...s, rules: e.target.value }))} />
          <select className="bg-gray-800 border border-gray-700 rounded-xl p-2" value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}>
            <option value="draft">Draft</option><option value="upcoming">Upcoming</option><option value="ongoing">Ongoing</option><option value="ended">Ended</option>
          </select>
          <button onClick={save} className="md:col-span-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold">{selectedId ? 'Update' : 'Create'} Hackathon</button>
        </div>

        <div className="grid gap-4">
          {hackathons.map((h) => (
            <div key={h._id} className="bg-gray-900 text-white border border-gray-700 rounded-2xl p-6 space-y-3">
              <h2 className="text-xl font-bold">{h.title}</h2>
              <p className="text-sm text-gray-300">{h.description}</p>
              <div className="flex flex-wrap gap-2">
                {faculty.map((f) => (
                  <label key={f._id} className="text-xs bg-gray-800 px-2 py-1 rounded-lg flex items-center gap-1">
                    <input type="checkbox" checked={judgeIds.includes(f._id)} onChange={(e) => setJudgeIds((ids) => e.target.checked ? [...ids, f._id] : ids.filter((id) => id !== f._id))} />
                    {f.name}
                  </label>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => edit(h)} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500">Edit</button>
                <button onClick={() => remove(h._id)} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500">Delete</button>
                <button onClick={() => assignJudges(h._id)} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500">Assign Judges</button>
                <button onClick={() => publish(h._id)} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500">Publish Results</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminHackathons;

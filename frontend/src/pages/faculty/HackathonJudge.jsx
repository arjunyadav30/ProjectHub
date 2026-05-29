import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/common/Layout';
import { hackathonAPI } from '../../api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils';

const FacultyHackathonJudge = () => {
  const [assigned, setAssigned] = useState([]);
  const [selected, setSelected] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [form, setForm] = useState({ innovation: 0, execution: 0, ui_ux: 0, impact: 0, comment: '' });

  useEffect(() => {
    hackathonAPI.getJudgeAssigned()
      .then((res) => {
        const items = res.data.data || [];
        setAssigned(items);
        if (items[0]) setSelected(items[0]._id);
      })
      .catch((e) => toast.error(getErrorMessage(e)));
  }, []);

  useEffect(() => {
    if (!selected) return;
    hackathonAPI.getJudgeSubmissions(selected)
      .then((res) => setSubmissions(res.data.data || []))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, [selected]);

  const score = async (subId) => {
    try {
      await hackathonAPI.scoreSubmission(selected, subId, {
        scores: {
          innovation: Number(form.innovation),
          execution: Number(form.execution),
          ui_ux: Number(form.ui_ux),
          impact: Number(form.impact),
        },
        comment: form.comment,
      });
      toast.success('Scored');
    } catch (e) { toast.error(getErrorMessage(e)); }
  };

  const selectedHack = assigned.find((a) => a._id === selected);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hackathon Judge Panel</h1>

        <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select Hackathon</option>
          {assigned.map((h) => <option key={h._id} value={h._id}>{h.title}</option>)}
        </select>

        <div className="grid gap-4">
          {submissions.map((s) => (
            <div key={s._id} className="bg-gray-900 text-white border border-gray-700 rounded-2xl p-6 space-y-3">
              <h2 className="text-xl font-bold">{s.project_title}</h2>
              <p className="text-sm text-gray-300">Team: {s.team_id?.team_name || 'Unknown'}</p>
              <div className="grid md:grid-cols-4 gap-2">
                {['innovation', 'execution', 'ui_ux', 'impact'].map((k) => (
                  <input key={k} type="number" min="0" max="10" className="bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder={k} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} disabled={selectedHack?.is_results_published} />
                ))}
              </div>
              <textarea className="w-full bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder="Comment" value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} disabled={selectedHack?.is_results_published} />
              <button onClick={() => score(s._id)} disabled={selectedHack?.is_results_published} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-semibold">Submit Score</button>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FacultyHackathonJudge;

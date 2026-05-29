import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/common/Layout';
import { hackathonAPI, teamAPI } from '../../api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils';

const StudentHackathons = () => {
  const [hackathons, setHackathons] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [submission, setSubmission] = useState({ project_title: '', description: '', github_link: '', demo_video_url: '', tech_stack: '' });

  useEffect(() => {
    Promise.all([hackathonAPI.getAll(), teamAPI.getAll()])
      .then(([hRes, tRes]) => {
        setHackathons(hRes.data.data || []);
        setTeams(tRes.data.data || []);
      })
      .catch((e) => toast.error(getErrorMessage(e)));
  }, []);

  const register = async (id) => {
    if (!selectedTeam) return toast.error('Select team first');
    try {
      await hackathonAPI.register(id, { team_id: selectedTeam });
      toast.success('Team registered');
    } catch (e) { toast.error(getErrorMessage(e)); }
  };

  const submit = async (id) => {
    if (!selectedTeam) return toast.error('Select team first');
    try {
      await hackathonAPI.submit(id, {
        team_id: selectedTeam,
        ...submission,
        tech_stack: submission.tech_stack.split(',').map((s) => s.trim()).filter(Boolean),
      });
      toast.success('Submission uploaded');
    } catch (e) { toast.error(getErrorMessage(e)); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hackathons</h1>

        <div className="card p-4">
          <label className="block text-sm mb-2 text-gray-600 dark:text-gray-300">Select Team</label>
          <select className="input" value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}>
            <option value="">Choose team</option>
            {teams.map((t) => <option key={t._id} value={t._id}>{t.team_name}</option>)}
          </select>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {hackathons.map((h) => (
            <div key={h._id} className="bg-gray-900 text-white border border-gray-700 rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold">{h.title}</h2>
              <p className="text-sm text-gray-300">{h.description}</p>
              <div className="flex gap-2">
                <button onClick={() => register(h._id)} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold">Register Team</button>
              </div>
              <div className="grid gap-2">
                <input className="bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder="Project Title" value={submission.project_title} onChange={(e) => setSubmission((s) => ({ ...s, project_title: e.target.value }))} />
                <textarea className="bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder="Description" value={submission.description} onChange={(e) => setSubmission((s) => ({ ...s, description: e.target.value }))} />
                <input className="bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder="GitHub Link" value={submission.github_link} onChange={(e) => setSubmission((s) => ({ ...s, github_link: e.target.value }))} />
                <input className="bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder="Demo Video URL" value={submission.demo_video_url} onChange={(e) => setSubmission((s) => ({ ...s, demo_video_url: e.target.value }))} />
                <input className="bg-gray-800 border border-gray-700 rounded-xl p-2" placeholder="Tech Stack (comma separated)" value={submission.tech_stack} onChange={(e) => setSubmission((s) => ({ ...s, tech_stack: e.target.value }))} />
                <button onClick={() => submit(h._id)} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold">Submit Project</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentHackathons;

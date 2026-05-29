import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { hackathonAPI } from '../../api';
import { Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils';

const HackathonDetailPage = () => {
  const { id } = useParams();
  const [hackathon, setHackathon] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    hackathonAPI.getById(id)
      .then((res) => {
        const item = res.data.data;
        setHackathon(item);
        if (item?.is_results_published) {
          hackathonAPI.getLeaderboard(id).then((r) => setLeaderboard(r.data.data || [])).catch(() => {});
        }
      })
      .catch((e) => toast.error(getErrorMessage(e)));
  }, [id]);

  const countdown = useMemo(() => {
    if (!hackathon) return '';
    const target = new Date(hackathon.registration_end).getTime() > now
      ? new Date(hackathon.registration_end).getTime()
      : new Date(hackathon.submission_deadline).getTime();
    const diff = Math.max(target - now, 0);
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${d}d ${h}h ${m}m ${s}s`;
  }, [hackathon, now]);

  if (!hackathon) return <div className="min-h-screen bg-gray-950 text-white p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
          {hackathon.banner_image_url && <img src={hackathon.banner_image_url} alt={hackathon.title} className="w-full h-72 object-cover" />}
          <div className="p-6">
            <h1 className="text-4xl font-bold">{hackathon.title}</h1>
            <p className="text-gray-300 mt-3">{hackathon.description}</p>
            <p className="mt-4 text-blue-300 flex items-center gap-2"><Clock className="w-4 h-4" /> Countdown: {countdown}</p>
            <Link to="/login" className="inline-block mt-5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold">Register Now</Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-3">Tracks</h2>
            <div className="flex flex-wrap gap-2">{(hackathon.tracks || []).map((t) => <span key={t} className="px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-sm">{t}</span>)}</div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-3">Timeline</h2>
            <div className="text-sm text-gray-300 space-y-1">
              <p>Registration Start: {new Date(hackathon.registration_start).toLocaleString()}</p>
              <p>Registration End: {new Date(hackathon.registration_end).toLocaleString()}</p>
              <p>Submission Deadline: {new Date(hackathon.submission_deadline).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-3">Prizes</h2>
          <div className="space-y-2">{(hackathon.prizes || []).map((p, i) => <div key={i} className="flex justify-between border-b border-gray-800 pb-2"><span>{p.title}</span><span>?{Number(p.amount || 0).toLocaleString()}</span></div>)}</div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-3">FAQs</h2>
          <div className="space-y-3">{(hackathon.faqs || []).map((f, i) => <div key={i}><p className="font-semibold">{f.question}</p><p className="text-gray-300 text-sm">{f.answer}</p></div>)}</div>
        </div>

        {hackathon.is_results_published && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-3">Leaderboard</h2>
            <div className="space-y-2">{leaderboard.map((l) => <div key={l.submission_id} className="flex justify-between bg-gray-800 rounded-xl p-3"><span>#{l.rank} {l.team_name}</span><span>{l.average_score}</span></div>)}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HackathonDetailPage;

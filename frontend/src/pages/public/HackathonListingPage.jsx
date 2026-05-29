import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Trophy, Calendar, Tag } from 'lucide-react';
import { hackathonAPI } from '../../api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils';

const statuses = ['all', 'upcoming', 'ongoing', 'ended'];

const HackathonListingPage = () => {
  const [hackathons, setHackathons] = useState([]);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    hackathonAPI.getAll()
      .then((res) => setHackathons(res.data.data || []))
      .catch((e) => toast.error(getErrorMessage(e)));
  }, []);

  const filtered = useMemo(() => hackathons.filter((h) => {
    const statusOk = status === 'all' || h.status === status;
    const searchOk = h.title?.toLowerCase().includes(search.toLowerCase());
    return statusOk && searchOk;
  }), [hackathons, status, search]);

  return (
    <div className="min-h-screen bg-gray-950 text-white py-12 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Hackathons</h1>
            <p className="text-gray-400 mt-2">Find upcoming and ongoing competitions</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to="/hackathonhub/login" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold w-fit">Login</Link>
            <Link to="/hackathonhub/signup" className="px-4 py-2 rounded-xl border border-gray-700 hover:border-blue-500 w-fit">Signup</Link>
            <Link to="/hackathons/create" className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold w-fit">Create Hackathon</Link>
            <Link to="/" className="px-4 py-2 rounded-xl border border-gray-700 hover:border-blue-500 w-fit">Back</Link>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title" className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-2" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {statuses.map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${status === s ? 'bg-blue-600' : 'bg-gray-800 border border-gray-700'}`}>
                {s === 'all' ? 'All' : s === 'ongoing' ? 'Live' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((hack) => {
            const prizePool = (hack.prizes || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            return (
              <div key={hack._id} className="bg-gray-900 border border-gray-700 rounded-2xl p-6 hover:border-blue-500/50 transition-colors">
                {hack.banner_image_url && <img src={hack.banner_image_url} alt={hack.title} className="w-full h-44 object-cover rounded-xl mb-4" />}
                <h3 className="text-xl font-bold">{hack.title}</h3>
                <div className="text-sm text-gray-300 mt-3 space-y-1">
                  <p className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Reg: {new Date(hack.registration_start).toLocaleDateString()} - {new Date(hack.registration_end).toLocaleDateString()}</p>
                  <p className="flex items-center gap-2"><Trophy className="w-4 h-4" /> ?{prizePool.toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {(hack.tracks || []).slice(0, 3).map((track) => <span key={track} className="text-xs px-2 py-1 rounded-full bg-gray-800 border border-gray-700 flex items-center gap-1"><Tag className="w-3 h-3" />{track}</span>)}
                </div>
                <Link to={`/hackathons/${hack._id}`} className="mt-5 inline-block px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold">View Details</Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HackathonListingPage;

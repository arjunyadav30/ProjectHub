import { Link } from 'react-router-dom';
import { Layers, Trophy } from 'lucide-react';

const HubSelectorPage = () => {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="max-w-4xl w-full">
        <h1 className="text-4xl font-bold text-center mb-3">Choose Your Platform</h1>
        <p className="text-gray-400 text-center mb-10">ProjectHub and HackathonHub run with separate login/signup systems.</p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3"><Layers className="w-6 h-6 text-blue-400" /><h2 className="text-2xl font-semibold">ProjectHub</h2></div>
            <p className="text-gray-300 text-sm mb-5">College project management for admin, faculty, and students.</p>
            <div className="flex gap-2">
              <Link to="/projecthub/login" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold">Login</Link>
              <Link to="/projecthub/signup" className="px-4 py-2 rounded-xl border border-gray-600 hover:border-blue-500">Signup</Link>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3"><Trophy className="w-6 h-6 text-yellow-400" /><h2 className="text-2xl font-semibold">HackathonHub</h2></div>
            <p className="text-gray-300 text-sm mb-5">Independent hackathon platform for hackathon admins and participants.</p>
            <div className="flex gap-2">
              <Link to="/hackathonhub/login" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold">Login</Link>
              <Link to="/hackathonhub/signup" className="px-4 py-2 rounded-xl border border-gray-600 hover:border-blue-500">Signup</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HubSelectorPage;

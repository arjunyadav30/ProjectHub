import React, { useEffect, useState } from 'react';
import { achievementsAPI, userAPI } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Badges() {
  const [badges, setBadges] = useState([]);
  const [myBadges, setMyBadges] = useState([]);
  const { user } = useAuth();
  const [awardTo, setAwardTo] = useState('');
  const [selectedBadge, setSelectedBadge] = useState('');

  useEffect(() => {
    achievementsAPI.listBadges().then(r => setBadges(r.data.data)).catch(() => {});
    if (user) achievementsAPI.getUserBadges(user._id).then(r => setMyBadges(r.data.data)).catch(() => {});
  }, [user]);

  const handleAward = async () => {
    if (!selectedBadge || !awardTo) return;
    try {
      await achievementsAPI.awardBadge({ badge_key: selectedBadge, user_id: awardTo });
      alert('Awarded');
    } catch (e) { alert('Failed'); }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Badges & Achievements</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-lg p-4 shadow">
          <h3 className="text-lg font-medium mb-3">Available Badges</h3>
          <ul className="space-y-3">
            {badges.map(b => (
              <li key={b._id} className="flex items-center gap-3">
                {b.icon ? <img src={b.icon} alt="icon" className="w-10 h-10 rounded" /> : <div className="w-10 h-10 bg-gray-100 rounded" />}
                <div>
                  <div className="font-medium">{b.name}</div>
                  <div className="text-sm text-gray-500">{b.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="text-lg font-medium mb-3">My Badges</h3>
          <ul className="space-y-2">
            {myBadges.map(a => (
              <li key={a._id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{a.badge?.name}</div>
                  <div className="text-sm text-gray-500">{new Date(a.awarded_at).toLocaleDateString()}</div>
                </div>
                <div className="text-sm text-gray-500">{a.reason}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {user?.role === 'admin' || user?.role === 'faculty' ? (
        <div className="mt-6 bg-white rounded-lg p-4 shadow">
          <h3 className="text-lg font-medium mb-3">Award Badge (Admin/Faculty)</h3>
          <div className="flex gap-3">
            <select className="border p-2 rounded" value={selectedBadge} onChange={e => setSelectedBadge(e.target.value)}>
              <option value="">Select badge</option>
              {badges.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
            </select>
            <input className="border p-2 rounded" placeholder="user id" value={awardTo} onChange={e => setAwardTo(e.target.value)} />
            <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={handleAward}>Award</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

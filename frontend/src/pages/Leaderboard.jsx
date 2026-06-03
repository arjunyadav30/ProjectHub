import React, { useEffect, useState } from 'react';
import { achievementsAPI } from '../api';

export default function Leaderboard() {
  const [teams, setTeams] = useState([]);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    achievementsAPI.getTopTeams({ limit: 10 }).then(r => setTeams(r.data.data)).catch(() => {});
    achievementsAPI.getTopStudents({ limit: 10 }).then(r => setStudents(r.data.data)).catch(() => {});
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Leaderboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="text-lg font-medium mb-3">Top Teams</h3>
          <ol className="space-y-3">
            {teams.map((t, i) => (
              <li key={t._id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{i + 1}. {t.team_name}</div>
                  <div className="text-sm text-gray-500">Members: {t.members?.length || 0}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-semibold">{t.percent}%</div>
                  <div className="text-sm text-gray-500">{t.completed_modules} modules</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="text-lg font-medium mb-3">Top Students</h3>
          <ol className="space-y-3">
            {students.map((s, i) => (
              <li key={s.user?._id || i} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{i + 1}. {s.user?.name || 'Unknown'}</div>
                  <div className="text-sm text-gray-500">{s.user?.email || ''}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-semibold">{s.awards}</div>
                  <div className="text-sm text-gray-500">badges</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

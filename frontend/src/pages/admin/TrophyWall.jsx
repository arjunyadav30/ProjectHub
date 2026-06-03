import React, { useEffect, useState } from 'react';
import { achievementsAPI } from '../../api';

export default function TrophyWall() {
  const [awards, setAwards] = useState([]);

  useEffect(() => {
    // fetch top students' awards as a simple trophy wall
    achievementsAPI.getTopStudents({ limit: 50 }).then(r => setAwards(r.data.data)).catch(() => {});
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Trophy Wall</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {awards.map((a, i) => (
          <div key={i} className="bg-white rounded-lg p-4 shadow text-center">
            <div className="text-xl font-semibold">{a.user?.name || 'Student'}</div>
            <div className="text-sm text-gray-500">{a.user?.email}</div>
            <div className="mt-3 text-3xl font-bold text-blue-600">{a.awards}</div>
            <div className="text-sm text-gray-500">badges</div>
          </div>
        ))}
      </div>
    </div>
  );
}

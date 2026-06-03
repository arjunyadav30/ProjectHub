import React, { useState } from 'react';
import { achievementsAPI, userAPI } from '../../api';
import { jsPDF } from 'jspdf';

export default function CertificateGenerator() {
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('Participation Certificate');
  const [description, setDescription] = useState('For active participation');

  const handleGenerate = async () => {
    if (!userId) return alert('Enter user id');
    try {
      const userRes = await userAPI.getPublicProfile(userId);
      const user = userRes.data.data.user;
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(24);
      doc.text(title, 20, 40);
      doc.setFontSize(16);
      doc.text(`Awarded to: ${user.name}`, 20, 70);
      doc.setFontSize(12);
      doc.text(description, 20, 90);
      const blob = doc.output('blob');
      const fileUrl = URL.createObjectURL(blob);
      // Post record to backend (admin/faculty)
      const formData = new FormData();
      // We'll upload the certificate file to backend as base64 URL in this minimal implementation
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result;
        await achievementsAPI.createCertificate({ user_id: userId, title, description, file_url: base64 });
        // trigger download
        const a = document.createElement('a');
        a.href = fileUrl; a.download = `${user.name}-certificate.pdf`; a.click();
        URL.revokeObjectURL(fileUrl);
        alert('Certificate generated and recorded');
      };
      reader.readAsDataURL(blob);
    } catch (e) { console.error(e); alert('Failed to generate'); }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Generate Certificate</h2>
      <div className="bg-white rounded-lg p-4 shadow max-w-xl">
        <div className="space-y-3">
          <input className="w-full border p-2 rounded" placeholder="User ID" value={userId} onChange={e => setUserId(e.target.value)} />
          <input className="w-full border p-2 rounded" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea className="w-full border p-2 rounded" placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={handleGenerate}>Generate & Record</button>
          </div>
        </div>
      </div>
    </div>
  );
}

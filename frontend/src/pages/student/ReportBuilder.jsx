import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, Input } from '../../components/common';
import { reportAPI } from '../../api';
import toast from 'react-hot-toast';

const ReportBuilder = () => {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    reportAPI.getMinorProjectReport()
      .then((res) => setDoc(res.data?.data || null))
      .catch(() => toast.error('Failed to load report'))
      .finally(() => setLoading(false));
  }, []);

  const payload = doc?.payload || { cover: {}, sections: [], teamMembers: [], snapshots: [] };
  const [activeSection, setActiveSection] = useState('cover');
  const sectionsNav = useMemo(() => ([
    { key: 'cover', label: 'Cover' },
    ...(payload.sections || []).map((s, i) => ({ key: `sec-${i}`, label: s.title || `Section ${i + 1}`, index: i })),
    { key: 'snapshots', label: 'Appendix / Figures' },
  ]), [payload.sections]);

  const updateCover = (key, value) => setDoc((prev) => ({ ...prev, payload: { ...prev.payload, cover: { ...prev.payload.cover, [key]: value } } }));
  const updateSection = (idx, value) => setDoc((prev) => ({
    ...prev,
    payload: {
      ...prev.payload,
      sections: prev.payload.sections.map((s, i) => (i === idx ? { ...s, content: value } : s)),
    },
  }));

  const addSnapshot = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDoc((prev) => ({
        ...prev,
        payload: {
          ...prev.payload,
          snapshots: [...(prev.payload.snapshots || []), { caption: '', imageData: reader.result }],
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const updateSnapshot = (idx, key, value) => setDoc((prev) => ({
    ...prev,
    payload: {
      ...prev.payload,
      snapshots: prev.payload.snapshots.map((s, i) => (i === idx ? { ...s, [key]: value } : s)),
    },
  }));

  const removeSnapshot = (idx) => setDoc((prev) => ({
    ...prev,
    payload: {
      ...prev.payload,
      snapshots: prev.payload.snapshots.filter((_, i) => i !== idx),
    },
  }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await reportAPI.saveMinorProjectReport({ title: doc.title, payload: doc.payload });
      setDoc(res.data?.data || doc);
      toast.success('Report saved');
    } catch {
      toast.error('Failed to save report');
    } finally { setSaving(false); }
  };

  const downloadPdf = () => {
    if (!doc) return;
    const p = doc.payload;
    const pdf = new jsPDF();
    let y = 18;

    pdf.setFontSize(18);
    pdf.text(p.cover?.reportTitle || 'Project Report', 14, y); y += 8;
    pdf.setFontSize(14);
    pdf.text(p.cover?.projectTitle || '', 14, y); y += 8;
    pdf.setFontSize(10);
    pdf.text(`Institute: ${p.cover?.institute || ''}`, 14, y); y += 5;
    pdf.text(`Department: ${p.cover?.department || ''}`, 14, y); y += 5;
    pdf.text(`Submitted By: ${p.cover?.submittedBy || ''}`, 14, y); y += 5;
    pdf.text(`Enrollment: ${p.cover?.enrollmentNo || ''}`, 14, y); y += 5;
    pdf.text(`Guide: ${p.cover?.guideName || ''}`, 14, y); y += 5;
    pdf.text(`Academic Year: ${p.cover?.academicYear || ''}`, 14, y); y += 10;

    (p.sections || []).forEach((sec) => {
      if (y > 270) { pdf.addPage(); y = 16; }
      pdf.setFontSize(13);
      pdf.text(sec.title || '', 14, y); y += 6;
      pdf.setFontSize(10);
      const lines = pdf.splitTextToSize(sec.content || '', 180);
      pdf.text(lines, 14, y);
      y += lines.length * 5 + 4;
    });

    (p.snapshots || []).forEach((snap) => {
      if (!snap.imageData) return;
      if (y > 220) { pdf.addPage(); y = 16; }
      pdf.setFontSize(11);
      pdf.text(snap.caption || 'Snapshot', 14, y); y += 4;
      try {
        pdf.addImage(snap.imageData, 'JPEG', 14, y, 120, 70);
        y += 76;
      } catch (_) {
        try {
          pdf.addImage(snap.imageData, 'PNG', 14, y, 120, 70);
          y += 76;
        } catch (__) {}
      }
    });

    pdf.save('minor-project-report.pdf');
  };

  if (loading) return <DashboardLayout><div className="card p-5">Loading report builder...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Project Report Builder</h1>
            <p className="text-sm text-gray-500">Every section editable, snapshots add karo, save aur download karo.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={downloadPdf}>Download PDF</Button>
            <Button onClick={save} loading={saving}>Save</Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <aside className="md:w-[220px] md:min-w-[220px] bg-gray-900 rounded-xl p-2 max-h-[70vh] overflow-y-auto">
            <div className="md:block hidden space-y-1">
              {sectionsNav.map((sec, idx) => (
                <button key={sec.key} onClick={() => setActiveSection(sec.key)}
                  className={`w-full text-left py-3 px-4 rounded-lg text-sm ${activeSection === sec.key ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
                  {sec.label}
                </button>
              ))}
            </div>
            <select className="input md:hidden" value={activeSection} onChange={(e) => setActiveSection(e.target.value)}>
              {sectionsNav.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </aside>

          <div className="flex-1 space-y-4">
            <div className="card p-4 flex items-center justify-between">
              <p className="text-sm text-gray-300">{sectionsNav.findIndex(s => s.key === activeSection) + 1 > 0 ? `${sectionsNav.find(s => s.key === activeSection)?.label} - Slide ${sectionsNav.findIndex(s => s.key === activeSection) + 1}/${sectionsNav.length}` : ''}</p>
              <p className="text-xs text-gray-400">Auto-save enabled</p>
            </div>

            {activeSection === 'cover' && (
              <div className="card p-5 space-y-3">
                <h2 className="font-semibold">Cover Page</h2>
                <div className="grid md:grid-cols-2 gap-3">
            <Input label="Institute" value={payload.cover?.institute || ''} onChange={(e) => updateCover('institute', e.target.value)} />
            <Input label="Department" value={payload.cover?.department || ''} onChange={(e) => updateCover('department', e.target.value)} />
            <Input label="Report Title" value={payload.cover?.reportTitle || ''} onChange={(e) => updateCover('reportTitle', e.target.value)} />
            <Input label="Project Title" value={payload.cover?.projectTitle || ''} onChange={(e) => updateCover('projectTitle', e.target.value)} />
            <Input label="Submitted By" value={payload.cover?.submittedBy || ''} onChange={(e) => updateCover('submittedBy', e.target.value)} />
            <Input label="Enrollment No" value={payload.cover?.enrollmentNo || ''} onChange={(e) => updateCover('enrollmentNo', e.target.value)} />
            <Input label="Guide Name" value={payload.cover?.guideName || ''} onChange={(e) => updateCover('guideName', e.target.value)} />
            <Input label="Academic Year" value={payload.cover?.academicYear || ''} onChange={(e) => updateCover('academicYear', e.target.value)} />
                </div>
              </div>
            )}

            {activeSection.startsWith('sec-') && (
              <div className="space-y-3">
                {(payload.sections || []).map((sec, idx) => activeSection === `sec-${idx}` ? (
                  <div key={sec.key || idx} className="card p-5 space-y-2">
                    <h3 className="font-semibold">{sec.title}</h3>
                    <textarea className="input min-h-[120px]" value={sec.content || ''} onChange={(e) => updateSection(idx, e.target.value)} placeholder={`Write ${sec.title}...`} />
                  </div>
                ) : null)}
              </div>
            )}

            {activeSection === 'snapshots' && (
              <div className="card p-5 space-y-3">
                <h2 className="font-semibold">Snapshots / Figures</h2>
                <input type="file" accept="image/*" onChange={(e) => addSnapshot(e.target.files?.[0])} className="input" />
                <div className="grid md:grid-cols-2 gap-4">
                  {(payload.snapshots || []).map((snap, idx) => (
                    <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-2">
                      {snap.imageData && <img src={snap.imageData} alt="snapshot" className="w-full h-44 object-cover rounded-lg" />}
                      <Input label="Caption" value={snap.caption || ''} onChange={(e) => updateSnapshot(idx, 'caption', e.target.value)} />
                      <Button size="sm" variant="danger" onClick={() => removeSnapshot(idx)}>Remove</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReportBuilder;

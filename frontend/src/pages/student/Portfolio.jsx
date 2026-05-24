import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import { DashboardLayout } from '../../components/common/Layout';
import { Button } from '../../components/common';
import { portfolioAPI } from '../../api';
import toast from 'react-hot-toast';

const StudentPortfolio = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState('classic');

  useEffect(() => {
    portfolioAPI.getResumeData()
      .then((res) => setData(res.data.data))
      .catch(() => toast.error('Failed to load resume data'))
      .finally(() => setLoading(false));
  }, []);

  const downloadPdf = () => {
    if (!data?.resume) return;
    const r = data.resume;
    const doc = new jsPDF();
    let y = 16;
    doc.setFontSize(18);
    doc.text(r.name || 'Student', 14, y);
    y += 8;
    doc.setFontSize(11);
    doc.text(`${r.email || ''} | ${r.phone || ''}`, 14, y);
    y += 8;
    doc.text(`${r.branch || ''} Year ${r.year || ''}`, 14, y);
    y += 10;
    doc.setFontSize(13);
    doc.text('Skills', 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.text((r.skills || []).join(', ') || 'N/A', 14, y, { maxWidth: 180 });
    y += 12;
    doc.setFontSize(13);
    doc.text('Projects', 14, y);
    y += 7;
    doc.setFontSize(10);
    (r.projects || []).forEach((p, idx) => {
      doc.text(`${idx + 1}. ${p.title}`, 14, y); y += 5;
      doc.text(p.description || '', 18, y, { maxWidth: 176 }); y += 8;
      doc.text(`Tech: ${(p.technologies || []).join(', ')}`, 18, y, { maxWidth: 176 }); y += 7;
      if (y > 270) { doc.addPage(); y = 16; }
    });
    doc.save(`${(r.name || 'student').replace(/\s+/g, '_')}_resume.pdf`);
  };

  const downloadPortfolioHtml = async () => {
    try {
      const res = await portfolioAPI.downloadPortfolioHtml();
      const blob = new Blob([res.data], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'portfolio.html';
      link.click();
      URL.revokeObjectURL(url);
    } catch (_) {
      toast.error('Failed to export portfolio HTML');
    }
  };

  const themedHtml = () => {
    const raw = data?.portfolio_html || '';
    if (!raw) return '';
    if (template === 'minimal') {
      return raw.replace('background:#f5f7fb', 'background:#ffffff').replace('border-radius:18px', 'border-radius:8px');
    }
    if (template === 'dark-pro') {
      return raw
        .replace('background:#f5f7fb', 'background:#0b1220;color:#f9fafb')
        .replace('background:white', 'background:#111827;color:#f9fafb')
        .replace('border:1px solid #e5e7eb', 'border:1px solid #374151');
    }
    return raw;
  };

  if (loading) return <DashboardLayout><div className="card p-5">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Resume + Portfolio Generator</h1>
            <p className="text-sm text-gray-500">Auto-generated from your project data.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={downloadPortfolioHtml}>Export Portfolio HTML</Button>
            <Button onClick={downloadPdf}>Download Resume PDF</Button>
          </div>
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="font-semibold">Portfolio Preview (HTML)</h2>
          <div className="flex gap-2">
            <Button size="sm" variant={template === 'classic' ? 'primary' : 'secondary'} onClick={() => setTemplate('classic')}>Classic</Button>
            <Button size="sm" variant={template === 'minimal' ? 'primary' : 'secondary'} onClick={() => setTemplate('minimal')}>Minimal</Button>
            <Button size="sm" variant={template === 'dark-pro' ? 'primary' : 'secondary'} onClick={() => setTemplate('dark-pro')}>Dark Pro</Button>
          </div>
          <iframe title="portfolio" srcDoc={themedHtml()} className="w-full h-[520px] rounded-xl border border-gray-200 dark:border-gray-700" />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentPortfolio;

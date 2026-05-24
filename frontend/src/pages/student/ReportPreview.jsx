import { useEffect, useState, useRef } from 'react';
import { createReportPDF } from './TemplateLockReport';

const ReportPreview = () => {
  const [pdfUrl, setPdfUrl] = useState('');
  const [status, setStatus] = useState('Loading preview...');
  const [lastUpdated, setLastUpdated] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [hasPending, setHasPending] = useState(false);

  const urlRef = useRef('');
  const iframeRef = useRef(null);
  const currentPageRef = useRef(1);
  const lastPayloadRef = useRef('');
  const pendingDataRef = useRef(null);

  const withPageAnchor = (url) => `${url}#page=${currentPageRef.current}&zoom=page-width`;

  const renderPDF = (data) => {
    try {
      const pdf = createReportPDF(data);
      const blob = pdf.output('blob');
      const newUrl = URL.createObjectURL(blob);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = newUrl;
      setPdfUrl(withPageAnchor(newUrl));
      setStatus('');
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error('PDF generation error:', e);
      setStatus('PDF generate karne mein error aaya. Console check karo.');
    }
  };

  const handleIncomingData = (data) => {
    if (isPaused) {
      pendingDataRef.current = data;
      setHasPending(true);
      setStatus('Paused: new changes pending');
      return;
    }
    setStatus('Updating...');
    renderPDF(data);
  };

  const applyPending = () => {
    if (!pendingDataRef.current) return;
    const next = pendingDataRef.current;
    pendingDataRef.current = null;
    setHasPending(false);
    setStatus('Updating...');
    renderPDF(next);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('pdf_preview_data');
      if (raw) {
        lastPayloadRef.current = raw;
        renderPDF(JSON.parse(raw));
      } else {
        setStatus('Koi data nahi mila. Pehle editor mein "Full PDF Preview" click karo.');
      }
    } catch (_) {
      setStatus('Data load karne mein error aaya.');
    }

    const channel = new BroadcastChannel('pdf_preview_channel');
    channel.onmessage = (e) => {
      if (e.data?.type === 'UPDATE_DATA' && e.data?.data) {
        lastPayloadRef.current = JSON.stringify(e.data.data);
        handleIncomingData(e.data.data);
      }
    };

    return () => {
      channel.close();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [isPaused]);

  useEffect(() => {
    const id = setInterval(() => {
      try {
        const hash = iframeRef.current?.contentWindow?.location?.hash || '';
        const match = hash.match(/page=(\d+)/i);
        if (match) currentPageRef.current = Number(match[1]) || 1;
      } catch (_) {}
    }, 600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      try {
        const raw = localStorage.getItem('pdf_preview_data');
        if (!raw || raw === lastPayloadRef.current) return;
        lastPayloadRef.current = raw;
        handleIncomingData(JSON.parse(raw));
      } catch (_) {}
    }, 700);
    return () => clearInterval(id);
  }, [isPaused]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1e1e2e', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#16161e', borderBottom: '1px solid #2a2a3e', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: status === '' ? '#50fa7b' : '#ffb86c', boxShadow: status === '' ? '0 0 6px #50fa7b' : '0 0 6px #ffb86c' }} />
          <span style={{ color: '#cdd6f4', fontSize: 13, fontWeight: 600 }}>Live PDF Preview</span>
          {status ? (
            <span style={{ color: '#ffb86c', fontSize: 12 }}>{status}</span>
          ) : (
            <span style={{ color: '#6272a4', fontSize: 12 }}>Auto-updates jab bhi editor mein kuch badlo • Last updated: {lastUpdated}</span>
          )}
        </div>
        <div style={{ color: '#6272a4', fontSize: 11, display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              const next = !isPaused;
              setIsPaused(next);
              if (!next && hasPending) applyPending();
            }}
            style={{ background: isPaused ? '#3b82f6' : '#2a2a3e', color: '#e2e8f0', border: '1px solid #3f3f56', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}
          >
            {isPaused ? 'Resume Live' : 'Pause Live'}
          </button>
          {hasPending && (
            <button
              onClick={applyPending}
              style={{ background: '#16a34a', color: '#f8fafc', border: '1px solid #1d7a3e', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}
            >
              Apply Update
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {pdfUrl ? (
          <iframe ref={iframeRef} src={pdfUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Preview" />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 40, height: 40, border: '3px solid #6272a4', borderTopColor: '#bd93f9', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: '#6272a4', fontSize: 14 }}>{status}</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportPreview;

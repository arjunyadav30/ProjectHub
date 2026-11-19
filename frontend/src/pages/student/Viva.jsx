import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/common/Layout';
import { Button } from '../../components/common';
import { jsPDF } from 'jspdf';
import { teamAPI, vivaAPI } from '../../api';
import toast from 'react-hot-toast';

const StudentViva = () => {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState('standard');
  const [commitSession, setCommitSession] = useState(null);
  const [commitAnswers, setCommitAnswers] = useState([]);
  const [commitResult, setCommitResult] = useState(null);
  const [commitError, setCommitError] = useState('');
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [listeningIndex, setListeningIndex] = useState(-1);
  const [recognitionSupported] = useState(() => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));

  useEffect(() => {
    teamAPI.getAll().then((res) => setTeams(res.data.data || [])).catch(() => toast.error('Failed to load teams'));
  }, []);

  const startViva = async () => {
    if (!selectedTeam) return toast.error('Select a team first');
    setLoading(true);
    if (mode === 'commit') {
      setCommitError('');
      try {
        const { data } = await vivaAPI.startCommit(selectedTeam);
        const resultData = data.data;
        setCommitSession(resultData);
        setCommitAnswers(new Array((resultData.questions || []).length).fill(''));
        setCommitResult(null);
      } catch (e) {
        const message = e.response?.data?.message || 'Unable to start commit-based viva.';
        setCommitError(message);
        toast.error(message);
      } finally { setLoading(false); }
      return;
    }
    try {
      const res = await vivaAPI.start(selectedTeam);
      const data = res.data.data;
      setSession(data);
      setAnswers(new Array((data.questions || []).length).fill(''));
      setResult(null);
      toast.success('Viva session started');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to start viva');
    } finally { setLoading(false); }
  };

  const submitViva = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await vivaAPI.submit(session._id, answers);
      setResult(res.data.data);
      toast.success('AI evaluation complete');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to submit viva');
    } finally { setLoading(false); }
  };

  const submitCommitViva = async () => {
    if (!commitSession) return;
    setLoading(true);
    try {
      const { data } = await vivaAPI.submitCommit(commitSession.session_id, commitAnswers);
      setCommitResult(data.data);
      toast.success('Commit-based viva submitted');
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to submit commit-based viva'); }
    finally { setLoading(false); }
  };

  const downloadReportPdf = async () => {
    if (!result?.session_id) return;
    try {
      const res = await vivaAPI.getReport(result.session_id);
      const r = res.data?.data;
      const doc = new jsPDF();
      let y = 16;
      doc.setFontSize(16);
      doc.text(`AI Viva Report - ${r.project_title || ''}`, 14, y); y += 8;
      doc.setFontSize(10);
      doc.text(`Student: ${r.student?.name || ''} (${r.student?.email || ''})`, 14, y); y += 6;
      doc.text(`Score: ${r.total_score}/${r.max_score}`, 14, y); y += 8;
      doc.text(`Feedback: ${r.overall_feedback || ''}`, 14, y, { maxWidth: 180 }); y += 10;
      (r.questions || []).forEach((q, idx) => {
        doc.text(`${idx + 1}. ${q.question}`, 14, y, { maxWidth: 180 }); y += 6;
        doc.text(`Score: ${q.score} | ${q.feedback}`, 18, y, { maxWidth: 176 }); y += 8;
        if (y > 272) { doc.addPage(); y = 16; }
      });
      doc.save(`viva-report-${r.session_id}.pdf`);
    } catch (e) {
      toast.error('Failed to export report');
    }
  };

  const startVoiceInput = (idx) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return toast.error('Speech recognition not supported in this browser');
    const recognition = new SR();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setListeningIndex(idx);
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || '';
      setAnswers((prev) => prev.map((a, i) => (i === idx ? `${a} ${text}`.trim() : a)));
    };
    recognition.onerror = () => toast.error('Voice input failed');
    recognition.onend = () => setListeningIndex(-1);
    recognition.start();
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Viva Interview</h1>
          <p className="text-sm text-gray-500 mt-1">Technical viva with AI scoring and feedback report.</p>
        </div>

        <div className="card p-4 space-y-3">
          <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
            {[['standard', 'Standard viva'], ['commit', 'Commit-based viva']].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setMode(value)} className={`flex-1 rounded-md py-2 text-sm ${mode === value ? 'bg-white dark:bg-gray-700 shadow font-medium' : 'text-gray-500'}`}>{label}</button>
            ))}
          </div>
          <label className="text-sm font-medium">Select Team</label>
          <select className="input" value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}>
            <option value="">Choose team</option>
            {teams.map((t) => <option key={t._id} value={t._id}>{t.team_name}</option>)}
          </select>
          <Button onClick={startViva} loading={loading}>{mode === 'commit' ? 'Start commit-based viva' : 'Start AI Viva'}</Button>
        </div>

        {commitError && mode === 'commit' && <div role="alert" className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-4 text-sm text-blue-900 dark:text-blue-200">{commitError}</div>}
        {mode === 'commit' && commitSession && !commitResult && (
          <div className="card p-4 space-y-4">
            <h2 className="font-semibold dark:text-white">Commit-based questions</h2>
            {(commitSession.questions || []).map((q, idx) => (
              <div key={`${q.index}-${q.commit_sha}`} className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex flex-wrap gap-2"><span className="badge-open">{q.commit_sha}</span><span className="badge-pending">{q.difficulty}</span></div>
                <p className="text-sm font-medium">{q.question}</p><p className="text-xs text-gray-500">{q.commit_message}</p>
                {q.files?.length > 0 && <p className="text-xs text-gray-500">Files: {q.files.map(f => typeof f === 'string' ? f : f.filename).join(', ')}</p>}
                <textarea className="input min-h-[100px]" aria-label={`Answer ${idx + 1}`} value={commitAnswers[idx] || ''} onChange={e => setCommitAnswers(prev => prev.map((answer, i) => i === idx ? e.target.value : answer))} />
              </div>
            ))}
            <Button className="min-h-12 w-full" loading={loading} onClick={submitCommitViva}>Submit commit viva</Button>
          </div>
        )}
        {mode === 'commit' && commitResult && <div className="card p-4 space-y-3"><h2 className="font-semibold">Commit viva result · {commitResult.total_score}/100</h2>{(commitResult.questions || []).map((q, index) => <div key={`${q.index}-${index}`} className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3"><p className="font-medium text-sm">{q.question}</p><p className="text-sm mt-1">Score: {q.score}/10</p><p className="text-sm text-gray-500">{q.feedback}</p></div>)}</div>}

        {mode === 'standard' && session && !result && (
          <div className="card p-4 space-y-4">
            <h2 className="font-semibold">Answer Questions</h2>
            {(session.questions || []).map((q, idx) => (
              <div key={idx} className="space-y-1">
                <p className="text-sm font-medium">{q.question}</p>
                <textarea
                  className="input min-h-[90px]"
                  value={answers[idx] || ''}
                  onChange={(e) => setAnswers((prev) => prev.map((a, i) => (i === idx ? e.target.value : a)))}
                />
                {recognitionSupported && (
                  <Button size="sm" variant="secondary" onClick={() => startVoiceInput(idx)}>
                    {listeningIndex === idx ? 'Listening...' : 'Use Voice'}
                  </Button>
                )}
              </div>
            ))}
            <Button onClick={submitViva} loading={loading}>Submit for AI Evaluation</Button>
          </div>
        )}

        {mode === 'standard' && result && (
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold">Viva Report</h2>
            <p className="text-sm"><span className="font-medium">Score:</span> {result.total_score}/{result.max_score}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">{result.overall_feedback}</p>
            <div className="space-y-2">
              {(result.question_feedback || []).map((q, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <p className="text-xs font-semibold">Q{idx + 1} Score: {q.score}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">{q.feedback}</p>
                </div>
              ))}
            </div>
            <Button onClick={downloadReportPdf}>Download Report PDF</Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentViva;

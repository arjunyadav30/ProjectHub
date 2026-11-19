import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Modal, Skeleton } from '../common';
import { contributionAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage, getData } from '../../pages/evaluation/shared';
import OnboardingStatus from './OnboardingStatus';

const STEP_TITLES = ['Link repository', 'Map contributors', 'Confirm', 'Done'];
const CONFIDENCE_VARIANT = { high: 'approved', medium: 'pending', low: 'default' };

const maskEmail = (email) => {
  const [name, domain] = String(email || '').split('@');
  if (!domain) return '';
  return `${name.slice(0, 2)}${'•'.repeat(Math.max(2, Math.min(6, name.length - 2)))}@${domain}`;
};

const RepoOnboardingWizard = ({ open, onClose, teamId, canAnalyze = false, onDone }) => {
  const { profile } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [onboarding, setOnboarding] = useState(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [rows, setRows] = useState([]);
  const [showEmails, setShowEmails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = getData(await contributionAPI.onboarding(teamId));
      if (!mounted.current) return;
      setOnboarding(data);
      setRows((data?.members || []).map((member) => ({
        student_id: String(member.student_id),
        name: member.name,
        login: member.github_login || '',
        confidence: null,
      })));
      setRepoUrl(data?.repo?.url || '');
    } catch (e) {
      if (mounted.current) toast.error(errorMessage(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setPreview(null);
    setSaved(false);
    setShowEmails(false);
    setElapsed(0);
    setRows([]);
    loadStatus();
  }, [open, loadStatus]);

  useEffect(() => {
    if (!analyzing) return undefined;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [analyzing]);

  const suggestions = preview?.suggestions || null;
  const bots = useMemo(() => new Set((suggestions?.ignored_bots || []).map((login) => String(login).toLowerCase())), [suggestions]);
  const candidates = useMemo(() => (preview?.candidates || [])
    .filter((candidate) => candidate.login && !bots.has(String(candidate.login).toLowerCase())), [preview, bots]);
  const myRowIndex = rows.findIndex((row) => row.student_id === String(profile?._id || ''));
  const suggestionFor = useCallback((studentId) => (
    suggestions?.suggestions?.find((item) => String(item.student_id) === String(studentId)) || null
  ), [suggestions]);

  const previewRepo = async () => {
    if (!repoUrl.trim()) return toast.error('Enter the repository URL.');
    setPreviewing(true);
    try {
      const result = getData(await contributionAPI.previewRepo({ repo_url: repoUrl.trim(), team_id: teamId }));
      if (!mounted.current) return;
      setPreview(result);
      setRepoUrl(result?.repo?.url || repoUrl);
      const byStudent = new Map((result?.suggestions?.suggestions || []).map((item) => [String(item.student_id), item]));
      setRows((prev) => prev.map((row) => {
        const suggestion = byStudent.get(row.student_id);
        return suggestion
          ? { ...row, login: suggestion.login || row.login, confidence: suggestion.confidence }
          : row;
      }));
      setStep(1);
      if (result?.warnings?.length) result.warnings.forEach((warning) => toast(warning, { icon: '⚠️' }));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      if (mounted.current) setPreviewing(false);
    }
  };

  const continueWithoutPreview = () => {
    if (!onboarding?.repo) return toast.error('Preview the repository first.');
    setPreview({ repo: { full_name: onboarding.repo.full_name, url: onboarding.repo.url }, candidates: [], suggestions: null, checks: [], warnings: [] });
    setStep(1);
  };

  const setLogin = (studentId, login) => {
    setRows((prev) => prev.map((row) => (row.student_id === studentId ? { ...row, login } : row)));
  };

  const claim = (login) => {
    if (myRowIndex < 0) return toast.error('You are not an accepted member of this team.');
    setRows((prev) => prev.map((row, index) => {
      if (String(row.login).toLowerCase() === String(login).toLowerCase() && index !== myRowIndex) return { ...row, login: '' };
      return index === myRowIndex ? { ...row, login } : row;
    }));
  };

  const duplicateLogins = useMemo(() => {
    const seen = new Map();
    rows.forEach((row) => {
      const key = String(row.login || '').trim().toLowerCase();
      if (key) seen.set(key, (seen.get(key) || 0) + 1);
    });
    return [...seen.entries()].filter(([, count]) => count > 1).map(([login]) => login);
  }, [rows]);

  const goToConfirm = () => {
    if (duplicateLogins.length) return toast.error(`Each GitHub username can belong to only one student (duplicate: ${duplicateLogins[0]}).`);
    setStep(2);
  };

  const save = async () => {
    setSaving(true);
    try {
      const repoResult = getData(await contributionAPI.setRepo(teamId, { repo_url: repoUrl.trim() }));
      if (repoResult?.warning) toast(repoResult.warning, { icon: '⚠️' });
      await contributionAPI.setAuthorMap(teamId, rows.map((row) => ({
        student_id: row.student_id,
        github_login: String(row.login || '').trim(),
        emails: suggestionFor(row.student_id)?.email ? [suggestionFor(row.student_id).email] : [],
      })));
      if (!mounted.current) return;
      await loadStatus();
      if (!mounted.current) return;
      setSaved(true);
      setStep(3);
      toast.success('Repository and contributors saved');
      onDone?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setElapsed(0);
    try {
      await contributionAPI.generate(teamId, {});
      toast.success('Contribution report generated');
      onDone?.('analyzed');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      if (mounted.current) setAnalyzing(false);
    }
  };

  const mappedCount = rows.filter((row) => String(row.login || '').trim()).length;

  return (
    <Modal open={open} onClose={onClose} title="Repository & contributors" size="xl">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2 text-xs">
          {STEP_TITLES.map((title, index) => (
            <span key={title} className={`px-2 py-1 rounded-full ${index === step ? 'bg-blue-600 text-white' : index < step ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
              {index + 1}. {title}
            </span>
          ))}
        </div>

        {loading ? <div className="grid gap-3"><Skeleton className="h-10" /><Skeleton className="h-24" /></div> : <>
          {step === 0 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium">Public GitHub repository URL
                <input className="input mt-1" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repository" disabled={previewing} />
              </label>
              <p className="text-xs text-gray-500">Only public repositories are supported. Private repositories will appear as “not found”.</p>
              {onboarding?.repo && <p className="text-sm text-gray-600 dark:text-gray-300">Currently linked: <span className="font-medium">{onboarding.repo.full_name}</span></p>}
              <div className="flex flex-wrap gap-2">
                <Button loading={previewing} onClick={previewRepo} disabled={previewing}>Preview repository</Button>
                {onboarding?.repo && <Button variant="secondary" onClick={continueWithoutPreview} disabled={previewing}>Edit mapping only</Button>}
                <Button variant="secondary" onClick={onClose} disabled={previewing}>Cancel</Button>
              </div>
              {preview?.repo && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold dark:text-white">{preview.repo.full_name}</p>
                    {preview.repo.language && <span className="text-xs text-gray-500">{preview.repo.language}</span>}
                    {preview.repo.archived && <span className="text-xs text-amber-700">archived</span>}
                    {preview.repo.fork && <span className="text-xs text-amber-700">fork</span>}
                  </div>
                  {preview.repo.description && <p className="text-sm text-gray-600 dark:text-gray-300">{preview.repo.description}</p>}
                  <p className="text-xs text-gray-500">Default branch: {preview.repo.default_branch || '—'} · Stars: {preview.repo.stars ?? 0} · Created: {preview.repo.created_at ? new Date(preview.repo.created_at).toLocaleDateString('en-IN') : '—'}</p>
                  {(preview.checks || []).map((check) => <p key={check.key} className={`text-sm ${check.ok ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>{check.ok ? '✓' : '!'} {check.detail}</p>)}
                  {(preview.warnings || []).filter((warning) => !(preview.checks || []).some((check) => !check.ok && check.detail === warning)).map((warning, index) => <p key={`${warning}-${index}`} className="text-sm text-amber-700 dark:text-amber-400">{warning}</p>)}
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-600 dark:text-gray-300">{preview?.repo?.full_name}</p>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <input type="checkbox" checked={showEmails} onChange={(e) => setShowEmails(e.target.checked)} /> Show full emails
                </label>
              </div>
              {!!preview?.warnings?.length && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 space-y-1">
                  {preview.warnings.map((warning, index) => <p key={`${warning}-${index}`} className="text-xs text-amber-800 dark:text-amber-300">{warning}</p>)}
                </div>
              )}
              <div className="space-y-2">
                {rows.length === 0 && <p className="text-sm text-gray-500">No accepted team members found.</p>}
                {rows.map((row) => {
                  const suggestion = suggestionFor(row.student_id);
                  return (
                    <div key={row.student_id} className="grid sm:grid-cols-[1fr_1.2fr_auto] gap-2 items-center">
                      <p className="text-sm font-medium dark:text-white">{row.name}{row.student_id === String(profile?._id || '') && <span className="ml-1 text-xs text-blue-600">(you)</span>}</p>
                      <input className="input" list="repo-candidate-logins" value={row.login} onChange={(e) => setLogin(row.student_id, e.target.value)} placeholder="GitHub username" />
                      <div className="flex items-center gap-1">
                        {row.confidence && <span className={`rounded px-2 py-0.5 text-xs ${CONFIDENCE_VARIANT[row.confidence] === 'approved' ? 'bg-green-100 text-green-800' : row.confidence === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{row.confidence} match</span>}
                        {suggestion && <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setLogin(row.student_id, suggestion.login)}>use suggestion</button>}
                      </div>
                    </div>
                  );
                })}
                <datalist id="repo-candidate-logins">{candidates.map((candidate) => <option key={candidate.login} value={candidate.login}>{candidate.commits} commits</option>)}</datalist>
              </div>
              <p className="text-xs text-gray-500">{mappedCount} of {rows.length} contributor(s) mapped. Unmapped members will not receive a contribution share.</p>
              {duplicateLogins.length > 0 && <p className="text-sm text-red-600 dark:text-red-400">Duplicate username: {duplicateLogins[0]}. A GitHub account can map to only one student.</p>}
              {!!candidates.length && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                  <p className="text-sm font-medium">Authors found in this repository</p>
                  <div className="flex flex-wrap gap-2">
                    {candidates.map((candidate) => {
                      const assigned = rows.find((row) => String(row.login).toLowerCase() === String(candidate.login).toLowerCase());
                      return (
                        <span key={candidate.login} className="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs">
                          <span className="font-medium">{candidate.login}</span>
                          <span className="text-gray-500">{candidate.commits} commits</span>
                          {candidate.email && <span className="text-gray-400">{showEmails ? candidate.email : maskEmail(candidate.email)}</span>}
                          {!assigned && myRowIndex >= 0 && <button type="button" className="text-blue-600 hover:underline" onClick={() => claim(candidate.login)}>That&apos;s me</button>}
                        </span>
                      );
                    })}
                  </div>
                  {(suggestions?.unmatched_members || []).length > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">{suggestions.unmatched_members.length} member(s) had no confident match; confirm their usernames above.</p>}
                  {bots.size > 0 && <p className="text-xs text-gray-500">{bots.size} bot account(s) are ignored for contribution scoring.</p>}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setStep(0)} disabled={saving}>Back</Button>
                <Button onClick={goToConfirm} disabled={saving}>Continue</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                <p className="text-sm"><span className="text-gray-500">Repository:</span> <span className="font-medium">{preview?.repo?.full_name || repoUrl}</span></p>
                <p className="text-sm text-gray-500">Share is calculated only from commits attributed to the mapped accounts. The guide makes the final score decision.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead><tr className="text-left border-b dark:border-gray-700"><th className="p-2">Student</th><th className="p-2">GitHub username</th></tr></thead>
                  <tbody>
                    {rows.map((row) => <tr key={row.student_id} className="border-b dark:border-gray-800"><td className="p-2 dark:text-white">{row.name}</td><td className="p-2">{row.login || <span className="text-gray-400">not mapped</span>}</td></tr>)}
                  </tbody>
                </table>
              </div>
              {canAnalyze && <p className="text-xs text-gray-500">After saving you can run the analysis immediately. It may take up to a minute.</p>}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setStep(1)} disabled={saving}>Back</Button>
                <Button loading={saving} onClick={save} disabled={saving}>Save repository & mapping</Button>
              </div>
            </div>
          )}

          {step === 3 && saved && (
            <div className="space-y-4">
              <OnboardingStatus status={onboarding?.status} steps={onboarding?.steps} stale={onboarding?.stale} showSteps />
              <p className="text-sm text-gray-600 dark:text-gray-300">The repository and contributor mapping are saved. {analyzing ? `Analysis is running… ${elapsed}s elapsed.` : 'The guide will be able to generate the contribution report.'}</p>
              <div className="flex flex-wrap gap-2">
                {canAnalyze && <Button loading={analyzing} onClick={runAnalysis} disabled={analyzing}>Run analysis now</Button>}
                <Button variant="secondary" onClick={onClose} disabled={analyzing}>Done</Button>
              </div>
            </div>
          )}
        </>}
      </div>
    </Modal>
  );
};

export default RepoOnboardingWizard;

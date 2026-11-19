import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, SkeletonCard } from '../common';
import { contributionAPI } from '../../api';
import { errorMessage, formatIST, getData } from '../../pages/evaluation/shared';
import OnboardingStatus from './OnboardingStatus';
import RepoOnboardingWizard from './RepoOnboardingWizard';
import ContributionPanel from './ContributionPanel';

const RepositoryOnboardingCard = ({ teamId, canAnalyze = false, withPanel = false, onChanged }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      const next = getData(await contributionAPI.onboarding(teamId));
      if (mounted.current) setData(next);
    } catch (e) {
      if (mounted.current) toast.error(errorMessage(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <SkeletonCard />;

  const status = data?.status || 'no_repo';
  const needsSetup = status === 'no_repo' || status === 'mapping_needed';
  const mapped = (data?.members || []).filter((member) => member.github_login).length;
  const total = (data?.members || []).length;

  return (
    <div className="space-y-4">
      <section className="card p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Repository &amp; contributors</h2>
            <p className="text-sm text-gray-500">Link one public GitHub repository and map authors to team members.</p>
          </div>
          <OnboardingStatus status={status} stale={data?.stale} />
        </div>
        {data?.repo ? (
          <a href={data.repo.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 break-all hover:underline">{data.repo.full_name}</a>
        ) : (
          <p className="text-sm text-gray-500">No repository linked yet.</p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          <p>Mapped: {mapped}/{total}</p>
          <p>Last analysis: {data?.last_report_at ? formatIST(data.last_report_at) : '—'}</p>
          <p>{data?.decided ? 'Guide decision recorded' : 'Guide decision pending'}</p>
        </div>
        {data?.stale && <p className="text-sm text-amber-700 dark:text-amber-400">The last analysis is more than 7 days old. Re-run it before finalizing marks.</p>}
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer">Setup progress</summary>
          <div className="mt-2"><OnboardingStatus status={status} steps={data?.steps} stale={data?.stale} showSteps /></div>
        </details>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setWizardOpen(true)}>{status === 'no_repo' ? 'Link repository' : status === 'mapping_needed' ? 'Map contributors' : 'Edit repository / mapping'}</Button>
          {!needsSetup && <Button size="sm" variant="secondary" onClick={load}>Refresh status</Button>}
        </div>
      </section>

      {withPanel && !needsSetup && <ContributionPanel teamId={teamId} />}

      <RepoOnboardingWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        teamId={teamId}
        canAnalyze={canAnalyze}
        onDone={() => { load(); onChanged?.(); }}
      />
    </div>
  );
};

export default RepositoryOnboardingCard;

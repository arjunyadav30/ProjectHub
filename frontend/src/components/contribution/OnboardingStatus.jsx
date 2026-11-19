import { Badge } from '../common';

const META = {
  no_repo: { label: 'No repository', variant: 'rejected' },
  mapping_needed: { label: 'Mapping needed', variant: 'pending' },
  ready: { label: 'Ready to analyze', variant: 'open' },
  analyzed: { label: 'Analyzed', variant: 'approved' },
  decided: { label: 'Decision recorded', variant: 'completed' },
};

const STEP_LABELS = {
  repo: 'Repository',
  mapping: 'Contributors',
  ready: 'Ready',
  analyzed: 'Analysis',
  decided: 'Decision',
};

export const statusLabel = (status) => META[status]?.label || String(status || 'Unknown').replace(/_/g, ' ');

const OnboardingStatus = ({ status, steps = [], stale = false, showSteps = false }) => (
  <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={META[status]?.variant || 'default'}>{statusLabel(status)}</Badge>
      {stale && <Badge variant="pending">Report older than 7 days</Badge>}
    </div>
    {showSteps && (
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        {steps.map((step, index) => (
          <li key={step.key || index} className="flex items-center gap-1">
            <span className={`inline-block w-2 h-2 rounded-full ${step.done ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
            {STEP_LABELS[step.key] || step.key}
            {index < steps.length - 1 && <span className="text-gray-300 dark:text-gray-600 ml-1">→</span>}
          </li>
        ))}
      </ol>
    )}
  </div>
);

export default OnboardingStatus;

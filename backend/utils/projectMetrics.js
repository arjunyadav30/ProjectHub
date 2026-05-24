const buildWorkload = (team) => {
  const loadMap = new Map();
  (team.project?.modules || []).forEach((module) => {
    const key = module.assigned_to ? module.assigned_to.toString() : 'unassigned';
    if (!loadMap.has(key)) {
      loadMap.set(key, {
        assignee_id: key,
        assignee_name: module.assigned_to?.name || 'Unassigned',
        total_tasks: 0,
        open_tasks: 0,
        estimated_hours: 0,
        actual_hours: 0,
      });
    }

    const row = loadMap.get(key);
    row.total_tasks += 1;
    if (module.status !== 'completed') row.open_tasks += 1;
    row.estimated_hours += Number(module.estimated_hours || 0);
    row.actual_hours += Number(module.actual_hours || 0);
  });

  const members = Array.from(loadMap.values()).map((entry) => {
    const status = entry.open_tasks > 6 || entry.estimated_hours > 30
      ? 'overloaded'
      : entry.open_tasks < 2
        ? 'underloaded'
        : 'balanced';

    return { ...entry, status };
  });

  return { members };
};

const buildSprintVelocity = (team) => {
  const sprint = team.project?.sprint || {};
  const committed = Number(sprint.committed_points || 0);
  const completed = Number(sprint.completed_points || 0);

  const rate = committed > 0 ? Number(((completed / committed) * 100).toFixed(2)) : 0;

  return {
    sprint,
    velocity: {
      committed_points: committed,
      completed_points: completed,
      completion_rate: rate,
    },
  };
};

const buildDashboardMetrics = (team) => {
  const modules = team.project?.modules || [];
  const total = modules.length;
  const completed = modules.filter((m) => m.status === 'completed').length;
  const overdue = modules.filter((m) => m.due_date && new Date(m.due_date) < new Date() && m.status !== 'completed').length;
  const cycleCandidates = modules.filter((m) => Number(m.actual_hours || 0) > 0);
  const cycleTimeHours = cycleCandidates.length
    ? Number((cycleCandidates.reduce((sum, m) => sum + Number(m.actual_hours || 0), 0) / cycleCandidates.length).toFixed(2))
    : 0;

  return {
    kpis: {
      tasks_total: total,
      tasks_completed: completed,
      tasks_overdue: overdue,
      cycle_time_hours: cycleTimeHours,
    },
    burndown: {
      remaining_tasks: total - completed,
      completed_tasks: completed,
    },
    cumulative_flow: {
      not_started: modules.filter((m) => m.status === 'not_started').length,
      inprogress: modules.filter((m) => m.status === 'inprogress').length,
      completed,
    },
  };
};

module.exports = { buildWorkload, buildSprintVelocity, buildDashboardMetrics };

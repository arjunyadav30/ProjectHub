const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorkload, buildSprintVelocity, buildDashboardMetrics } = require('../utils/projectMetrics');

const sampleTeam = {
  project: {
    sprint: { committed_points: 20, completed_points: 14 },
    modules: [
      { module_name: 'A', status: 'not_started', estimated_hours: 10, actual_hours: 0, assigned_to: { toString: () => 'u1', name: 'Alice' } },
      { module_name: 'B', status: 'inprogress', estimated_hours: 8, actual_hours: 3, assigned_to: { toString: () => 'u1', name: 'Alice' } },
      { module_name: 'C', status: 'completed', estimated_hours: 5, actual_hours: 6, assigned_to: { toString: () => 'u2', name: 'Bob' } },
    ],
  },
};

test('buildWorkload returns workload states', () => {
  const result = buildWorkload(sampleTeam);
  assert.equal(result.members.length, 2);
  assert.equal(result.members[0].assignee_name, 'Alice');
});

test('buildSprintVelocity computes completion rate', () => {
  const result = buildSprintVelocity(sampleTeam);
  assert.equal(result.velocity.completion_rate, 70);
});

test('buildDashboardMetrics computes KPIs', () => {
  const result = buildDashboardMetrics(sampleTeam);
  assert.equal(result.kpis.tasks_total, 3);
  assert.equal(result.kpis.tasks_completed, 1);
});

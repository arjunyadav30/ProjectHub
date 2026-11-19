const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');

const routers = [
  ['/api/contributions', require('../routes/contributions')],
  ['/api/schedule', require('../routes/schedule')],
  ['/api/panel', require('../routes/panel')],
  ['/api/evaluation', require('../routes/evaluation')],
  ['/api/health-monitor', require('../routes/healthMonitor')],
  ['/api/viva', require('../routes/viva')],
  ['/api/integrations', require('../routes/integrations')],
];

const checks = [
  ['post', '/api/contributions/repo/preview'],
  ['put', '/api/contributions/teams/team1/repo'],
  ['get', '/api/contributions/teams/team1/onboarding'],
  ['get', '/api/contributions/events/event1/onboarding'],
  ['post', '/api/contributions/events/event1/onboarding/remind'],
  ['post', '/api/contributions/events/event1/analyze-all'],
  ['get', '/api/contributions/events/event1/analyze-all/job1'],
  ['post', '/api/contributions/teams/team1/generate'],
  ['get', '/api/contributions/teams/team1/latest'],
  ['put', '/api/contributions/teams/team1/author-map'],
  ['put', '/api/contributions/reports/report1/decision'],
  ['get', '/api/contributions/events/event1/summary'],

  ['get', '/api/schedule/events/event1/panels'],
  ['post', '/api/schedule/events/event1/panels'],
  ['put', '/api/schedule/events/event1/panels/panel1'],
  ['delete', '/api/schedule/events/event1/panels/panel1'],
  ['post', '/api/schedule/events/event1/presentations/presentation1/auto'],
  ['get', '/api/schedule/events/event1/presentations/presentation1/slots'],
  ['post', '/api/schedule/events/event1/presentations/presentation1/publish'],
  ['patch', '/api/schedule/slots/slot1'],
  ['post', '/api/schedule/slots/slot1/reschedule-request'],
  ['patch', '/api/schedule/slots/slot1/reschedule-request'],
  ['get', '/api/schedule/my'],
  ['get', '/api/schedule/my/calendar.ics'],
  ['get', '/api/schedule/slots/slot1/calendar.ics'],

  ['get', '/api/panel/slots/slot1/scoresheet'],
  ['post', '/api/panel/slots/slot1/start'],
  ['post', '/api/panel/slots/slot1/complete'],
  ['put', '/api/panel/slots/slot1/score'],
  ['get', '/api/panel/events/event1/presentations/presentation1/leaderboard'],
  ['post', '/api/panel/events/event1/presentations/presentation1/finalize'],
  ['get', '/api/panel/events/event1/dashboard'],

  ['get', '/api/evaluation/my'],
  ['get', '/api/evaluation/events/event1/grades'],
  ['get', '/api/evaluation/events/event1/grades.csv'],
  ['get', '/api/evaluation/events/event1/marks'],
  ['put', '/api/evaluation/events/event1/marks'],
  ['put', '/api/evaluation/events/event1/weights'],
  ['post', '/api/evaluation/events/event1/finalize'],
  ['get', '/api/evaluation/teams/team1/grades'],
  ['put', '/api/evaluation/teams/team1/report-score'],
  ['put', '/api/evaluation/grades/grade1/override'],

  ['get', '/api/health-monitor/events/event1'],
  ['get', '/api/health-monitor/teams/team1'],
  ['post', '/api/health-monitor/teams/team1/check'],

  ['post', '/api/viva/commit/start'],
  ['post', '/api/viva/commit/submit'],

  ['post', '/api/integrations/github/teams/team1/connect'],
  ['post', '/api/integrations/github/teams/team1/sync'],
  ['get', '/api/integrations/github/teams/team1'],
];

test('every module route rejects unauthenticated requests with 401', async () => {
  const app = express();
  app.use(express.json());
  routers.forEach(([base, router]) => app.use(base, router));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    for (const [method, path] of checks) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: method.toUpperCase(),
        headers: { 'Content-Type': 'application/json' },
        body: ['post', 'put', 'patch'].includes(method) ? '{}' : undefined,
      });
      assert.equal(response.status, 401, `${method.toUpperCase()} ${path} should require authentication`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

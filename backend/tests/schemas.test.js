const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const oid = () => new mongoose.Types.ObjectId();

const ContributionReport = require('../models/ContributionReport');
const PresentationPanel = require('../models/PresentationPanel');
const PresentationSlot = require('../models/PresentationSlot');
const JudgeScore = require('../models/JudgeScore');
const FinalGrade = require('../models/FinalGrade');
const HealthCheckLog = require('../models/HealthCheckLog');
const VivaSession = require('../models/VivaSession');
const Team = require('../models/Team');
const Event = require('../models/Event');

test('ContributionReport accepts a generated report and a guide decision', () => {
  const doc = new ContributionReport({
    college_id: oid(), team_id: oid(), event_id: oid(), generated_by: oid(), repo_full_name: 'a/b',
    members: [{ student_id: oid(), name: 'A', share_percent: 60, suggested_score_100: 100, flags: ['bulk_dump'] }],
    unmapped_authors: [{ login: 'x', email: 'x@y.z', name: 'X', commits: 2 }],
    guide_decision: { scores: [{ student_id: oid(), score_100: 90 }], comment: 'ok' },
  });
  assert.equal(doc.validateSync(), undefined);
  doc.guide_decision.scores[0].score_100 = 140;
  assert.ok(doc.validateSync());
});

test('PresentationSlot + JudgeScore enforce required fields and ranges', () => {
  const slot = new PresentationSlot({ college_id: oid(), event_id: oid(), presentation_id: oid(), panel_id: oid(), team_id: oid(), start_at: new Date(), end_at: new Date() });
  assert.equal(slot.validateSync(), undefined);
  assert.equal(slot.status, 'scheduled');
  assert.equal(slot.reschedule_request.status, 'none');
  const bad = new JudgeScore({ college_id: oid(), event_id: oid(), presentation_id: oid(), slot_id: oid(), panel_id: oid(), team_id: oid(), examiner_user_id: oid(), criteria: [{ label: 'x', marks: 1, marks_out_of: 10 }], total_percent: 120 });
  assert.ok(bad.validateSync().errors.total_percent);
});

test('Team stores author map and health; Event has default evaluation weights', () => {
  const t = new Team({ college_id: oid(), event_id: oid(), team_name: 'T', created_by: oid(), project: { github: { author_map: [{ student_id: oid(), github_login: 'alice', emails: ['A@B.com'] }] } } });
  assert.equal(t.validateSync(), undefined);
  assert.equal(t.project.github.author_map[0].emails[0], 'a@b.com');
  assert.equal(t.project.health.status, 'unknown');
  const e = new Event({ college_id: oid(), title: 't', description: 'd', created_by: oid(), registration_end: new Date(), event_end_date: new Date() });
  assert.equal(e.evaluation_weights.presentation, 30);
});

test('Team stores repository onboarding metadata additively', () => {
  const linkedBy = oid();
  const t = new Team({
    college_id: oid(), event_id: oid(), team_name: 'T', created_by: oid(),
    project: {
      github: {
        repo_full_name: 'alice/project',
        repo_url: 'https://github.com/alice/project',
        repo_linked_at: new Date('2026-11-01T00:00:00Z'),
        repo_linked_by: linkedBy,
      },
    },
  });
  assert.equal(t.validateSync(), undefined);
  assert.equal(t.project.github.repo_linked_at.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(t.project.github.repo_linked_by.toString(), linkedBy.toString());
  assert.equal(t.project.github.author_map.length, 0);
});

test('VivaSession supports commit-based questions and trust data', () => {
  const v = new VivaSession({ team_id: oid(), student_user_id: oid(), source: 'commit_ai', generation_method: 'ai', questions: [{ question: 'Q', commit_sha: 'abc', files: ['a.js'], difficulty: 'hard', context_excerpt: '+x' }], trust: { level: 'verify', gap: 40 } });
  assert.equal(v.validateSync(), undefined);
  assert.equal(new VivaSession({ team_id: oid(), student_user_id: oid() }).source, 'rule');
});

test('FinalGrade, panel and health log validate', () => {
  assert.equal(new FinalGrade({ college_id: oid(), event_id: oid(), team_id: oid(), student_id: oid(), manual: { report_score: 80 } }).validateSync(), undefined);
  assert.ok(new FinalGrade({ college_id: oid(), event_id: oid(), team_id: oid(), student_id: oid(), manual: { report_score: 180 } }).validateSync());
  assert.equal(new PresentationPanel({ college_id: oid(), event_id: oid(), name: 'P1', created_by: oid() }).validateSync(), undefined);
  assert.equal(new HealthCheckLog({ college_id: oid(), team_id: oid(), url: 'https://x.dev', status: 'up' }).validateSync(), undefined);
  assert.ok(new HealthCheckLog({ college_id: oid(), team_id: oid(), url: 'https://x.dev', status: 'weird' }).validateSync());
});

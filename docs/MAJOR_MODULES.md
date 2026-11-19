# ProjectHub major-project modules: integration guide

No new npm dependencies. Run `cd backend && npm test` (44 tests) after copying the files in.

## New environment variables (backend/.env)
| Variable | Purpose |
|---|---|
| `GITHUB_TOKEN` | Strongly recommended. Raises GitHub limit from 60 to 5000 requests/hour. Without it, only ~40 commit diffs are analyzed per report. |
| `GITHUB_MAX_DETAIL_COMMITS` | Max commit diffs fetched per report (default 40, or 150 with a token). |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | Optional. If neither is set, the viva uses template questions and heuristic scoring. |
| `HEALTH_MONITOR_ENABLED`, `HEALTH_CHECK_INTERVAL_MIN` | Background uptime checks (default on, every 15 min). |

## Schema changes to existing models (additive, backward compatible)
- `Team.project.github.author_map` (GitHub identity mapping) and `Team.project.health` (live-link status).
- `Event.evaluation_weights` (defaults 30/20/20/15/15).
- `VivaSession`: `source`, `generation_method`, `scoring_method`, `trust`, plus per-question commit fields.

## API summary
**Git contribution** `/api/contributions`: `POST /teams/:id/generate` (mentor/admin), `GET /teams/:id/latest`, `PUT /teams/:id/author-map`, `PUT /reports/:id/decision`, `GET /events/:id/summary`.
**Commit-grounded viva** `/api/viva`: `POST /commit/start`, `POST /commit/submit` (students). Faculty read results and the trust signal through the existing `GET /viva/team/:teamId`.
**Scheduler** `/api/schedule`: panels CRUD, `POST /events/:e/presentations/:p/auto` (`dry_run` supported), `GET .../slots`, `POST .../publish`, `PATCH /slots/:id`, reschedule request/decision, `GET /my`, `.ics` exports.
**Live panel + dashboard** `/api/panel`: `GET /slots/:id/scoresheet`, `POST /slots/:id/start|complete`, `PUT /slots/:id/score`, `GET /events/:e/presentations/:p/leaderboard`, `POST .../finalize`, `GET /events/:e/dashboard`.
**Unified evaluation** `/api/evaluation`: `GET /events/:e/grades`, `PUT /events/:e/weights`, `PUT /teams/:t/report-score`, `POST /events/:e/finalize`, `PUT /grades/:id/override`, `GET /events/:e/grades.csv`, `GET /my`.
**Health monitor** `/api/health-monitor`: `GET /events/:e`, `GET /teams/:t`, `POST /teams/:t/check`.

## Design decisions worth stating in your viva
- **Contribution is a suggestion.** Commits are weighted (lines after ignoring lockfiles/build output, capped per commit; commits; active days; PRs; message quality). Shares sum to 100%. The guide records the final score in `guide_decision`; the evaluation engine prefers it.
- **Trust signal** = |Git score - viva score| gap. It is an evidence-based flag for the guide, never proof of misconduct. Students never see it, the expected answers, or the code context.
- **Bias normalization** uses z-scores per examiner within a panel: `normalized = panelMean + (score - examinerMean) / examinerStd * panelStd`. Examiners with fewer than 3 scores or zero spread fall back to raw scores and are flagged. **Limitation:** differences *between* panels are not corrected, because panels may genuinely see different teams. Use overlapping/rotating examiners if you need cross-panel fairness.
- **Conflict of interest:** a mentor cannot score a team they mentor. The scheduler also keeps mentors off their own team's panel and avoids double-booking examiners.
- **Missing components** in the final grade are excluded and the remaining weights re-normalized, and the row is flagged `partial`.
- **SSRF protection** in the health monitor: http/https only, private/loopback/metadata IPs rejected at connect time (blocks DNS rebinding), redirects re-validated.
- Scheduler wall-clock times assume IST (UTC+05:30).

## Not included yet
Frontend pages. The API client methods are in `frontend/src/api/index.js`; the pages (scoresheet, dashboard, schedule board, contribution report, health cards) still need to be built.

## Onboarding: plug-and-play repository setup
Students link one public GitHub repository per team; the guide maps repo authors to registered team members, then analysis runs with that mapping.

**Normalization** (`utils/repoUrl.js`) accepts `https://github.com/o/r`, `github.com/o/r`, `git@github.com:o/r.git`, `https://github.com/o/r/tree/branch`, `o/r`, and rejects non-GitHub hosts. It stores `project.github.repo_url` (canonical), `github_link`, `repo_full_name`, plus `repo_linked_at` / `repo_linked_by`. Only **public** repositories are supported (private repos need server-side tokens, out of scope).

**Endpoints** (all under `/api/contributions`, all `protect` + role-guarded; 401 without a token):
| Method + path | Who | Notes |
|---|---|---|
| `POST /repo/preview` | student, faculty, admin | Validates + summarizes a repo before saving; returns contributor candidates and, when `team_id` is supplied by an authorized caller, one-to-one identity suggestions. Candidate emails are stripped without team access. Rate limited to 10 previews / user / 10 min (HTTP 429). Never stores anything. |
| `PUT /teams/:teamId/repo` | team member, mentor, admin | Saves the canonical repo fields; warns if a report already exists for the old repo. |
| `GET /teams/:teamId/onboarding` | team member, mentor, admin | Derived status + steps + repo/mapping/report summary. |
| `GET /events/:eventId/onboarding` | faculty, admin (event manager for reminders/analysis) | Funnel counts + one row per approved team. |
| `POST /events/:eventId/onboarding/remind` | event manager | Notifies accepted members of teams in `no_repo` / `mapping_needed`; 24 h per-team cooldown (`Notification` type `repo_reminder`). |
| `POST /events/:eventId/analyze-all` | event manager | Starts an in-memory job for up to 100 eligible teams; 409 if a job is already running. `only_stale` re-analyzes teams whose report is > 7 days old. |
| `GET /events/:eventId/analyze-all/:jobId` | event manager | Job status: `running`, `done`, `failed`, `paused_rate_limit`. |

**Derived status** (`utils/onboardingStatus.js`): `no_repo` → `mapping_needed` (repo linked) → `ready` (every accepted member has a `github_login`) → `analyzed` (a report exists) → `decided` (guide decision recorded). Reports older than 7 days are flagged `stale`.

**Limits and caveats:** analysis jobs are in memory (lost on backend restart), one job per event, capped at 100 teams, pause 1 s between teams, and stop with `paused_rate_limit` when GitHub refuses. Set `GITHUB_TOKEN` for event-scale runs. Event windows use `registration_start` → `event_end_date`; `POST /teams/:id/generate` accepts `event_only` for the same window.

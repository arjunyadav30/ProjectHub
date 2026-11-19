import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { teamAPI, facultyAPI, videoAPI, vivaAPI, eventAPI } from '../../api';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, Badge, Modal, Input } from '../../components/common';
import { ChevronLeft, Award, MessageSquare, CheckCircle, XCircle, Kanban, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils';
import RepositoryOnboardingCard from '../../components/contribution/RepositoryOnboardingCard';
import TeamHealthPanel from '../evaluation/TeamHealthPanel';

const presentationOutOf = (presentation, fallback) => (presentation?.labels || []).reduce((sum, label) => sum + Number(label.marks_out_of || 0), 0) || Number(fallback) || 100;

const buildMarkRows = (team, marks, presentations) => {
  const members = (team?.members || []).filter(mem => mem.status === 'accepted');
  const list = presentations.length ? presentations : [{ _id: null, title: 'Presentation', labels: [] }];
  const rows = [];
  members.forEach(mem => {
    const sid = String(mem.student_id?._id || mem.student_id || '');
    const memberMarks = marks.filter(mk => String(mk.student_id?._id || mk.student_id) === sid);
    const base = { student_id: sid, name: mem.student_id?.name, enrollment_no: mem.student_id?.enrollment_no };
    list.forEach(presentation => {
      const existing = memberMarks.find(mk => String(mk.presentation_id || '') === String(presentation._id || ''));
      rows.push({
        ...base,
        key: `${sid}:${presentation._id || 'none'}`,
        presentation_id: presentation._id || null,
        presentation_title: presentation.title || 'Presentation',
        presentation_marks: existing?.presentation_marks ?? 0,
        marks_out_of: existing?.marks_out_of ?? presentationOutOf(presentation, 100),
        attendance: existing?.attendance || 'not_marked',
        saved: !!existing,
        dirty: false,
      });
    });
    memberMarks.filter(mk => !list.some(p => String(p._id || '') === String(mk.presentation_id || ''))).forEach(mk => {
      rows.push({
        ...base,
        key: `${sid}:${mk.presentation_id || 'none'}`,
        presentation_id: mk.presentation_id || null,
        presentation_title: mk.presentation_title || mk.marks_label || 'Presentation',
        presentation_marks: mk.presentation_marks ?? 0,
        marks_out_of: mk.marks_out_of ?? 100,
        attendance: mk.attendance || 'not_marked',
        saved: true,
        dirty: false,
      });
    });
  });
  return rows;
};

const markPayload = (row) => ({
  student_id: row.student_id,
  presentation_id: row.presentation_id,
  presentation_title: row.presentation_title,
  presentation_marks: row.presentation_marks,
  marks_out_of: row.marks_out_of,
  attendance: row.attendance,
});

const FacultyTeamDetail = () => {
  const { id } = useParams();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [saving, setSaving] = useState(false);

  // Suggestion
  const [suggestionText, setSuggestionText] = useState('');

  // Marks
  const [marksData, setMarksData] = useState([]);
  const [presentations, setPresentations] = useState([]);
  const [savingKey, setSavingKey] = useState('');

  // Review
  const [reviewComment, setReviewComment] = useState('');
  const navigate = useNavigate();
  const [meetingAt, setMeetingAt] = useState('');
  const [meetingAttendance, setMeetingAttendance] = useState([]);
  const [vivaSessions, setVivaSessions] = useState([]);
  const [vivaCommentById, setVivaCommentById] = useState({});

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const [teamRes, marksRes] = await Promise.all([
        teamAPI.getById(id),
        facultyAPI.getTeamMarks(id),
      ]);
      const t = teamRes.data.data;
      setTeam(t);
      const m = marksRes.data.data || [];
      let eventPresentations = [];
      const eventId = t.event_id?._id || t.event_id;
      if (eventId) {
        try {
          const evRes = await eventAPI.getById(eventId);
          const eventDoc = evRes.data.data?.event || evRes.data.data;
          eventPresentations = eventDoc?.presentation_schedules || [];
        } catch { /* schedule is optional; fall back to a single presentation row */ }
      }
      setPresentations(eventPresentations);
      setMarksData(buildMarkRows(t, m, eventPresentations));
    } catch (e) { toast.error('Failed to load team'); }
    finally { setLoading(false); }
  }, [id]);

  useRefetchOnFocus(fetchTeam, { liveScopes: ['teams', 'team', `team:${id}`] });

  useEffect(() => {
    fetchTeam();
    videoAPI.getTeamAttendance(id)
      .then((res) => setMeetingAttendance(res.data?.data?.attendance || []))
      .catch(() => setMeetingAttendance([]));
    vivaAPI.getTeamSessions(id)
      .then((res) => setVivaSessions(res.data?.data?.sessions || []))
      .catch(() => setVivaSessions([]));
  }, [fetchTeam]);

  const handleAddSuggestion = async () => {
    if (!suggestionText.trim()) return;
    setSaving(true);
    try {
      await facultyAPI.addSuggestion(id, suggestionText);
      toast.success('Suggestion added');
      setSuggestionText('');
      fetchTeam();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  const handleSaveMarks = async () => {
    const changed = marksData.filter(row => row.dirty);
    if (!changed.length) return toast('No changes to save');
    setSaving(true);
    try {
      await facultyAPI.giveMarks(id, changed.map(markPayload));
      toast.success(`${changed.length} mark row(s) saved`);
      fetchTeam();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  const saveMarkRow = async (row) => {
    setSavingKey(row.key);
    try {
      await facultyAPI.giveMarks(id, [markPayload(row)]);
      toast.success(`Marks saved for ${row.name}`);
      fetchTeam();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSavingKey(''); }
  };

  const handleSubmissionReview = async (action) => {
    setSaving(true);
    try {
      await facultyAPI.reviewSubmission(id, { action, comment: reviewComment });
      toast.success(`Submission ${action}`);
      fetchTeam();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  const submitVivaReview = async (sessionId) => {
    setSaving(true);
    try {
      await vivaAPI.facultyReview(sessionId, vivaCommentById[sessionId] || '');
      toast.success('Viva review saved');
      const res = await vivaAPI.getTeamSessions(id);
      setVivaSessions(res.data?.data?.sessions || []);
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  const exportAttendanceCsv = () => {
    const rows = [
      ['Name', 'Email', 'Role', 'Joined At'],
      ...meetingAttendance.map((a) => [a.user_id?.name || '', a.user_id?.email || '', a.user_id?.role || '', a.joined_at || '']),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `team-${id}-attendance.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAttendancePdf = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Attendance - ${team.team_name}`, 14, 16);
    let y = 26;
    meetingAttendance.forEach((a, i) => {
      doc.setFontSize(10);
      doc.text(`${i + 1}. ${a.user_id?.name || 'User'} | ${a.user_id?.email || ''} | ${new Date(a.joined_at).toLocaleString()}`, 14, y);
      y += 7;
      if (y > 280) { doc.addPage(); y = 16; }
    });
    doc.save(`team-${id}-attendance.pdf`);
  };

  const downloadReminderIcs = () => {
    const date = meetingAt || new Date().toISOString().slice(0, 16);
    const start = new Date(date);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const ics = `BEGIN:VCALENDAR\\nVERSION:2.0\\nBEGIN:VEVENT\\nSUMMARY:ProjectHub Team Meeting\\nDTSTART:${fmt(start)}\\nDTEND:${fmt(end)}\\nDESCRIPTION:Team meeting reminder\\nEND:VEVENT\\nEND:VCALENDAR`;
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `team-${id}-meeting-reminder.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sendReminder = async () => {
    setSaving(true);
    try {
      const res = await videoAPI.sendReminder(id);
      toast.success(`Reminder sent to ${res.data?.data?.sent_to || 0} users`);
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  const joinTeamCall = async () => {
    try {
      const { data } = await teamAPI.joinVideoRoom(id);
      const roomUrl = data?.data?.room_url;
      if (!roomUrl) return toast.error('Meeting room unavailable');
      window.open(roomUrl, '_blank', 'noopener,noreferrer');
    } catch (e) { toast.error(getErrorMessage(e)); }
  };

  const scheduleMeeting = async () => {
    if (!meetingAt) return toast.error('Select date/time first');
    setSaving(true);
    try {
      await videoAPI.scheduleTeamMeeting(id, meetingAt);
      toast.success('Meeting scheduled');
      fetchTeam();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };


  if (loading) return (
    <DashboardLayout>
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
        <div className="card p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />)}</div>
      </div>
    </DashboardLayout>
  );

  if (!team) return <DashboardLayout><p className="text-red-500">Team not found</p></DashboardLayout>;

  const modules = team.project?.modules || [];
  const acceptedMembers = team.members?.filter(m => m.status === 'accepted') || [];
  const completed = modules.filter(m => m.status === 'completed').length;
  const inprogress = modules.filter(m => m.status === 'inprogress').length;
  const notStarted = modules.filter(m => m.status === 'not_started').length;
  const percent = modules.length > 0 ? Math.round((completed / modules.length) * 100) : 0;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'kanban', label: 'Kanban' },
    { id: 'marks', label: 'Marks & Attendance' },
    { id: 'suggestions', label: 'Suggestions' },
    { id: 'submission', label: 'Submission' },
    { id: 'viva', label: 'AI Viva Reviews' },
    { id: 'contribution', label: 'Git Contribution' },
    { id: 'health', label: 'Live Link' },
    { id: 'members', label: 'Members' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <Link to="/faculty/teams" className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-500 mb-3">
            <ChevronLeft className="w-4 h-4" /> Back to Teams
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{team.team_name}</h1>
              <p className="text-gray-500 text-sm">{team.event_id?.title}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => navigate(`/chat/group/${id}`)}>Team Chat</Button>
              <Button size="sm" onClick={joinTeamCall}>Join Video Call</Button>
              <Badge variant={
                team.project?.submission_status === 'submitted' ? 'pending' :
                team.project?.submission_status === 'accepted' ? 'approved' :
                team.project?.submission_status === 'rejected' ? 'rejected' : 'default'
              }>{team.project?.submission_status || 'In Progress'}</Badge>
            </div>
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <h2 className="font-semibold">Video Meeting Control</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <input type="datetime-local" className="input" value={meetingAt} onChange={(e) => setMeetingAt(e.target.value)} />
            <Button variant="secondary" onClick={scheduleMeeting} loading={saving}>Schedule</Button>
            <Button onClick={joinTeamCall}>Join Now</Button>
          </div>
          <p className="text-xs text-gray-500">Attendance logs: {meetingAttendance.length}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={exportAttendanceCsv}>Export CSV</Button>
            <Button size="sm" variant="secondary" onClick={exportAttendancePdf}>Export PDF</Button>
            <Button size="sm" variant="secondary" onClick={downloadReminderIcs}>Calendar Reminder</Button>
            <Button size="sm" onClick={sendReminder} loading={saving}>Send Reminder Notifications</Button>
          </div>
        </div>

        {/* Progress bar */}
        {modules.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm font-bold text-blue-600">{percent}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${percent}%` }} />
            </div>
            <div className="flex gap-4 text-xs text-gray-500 mt-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> {completed} Done</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> {inprogress} In Progress</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> {notStarted} Not Started</span>
            </div>
          </div>
        )}

        {activeTab === 'viva' && (
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold">AI Viva Faculty Review Panel</h2>
            {vivaSessions.length === 0 ? (
              <p className="text-sm text-gray-500">No viva sessions yet.</p>
            ) : vivaSessions.map((session) => (
              <div key={session._id} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                <p className="text-sm font-medium">{session.student_user_id?.name} ({session.student_user_id?.email})</p>
                {session.source === 'commit_ai' && <div className="space-y-3">
                  <div className="flex flex-wrap gap-2"><Badge variant="open">Commit-based</Badge><Badge>{session.generation_method || 'AI'}</Badge><Badge>{session.scoring_method || 'AI scoring'}</Badge></div>
                  {(session.questions || []).map((question, index) => <div key={`${question.index}-${index}`} className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 space-y-1">
                    <p className="text-sm font-medium">{question.question}</p><p className="text-xs text-gray-500">Commit {question.commit_sha} · {question.commit_message}</p>
                    <p className="text-sm"><span className="font-medium">Answer:</span> {question.answer || 'No answer provided'}</p><p className="text-sm">Score: {question.score}/10 · {question.feedback}</p>
                  </div>)}
                  {session.trust && <div className={`rounded-lg p-3 text-sm ${session.trust.level === 'consistent' ? 'bg-green-50 dark:bg-green-900/20' : session.trust.level === 'verify' ? 'bg-amber-50 dark:bg-amber-900/20' : session.trust.level === 'check_mapping' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <p className="font-semibold">Trust check · {session.trust.level}</p><p>Git score {session.trust.git_score_100 ?? '—'} · Viva score {session.trust.viva_score_100 ?? session.total_score ?? '—'} · Gap {session.trust.gap ?? '—'}</p><p>{session.trust.message}</p><p className="mt-2 text-xs">An evidence-based flag for review, not proof of misconduct.</p>
                  </div>}
                </div>}
                <p className="text-xs text-gray-500">Score: {session.total_score}/{session.max_score}</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">{session.overall_feedback}</p>
                <textarea
                  className="input min-h-[70px]"
                  placeholder="Faculty review comment..."
                  value={vivaCommentById[session._id] ?? session.faculty_review?.comment ?? ''}
                  onChange={(e) => setVivaCommentById((prev) => ({ ...prev, [session._id]: e.target.value }))}
                />
                <Button size="sm" onClick={() => submitVivaReview(session._id)} loading={saving}>Save Viva Review</Button>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'contribution' && <RepositoryOnboardingCard teamId={id} canAnalyze withPanel />}
        {activeTab === 'health' && <TeamHealthPanel teamId={id} />}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}>{t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="card p-5 space-y-3">
              <h2 className="font-semibold">Project Details</h2>
              {team.project?.description && <p className="text-gray-600 dark:text-gray-400">{team.project.description}</p>}
              {team.project?.technologies_used?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {team.project.technologies_used.map(t => (
                    <span key={t} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">{t}</span>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {team.project?.github_link && (
                  <a href={team.project.github_link} target="_blank" rel="noopener noreferrer"
                    className="text-blue-500 hover:underline truncate">GitHub: {team.project.github_link}</a>
                )}
                {team.project?.live_link && (
                  <a href={team.project.live_link} target="_blank" rel="noopener noreferrer"
                    className="text-blue-500 hover:underline truncate">Live: {team.project.live_link}</a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Kanban Tab (read-only for faculty) */}
        {activeTab === 'kanban' && (
          <div>
            {modules.length === 0 ? (
              <div className="card p-12 text-center text-gray-400">
                <Kanban className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No modules added yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { key: 'not_started', label: 'Not Started', color: 'border-gray-300 dark:border-gray-600' },
                  { key: 'inprogress', label: 'In Progress', color: 'border-amber-400' },
                  { key: 'completed', label: 'Completed', color: 'border-green-400' },
                ].map(col => (
                  <div key={col.key} className={`bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border-t-4 ${col.color}`}>
                    <h3 className="font-semibold text-sm mb-3 text-gray-700 dark:text-gray-300">{col.label}
                      <span className="ml-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs px-1.5 py-0.5 rounded-full">
                        {modules.filter(m => m.status === col.key).length}
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {modules.filter(m => m.status === col.key).map(mod => (
                        <div key={mod._id} className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm">
                          <p className="font-medium text-sm">{mod.module_name}</p>
                          {mod.description && <p className="text-xs text-gray-500 mt-1">{mod.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Marks Tab */}
        {activeTab === 'marks' && (
          <div className="card p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold flex items-center gap-2"><Award className="w-5 h-5 text-amber-500" /> Marks & Attendance</h2>
                <p className="text-xs text-gray-500 mt-1">All marks for this team across {presentations.length ? `${presentations.length} presentation(s)` : 'all entries'}. Students see saved marks on their My Evaluation page.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{marksData.filter(row => row.dirty).length} unsaved</span>
                <Button onClick={handleSaveMarks} loading={saving} disabled={!marksData.some(row => row.dirty)}>Save all changed</Button>
              </div>
            </div>
            {marksData.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-left">
                    <tr>{['Student', 'Presentation', 'Attendance', 'Marks', 'Out of', ''].map(h => <th key={h} className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {marksData.map(row => {
                      const patch = (update) => setMarksData(rows => rows.map(x => x.key === row.key ? { ...x, ...update, dirty: true } : x));
                      return (
                        <tr key={row.key}>
                          <td className="px-3 py-2">
                            <p className="font-medium">{row.name}</p>
                            <p className="text-xs text-gray-500">{row.enrollment_no}</p>
                          </td>
                          <td className="px-3 py-2">
                            {row.presentation_title}
                            {row.saved && !row.dirty && <span className="block text-[11px] text-emerald-600 dark:text-emerald-400">saved</span>}
                          </td>
                          <td className="px-3 py-2">
                            <select value={row.attendance} onChange={e => patch({ attendance: e.target.value, ...(e.target.value === 'absent' ? { presentation_marks: 0 } : {}) })} className="input text-sm py-1 px-2 w-32">
                              <option value="not_marked">Not Marked</option>
                              <option value="present">Present</option>
                              <option value="absent">Absent</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min={0} max={row.marks_out_of} value={row.presentation_marks ?? 0} disabled={row.attendance === 'absent'}
                              onChange={e => patch({ presentation_marks: Math.max(0, parseInt(e.target.value, 10) || 0) })} className="input w-20 text-center" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min={1} max={1000} value={row.marks_out_of ?? 100}
                              onChange={e => patch({ marks_out_of: Math.max(1, parseInt(e.target.value, 10) || 1) })} className="input w-20 text-center" />
                          </td>
                          <td className="px-3 py-2">
                            <Button size="sm" variant="secondary" loading={savingKey === row.key} onClick={() => saveMarkRow(row)}>Save</Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-gray-500">No accepted members in this team.</p>}
          </div>
        )}

        {/* Suggestions Tab */}
        {activeTab === 'suggestions' && (
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><MessageSquare className="w-5 h-5 text-green-500" /> Faculty Suggestions</h2>
            <div>
              <label className="block text-sm font-medium mb-2">Add New Suggestion</label>
              <textarea
                className="input w-full h-28 resize-none"
                placeholder="Write a suggestion for the team..."
                value={suggestionText}
                onChange={e => setSuggestionText(e.target.value)}
              />
              <Button className="mt-2" onClick={handleAddSuggestion} loading={saving}>Add Suggestion</Button>
            </div>
            <div className="space-y-3">
              {(team.project?.suggestions || []).map((s, i) => (
                <div key={i} className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl">
                  <p className="text-sm text-gray-800 dark:text-gray-200">{s.text}</p>
                  <p className="text-xs text-gray-500 mt-2">By {s.by_name} · {new Date(s.created_at).toLocaleString()}</p>
                </div>
              ))}
              {!team.project?.suggestions?.length && <p className="text-gray-400 text-sm">No suggestions yet.</p>}
            </div>
          </div>
        )}

        {/* Submission Tab */}
        {activeTab === 'submission' && (
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold">Final Submission Review</h2>
            {team.project?.submission_status === 'not_submitted' ? (
              <p className="text-gray-500">Team has not submitted yet.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3">
                  {team.project?.github_link && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium w-24">GitHub:</span>
                      <a href={team.project.github_link} target="_blank" className="text-blue-500 hover:underline text-sm">{team.project.github_link}</a>
                    </div>
                  )}
                  {team.project?.live_link && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium w-24">Live Link:</span>
                      <a href={team.project.live_link} target="_blank" className="text-blue-500 hover:underline text-sm">{team.project.live_link}</a>
                    </div>
                  )}
                  {team.project?.video_link && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium w-24">Video:</span>
                      <a href={team.project.video_link} target="_blank" className="text-blue-500 hover:underline text-sm">{team.project.video_link}</a>
                    </div>
                  )}
                  {team.project?.documentation_file && (
                    <div>
                      <p className="text-sm font-medium mb-2">Documentation (view only):</p>
                      <iframe
                        src={`${team.project.documentation_file}#toolbar=0`}
                        className="w-full h-64 rounded-xl border border-gray-200 dark:border-gray-700"
                        title="Documentation"
                      />
                    </div>
                  )}
                </div>

                {team.project?.submission_status !== 'not_submitted' && (
                  <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <label className="block text-sm font-medium">Comment (optional for rejection)</label>
                    <textarea
                      className="input w-full h-20 resize-none"
                      placeholder="Add a comment..."
                      value={reviewComment}
                      onChange={e => setReviewComment(e.target.value)}
                    />
                    <div className="flex gap-3">
                      <Button onClick={() => handleSubmissionReview('accepted')} loading={saving} disabled={team.project?.submission_status === 'accepted'}>
                        <CheckCircle className="w-4 h-4" /> Accept Submission
                      </Button>
                      <Button variant="danger" onClick={() => handleSubmissionReview('rejected')} loading={saving} disabled={team.project?.submission_status === 'rejected'}>
                        <XCircle className="w-4 h-4" /> Reject
                      </Button>
                    </div>
                  </div>
                )}

                {team.project?.submission_status !== 'not_submitted' && (
                  <div className={`p-3 rounded-xl text-sm font-medium ${
                    team.project?.submission_status === 'accepted'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  }`}>
                    Submission {team.project?.submission_status}
                    {team.project?.submission_comment && `: "${team.project.submission_comment}"`}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="card p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-blue-500" /> Team Members</h2>
            <div className="space-y-3">
              {acceptedMembers.map(m => (
                <div key={m._id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center font-bold text-blue-700 dark:text-blue-300 overflow-hidden">
                    {m.student_id?.profile_image ? (
                      <img src={m.student_id.profile_image} className="w-full h-full object-cover" alt="" />
                    ) : m.student_id?.name?.[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{m.student_id?.name}</p>
                    <p className="text-xs text-gray-500">{m.student_id?.enrollment_no} · {m.student_id?.branch} Sem {m.student_id?.semester}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    {m.student_id?._id === team.team_leader?._id && (
                      <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">Leader</span>
                    )}
                    <Badge variant={m.status === 'accepted' ? 'approved' : m.status === 'rejected' ? 'rejected' : 'pending'}>
                      {m.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default FacultyTeamDetail;

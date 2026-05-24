import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { teamAPI, facultyAPI, videoAPI, vivaAPI } from '../../api';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, Badge, Modal, Input } from '../../components/common';
import { ChevronLeft, Award, MessageSquare, CheckCircle, XCircle, Kanban, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils';

const FacultyTeamDetail = () => {
  const { id } = useParams();
  const [team, setTeam] = useState(null);
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [saving, setSaving] = useState(false);

  // Suggestion
  const [suggestionText, setSuggestionText] = useState('');

  // Marks
  const [marksData, setMarksData] = useState([]);

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
      setMarks(m);

      const members = t.members?.filter(mem => mem.status === 'accepted') || [];
      setMarksData(members.map(mem => {
        const existing = m.find(mk => mk.student_id?._id === mem.student_id?._id);
        return {
          student_id: mem.student_id?._id,
          name: mem.student_id?.name,
          enrollment_no: mem.student_id?.enrollment_no,
          presentation_marks: existing?.presentation_marks || 0,
          attendance: existing?.attendance || 'not_marked',
          marks_out_of: existing?.marks_out_of || 100,
          marks_label: existing?.marks_label || 'Presentation',
        };
      }));
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
    setSaving(true);
    try {
      await facultyAPI.giveMarks(id, marksData);
      toast.success('Marks saved');
      fetchTeam();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
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
            <h2 className="font-semibold flex items-center gap-2"><Award className="w-5 h-5 text-amber-500" /> Marks & Attendance</h2>
            <div className="space-y-3">
              {marksData.map((m, i) => (
                <div key={m.student_id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs text-gray-500">{m.enrollment_no}</p>
                    </div>
                    <select
                      value={m.attendance}
                      onChange={e => setMarksData(d => d.map((x, j) => j === i ? {...x, attendance: e.target.value} : x))}
                      className="input text-sm py-1 px-2 w-32">
                      <option value="not_marked">Not Marked</option>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-600 dark:text-gray-400">{m.marks_label}:</label>
                    <input
                      type="number" min={0} max={m.marks_out_of}
                      value={m.presentation_marks ?? 0}
                      disabled={m.attendance === 'absent'}
                      onChange={e => setMarksData(d => d.map((x, j) => j === i ? {...x, presentation_marks: parseInt(e.target.value) || 0} : x))}
                      className="input w-20 text-center"
                    />
                    <span className="text-sm text-gray-500">/ {m.marks_out_of}</span>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={handleSaveMarks} loading={saving}>Save Marks</Button>
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

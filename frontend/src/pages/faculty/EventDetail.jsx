import { useCallback, useEffect, useState } from 'react';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import { useParams, Link } from 'react-router-dom';
import { eventAPI, adminAPI } from '../../api';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, Badge, Modal } from '../../components/common';
import { ChevronLeft, Users, Award, Download, CheckCircle, Clock, XCircle, Eye } from 'lucide-react';
import { formatDate, getErrorMessage } from '../../utils';
import { facultyAPI } from '../../api';
import toast from 'react-hot-toast';

const FacultyEventDetail = () => {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [teams, setTeams] = useState([]);
  const [unregistered, setUnregistered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('teams');

  // Marks modal
  const [showMarksModal, setShowMarksModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [marksData, setMarksData] = useState([]);
  const [saving, setSaving] = useState(false);
  const presentations = event?.presentation_schedules || [];

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, teamsRes] = await Promise.all([
        eventAPI.getById(id),
        eventAPI.getTeams(id),
      ]);
      setEvent(evRes.data.data?.event || evRes.data.data);
      setTeams(teamsRes.data.data?.teams || teamsRes.data.data || []);

      adminAPI.getUnregisteredStudents(id)
        .then(res => setUnregistered(res.data.data || []))
        .catch(() => setUnregistered([]));
    } catch (e) {
      toast.error('Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useRefetchOnFocus(fetchAll, { liveScopes: ['events', `event:${id}`, 'teams'] });

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openMarks = async (team, presentation = null) => {
    setSelectedTeam(team);
    const members = team.members?.filter(m => m.status === 'accepted') || [];
    try {
      const res = await facultyAPI.getTeamMarks(team._id);
      const existingMarks = res.data.data || [];
      setMarksData(members.map(m => {
        const existing = existingMarks.find(mk =>
          (mk.student_id?._id === m.student_id?._id || mk.student_id === m.student_id?._id) &&
          String(mk.presentation_id || '') === String(presentation?._id || '')
        );
        const labelMarks = presentation?.labels?.length
          ? presentation.labels.map(label => {
            const saved = existing?.label_marks?.find(item => String(item.label_id || '') === String(label._id || ''));
            return {
              label_id: label._id,
              label: label.label,
              marks: saved?.marks ?? 0,
              marks_out_of: label.marks_out_of,
            };
          })
          : [{
            label_id: null,
            label: event?.presentation_schedule?.marks_label || 'Presentation',
            marks: existing?.presentation_marks ?? 0,
            marks_out_of: event?.presentation_schedule?.marks_out_of || 100,
          }];
        return {
          student_id: m.student_id?._id,
          name: m.student_id?.name,
          enrollment_no: m.student_id?.enrollment_no,
          presentation_id: presentation?._id || null,
          presentation_title: presentation?.title || event?.presentation_schedule?.marks_label || 'Presentation',
          label_marks: labelMarks,
          presentation_marks: existing?.presentation_marks ?? 0,
          attendance: existing?.attendance || 'not_marked',
          marks_out_of: labelMarks.reduce((sum, label) => sum + Number(label.marks_out_of || 0), 0),
          marks_label: presentation?.title || event?.presentation_schedule?.marks_label || 'Presentation',
        };
      }));
    } catch {
      setMarksData(members.map(m => ({
        student_id: m.student_id?._id,
        name: m.student_id?.name,
        enrollment_no: m.student_id?.enrollment_no,
        presentation_id: presentation?._id || null,
        presentation_title: presentation?.title || event?.presentation_schedule?.marks_label || 'Presentation',
        label_marks: presentation?.labels?.length
          ? presentation.labels.map(label => ({
            label_id: label._id,
            label: label.label,
            marks: 0,
            marks_out_of: label.marks_out_of,
          }))
          : [{ label_id: null, label: event?.presentation_schedule?.marks_label || 'Presentation', marks: 0, marks_out_of: event?.presentation_schedule?.marks_out_of || 100 }],
        presentation_marks: 0,
        attendance: 'not_marked',
        marks_out_of: presentation?.labels?.reduce((sum, label) => sum + Number(label.marks_out_of || 0), 0) || event?.presentation_schedule?.marks_out_of || 100,
        marks_label: presentation?.title || event?.presentation_schedule?.marks_label || 'Presentation',
      })));
    }
    setShowMarksModal(true);
  };

  const handleSaveMarks = async () => {
    setSaving(true);
    try {
      await facultyAPI.giveMarks(selectedTeam._id, marksData);
      toast.success('Marks saved successfully');
      setShowMarksModal(false);
      await fetchAll();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const exportUnregistered = async () => {
    try {
      const res = await adminAPI.exportUnregisteredStudents(id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `unregistered-${event?.title}.csv`;
      a.click();
    } catch {
      toast.error('Export failed');
    }
  };

  if (loading) return (
    <DashboardLayout>
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
        <div className="card p-6 space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />)}
        </div>
      </div>
    </DashboardLayout>
  );

  if (!event) return <DashboardLayout><p className="text-red-500">Event not found.</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <Link to="/faculty/events" className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-500 mb-3">
            <ChevronLeft className="w-4 h-4" /> Back to Events
          </Link>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{event.title}</h1>
              <p className="text-gray-500 text-sm mt-1 max-w-2xl">{event.description}</p>
            </div>
          </div>

          {/* Meta info */}
          <div className="grid sm:grid-cols-4 gap-3 mt-4">
            {[
              { label: 'Team Size', value: `${event.min_team_size}–${event.max_team_size}` },
              { label: 'Reg Ends', value: formatDate(event.registration_end) },
              { label: 'Event Ends', value: formatDate(event.event_end_date) },
              { label: 'Presentations', value: presentations.length ? `${presentations.length} scheduled` : 'Not set' },
            ].map(item => (
              <div key={item.label} className="card p-3">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="font-semibold text-sm text-gray-900 dark:text-white mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Allowed semesters */}
          {event.allowed_semesters?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {event.allowed_semesters.map(s => (
                <span key={s} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                  Sem {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'teams', label: `Registered Teams (${teams.length})` },
            { id: 'unregistered', label: `Unregistered Students (${unregistered.length})` },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div className="space-y-3">
            {teams.length === 0 ? (
              <div className="card p-12 text-center text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No teams registered yet.</p>
              </div>
            ) : (
              teams.map(team => {
                const modules = team.project?.modules || [];
                const completed = modules.filter(m => m.status === 'completed').length;
                const percent = modules.length > 0 ? Math.round((completed / modules.length) * 100) : 0;
                const acceptedMembers = team.members?.filter(m => m.status === 'accepted') || [];

                return (
                  <div key={team._id} className="card p-5">
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{team.team_name}</h3>
                          <Badge variant={
                            team.registration_status === 'approved' ? 'approved' :
                            team.registration_status === 'rejected' ? 'rejected' : 'pending'
                          }>
                            {team.registration_status}
                          </Badge>
                          {team.project?.submission_status === 'submitted' && (
                            <Badge variant="pending">Needs Review</Badge>
                          )}
                        </div>

                        <p className="text-sm text-gray-500 mb-2 line-clamp-1">
                          {team.project?.description || 'No description'}
                        </p>

                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" /> {acceptedMembers.length} members
                          </span>
                          {team.team_leader && (
                            <span>Leader: {team.team_leader.name} ({team.team_leader.enrollment_no})</span>
                          )}
                          {team.assigned_faculty && (
                            <span className="text-purple-600">Mentor: {team.assigned_faculty.name}</span>
                          )}
                        </div>

                        {/* Tech stack */}
                        {team.project?.technologies_used?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {team.project.technologies_used.slice(0, 5).map(t => (
                              <span key={t} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Progress */}
                        {modules.length > 0 && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percent}%` }} />
                            </div>
                            <span className="text-xs text-gray-500">{percent}%</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2">
                        <Link to={`/teams/${team._id}`}>
                          <Button size="sm" variant="secondary">
                            <Eye className="w-3.5 h-3.5" /> View
                          </Button>
                        </Link>
                        {presentations.length > 0 ? presentations.map(presentation => (
                          <Button key={presentation._id} size="sm" variant="secondary" onClick={() => openMarks(team, presentation)}>
                            <Award className="w-3.5 h-3.5" /> {presentation.title}
                          </Button>
                        )) : (
                          <Button size="sm" variant="secondary" onClick={() => openMarks(team)}>
                            <Award className="w-3.5 h-3.5" /> Marks
                          </Button>
                        )}
                        {team.assigned_faculty?._id && (
                          <Link to={`/faculty/teams/${team._id}`}>
                            <Button size="sm" variant="secondary">
                              Manage
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Unregistered Students Tab */}
        {activeTab === 'unregistered' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={exportUnregistered}>
                <Download className="w-4 h-4" /> Export CSV
              </Button>
            </div>

            {unregistered.length === 0 ? (
              <div className="card p-12 text-center text-gray-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>All eligible students are registered, or data unavailable.</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-left">
                      <tr>
                        {['Enrollment No', 'Name', 'Email', 'Branch', 'Semester', 'Phone'].map(h => (
                          <th key={h} className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {unregistered.map(s => (
                        <tr key={s._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400 font-medium">{s.enrollment_no}</td>
                          <td className="px-4 py-3 font-medium">{s.name}</td>
                          <td className="px-4 py-3 text-gray-500">{s.email}</td>
                          <td className="px-4 py-3">{s.branch || '—'}</td>
                          <td className="px-4 py-3">{s.semester ? `Sem ${s.semester}` : '—'}</td>
                          <td className="px-4 py-3">{s.phone || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Marks Modal */}
      <Modal
        open={showMarksModal}
        onClose={() => setShowMarksModal(false)}
        title={`Marks — ${selectedTeam?.team_name}`}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Presentation: <strong>{marksData[0]?.presentation_title || 'Presentation'}</strong>
          </p>

          <div className="space-y-3 max-h-72 overflow-y-auto">
            {marksData.map((m, i) => (
              <div key={m.student_id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm">{m.name}</p>
                    <p className="text-xs text-gray-500">{m.enrollment_no}</p>
                  </div>
                  <select
                    value={m.attendance}
                    onChange={e => setMarksData(d =>
                      d.map((x, j) => j === i ? { ...x, attendance: e.target.value } : x)
                    )}
                    className="input text-xs py-1 px-2 w-32">
                    <option value="not_marked">Not Marked</option>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
                <div className="space-y-2">
                  {m.label_marks?.map((label, labelIndex) => (
                    <div key={label.label_id || label.label} className="flex items-center gap-3">
                      <label className="text-xs text-gray-500 w-24 truncate">{label.label}:</label>
                      <input
                        type="number" min={0} max={label.marks_out_of}
                        value={m.attendance === 'absent' ? 0 : label.marks ?? 0}
                        disabled={m.attendance === 'absent'}
                        onChange={e => setMarksData(d =>
                          d.map((x, j) => j === i ? {
                            ...x,
                            label_marks: x.label_marks.map((item, idx) => idx === labelIndex ? { ...item, marks: parseInt(e.target.value) || 0 } : item),
                          } : x)
                        )}
                        className="input w-20 text-center"
                      />
                      <span className="text-xs text-gray-500">/ {label.marks_out_of}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {marksData.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-4">No accepted members in this team.</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowMarksModal(false)}>Cancel</Button>
            <Button onClick={handleSaveMarks} loading={saving} disabled={marksData.length === 0}>
              Save Marks
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default FacultyEventDetail;

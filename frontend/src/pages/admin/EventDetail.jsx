import { useCallback, useEffect, useState } from 'react';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import { useParams, Link } from 'react-router-dom';
import { eventAPI, adminAPI, teamAPI } from '../../api';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, Badge, Modal, Input } from '../../components/common';
import {
  Users, Download, Star, Plus, UserCheck, Award, Kanban, Eye, ChevronLeft,
  CheckCircle, XCircle, Clock, Calendar, Pencil, Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage, formatDate } from '../../utils';

const AdminEventDetail = () => {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [teams, setTeams] = useState([]);
  const [unregistered, setUnregistered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('teams');

  // Modals
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [showAssignFacultyModal, setShowAssignFacultyModal] = useState(false);
  const [showMarksModal, setShowMarksModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [allFaculty, setAllFaculty] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showPresentationModal, setShowPresentationModal] = useState(false);
  const [editPresentation, setEditPresentation] = useState(null);
  const [presentationForm, setPresentationForm] = useState({
    title: '',
    due_date: '',
    labels: [{ label: '', marks_out_of: 100 }],
  });

  // Add team form
  const [teamForm, setTeamForm] = useState({ team_name: '', description: '', technologies: [] });
  const [techInput, setTechInput] = useState('');

  // Marks
  const [marksData, setMarksData] = useState([]);
  const presentations = event?.presentation_schedules || [];

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, teamsRes, unregRes] = await Promise.all([
        eventAPI.getById(id),
        eventAPI.getTeams(id),
        adminAPI.getUnregisteredStudents(id),
      ]);
      setEvent(evRes.data.data?.event || evRes.data.data);
      setTeams(teamsRes.data.data?.teams || teamsRes.data.data || []);
      setUnregistered(unregRes.data.data || []);
    } catch (e) {
      toast.error('Failed to load event details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useRefetchOnFocus(fetchAll, { liveScopes: ['events', `event:${id}`, 'teams'] });

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleApproveTeam = async (teamId, action) => {
    try {
      await teamAPI.updateStatus(teamId, { status: action });
      toast.success(`Team ${action}`);
      fetchAll();
    } catch (e) { toast.error(getErrorMessage(e)); }
  };

  const handleAssignFaculty = async (facultyId) => {
    if (!selectedTeam) return;
    setSaving(true);
    try {
      await teamAPI.assignFaculty(selectedTeam._id, facultyId);
      toast.success('Faculty assigned. Awaiting faculty acceptance.');
      setShowAssignFacultyModal(false);
      fetchAll();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  const openPresentationModal = (presentation = null) => {
    setEditPresentation(presentation);
    setPresentationForm(presentation ? {
      title: presentation.title || '',
      due_date: presentation.due_date?.slice(0, 10) || '',
      labels: presentation.labels?.length
        ? presentation.labels.map(label => ({ ...label }))
        : [{ label: '', marks_out_of: 100 }],
    } : {
      title: '',
      due_date: '',
      labels: [{ label: '', marks_out_of: 100 }],
    });
    setShowPresentationModal(true);
  };

  const handleSavePresentation = async () => {
    const clean = {
      ...presentationForm,
      labels: presentationForm.labels
        .map(label => ({ ...label, label: label.label.trim(), marks_out_of: Number(label.marks_out_of) || 0 }))
        .filter(label => label.label && label.marks_out_of > 0),
    };
    if (!clean.title.trim() || !clean.due_date || clean.labels.length === 0) {
      return toast.error('Title, due date, and at least one label are required');
    }
    setSaving(true);
    try {
      const next = editPresentation
        ? presentations.map(item => item._id === editPresentation._id ? { ...clean, _id: editPresentation._id } : item)
        : [...presentations, clean];
      await eventAPI.updatePresentationSchedule(id, { presentation_schedules: next });
      toast.success(editPresentation ? 'Presentation updated' : 'Presentation scheduled');
      setShowPresentationModal(false);
      fetchAll();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  const handleDeletePresentation = async (presentationId) => {
    if (!confirm('Delete this presentation schedule?')) return;
    setSaving(true);
    try {
      await eventAPI.updatePresentationSchedule(id, {
        presentation_schedules: presentations.filter(item => item._id !== presentationId),
      });
      toast.success('Presentation deleted');
      fetchAll();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  const openMarks = async (team, presentation = null) => {
    setSelectedTeam(team);
    const members = team.members?.filter(m => m.status === 'accepted') || [];
    // Pre-populate marks data
    const existingMarks = await adminAPI.getTeamMarks(team._id).then(r => r.data.data).catch(() => []);
    setMarksData(members.map(m => {
      const existing = existingMarks.find(mk =>
        mk.student_id?._id === m.student_id?._id &&
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
          marks: existing?.presentation_marks || 0,
          marks_out_of: event?.presentation_schedule?.marks_out_of || 100,
        }];
      return {
        student_id: m.student_id?._id,
        name: m.student_id?.name,
        enrollment_no: m.student_id?.enrollment_no,
        presentation_id: presentation?._id || null,
        presentation_title: presentation?.title || event?.presentation_schedule?.marks_label || 'Presentation',
        label_marks: labelMarks,
        presentation_marks: existing?.presentation_marks || 0,
        attendance: existing?.attendance || 'not_marked',
        marks_out_of: labelMarks.reduce((sum, label) => sum + Number(label.marks_out_of || 0), 0),
        marks_label: presentation?.title || event?.presentation_schedule?.marks_label || 'Presentation',
      };
    }));
    setShowMarksModal(true);
  };

  const handleSaveMarks = async () => {
    setSaving(true);
    try {
      await adminAPI.giveMarks({ team_id: selectedTeam._id, event_id: id, marks_data: marksData });
      toast.success('Marks saved');
      setShowMarksModal(false);
      await fetchAll();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  const handleFeature = async (team) => {
    if (!team.project?.live_link && !window.confirm('This project has no deployed link. Feature anyway?')) return;
    try {
      await adminAPI.featureProject({ team_id: team._id, deployed_link: team.project?.live_link || '' });
      toast.success('Project featured on homepage!');
      await fetchAll();
    } catch (e) { toast.error(getErrorMessage(e)); }
  };

  const exportUnregistered = async () => {
    try {
      const res = await adminAPI.exportUnregisteredStudents(id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = `unregistered-${event?.title}.csv`; a.click();
    } catch (e) { toast.error('Export failed'); }
  };

  const getStatusIcon = (status) => {
    if (status === 'approved') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === 'rejected') return <XCircle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-amber-500" />;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
          <div className="card p-6 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!event) return <DashboardLayout><p className="text-red-500">Event not found</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <Link to="/admin/events" className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-500 mb-3">
            <ChevronLeft className="w-4 h-4" /> Back to Events
          </Link>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{event.title}</h1>
              <p className="text-gray-500 text-sm mt-1">{event.description}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="text-sm text-gray-500 space-y-1">
                <p>Reg ends: <span className="font-medium">{formatDate(event.registration_end)}</span></p>
                <p>Event ends: <span className="font-medium">{formatDate(event.event_end_date)}</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
          {['teams', 'presentations', 'unregistered', 'featured'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}>
              {tab === 'teams' ? `Registered Teams (${teams.length})` :
               tab === 'presentations' ? `Presentations (${presentations.length})` :
               tab === 'unregistered' ? `Unregistered Students (${unregistered.length})` :
               'Featured Projects'}
            </button>
          ))}
        </div>

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowAddTeamModal(true)}>
                <Plus className="w-4 h-4" /> Add Team Manually
              </Button>
            </div>
            {teams.length === 0 ? (
              <div className="card p-12 text-center text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No teams registered yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teams.map(team => (
                  <div key={team._id} className="card p-5">
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(team.registration_status)}
                          <h3 className="font-semibold text-gray-900 dark:text-white">{team.team_name}</h3>
                          <Badge variant={
                            team.registration_status === 'approved' ? 'approved' :
                            team.registration_status === 'rejected' ? 'rejected' : 'pending'
                          }>{team.registration_status}</Badge>
                          {team.admin_registered && <Badge variant="default">Admin Added</Badge>}
                          {team.project?.submission_status && team.project.submission_status !== 'not_submitted' && (
                            <Badge variant={
                              team.project.submission_status === 'submitted' ? 'pending' :
                              team.project.submission_status === 'accepted' ? 'approved' :
                              team.project.submission_status === 'rejected' ? 'rejected' : 'default'
                            }>{team.project.submission_status}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mb-2">{team.project?.description}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {team.members?.filter(m => m.status === 'accepted').length} members
                          </span>
                          {team.assigned_faculty && (
                            <span className="flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5" />
                              Mentor assigned
                            </span>
                          )}
                        </div>
                        {team.project?.technologies_used?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {team.project.technologies_used.map(t => (
                              <span key={t} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2">
                        <Link to={`/teams/${team._id}`}>
                          <Button size="sm" variant="secondary"><Eye className="w-3.5 h-3.5" /> View</Button>
                        </Link>
                        <Button size="sm" variant="secondary" onClick={() => {
                          setSelectedTeam(team);
                          setAllFaculty([]);
                          setShowAssignFacultyModal(true);
                          // Fetch faculty list
                          adminAPI.getFaculty({ status: 'active', limit: 100 }).then(r => setAllFaculty(r.data.data.faculty || []));
                        }}>
                          <UserCheck className="w-3.5 h-3.5" /> Mentor
                        </Button>
                        {presentations.length > 0 ? presentations.map(presentation => (
                          <Button key={presentation._id} size="sm" variant="secondary" onClick={() => openMarks(team, presentation)}>
                            <Award className="w-3.5 h-3.5" /> {presentation.title}
                          </Button>
                        )) : (
                          <Button size="sm" variant="secondary" onClick={() => openMarks(team)}>
                            <Award className="w-3.5 h-3.5" /> Marks
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => handleFeature(team)}>
                          <Star className="w-3.5 h-3.5" /> Feature
                        </Button>
                        {team.registration_status === 'pending' && (
                          <>
                            <Button size="sm" onClick={() => handleApproveTeam(team._id, 'approved')}>
                              <CheckCircle className="w-3.5 h-3.5" /> Approve
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => handleApproveTeam(team._id, 'rejected')}>
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </Button>
                          </>
                        )}
                        {team.project?.submission_status === 'submitted' && (
                          <Link to={`/review-submission/${team._id}`}>
                            <Button size="sm" variant="warning">
                              <Eye className="w-3.5 h-3.5" /> Review Submission
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Presentations Tab */}
        {activeTab === 'presentations' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => openPresentationModal()}>
                <Plus className="w-4 h-4" /> Add Presentation
              </Button>
            </div>
            {presentations.length === 0 ? (
              <div className="card p-12 text-center text-gray-400">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No presentation scheduled yet.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {presentations.map(presentation => (
                  <div key={presentation._id} className="card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{presentation.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">Due before {formatDate(presentation.due_date)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openPresentationModal(presentation)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDeletePresentation(presentation._id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {presentation.labels?.map(label => (
                        <span key={label._id || label.label} className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                          {label.label}: {label.marks_out_of}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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
                <p>All eligible students are registered!</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-left">
                      <tr>
                        {['Enrollment No', 'Name', 'Email', 'Branch', 'Semester', 'Phone'].map(h => (
                          <th key={h} className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {unregistered.map(s => (
                        <tr key={s._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">{s.enrollment_no}</td>
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

        {/* Featured Tab */}
        {activeTab === 'featured' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Click "Feature" on any team card to add it to the homepage showcase.</p>
            {event.featured_projects?.length === 0 ? (
              <div className="card p-12 text-center text-gray-400">
                <Star className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No featured projects for this event yet.</p>
              </div>
            ) : (
              event.featured_projects?.map((fp, i) => (
                <div key={i} className="card p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{fp.title}</p>
                    {fp.deployed_link && <a href={fp.deployed_link} target="_blank" className="text-sm text-blue-500 hover:underline">{fp.deployed_link}</a>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Assign Faculty Modal */}
      <Modal open={showAssignFacultyModal} onClose={() => setShowAssignFacultyModal(false)} title="Assign Mentor Faculty">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Select a faculty member to assign as mentor for <strong>{selectedTeam?.team_name}</strong>.</p>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {allFaculty.map(f => (
              <button key={f._id} onClick={() => handleAssignFaculty(f._id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left border border-gray-200 dark:border-gray-600">
                <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-700 dark:text-purple-300 font-bold text-sm overflow-hidden">
                  {f.profile_image ? <img src={f.profile_image} className="w-full h-full object-cover" alt="" /> : f.name[0]}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{f.name}</p>
                  <p className="text-xs text-gray-500">{f.department} · {f.designation}</p>
                </div>
              </button>
            ))}
            {allFaculty.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6">No active faculty found.</p>
            )}
          </div>
          <Button variant="secondary" onClick={() => setShowAssignFacultyModal(false)}>Cancel</Button>
        </div>
      </Modal>

      {/* Marks Modal */}
      <Modal open={showMarksModal} onClose={() => setShowMarksModal(false)} title={`Give Marks — ${selectedTeam?.team_name}`}>
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
                    onChange={e => setMarksData(d => d.map((x, j) => j === i ? {...x, attendance: e.target.value} : x))}
                    className="input text-xs py-1 px-2 w-32">
                    <option value="not_marked">Not Marked</option>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
                <div className="space-y-2">
                  {m.label_marks?.map((label, labelIndex) => (
                    <div key={label.label_id || label.label} className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 w-28 truncate">{label.label}</label>
                      <input
                        type="number" min={0} max={label.marks_out_of}
                        value={m.attendance === 'absent' ? 0 : label.marks ?? 0}
                        onChange={e => setMarksData(d => d.map((x, j) => j === i ? {
                          ...x,
                          label_marks: x.label_marks.map((item, idx) => idx === labelIndex ? { ...item, marks: parseInt(e.target.value) || 0 } : item),
                        } : x))}
                        className="input w-20 text-center"
                        disabled={m.attendance === 'absent'}
                      />
                      <span className="text-sm text-gray-500">/ {label.marks_out_of}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowMarksModal(false)}>Cancel</Button>
            <Button onClick={handleSaveMarks} loading={saving}>Save Marks</Button>
          </div>
        </div>
      </Modal>

      {/* Presentation Modal */}
      <Modal open={showPresentationModal} onClose={() => setShowPresentationModal(false)} title={editPresentation ? 'Edit Presentation' : 'Add Presentation'}>
        <div className="space-y-4">
          <Input label="Presentation Title *" value={presentationForm.title}
            onChange={e => setPresentationForm(f => ({ ...f, title: e.target.value }))} />
          <Input label="Due Date *" type="date" value={presentationForm.due_date}
            onChange={e => setPresentationForm(f => ({ ...f, due_date: e.target.value }))} />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Labels and Marks</label>
              <Button size="sm" variant="secondary" onClick={() => setPresentationForm(f => ({ ...f, labels: [...f.labels, { label: '', marks_out_of: 100 }] }))}>
                <Plus className="w-3.5 h-3.5" /> Add Label
              </Button>
            </div>
            {presentationForm.labels.map((label, index) => (
              <div key={index} className="grid grid-cols-[1fr_120px_auto] gap-2">
                <Input placeholder="Label e.g. Viva" value={label.label}
                  onChange={e => setPresentationForm(f => ({ ...f, labels: f.labels.map((x, i) => i === index ? { ...x, label: e.target.value } : x) }))} />
                <Input type="number" min={1} placeholder="Out of" value={label.marks_out_of}
                  onChange={e => setPresentationForm(f => ({ ...f, labels: f.labels.map((x, i) => i === index ? { ...x, marks_out_of: e.target.value } : x) }))} />
                <Button size="sm" variant="danger" disabled={presentationForm.labels.length === 1}
                  onClick={() => setPresentationForm(f => ({ ...f, labels: f.labels.filter((_, i) => i !== index) }))}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowPresentationModal(false)}>Cancel</Button>
            <Button onClick={handleSavePresentation} loading={saving}>{editPresentation ? 'Update' : 'Schedule'}</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default AdminEventDetail;

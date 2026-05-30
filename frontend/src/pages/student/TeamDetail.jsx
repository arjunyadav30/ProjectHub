import { useCallback, useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, Badge, Modal, Input, Select, EmptyState, ProgressBar, Skeleton } from '../../components/common';
import { aiAPI, teamAPI, userAPI, videoAPI } from '../../api';
import {
  Github, Globe, Plus, Pencil, Trash2, CheckCircle,
  Clock, AlertCircle, Users, MessageSquare, LayoutGrid,
  GripVertical, Calendar, User, Sparkles, FileSearch
} from 'lucide-react';
import { formatDate, timeAgo, MODULE_STATUS_COLORS, getErrorMessage } from '../../utils';
import toast from 'react-hot-toast';

const MODULE_STATUSES = ['not_started', 'inprogress', 'completed'];

/* ─── Kanban helpers ─────────────────────────────────────── */
const COLUMN_CONFIG = [
  {
    id: 'all',
    label: 'Total',
    dotClass: 'bg-gray-400',
    badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    colClass: 'border-gray-200 dark:border-gray-700',
    headClass: 'bg-gray-50 dark:bg-gray-800/60',
    isTotal: true,          // read-only overview column — no drop target
  },
  {
    id: 'not_started',
    label: 'Not Started',
    dotClass: 'bg-gray-400',
    badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    colClass: 'border-gray-200 dark:border-gray-700',
    headClass: 'bg-gray-50 dark:bg-gray-800/60',
  },
  {
    id: 'inprogress',
    label: 'In Progress',
    dotClass: 'bg-amber-400',
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    colClass: 'border-amber-200 dark:border-amber-800/50',
    headClass: 'bg-amber-50/60 dark:bg-amber-900/20',
  },
  {
    id: 'completed',
    label: 'Completed',
    dotClass: 'bg-green-500',
    badgeClass: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    colClass: 'border-green-200 dark:border-green-800/50',
    headClass: 'bg-green-50/60 dark:bg-green-900/20',
  },
];

function getDueVariant(dueDateStr) {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = (due - now) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return { cls: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400', label: 'Overdue' };
  if (diffDays <= 2) return { cls: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400', label: formatDate(dueDateStr) };
  return { cls: 'text-gray-500 bg-gray-50 dark:bg-gray-800 dark:text-gray-400', label: formatDate(dueDateStr) };
}

/* ─── Kanban Card ─────────────────────────────────────────── */
function KanbanCard({ mod, isFaculty, onEdit, onDelete, onDragStart, onDragEnd }) {
  const due = getDueVariant(mod.due_date);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, mod._id)}
      onDragEnd={onDragEnd}
      className="group relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700
                 rounded-xl p-3.5 shadow-sm cursor-grab active:cursor-grabbing active:opacity-60
                 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md
                 transition-all duration-150 select-none"
    >
      {/* drag handle */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-30 transition-opacity">
        <GripVertical className="w-3.5 h-3.5 text-gray-400" />
      </div>

      {/* action buttons */}
      <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(mod)}
          className="p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {isFaculty && (
          <button
            onClick={() => onDelete(mod._id)}
            className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* module name */}
      <p className="text-sm font-medium text-gray-900 dark:text-white pr-14 leading-snug mb-2">
        {mod.module_name}
      </p>

      {/* description */}
      {mod.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2.5 line-clamp-2 leading-relaxed">
          {mod.description}
        </p>
      )}

      {/* meta row */}
      <div className="flex items-center gap-2 flex-wrap mt-1">
        {mod.assigned_to ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center
                            text-blue-700 dark:text-blue-400 font-semibold text-[10px] flex-shrink-0">
              {mod.assigned_to.name?.[0]}
            </div>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">{mod.assigned_to.name}</span>
          </div>
        ) : (
          <span className="text-[11px] text-gray-400 dark:text-gray-600 italic">Unassigned</span>
        )}

        {due && (
          <span className={`ml-auto inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md ${due.cls}`}>
            <Calendar className="w-3 h-3" />
            {due.label}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Kanban Column ───────────────────────────────────────── */
function KanbanColumn({ col, modules, isFaculty, onEdit, onDelete, onAdd, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, isDragOver }) {

  // "Total" column just shows all cards read-only (no drop)
  const isTotal = col.isTotal;

  return (
    <div
      className={`flex flex-col rounded-xl border ${col.colClass} min-h-[400px] transition-all duration-150
                  ${isDragOver && !isTotal ? 'ring-2 ring-blue-400 ring-offset-1 scale-[1.01]' : ''}`}
      onDragOver={isTotal ? undefined : onDragOver}
      onDragLeave={isTotal ? undefined : onDragLeave}
      onDrop={isTotal ? undefined : (e) => onDrop(e, col.id)}
    >
      {/* column header */}
      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-t-xl ${col.headClass} border-b ${col.colClass}`}>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dotClass}`} />
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{col.label}</span>
        <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${col.badgeClass}`}>
          {modules.length}
        </span>
      </div>

      {/* cards */}
      <div className={`flex-1 p-3 flex flex-col gap-2.5 ${isDragOver && !isTotal ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
        {modules.length === 0 && !isTotal && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 py-8">
            <LayoutGrid className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">Drop cards here</p>
          </div>
        )}
        {modules.length === 0 && isTotal && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 py-8">
            <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">No modules yet</p>
          </div>
        )}
        {modules.map((mod) => (
          <KanbanCard
            key={mod._id}
            mod={mod}
            isFaculty={isFaculty}
            onEdit={onEdit}
            onDelete={onDelete}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>

      {/* add button — only on status columns */}
      {!isTotal && (
        <button
          onClick={() => onAdd(col.id)}
          className="mx-3 mb-3 flex items-center justify-center gap-1.5 py-2 text-xs font-medium
                     text-gray-400 dark:text-gray-600 border border-dashed border-gray-200
                     dark:border-gray-700 rounded-lg hover:text-blue-600 hover:border-blue-300
                     dark:hover:text-blue-400 dark:hover:border-blue-700
                     transition-colors duration-150"
        >
          <Plus className="w-3.5 h-3.5" /> Add module
        </button>
      )}
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────── */
const TeamDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allFaculty, setAllFaculty] = useState([]);

  // Modals
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [editModule, setEditModule] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState([]);

  // Forms
  const [moduleForm, setModuleForm] = useState({ module_name: '', description: '', assigned_to: '', due_date: '', status: 'not_started' });
  const [progressNote, setProgressNote] = useState('');
  const [assignFacultyId, setAssignFacultyId] = useState('');
  const [statusForm, setStatusForm] = useState({ status: 'approved', reason: '', faculty_id: '' });
  const [projectForm, setProjectForm] = useState({ github_link: '', live_link: '', video_link: '', documentation_file: '', title: '', description: '', technologies_used: [] });
  const [saving, setSaving] = useState(false);
  const [meetingAt, setMeetingAt] = useState('');
  const [meetingAttendance, setMeetingAttendance] = useState([]);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiReview, setAiReview] = useState(null);
  const [aiCode, setAiCode] = useState('');
  const [aiNotes, setAiNotes] = useState('');
  const [aiLoading, setAiLoading] = useState('');
  const [showCodeReviewModal, setShowCodeReviewModal] = useState(false);

  // Kanban drag state
  const dragModuleId = useRef(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  /* ── fetch ── */
  const fetchTeam = useCallback(async () => {
    try {
      const { data } = await teamAPI.getById(id);
      setTeam(data.data);
      setProjectForm({
        github_link: data.data.project?.github_link || '',
        live_link: data.data.project?.live_link || '',
        video_link: data.data.project?.video_link || '',
        documentation_file: data.data.project?.documentation_file || '',
        title: data.data.project?.title || '',
        description: data.data.project?.description || '',
        technologies_used: data.data.project?.technologies_used || [],
      });
    } catch { toast.error('Failed to load team'); }
    finally { setLoading(false); }
  }, [id]);

  useRefetchOnFocus(fetchTeam, { liveScopes: ['teams', 'team', `team:${id}`] });

  useEffect(() => {
    setLoading(true);
    fetchTeam();
    videoAPI.getTeamAttendance(id)
      .then((res) => setMeetingAttendance(res.data?.data?.attendance || []))
      .catch(() => setMeetingAttendance([]));
    if (user.role === 'faculty' || user.role === 'admin') {
      userAPI.getAllFaculty().then(r => setAllFaculty(r.data.data));
    }
  }, [id, fetchTeam, user.role]);

  const isFaculty = user.role === 'faculty';
  const canManageTeam = user.role === 'faculty' || user.role === 'admin';
  const acceptedMembers = team?.members?.filter(m => m.status === 'accepted') || [];
  const allMembers = team?.members || []; // Show all members including pending
  const stats = team?.progress_stats || { total: 0, completed: 0, inprogress: 0, percent: 0 };
  const allModules = team?.project?.modules || [];

  /* ── module CRUD ── */
  const openAddModule = (status = 'not_started') => {
    setEditModule(null);
    setModuleForm({ module_name: '', description: '', assigned_to: '', due_date: '', status });
    setShowModuleModal(true);
  };

  const openEditModule = (mod) => {
    setEditModule(mod);
    setModuleForm({
      module_name: mod.module_name,
      description: mod.description || '',
      assigned_to: mod.assigned_to?._id || '',
      due_date: mod.due_date ? mod.due_date.slice(0, 10) : '',
      status: mod.status || 'not_started',
    });
    setShowModuleModal(true);
  };

  const saveModule = async () => {
    if (!moduleForm.module_name.trim()) return toast.error('Module name required');
    setSaving(true);
    try {
      if (editModule) {
        await teamAPI.updateModule(id, editModule._id, moduleForm);
      } else {
        await teamAPI.addModule(id, moduleForm);
      }
      toast.success(editModule ? 'Module updated' : 'Module added');
      setShowModuleModal(false);
      fetchTeam();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const deleteModule = async (moduleId) => {
    if (!confirm('Delete this module?')) return;
    try {
      await teamAPI.deleteModule(id, moduleId);
      toast.success('Module deleted');
      fetchTeam();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const updateModuleStatus = async (moduleId, status) => {
    try {
      // Optimistic update
      setTeam(prev => ({
        ...prev,
        project: {
          ...prev.project,
          modules: prev.project.modules.map(m =>
            m._id === moduleId ? { ...m, status } : m
          ),
        },
      }));
      await teamAPI.updateModule(id, moduleId, { status });
      fetchTeam();
    } catch (err) {
      toast.error(getErrorMessage(err));
      fetchTeam(); // revert on error
    }
  };

  /* ── Kanban drag handlers ── */
  const handleDragStart = (e, moduleId) => {
    dragModuleId.current = moduleId;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    dragModuleId.current = null;
    setDragOverCol(null);
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colId);
  };

  const handleDragLeave = () => setDragOverCol(null);

  const handleDrop = (e, colId) => {
    e.preventDefault();
    setDragOverCol(null);
    const modId = dragModuleId.current;
    if (!modId) return;
    const mod = allModules.find(m => m._id === modId);
    if (!mod || mod.status === colId) return;
    updateModuleStatus(modId, colId);
  };

  /* ── project links ── */
  const saveProjectLinks = async () => {
    setSaving(true);
    try {
      await teamAPI.updateProject(id, projectForm);
      toast.success('Project updated');
      fetchTeam();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const joinTeamCall = async () => {
    try {
      const { data } = await teamAPI.joinVideoRoom(id);
      const roomUrl = data?.data?.room_url;
      if (!roomUrl) return toast.error('Meeting room unavailable');
      window.open(roomUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const scheduleMeeting = async () => {
    if (!meetingAt) return toast.error('Select date/time first');
    try {
      await videoAPI.scheduleTeamMeeting(id, meetingAt);
      toast.success('Meeting scheduled');
      fetchTeam();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };


  /* ── progress note ── */
  const generateSummary = async () => {
    setAiLoading('summary');
    try {
      const { data } = await aiAPI.generateProjectSummary(id);
      setAiSummary(data.data);
      toast.success('AI summary generated');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setAiLoading(''); }
  };

  const runCodeReview = async () => {
    if (!aiCode.trim() && !team?.project?.github_link) {
      return toast.error('Paste code or add a GitHub link first');
    }
    setAiLoading('review');
    try {
      const { data } = await aiAPI.reviewProjectCode(id, { code: aiCode, notes: aiNotes });
      setAiReview(data.data);
      setShowCodeReviewModal(false);
      toast.success('AI code review ready');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setAiLoading(''); }
  };

  const addProgressNote = async () => {
    if (!progressNote.trim()) return toast.error('Write a note first');
    setSaving(true);
    try {
      await teamAPI.addProgressUpdate(id, progressNote);
      toast.success('Progress note added');
      setProgressNote('');
      setShowProgressModal(false);
      fetchTeam();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  /* ── faculty ── */
  const assignFaculty = async () => {
    if (!assignFacultyId) return toast.error('Select a faculty');
    setSaving(true);
    try {
      await teamAPI.assignFaculty(id, assignFacultyId);
      toast.success('Faculty assigned');
      setShowAssignModal(false);
      fetchTeam();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const updateStatus = async () => {
    setSaving(true);
    try {
      await teamAPI.updateStatus(id, statusForm);
      toast.success(`Team ${statusForm.status}`);
      setShowStatusModal(false);
      fetchTeam();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  /* ── member management ── */
  const handleSearchStudents = async (query) => {
    setStudentSearch(query);
    if (query.length < 2) { setStudentSearchResults([]); return; }
    try {
      const res = await userAPI.searchStudents(query);
      setStudentSearchResults(res.data.data || []);
    } catch { setStudentSearchResults([]); }
  };

  const handleAddMember = async (studentId) => {
    setSaving(true);
    try {
      await teamAPI.addMember(id, studentId);
      toast.success('Member added successfully');
      setShowAddMemberModal(false);
      setStudentSearch('');
      setStudentSearchResults([]);
      fetchTeam();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleRemoveMember = async (studentId) => {
    if (!confirm('Remove this member from the team?')) return;
    setSaving(true);
    try {
      await teamAPI.removeMember(id, studentId);
      toast.success('Member removed');
      fetchTeam();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  /* ── render ── */
  if (loading) return (
    <DashboardLayout>
      <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}</div>
    </DashboardLayout>
  );
  if (!team) return <DashboardLayout><p>Team not found.</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>

        {/* ── Team Header ── */}
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{team.team_name}</h1>
                <Badge variant={team.registration_status}>{team.registration_status}</Badge>
              </div>
              <p className="text-sm text-gray-500">Event: {team.event_id?.title}</p>
              {team.assigned_faculty && (
                <p className="text-sm text-blue-600 mt-1">Mentor: {team.assigned_faculty.name}</p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="secondary" onClick={() => navigate(`/chat/group/${id}`)}>
                Team Chat
              </Button>
              <Button size="sm" onClick={joinTeamCall}>
                Join Video Call
              </Button>
              {canManageTeam && (
                <>
                <Button size="sm" variant="secondary" onClick={() => setShowAssignModal(true)}>Assign Mentor</Button>
                <Button size="sm" variant="secondary" onClick={() => setShowStatusModal(true)}>Review</Button>
                </>
              )}
            </div>
          </div>

          {/* Progress Summary */}
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="grid grid-cols-4 gap-4 mb-3">
              {[
                { label: 'Total Modules', value: stats.total, icon: AlertCircle, color: 'text-gray-600' },
                { label: 'In Progress', value: stats.inprogress, icon: Clock, color: 'text-amber-600' },
                { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-green-600' },
                { label: 'Progress', value: `${stats.percent}%`, icon: CheckCircle, color: 'text-blue-600' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
            <ProgressBar percent={stats.percent} />
          </div>
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Video Meeting</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <input type="datetime-local" className="input" value={meetingAt} onChange={(e) => setMeetingAt(e.target.value)} />
            <Button variant="secondary" onClick={scheduleMeeting}>Schedule</Button>
            <Button onClick={joinTeamCall}>Join Now</Button>
          </div>
          <p className="text-xs text-gray-500">Attendance logs: {meetingAttendance.length}</p>
        </div>

        {/* ── AI Project Assistant ── */}
        <div className="card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">AI Project Assistant</h2>
              <p className="text-xs text-gray-500 mt-1">Generate a project summary and review pasted code.</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={generateSummary} loading={aiLoading === 'summary'}>
                <Sparkles className="w-4 h-4" /> Summary
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowCodeReviewModal(true)}>
                <FileSearch className="w-4 h-4" /> Code Review
              </Button>
            </div>
          </div>

          {(aiSummary || aiReview) && (
            <div className="grid md:grid-cols-2 gap-3">
              {aiSummary && (
                <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-900/10 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Summary</p>
                    <span className="text-[11px] uppercase tracking-wide text-blue-500">{aiSummary.source}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{aiSummary.summary}</p>
                  {aiSummary.next_steps?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">Next steps</p>
                      <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                        {aiSummary.next_steps.map((step) => <li key={step}>- {step}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {aiReview && (
                <div className="rounded-xl border border-amber-100 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-900/10 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Code Review</p>
                    <span className="text-[11px] uppercase tracking-wide text-amber-600">{aiReview.source}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{aiReview.verdict}</p>
                  {aiReview.issues?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">Issues</p>
                      <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                        {aiReview.issues.map((issue) => <li key={issue}>- {issue}</li>)}
                      </ul>
                    </div>
                  )}
                  {aiReview.suggestions?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">Suggestions</p>
                      <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                        {aiReview.suggestions.map((suggestion) => <li key={suggestion}>- {suggestion}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Project Details</h2>
          <div className="space-y-3">
            <Input
              label="Project Title"
              value={projectForm.title}
              onChange={e => setProjectForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Project title..."
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                value={projectForm.description}
                onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))}
                className="input min-h-[80px] resize-y"
                placeholder="Project description..."
              />
            </div>
            <Input
              label="Technologies (comma separated)"
              value={projectForm.technologies_used.join(', ')}
              onChange={e => setProjectForm(f => ({ ...f, technologies_used: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
              placeholder="React, Node.js, MongoDB..."
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">GitHub Link</label>
                <div className="relative">
                  <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={projectForm.github_link}
                    onChange={e => setProjectForm(f => ({ ...f, github_link: e.target.value }))}
                    placeholder="https://github.com/..."
                    className="input pl-9"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Live Link</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={projectForm.live_link}
                    onChange={e => setProjectForm(f => ({ ...f, live_link: e.target.value }))}
                    placeholder="https://myproject.com"
                    className="input pl-9"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {projectForm.github_link && (
                <a href={projectForm.github_link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors">
                  <Github className="w-4 h-4" /> GitHub
                </a>
              )}
              {projectForm.live_link && (
                <a href={projectForm.live_link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                  <Globe className="w-4 h-4" /> Live Demo
                </a>
              )}
            </div>
            <Button size="sm" onClick={saveProjectLinks} loading={saving}>Save Project Info</Button>
          </div>
        </div>

        {/* ── Kanban Board ── */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Modules</h2>
              <span className="text-xs text-gray-400 ml-1">· drag cards to update status</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowProgressModal(true)}>
                <MessageSquare className="w-4 h-4" /> Add Note
              </Button>
              <Button size="sm" onClick={() => openAddModule('not_started')}>
                <Plus className="w-4 h-4" /> Add Module
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {COLUMN_CONFIG.map(col => {
              const colModules = col.isTotal
                ? allModules
                : allModules.filter(m => m.status === col.id);

              return (
                <KanbanColumn
                  key={col.id}
                  col={col}
                  modules={colModules}
                  isFaculty={isFaculty}
                  onEdit={openEditModule}
                  onDelete={deleteModule}
                  onAdd={openAddModule}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  isDragOver={dragOverCol === col.id}
                />
              );
            })}
          </div>
        </div>

        {/* ── Progress Log ── */}
        {team.project?.progress_updates?.length > 0 && (
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Progress Log</h2>
            <div className="space-y-3">
              {[...team.project.progress_updates].reverse().map((update, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs flex-shrink-0">
                    {update.updated_by?.name?.[0] || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{update.updated_by?.name}</span>
                      <span className="text-xs text-gray-400">{timeAgo(update.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{update.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Team Members ── */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Team Members</h2>
            {canManageTeam && (
              <Button size="sm" onClick={() => setShowAddMemberModal(true)}>
                <Plus className="w-4 h-4" /> Add Member
              </Button>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {allMembers.map(member => (
              <div
                key={member.student_id?._id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${member.status === 'accepted'
                  ? 'border-green-200 bg-green-50 dark:bg-green-900/10'
                  : 'border-gray-200 dark:border-gray-700'
                  }`}
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                  {member.student_id?.name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm truncate">{member.student_id?.name}</p>
                    {team.team_leader?._id === member.student_id?._id && (
                      <span className="text-yellow-500 text-xs">👑 Leader</span>
                    )}
                    {member.status === 'pending' && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">Pending</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{member.student_id?.enrollment_no}</p>
                </div>
                {canManageTeam && team.team_leader?._id !== member.student_id?._id && (
                  <button
                    onClick={() => handleRemoveMember(member.student_id._id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-md transition-colors"
                    title="Remove member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                {!canManageTeam && <Badge variant={member.status}>{member.status}</Badge>}
              </div>
            ))}
          </div>
        </div>
      </div>

        {/* ── Faculty Suggestions ── */}
        {team.project?.suggestions?.length > 0 && (
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">💡 Faculty Suggestions</h2>
            <div className="space-y-3">
              {team.project.suggestions.map((s, i) => (
                <div key={i} className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl">
                  <p className="text-sm text-gray-800 dark:text-gray-200">{s.text}</p>
                  <p className="text-xs text-gray-500 mt-2">By {s.by_name} · {new Date(s.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Presentation Info ── */}
        {team.event_id?.presentation_schedule?.start_date && (
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">📅 Presentation Schedule</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Start Date</p>
                <p className="font-semibold text-blue-700 dark:text-blue-300">
                  {new Date(team.event_id.presentation_schedule.start_date).toLocaleDateString()}
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">End Date</p>
                <p className="font-semibold text-blue-700 dark:text-blue-300">
                  {new Date(team.event_id.presentation_schedule.end_date).toLocaleDateString()}
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Marks</p>
                <p className="font-semibold text-blue-700 dark:text-blue-300">
                  {team.event_id.presentation_schedule.marks_label} / {team.event_id.presentation_schedule.marks_out_of}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Final Submission ── */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">📦 Final Submission</h2>
          {team.project?.submission_status === 'not_submitted' ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Submit your final project when ready. Fill in all links before submitting.</p>
              <div className="grid gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">GitHub Link</label>
                  <input className="input w-full" placeholder="https://github.com/..." value={projectForm.github_link}
                    onChange={e => setProjectForm(f => ({...f, github_link: e.target.value}))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Deployed / Live Link</label>
                  <input className="input w-full" placeholder="https://yourapp.com" value={projectForm.live_link}
                    onChange={e => setProjectForm(f => ({...f, live_link: e.target.value}))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Video Link (optional)</label>
                  <input className="input w-full" placeholder="https://youtube.com/..." value={projectForm.video_link || ''}
                    onChange={e => setProjectForm(f => ({...f, video_link: e.target.value}))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Project Document Link</label>
                  <input className="input w-full" placeholder="https://drive.google.com/... or document URL" value={projectForm.documentation_file || ''}
                    onChange={e => setProjectForm(f => ({...f, documentation_file: e.target.value}))} />
                </div>
              </div>
              <Button onClick={async () => {
                setSaving(true);
                try {
                  await teamAPI.updateProject(id, { ...projectForm, submission_status: 'submitted' });
                  toast.success('Project submitted for review!');
                  fetchTeam();
                } catch (e) { toast.error('Submission failed'); }
                finally { setSaving(false); }
              }} loading={saving}>
                Submit for Final Review
              </Button>
            </div>
          ) : (
            <div className={`p-4 rounded-xl ${
              team.project.submission_status === 'accepted' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' :
              team.project.submission_status === 'rejected' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' :
              'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
            }`}>
              <p className="font-medium capitalize">
                {team.project.submission_status === 'accepted' ? '✅ Submission Accepted!' :
                 team.project.submission_status === 'rejected' ? '❌ Submission Rejected' :
                 '⏳ Awaiting Review'}
              </p>
              {team.project.submission_comment && (
                <p className="text-sm text-gray-600 mt-2">{team.project.submission_comment}</p>
              )}
            </div>
          )}
        </div>

      {/* ── Add / Edit Module Modal ── */}
      <Modal
        open={showModuleModal}
        onClose={() => setShowModuleModal(false)}
        title={editModule ? 'Edit Module' : 'Add Module'}
      >
        <div className="space-y-4">
          <Input
            label="Module Name"
            value={moduleForm.module_name}
            onChange={e => setModuleForm(f => ({ ...f, module_name: e.target.value }))}
            placeholder="e.g. Authentication System"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={moduleForm.description}
              onChange={e => setModuleForm(f => ({ ...f, description: e.target.value }))}
              className="input min-h-[80px]"
              placeholder="What does this module cover?"
            />
          </div>
          <Select
            label="Assign To"
            value={moduleForm.assigned_to}
            onChange={e => setModuleForm(f => ({ ...f, assigned_to: e.target.value }))}
          >
            <option value="">Unassigned</option>
            {acceptedMembers.map(m => (
              <option key={m.student_id?._id} value={m.student_id?._id}>
                {m.student_id?.name} ({m.student_id?.enrollment_no})
              </option>
            ))}
          </Select>
          <Input
            label="Due Date"
            type="date"
            value={moduleForm.due_date}
            onChange={e => setModuleForm(f => ({ ...f, due_date: e.target.value }))}
          />
          {/* Status selector — only shown when editing */}
          {editModule && (
            <Select
              label="Status"
              value={moduleForm.status}
              onChange={e => setModuleForm(f => ({ ...f, status: e.target.value }))}
            >
              <option value="not_started">Not Started</option>
              <option value="inprogress">In Progress</option>
              <option value="completed">Completed</option>
            </Select>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowModuleModal(false)}>Cancel</Button>
            <Button onClick={saveModule} loading={saving}>{editModule ? 'Update' : 'Add'} Module</Button>
          </div>
        </div>
      </Modal>

      {/* ── Progress Note Modal ── */}
      <Modal open={showProgressModal} onClose={() => setShowProgressModal(false)} title="Add Progress Note">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Note</label>
            <textarea
              value={progressNote}
              onChange={e => setProgressNote(e.target.value)}
              className="input min-h-[100px]"
              placeholder="Describe today's progress..."
            />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowProgressModal(false)}>Cancel</Button>
            <Button onClick={addProgressNote} loading={saving}>Add Note</Button>
          </div>
        </div>
      </Modal>

      {/* ── Assign Faculty Modal ── */}
      <Modal open={showCodeReviewModal} onClose={() => setShowCodeReviewModal(false)} title="AI Code Review" size="lg">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Review Notes</label>
            <input
              value={aiNotes}
              onChange={e => setAiNotes(e.target.value)}
              className="input w-full"
              placeholder="Focus area, file name, or concern..."
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Code</label>
            <textarea
              value={aiCode}
              onChange={e => setAiCode(e.target.value)}
              className="input min-h-[260px] font-mono text-xs"
              placeholder="Paste a component, API route, controller, or config file..."
            />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowCodeReviewModal(false)}>Cancel</Button>
            <Button onClick={runCodeReview} loading={aiLoading === 'review'}>Run Review</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign Mentor Faculty">
        <div className="space-y-4">
          <Select
            label="Select Faculty"
            value={assignFacultyId}
            onChange={e => setAssignFacultyId(e.target.value)}
          >
            <option value="">Choose a mentor...</option>
            {allFaculty.map(f => (
              <option key={f._id} value={f._id}>{f.name} — {f.department}</option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowAssignModal(false)}>Cancel</Button>
            <Button onClick={assignFaculty} loading={saving}>Assign</Button>
          </div>
        </div>
      </Modal>

      {/* ── Review Status Modal ── */}
      <Modal open={showStatusModal} onClose={() => setShowStatusModal(false)} title="Review Team Registration">
        <div className="space-y-4">
          <Select
            label="Decision"
            value={statusForm.status}
            onChange={e => setStatusForm(f => ({ ...f, status: e.target.value }))}
          >
            <option value="approved">✅ Approve</option>
            <option value="rejected">❌ Reject</option>
          </Select>
          {statusForm.status === 'approved' && (
            <Select
              label="Assign Mentor Faculty"
              value={statusForm.faculty_id}
              onChange={e => setStatusForm(f => ({ ...f, faculty_id: e.target.value }))}
            >
              <option value="">Select mentor (optional)</option>
              {allFaculty.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
            </Select>
          )}
          {statusForm.status === 'rejected' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reason</label>
              <textarea
                value={statusForm.reason}
                onChange={e => setStatusForm(f => ({ ...f, reason: e.target.value }))}
                className="input min-h-[80px]"
                placeholder="Reason for rejection..."
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowStatusModal(false)}>Cancel</Button>
            <Button
              variant={statusForm.status === 'approved' ? 'success' : 'danger'}
              onClick={updateStatus}
              loading={saving}
            >
              {statusForm.status === 'approved' ? 'Approve Team' : 'Reject Team'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Add Member Modal ── */}
      <Modal open={showAddMemberModal} onClose={() => { setShowAddMemberModal(false); setStudentSearch(''); setStudentSearchResults([]); }} title="Add Team Member">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Search Student</label>
            <input
              type="text"
              value={studentSearch}
              onChange={e => handleSearchStudents(e.target.value)}
              placeholder="Enter name or enrollment number..."
              className="input w-full"
            />
          </div>
          {studentSearchResults.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {studentSearchResults.map(student => (
                <button
                  key={student._id}
                  onClick={() => handleAddMember(student._id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-left border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs flex-shrink-0">
                    {student.name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{student.name}</p>
                    <p className="text-xs text-gray-500">{student.enrollment_no} • {student.branch} Year {student.year}</p>
                  </div>
                  <Plus className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
          )}
          {studentSearch.length >= 2 && studentSearchResults.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <p className="text-sm">No students found</p>
            </div>
          )}
        </div>
      </Modal>
    </DashboardLayout>
  );
}

export default TeamDetailPage;

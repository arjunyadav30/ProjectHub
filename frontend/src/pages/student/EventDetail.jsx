import { useCallback, useEffect, useState } from 'react';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, Badge, Modal, Input, EmptyState } from '../../components/common';
import { eventAPI, teamAPI, userAPI } from '../../api';
import { Calendar, Users, Clock, Plus, Search, Trash2, Crown, Download } from 'lucide-react';
import { formatDate, formatDateTime, getErrorMessage, downloadCSV } from '../../utils';
import { useDebounce } from '../../hooks/useDebounce';
import toast from 'react-hot-toast';

const isRegistrationOpen = (event) => {
  const now = Date.now();
  const startsAt = event.registration_start ? new Date(event.registration_start).getTime() : null;
  const endsAt = event.registration_end ? new Date(event.registration_end).getTime() : null;
  const hasOpenStatus = event.status === 'open' || event.status === 'active';

  return hasOpenStatus && (!startsAt || now >= startsAt) && (!endsAt || now <= endsAt);
};

const EventDetailPage = () => {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [teams, setTeams] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [step, setStep] = useState(1);

  // Team creation form state
  const [teamName, setTeamName] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [leaderId, setLeaderId] = useState('');
  const [project, setProject] = useState({ title: '', description: '', technologies_used: [] });
  const [creating, setCreating] = useState(false);
  const [studentRegistration, setStudentRegistration] = useState(null);

  const debouncedSearch = useDebounce(searchQ, 300);

  const loadEvent = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const evtRes = await eventAPI.getById(id);
      const eventData = evtRes.data.data;
      const eventObj = eventData.event || eventData;
      const registration = eventData.studentRegistration || null;

      setEvent(eventObj);
      setStudentRegistration(registration);

      if (user.role === 'faculty') {
        const teamsRes = await eventAPI.getTeams(id);
        setTeams(teamsRes.data.data.teams);
        setStats(teamsRes.data.data.stats);
      }
    } catch {
      toast.error('Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const refreshEvent = useCallback(() => loadEvent(false), [id, user.role]);

  useRefetchOnFocus(refreshEvent, { liveScopes: ['events', `event:${id}`, 'teams'] });

  useEffect(() => {
    loadEvent();
  }, [id, user.role]);

  useEffect(() => {
    if (debouncedSearch.length < 2) { setSearchResults([]); return; }
    userAPI.searchStudents(debouncedSearch).then(r => setSearchResults(r.data.data));
  }, [debouncedSearch]);

  useEffect(() => {
    if (!showTeamModal) return;
    if (profile?._id && selectedMembers.length === 0) {
      setSelectedMembers([profile]);
      setLeaderId(profile._id);
    }
  }, [showTeamModal, profile, selectedMembers.length]);

  const addMember = (student) => {
    if (selectedMembers.find(m => m._id === student._id)) return;
    if (event && selectedMembers.length >= event.max_team_size) {
      toast.error(`Max team size is ${event.max_team_size}`);
      return;
    }
    setSelectedMembers(prev => [...prev, student]);
    setSearchQ('');
    setSearchResults([]);
  };

  const removeMember = (id) => {
    if (profile?._id === id) return toast.error('You are already included in this team');
    setSelectedMembers(prev => prev.filter(m => m._id !== id));
    if (leaderId === id) setLeaderId('');
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return toast.error('Team name required');
    if (selectedMembers.length < (event?.min_team_size || 1)) return toast.error(`Min ${event?.min_team_size} members required`);
    if (!leaderId) return toast.error('Select a team leader');

    if (step === 1) {
      setStep(2);
      return;
    }

    setCreating(true);
    try {
      await teamAPI.create({
        event_id: id,
        team_name: teamName,
        member_enrollment_nos: selectedMembers.map(m => m.enrollment_no),
        leader_enrollment_no: selectedMembers.find(m => m._id === leaderId)?.enrollment_no,
        project,
      });
      toast.success('Team registered successfully!');
      setShowTeamModal(false);
      setStep(1);
      setTeamName('');
      setSelectedMembers([]);
      setLeaderId('');
      setProject({ title: '', description: '', technologies_used: [] });
      await loadEvent(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const { data } = await eventAPI.exportTeams(id);
      downloadCSV(data, `${event?.title}-teams.csv`);
    } catch { toast.error('Export failed'); }
  };

  if (loading) return <DashboardLayout><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/2" /><div className="h-32 bg-gray-200 rounded" /></div></DashboardLayout>;
  if (!event) return <DashboardLayout><p>Event not found.</p></DashboardLayout>;

  const isOpen = isRegistrationOpen(event);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Back */}
        <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          ← Back to Events
        </button>

        {/* Event Header */}
        <div className="card p-6" id="event-info">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{event.title}</h1>
                <Badge variant={event.status}>{event.status}</Badge>
              </div>
              <p className="text-gray-600 dark:text-gray-400">{event.description}</p>
            </div>
            {user.role === 'faculty' && event.created_by?._id === user._id && (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => navigate(`/events/${id}/edit`)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={handleExportCSV}><Download className="w-4 h-4" /></Button>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-gray-500 text-xs">Team Size</p>
              <p className="font-semibold">{event.min_team_size}–{event.max_team_size} members</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-gray-500 text-xs">Registration Closes</p>
              <p className="font-semibold">{formatDate(event.registration_end)}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-gray-500 text-xs">Event Ends</p>
              <p className="font-semibold">{formatDate(event.event_end_date)}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-gray-500 text-xs">Organizer</p>
              <p className="font-semibold">{event.created_by?.name}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {event.allowed_branches?.map(b => (
              <span key={b} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-md text-sm">{b}</span>
            ))}
            {event.allowed_years?.map(y => (
              <span key={y} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 rounded-md text-sm">Year {y}</span>
            ))}
          </div>

          {/* Register Button (student) - Only show if NOT registered */}
          {user.role === 'student' && isOpen && !studentRegistration && (
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
              <Button onClick={() => {
                if (profile?._id && selectedMembers.length === 0) {
                  setSelectedMembers([profile]);
                  setLeaderId(profile._id);
                }
                setShowTeamModal(true);
              }}>
                <Plus className="w-4 h-4" /> Register Team
              </Button>
            </div>
          )}

          {/* Registered Team Details (student) - Show if registered */}
          {user.role === 'student' && studentRegistration && (
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-green-900 dark:text-green-300">
                      ✓ Successfully Registered
                    </p>
                    <p className="mt-1 text-sm text-green-800 dark:text-green-400">
                      Team: <span className="font-medium">{studentRegistration.team_name}</span>
                    </p>
                  </div>
                  <Badge variant={studentRegistration.registration_status}>
                    {studentRegistration.registration_status}
                  </Badge>
                </div>
              </div>
              
              {/* Buttons to view details */}
              <div className="flex gap-2">
                <Link 
                  to={`/teams/${studentRegistration._id}`}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-center font-medium transition-colors"
                >
                  View Team Details
                </Link>
                <Link 
                  to={`#event-info`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('event-info')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg text-center font-medium transition-colors"
                >
                  View Event Details
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Faculty: Teams Stats + List */}
        {user.role === 'faculty' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total', value: stats.total, color: 'text-gray-900 dark:text-white' },
                { label: 'Approved', value: stats.approved, color: 'text-green-600' },
                { label: 'Pending', value: stats.pending, color: 'text-amber-600' },
                { label: 'Rejected', value: stats.rejected, color: 'text-red-600' },
              ].map(s => (
                <div key={s.label} className="card p-4 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value || 0}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-white">All Teams</h2>
                <Button size="sm" onClick={() => setShowTeamModal(true)}>
                  <Plus className="w-4 h-4" /> Add Team
                </Button>
              </div>
              {teams.length === 0 ? (
                <EmptyState icon={Users} title="No teams yet" description="Teams will appear here once registered." />
              ) : (
                <div className="space-y-3">
                  {teams.map(team => (
                    <Link key={team._id} to={`/teams/${team._id}`}
                      className="flex items-center justify-between p-4 border border-gray-100 dark:border-gray-700 rounded-lg hover:border-blue-200 transition-colors">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{team.team_name}</p>
                        <p className="text-xs text-gray-500">
                          Leader: {team.team_leader?.name} · {team.members?.filter(m => m.status === 'accepted').length} members
                        </p>
                        {team.assigned_faculty && (
                          <p className="text-xs text-blue-600">Mentor: {team.assigned_faculty.name}</p>
                        )}
                      </div>
                      <Badge variant={team.registration_status}>{team.registration_status}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Team Registration Modal */}
      <Modal open={showTeamModal} onClose={() => { setShowTeamModal(false); setStep(1); }} title={`${step === 1 ? 'Form Your Team' : 'Project Details'}`} size="lg">
        {step === 1 ? (
          <div className="space-y-4">
            <Input label="Team Name" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Team Alpha" />

            {/* Member Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Add Members ({selectedMembers.length}/{event?.max_team_size})
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search by enrollment no or name..."
                  className="input pl-9"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="mt-1 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                  {searchResults.map(s => (
                    <button key={s._id} onClick={() => addMember(s)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-left text-sm">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs">
                        {s.name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.enrollment_no} · {s.branch} Year {s.year}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Members */}
            {selectedMembers.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selected Members — click crown to set leader</p>
                <div className="space-y-2">
                  {selectedMembers.map(m => (
                    <div key={m._id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${leaderId === m._id ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10' : 'border-gray-200 dark:border-gray-600'}`}>
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs">
                        {m.name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-gray-500">{m.enrollment_no}</p>
                      </div>
                      <button onClick={() => setLeaderId(m._id)}
                        className={`p-1.5 rounded-md transition-colors ${leaderId === m._id ? 'text-yellow-600' : 'text-gray-400 hover:text-yellow-500'}`}
                        title="Set as leader">
                        <Crown className="w-4 h-4" />
                      </button>
                      {profile?._id === m._id && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-medium">You</span>
                      )}
                      <button
                        onClick={() => removeMember(m._id)}
                        disabled={profile?._id === m._id}
                        title={profile?._id === m._id ? 'You are included by default' : 'Remove member'}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-md disabled:opacity-40 disabled:hover:text-gray-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {leaderId && <p className="text-xs text-yellow-600 mt-1">👑 Leader: {selectedMembers.find(m => m._id === leaderId)?.name}</p>}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowTeamModal(false)}>Cancel</Button>
              <Button onClick={handleCreateTeam} disabled={!teamName || selectedMembers.length === 0 || !leaderId}>
                Next: Project Details →
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Project Title"
              value={project.title}
              onChange={e => setProject(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Online Library System"
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Project Description</label>
              <textarea
                value={project.description}
                onChange={e => setProject(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of your project..."
                className="input min-h-[100px] resize-y"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Technologies Used</label>
              <input
                value={project.technologies_used.join(', ')}
                onChange={e => setProject(p => ({ ...p, technologies_used: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
                placeholder="React, Node.js, MongoDB (comma separated)"
                className="input"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={handleCreateTeam} loading={creating}>Submit Registration</Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
};

export default EventDetailPage;

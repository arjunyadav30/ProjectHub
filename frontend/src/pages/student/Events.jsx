import { useCallback, useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import { DashboardLayout } from '../../components/common/Layout';
import {
  Button, Badge, SkeletonCard, EmptyState, Modal, Input, Textarea,
} from '../../components/common';
import { eventAPI, teamAPI, userAPI } from '../../api';
import { Link } from 'react-router-dom';
import {
  Calendar, Search, Users, Clock, ChevronRight, X, Plus, Crown,
  Tag, CheckCircle2, Loader2,
} from 'lucide-react';
import { formatDate, getErrorMessage, cn } from '../../utils';
import { useDebounce } from '../../hooks/useDebounce';
import toast from 'react-hot-toast';

const isRegistrationOpen = (event) => {
  const now = Date.now();
  const startsAt = event.registration_start ? new Date(event.registration_start).getTime() : null;
  const endsAt = event.registration_end ? new Date(event.registration_end).getTime() : null;
  const hasOpenStatus = event.status === 'open' || event.status === 'active';

  return hasOpenStatus && (!startsAt || now >= startsAt) && (!endsAt || now <= endsAt);
};

// ─── Tag Input ────────────────────────────────────────────────────────────────
const TagInput = ({ tags, onChange, placeholder }) => {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  const addTag = (val) => {
    const trimmed = val.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') { 
      e.preventDefault(); 
      addTag(input); 
    }
    else if (e.key === 'Backspace' && !input && tags.length > 0) onChange(tags.slice(0, -1));
  };

  const handleChange = (e) => {
    const value = e.target.value;
    // If comma is typed, add the tag before the comma
    if (value.includes(',')) {
      const parts = value.split(',');
      for (let i = 0; i < parts.length - 1; i++) {
        addTag(parts[i]);
      }
      setInput(parts[parts.length - 1]);
    } else {
      setInput(value);
    }
  };

  return (
    <div
      className="input flex flex-wrap gap-1.5 h-auto min-h-[42px] cursor-text py-1.5"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-md text-sm">
          <Tag className="w-3 h-3" />{tag}
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(tags.filter((_, j) => j !== i)); }} className="hover:text-blue-600">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(input)}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] border-none outline-none bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
      />
    </div>
  );
};

// ─── Registration Modal ───────────────────────────────────────────────────────
const RegisterModal = ({ open, onClose, event, onSuccess }) => {
  const { profile } = useAuth();
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [technologies, setTechnologies] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [leaderId, setLeaderId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const debouncedSearch = useDebounce(searchQ, 300);

  const minSize = event?.min_team_size || 1;
  const maxSize = event?.max_team_size || 4;

  useEffect(() => {
    if (!open) return;
    setStep(1); setProjectName(''); setDescription(''); setTechnologies([]);
    setTeamName('');
    if (profile?._id) {
      setSelectedMembers([profile]);
      setLeaderId(profile._id);
    } else {
      setSelectedMembers([]);
      setLeaderId('');
    }
    setSearchQ(''); setSearchResults([]);
  }, [open, profile]);

  useEffect(() => {
    if (debouncedSearch.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    userAPI.searchStudents(debouncedSearch)
      .then(r => setSearchResults(r.data.data || []))
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false));
  }, [debouncedSearch]);

  const addMember = (student) => {
    if (selectedMembers.find(m => m._id === student._id)) return toast.error('Already added');
    if (selectedMembers.length >= maxSize) return toast.error(`Max ${maxSize} members`);
    setSelectedMembers(prev => [...prev, student]);
    setSearchQ(''); setSearchResults([]);
  };

  const removeMember = (id) => {
    if (profile?._id === id) return toast.error('You are already included in this team');
    setSelectedMembers(prev => prev.filter(m => m._id !== id));
    if (leaderId === id) setLeaderId('');
  };

  const handleNext = () => {
    if (!projectName.trim()) return toast.error('Project name is required');
    if (!description.trim()) return toast.error('Description is required');
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!teamName.trim()) return toast.error('Team name is required');
    if (selectedMembers.length < minSize) return toast.error(`Minimum ${minSize} member(s) required`);
    if (!leaderId) return toast.error('Please select a team leader');
    const leader = selectedMembers.find(m => m._id === leaderId);
    if (!leader) return toast.error('Invalid leader');

    setSubmitting(true);
    try {
      await teamAPI.create({
        event_id: event._id,
        team_name: teamName.trim(),
        leader_enrollment_no: leader.enrollment_no,
        member_enrollment_nos: selectedMembers.map(m => m.enrollment_no),
        project: { title: projectName.trim(), description: description.trim(), technologies_used: technologies },
      });
      toast.success('Registration submitted! Awaiting admin approval.');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!event) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Register — ${event.title}`} size="lg">
      {/* Steps */}
      <div className="flex items-center gap-2 mb-6">
        {['Project Details', 'Team Members'].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors',
              step > i + 1 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : step === i + 1 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-gray-100 text-gray-400 dark:bg-gray-800',
            )}>
              {step > i + 1
                ? <CheckCircle2 className="w-3.5 h-3.5" />
                : <span className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-xs">{i + 1}</span>
              }
              {label}
            </div>
            {i === 0 && <ChevronRight className="w-4 h-4 text-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <Input label="Project Name *" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. SmartAttend – AI Attendance System" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description *</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your project idea, goals, and approach..." rows={4} />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Technologies Used</label>
            <TagInput tags={technologies} onChange={setTechnologies} placeholder="Type a tech and press Enter (e.g. React, Node.js, Python)" />
            <p className="text-xs text-gray-400">Press Enter or comma after each technology</p>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleNext}>Next: Team Members <ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <Input label="Team Name *" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Team Nexus" />

          {/* Search */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Add Members
              <span className="ml-1 text-gray-400 font-normal">({selectedMembers.length}/{maxSize} · min {minSize})</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search by enrollment number…"
                className="input pl-9"
              />
              {searchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
            </div>

            {searchResults.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm bg-white dark:bg-gray-800">
                {searchResults.slice(0, 5).map(s => (
                  <button
                    key={s._id}
                    onClick={() => addMember(s)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-left border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 font-semibold text-sm shrink-0">
                      {s.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.enrollment_no} · {s.branch} · Sem {s.semester}</p>
                    </div>
                    <Plus className="w-4 h-4 text-blue-600 shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {debouncedSearch.length >= 2 && !searchLoading && searchResults.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-2">No students found</p>
            )}
          </div>

          {/* Selected members list */}
          {selectedMembers.length > 0 && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Members <span className="ml-1 text-xs text-gray-400 font-normal">— click 👑 to set leader</span>
              </label>
              <div className="space-y-2">
                {selectedMembers.map(m => (
                  <div key={m._id} className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                    leaderId === m._id
                      ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-600/40'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50',
                  )}>
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 font-semibold text-sm shrink-0">
                      {m.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.name}</p>
                      <p className="text-xs text-gray-500 truncate">{m.enrollment_no} · {m.branch}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {profile?._id === m._id && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-medium mr-1">You</span>
                      )}
                      {leaderId === m._id && (
                        <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded font-medium mr-1">Leader</span>
                      )}
                      <button
                        onClick={() => setLeaderId(m._id)}
                        title="Set as leader"
                        className={cn(
                          'p-1.5 rounded-lg transition-colors',
                          leaderId === m._id
                            ? 'text-amber-500 bg-amber-100 dark:bg-amber-900/30'
                            : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20',
                        )}
                      >
                        <Crown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeMember(m._id)}
                        disabled={profile?._id === m._id}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title={profile?._id === m._id ? 'You are included by default' : 'Remove member'}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info banner */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800/30">
            <Users className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-400">
              This event requires <strong>{minSize}–{maxSize} members</strong>.
              Each invited member receives a team invite notification.
              Your registration is sent to admin for review on submit.
            </p>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={handleSubmit} loading={submitting} disabled={submitting}>
              Submit Registration
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

// ─── Event Card ───────────────────────────────────────────────────────────────
const EventCard = ({ event }) => {
  const isOpen = isRegistrationOpen(event);
  const deadline = event.registration_end ? new Date(event.registration_end) : null;
  const daysLeft = deadline ? Math.ceil((deadline - Date.now()) / 86400000) : null;

  return (
    <Link to={`/events/${event._id}`}>
      <div className="card p-5 flex flex-col gap-4 hover:shadow-md transition-shadow cursor-pointer h-full">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 flex-1 text-base leading-snug">{event.title}</h3>
          <Badge variant={event.status}>{event.status}</Badge>
        </div>

        <p className="text-sm text-gray-500 line-clamp-2 -mt-1">{event.description}</p>

        <div className="space-y-1.5 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            Team: <span className="font-medium text-gray-700 dark:text-gray-300">{event.min_team_size}–{event.max_team_size} members</span>
          </div>
          {deadline && (
            <div className={cn('flex items-center gap-1.5 flex-wrap', daysLeft !== null && daysLeft <= 3 && isOpen && 'text-red-500')}>
              <Clock className="w-3.5 h-3.5" />
              Closes: <span className="font-medium">{formatDate(event.registration_end)}</span>
              {isOpen && daysLeft !== null && daysLeft > 0 && (
                <span className={cn('px-1.5 py-0.5 rounded font-medium', daysLeft <= 3 ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-gray-100 text-gray-600 dark:bg-gray-700')}>
                  {daysLeft}d left
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {event.allowed_semesters?.map(s => (
            <span key={s} className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full text-xs">Sem {s}</span>
          ))}
          {event.allowed_branches?.map(b => (
            <span key={b} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-xs">{b}</span>
          ))}
        </div>

        <div className="pt-1 border-t border-gray-100 dark:border-gray-700/50 mt-auto">
          <div className="text-center text-sm font-medium text-blue-600 py-2">
            View Details →
          </div>
        </div>
      </div>
    </Link>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const StudentEventsPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });

  const fetchEvents = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 9 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await eventAPI.getAll(params);
      setEvents(data.data.events);
      setPagination(data.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchEvents(1); }, [fetchEvents]);

  useRefetchOnFocus(() => fetchEvents(pagination.page || 1));

  const filtered = events.filter(e => e.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Events</h1>
          <p className="text-sm text-gray-500 mt-1">Browse events you're eligible for and register your team</p>
        </div>

        <div className="card p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events..." className="input pl-9" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input sm:w-40">
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="active">Active</option>
              <option value="upcoming">Upcoming</option>
              <option value="closed">Closed</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Calendar} title="No events found" description="There are no eligible events for your semester right now." />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(event => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="flex justify-center gap-2">
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => fetchEvents(p)}
                className={cn(
                  'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
                  p === pagination.page
                    ? 'bg-blue-700 text-white'
                    : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50',
                )}
              >{p}</button>
            ))}
          </div>
        )}
      </div>

    </DashboardLayout>
  );
};

export default StudentEventsPage;

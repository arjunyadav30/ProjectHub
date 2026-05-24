import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { teamAPI, facultyAPI } from '../api';
import { DashboardLayout } from '../components/common/Layout';
import { Badge, Button } from '../components/common';
import { CheckCircle, ChevronLeft, ExternalLink, FileText, Github, Globe, Users, Video, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils';

const ReviewSubmission = () => {
  const { id } = useParams();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState('');

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const res = await teamAPI.getById(id);
      setTeam(res.data.data);
      setComment(res.data.data?.project?.submission_comment || '');
    } catch (e) {
      toast.error('Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTeam(); }, [id]);

  const review = async (action) => {
    setSaving(true);
    try {
      await facultyAPI.reviewSubmission(id, { action, comment });
      toast.success(`Submission ${action}`);
      fetchTeam();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-72 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="card h-72 bg-gray-200 dark:bg-gray-700" />
        </div>
      </DashboardLayout>
    );
  }

  if (!team) return <DashboardLayout><p className="text-red-500">Submission not found</p></DashboardLayout>;

  const project = team.project || {};
  const members = team.members?.filter(member => member.status === 'accepted') || [];
  const hasSubmission = project.submission_status && project.submission_status !== 'not_submitted';

  const links = [
    { label: 'GitHub', value: project.github_link, icon: Github },
    { label: 'Live App', value: project.live_link, icon: Globe },
    { label: 'Video', value: project.video_link, icon: Video },
    { label: 'Documentation', value: project.documentation_file, icon: FileText },
  ].filter(item => item.value);

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-5xl">
        <div>
          <Link to="/notifications" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-500 mb-3">
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Final Submission Review</h1>
              <p className="text-sm text-gray-500 mt-1">{team.team_name} · {team.event_id?.title}</p>
            </div>
            <Badge variant={
              project.submission_status === 'submitted' ? 'pending' :
              project.submission_status === 'accepted' ? 'approved' :
              project.submission_status === 'rejected' ? 'rejected' : 'default'
            }>
              {project.submission_status || 'not_submitted'}
            </Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-5">
          <div className="space-y-5">
            <div className="card p-5 space-y-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">{project.title || team.team_name}</h2>
              {project.description && <p className="text-sm text-gray-600 dark:text-gray-400">{project.description}</p>}
              {project.technologies_used?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {project.technologies_used.map(tech => (
                    <span key={tech} className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      {tech}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-5 space-y-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">Submitted Material</h2>
              {links.length === 0 ? (
                <p className="text-sm text-gray-500">No links or files submitted.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {links.map(({ label, value, icon: Icon }) => (
                    <a
                      key={label}
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                    >
                      <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                        <p className="text-xs text-gray-500 truncate">{value}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {project.documentation_file && (
              <div className="card p-5 space-y-3">
                <h2 className="font-semibold text-gray-900 dark:text-white">Documentation Preview</h2>
                <iframe
                  src={`${project.documentation_file}#toolbar=0`}
                  className="w-full h-[520px] rounded-lg border border-gray-200 dark:border-gray-700"
                  title="Documentation preview"
                />
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="card p-5">
              <h2 className="font-semibold flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-600" /> Team
              </h2>
              <div className="space-y-3">
                {members.map(member => (
                  <div key={member._id} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center font-semibold overflow-hidden">
                      {member.student_id?.profile_image
                        ? <img src={member.student_id.profile_image} alt="" className="w-full h-full object-cover" />
                        : member.student_id?.name?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{member.student_id?.name}</p>
                      <p className="text-xs text-gray-500">{member.student_id?.enrollment_no}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5 space-y-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">Decision</h2>
              {hasSubmission ? (
                <>
                  <textarea
                    className="input w-full h-28 resize-none"
                    placeholder="Comment for team..."
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => review('accepted')} loading={saving} disabled={project.submission_status === 'accepted'}>
                      <CheckCircle className="w-4 h-4" /> Accept
                    </Button>
                    <Button variant="danger" onClick={() => review('rejected')} loading={saving} disabled={project.submission_status === 'rejected'}>
                      <XCircle className="w-4 h-4" /> Reject
                    </Button>
                  </div>
                  {project.submission_status !== 'submitted' && (
                    <p className="text-xs text-gray-500">Decision can be updated after review if needed.</p>
                  )}
                </>
              ) : (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Team has not submitted the final project yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReviewSubmission;

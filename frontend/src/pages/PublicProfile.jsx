import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { userAPI } from '../api';
import { DashboardLayout } from '../components/common/Layout';
import { Badge } from '../components/common';
import { ChevronLeft, Github, Linkedin, Mail, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';

const Field = ({ label, value }) => {
  if (!value && value !== 0) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{Array.isArray(value) ? value.join(', ') : value}</p>
    </div>
  );
};

const PublicProfile = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    userAPI.getPublicProfile(id)
      .then(res => setData(res.data.data))
      .catch(() => toast.error('Profile not found'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4 animate-pulse max-w-3xl">
          <div className="h-8 w-56 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="card h-72 bg-gray-200 dark:bg-gray-700" />
        </div>
      </DashboardLayout>
    );
  }

  if (!data) return <DashboardLayout><p className="text-red-500">Profile not found</p></DashboardLayout>;

  const { user, profile } = data;
  const image = user.profile_image || profile?.profile_image;

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-3xl">
        <Link to="/people" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-500">
          <ChevronLeft className="w-4 h-4" /> Back to People
        </Link>

        <div className="card p-6">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center text-2xl font-bold overflow-hidden flex-shrink-0">
              {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : <UserRound className="w-9 h-9" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{user.name}</h1>
                <Badge variant="default">{user.role}</Badge>
              </div>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <Mail className="w-4 h-4" /> {user.email}
              </p>
              <div className="flex gap-3 mt-3">
                {profile?.github_link && (
                  <a href={profile.github_link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                    <Github className="w-4 h-4" /> GitHub
                  </a>
                )}
                {profile?.linkedin_link && (
                  <a href={profile.linkedin_link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                    <Linkedin className="w-4 h-4" /> LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            {user.role === 'student' && (
              <>
                <Field label="Enrollment No" value={profile?.enrollment_no} />
                <Field label="Branch" value={profile?.branch} />
                <Field label="Semester" value={profile?.semester ? `Sem ${profile.semester}` : ''} />
                <Field label="Year" value={profile?.year ? `Year ${profile.year}` : ''} />
                <Field label="Session" value={profile?.session} />
                <Field label="Skills" value={profile?.skills} />
              </>
            )}

            {user.role === 'faculty' && (
              <>
                <Field label="Faculty ID" value={profile?.faculty_id} />
                <Field label="Department" value={profile?.department} />
                <Field label="Designation" value={profile?.designation} />
                <Field label="Qualification" value={profile?.qualification} />
                <Field label="Experience" value={profile?.experience_years ? `${profile.experience_years} years` : ''} />
                <Field label="Subjects" value={profile?.subjects} />
              </>
            )}

            {user.role === 'admin' && (
              <>
                <Field label="Employee ID" value={profile?.employee_id} />
                <Field label="Department" value={profile?.department} />
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PublicProfile;

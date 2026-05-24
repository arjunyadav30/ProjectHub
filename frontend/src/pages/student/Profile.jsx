import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../api';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, Input, Select, Textarea, TagInput } from '../../components/common';
import { ProgressBar } from '../../components/common';
import { BRANCHES, YEARS, SEMESTERS, GENDERS, getErrorMessage, profileCompletion } from '../../utils';
import { Camera, Github, Linkedin } from 'lucide-react';
import toast from 'react-hot-toast';

const ProfilePage = () => {
  const { user, profile, updateProfile, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    ...(profile || {}),
  });

  const completion = profileCompletion(profile, user?.role);

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await userAPI.updateMe(form);
      updateProfile(data.data.profile);
      updateUser({ name: form.name, phone: form.phone });
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('avatar', file);
    setAvatarLoading(true);
    try {
      const { data } = await userAPI.uploadAvatar(fd);
      updateUser({ profile_image: data.data.profile_image });
      toast.success('Avatar updated!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAvatarLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
          <p className="text-sm text-gray-500 mt-1">Keep your information up to date</p>
        </div>

        {/* Completion Bar */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Profile Completion</span>
            <span className="text-sm font-bold text-blue-600">{completion}%</span>
          </div>
          <ProgressBar percent={completion} />
          {completion < 100 && <p className="text-xs text-gray-500 mt-1">Complete your profile to get noticed</p>}
        </div>

        {/* Avatar */}
        <div className="card p-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                {user?.profile_image
                  ? <img src={user.profile_image} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="text-2xl font-bold text-blue-700">{user?.name?.[0]?.toUpperCase()}</span>
                }
              </div>
              <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-700 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-800 transition-colors">
                <Camera className="w-3.5 h-3.5 text-white" />
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </label>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{user?.name}</p>
              <p className="text-sm text-gray-500 capitalize">{user?.role} · {user?.email}</p>
              {avatarLoading && <p className="text-xs text-blue-600 mt-1">Uploading...</p>}
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <h2 className="font-semibold text-gray-900 dark:text-white">Personal Information</h2>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Full Name" value={form.name || ''} onChange={e => setField('name', e.target.value)} />
            <Input label="Phone" value={form.phone || ''} onChange={e => setField('phone', e.target.value)} />
          </div>

          <Input label="GitHub Profile" value={form.github_link || ''} onChange={e => setField('github_link', e.target.value)} placeholder="https://github.com/username" />
          <Input label="LinkedIn Profile" value={form.linkedin_link || ''} onChange={e => setField('linkedin_link', e.target.value)} placeholder="https://linkedin.com/in/username" />

          {user?.role === 'student' && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Select label="Year" value={form.year || ''} onChange={e => setField('year', e.target.value)}>
                  <option value="">Year</option>
                  {YEARS.map(y => <option key={y} value={y}>Year {y}</option>)}
                </Select>
                <Select label="Semester" value={form.semester || ''} onChange={e => setField('semester', e.target.value)}>
                  <option value="">Sem</option>
                  {SEMESTERS.map(s => <option key={s} value={s}>Sem {s}</option>)}
                </Select>
                <Select label="Branch" value={form.branch || ''} onChange={e => setField('branch', e.target.value)}>
                  <option value="">Branch</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select label="Gender" value={form.gender || ''} onChange={e => setField('gender', e.target.value)}>
                  <option value="">Select gender</option>
                  {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                </Select>
                <Input label="Date of Birth" type="date" value={form.dob ? form.dob.slice(0, 10) : ''} onChange={e => setField('dob', e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Skills</label>
                <TagInput value={form.skills || []} onChange={val => setField('skills', val)} placeholder="Type skill and press Enter..." />
                <p className="text-xs text-gray-400 mt-1">Press Enter or comma to add</p>
              </div>

              <Textarea label="Address" value={form.address || ''} onChange={e => setField('address', e.target.value)} placeholder="Your full address" />

              <div className="grid grid-cols-2 gap-4">
                <Input label="Guardian Name" value={form.guardian_name || ''} onChange={e => setField('guardian_name', e.target.value)} />
                <Input label="Guardian Phone" value={form.guardian_phone || ''} onChange={e => setField('guardian_phone', e.target.value)} />
              </div>
            </>
          )}

          {user?.role === 'faculty' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Department" value={form.department || ''} onChange={e => setField('department', e.target.value)} />
                <Input label="Designation" value={form.designation || ''} onChange={e => setField('designation', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Qualification" value={form.qualification || ''} onChange={e => setField('qualification', e.target.value)} placeholder="e.g. M.Tech, PhD" />
                <Input label="Experience (years)" type="number" value={form.experience_years || ''} onChange={e => setField('experience_years', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subjects</label>
                <TagInput value={form.subjects || []} onChange={val => setField('subjects', val)} placeholder="Add subjects..." />
              </div>
            </>
          )}

          <Button type="submit" loading={saving}>Save Changes</Button>

          {user?.role === 'student' && (
            <Button type="button" variant="secondary" onClick={async () => {
              try {
                const { jsPDF } = await import('jspdf');
                const apiMod = await import('../../api');
                const marksRes = await apiMod.default.get('/users/student/marks');
                const { data } = marksRes;
                const doc = new jsPDF();
                doc.setFontSize(18);
                doc.text('My Marks Report — ProjectHub', 14, 22);
                doc.setFontSize(11);
                doc.text(`Student: ${user.name}`, 14, 35);
                doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 42);
                let y = 55;
                (data?.data || []).forEach((m, i) => {
                  doc.setFontSize(12);
                  doc.text(`${i + 1}. ${m.marks_label || 'Presentation'} — ${m.event_id?.title || ''}`, 14, y);
                  y += 8;
                  doc.setFontSize(10);
                  doc.text(`   Marks: ${m.presentation_marks}/${m.marks_out_of}   Attendance: ${m.attendance}`, 14, y);
                  y += 12;
                  if (y > 270) { doc.addPage(); y = 20; }
                });
                doc.save('my-marks.pdf');
              } catch (e) { toast.error('Failed to generate PDF'); }
            }}>
              Download My Marks (PDF)
            </Button>
          )}
        </form>
      </div>
    </DashboardLayout>
  );
};

export default ProfilePage;

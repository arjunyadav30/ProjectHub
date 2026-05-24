import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Button, Input } from '../../components/common';
import { Eye, EyeOff, Lock, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils';

const BRANCHES = ['CSE', 'IT', 'ECE', 'ME', 'CE', 'EE'];
const SEMESTERS = [1,2,3,4,5,6,7,8];

const ChangePassword = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
    enrollment_no: '',
    branch: '',
    semester: '',
    year: '',
    session: '',
  });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (form.new_password !== form.confirm_password) return toast.error('Passwords do not match');
    if (form.new_password.length < 6) return toast.error('Password must be at least 6 characters');
    setSaving(true);
    try {
      await authAPI.changePassword({
        current_password: form.current_password,
        new_password: form.new_password,
      });

      // Also complete basic profile fields if provided
      if (form.enrollment_no || form.branch || form.semester) {
        await authAPI.completeProfile({
          enrollment_no: form.enrollment_no,
          branch: form.branch,
          semester: form.semester ? parseInt(form.semester) : undefined,
          year: form.year ? parseInt(form.year) : undefined,
          session: form.session,
        });
      }

      toast.success('Password changed successfully!');
      if (refreshUser) await refreshUser();
      navigate('/setup/complete-profile', { replace: true });
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Set Your Password</h1>
          <p className="text-gray-500 text-sm mt-2">
            Welcome, <strong>{user?.name}</strong>! Please change your temporary password to continue.
          </p>
        </div>

        <div className="space-y-4">
          {/* Current password */}
          <div className="relative">
            <Input
              label="Current (Temporary) Password"
              type={show.current ? 'text' : 'password'}
              value={form.current_password}
              onChange={e => setForm(f => ({...f, current_password: e.target.value}))}
            />
            <button type="button" onClick={() => setShow(s => ({...s, current: !s.current}))}
              className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600">
              {show.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* New password */}
          <div className="relative">
            <Input
              label="New Password"
              type={show.new ? 'text' : 'password'}
              value={form.new_password}
              onChange={e => setForm(f => ({...f, new_password: e.target.value}))}
            />
            <button type="button" onClick={() => setShow(s => ({...s, new: !s.new}))}
              className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600">
              {show.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Confirm password */}
          <div className="relative">
            <Input
              label="Confirm New Password"
              type={show.confirm ? 'text' : 'password'}
              value={form.confirm_password}
              onChange={e => setForm(f => ({...f, confirm_password: e.target.value}))}
            />
            <button type="button" onClick={() => setShow(s => ({...s, confirm: !s.confirm}))}
              className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600">
              {show.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Basic Profile Info</p>
            <div className="space-y-3">
              <Input label="Enrollment Number" value={form.enrollment_no} placeholder="e.g. 0201CS21001"
                onChange={e => setForm(f => ({...f, enrollment_no: e.target.value}))} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Branch</label>
                  <select className="input w-full" value={form.branch} onChange={e => setForm(f => ({...f, branch: e.target.value}))}>
                    <option value="">Select...</option>
                    {BRANCHES.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                  <select className="input w-full" value={form.semester} onChange={e => setForm(f => ({...f, semester: e.target.value}))}>
                    <option value="">Select...</option>
                    {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Year" type="number" min={1} max={4} value={form.year}
                  onChange={e => setForm(f => ({...f, year: e.target.value}))} />
                <Input label="Session" placeholder="2021-25" value={form.session}
                  onChange={e => setForm(f => ({...f, session: e.target.value}))} />
              </div>
            </div>
          </div>

          <Button className="w-full" onClick={handleSubmit} loading={saving}>
            Change Password & Continue
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;

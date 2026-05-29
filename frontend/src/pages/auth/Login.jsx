import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import { Button, Input } from '../../components/common';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isHackathonPortal = location.pathname.startsWith('/hackathonhub');
  const [loginType, setLoginType] = useState('email'); // 'email' | 'enrollment'
  const [form, setForm] = useState({ email: '', enrollment_no: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.password) return toast.error('Password is required');
    if (loginType === 'email' && !form.email) return toast.error('Email is required');
    if (loginType === 'enrollment' && !form.enrollment_no) return toast.error('Enrollment number is required');

    setLoading(true);
    try {
      const payload = loginType === 'enrollment'
        ? { enrollment_no: form.enrollment_no, password: form.password }
        : { email: form.email, password: form.password };

      const result = await login(payload, isHackathonPortal ? 'hackathonhub' : 'projecthub');
      toast.success(`Welcome back, ${result.user.name.split(' ')[0]}!`);

      // Role-based redirect
      if (result.user.role === 'hackathon_admin') {
        navigate('/hackathons/dashboard', { replace: true });
      } else if (result.user.role === 'hackathon_user') {
        navigate('/hackathons', { replace: true });
      } else if (result.user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else if (result.user.role === 'faculty') {
        navigate('/faculty/dashboard', { replace: true });
      } else {
        const isPasswordChanged = !!result.user.password_changed_at;
        const isProfileComplete = result.profile?.is_profile_complete || false;

        if (!isPasswordChanged) {
          navigate('/setup/change-password', { replace: true });
        } else if (!isProfileComplete) {
          navigate('/setup/complete-profile', { replace: true });
        } else {
          navigate('/student/dashboard', { replace: true });
        }
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome Back</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to ProjectHub</p>
        </div>

        <div className="card p-8">
          {!isHackathonPortal && (
          <div className="flex gap-1 mb-6 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            {[
              { id: 'email', label: 'Email' },
              { id: 'enrollment', label: 'Enrollment No' },
            ].map(t => (
              <button key={t.id} type="button" onClick={() => setLoginType(t.id)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  loginType === t.id
                    ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isHackathonPortal || loginType === 'email' ? (
              <Input label="Email" type="email" placeholder="you@college.edu"
                value={form.email} onChange={e => setField('email', e.target.value)} required />
            ) : (
              <Input label="Enrollment Number" placeholder="e.g. 0201CS21001"
                value={form.enrollment_no} onChange={e => setField('enrollment_no', e.target.value.toUpperCase())} required />
            )}

            <div className="relative">
              <Input label="Password" type={showPass ? 'text' : 'password'} placeholder="Your password"
                value={form.password} onChange={e => setField('password', e.target.value)} required />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">Forgot password?</Link>
            </div>

            <Button type="submit" className="w-full" loading={loading}>Sign In</Button>
          </form>

          <p className="text-sm text-center text-gray-600 dark:text-gray-400 mt-6">
            Don't have an account?{' '}
            <Link to={isHackathonPortal ? '/hackathonhub/signup' : '/projecthub/signup'} className="text-blue-600 font-medium hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

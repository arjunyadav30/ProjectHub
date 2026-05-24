import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../../api';
import { Button, Input } from '../../components/common';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [show, setShow] = useState({ pw: false, confirm: false });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error('Passwords do not match');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    if (!token) return toast.error('Invalid reset link');
    setLoading(true);
    try {
      await authAPI.resetPassword({ token, password: form.password });
      toast.success('Password reset! Please log in.');
      navigate('/login');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reset Password</h1>
          <p className="text-gray-500 text-sm mt-2">Enter your new password below</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Input
              label="New Password"
              type={show.pw ? 'text' : 'password'}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
            <button type="button" onClick={() => setShow(s => ({ ...s, pw: !s.pw }))}
              className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600">
              {show.pw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="relative">
            <Input
              label="Confirm Password"
              type={show.confirm ? 'text' : 'password'}
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              required
            />
            <button type="button" onClick={() => setShow(s => ({ ...s, confirm: !s.confirm }))}
              className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600">
              {show.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button type="submit" className="w-full" loading={loading}>Reset Password</Button>
          <p className="text-center text-sm text-gray-500">
            <Link to="/login" className="text-blue-600 hover:underline">Back to Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;

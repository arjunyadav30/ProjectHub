import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../../api';
import { Button, Input } from '../../components/common';
import { GraduationCap, Mail, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return toast.error('Enter your email');
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      setSent(true);
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forgot Password</h1>
          <p className="text-gray-500 text-sm mt-2">Enter your email to receive a reset link</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-9 h-9 text-green-600" />
            </div>
            <p className="text-gray-700 dark:text-gray-300">Check your inbox! If this email is registered, a password reset link has been sent.</p>
            <Link to="/login" className="block text-blue-600 hover:underline text-sm">Back to Login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <Button type="submit" className="w-full" loading={loading}>
              <Mail className="w-4 h-4" /> Send Reset Link
            </Button>
            <p className="text-center text-sm text-gray-500">
              <Link to="/login" className="text-blue-600 hover:underline">Back to Login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;

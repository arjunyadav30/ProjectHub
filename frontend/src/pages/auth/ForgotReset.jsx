import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../../api';
import { Button, Input } from '../../components/common';
import { GraduationCap, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      setSent(true);
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
        </div>
        <div className="card p-8">
          {sent ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Email Sent</h2>
              <p className="text-sm text-gray-500 mb-6">Check your inbox for a password reset link.</p>
              <Link to="/login" className="text-blue-600 text-sm font-medium hover:underline">Back to login</Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-1">Forgot Password</h2>
              <p className="text-sm text-gray-500 mb-6">Enter your email to receive a reset link.</p>
              <form onSubmit={onSubmit} className="space-y-4">
                <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@college.edu" required />
                <Button type="submit" className="w-full" loading={loading}>Send Reset Link</Button>
              </form>
              <p className="text-sm text-center mt-4">
                <Link to="/login" className="text-blue-600 hover:underline">Back to login</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      await authAPI.resetPassword({ token, password });
      toast.success('Password reset successfully. Please login.');
      navigate('/login');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md card p-8">
        <h2 className="text-xl font-semibold mb-6">Set New Password</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input label="New Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required />
          <Button type="submit" className="w-full" loading={loading}>Reset Password</Button>
        </form>
      </div>
    </div>
  );
};

export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying');
  const token = searchParams.get('token');

  useState(() => {
    if (token) {
      authAPI.verifyEmail(token)
        .then(() => setStatus('success'))
        .catch(() => setStatus('error'));
    } else {
      setStatus('error');
    }
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card p-8 text-center max-w-sm w-full">
        {status === 'verifying' && <p>Verifying your email...</p>}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="font-semibold text-lg mb-2">Email Verified!</h2>
            <Link to="/login" className="text-blue-600 hover:underline text-sm">Go to login</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <h2 className="font-semibold text-lg mb-2 text-red-600">Invalid Link</h2>
            <p className="text-sm text-gray-500">This link is expired or invalid.</p>
          </>
        )}
      </div>
    </div>
  );
};

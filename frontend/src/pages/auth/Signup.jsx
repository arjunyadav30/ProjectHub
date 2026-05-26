import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GraduationCap, BookOpen, Shield } from 'lucide-react';
import { Button, Input, Select } from '../../components/common';
import toast from 'react-hot-toast';
import { BRANCHES, getErrorMessage } from '../../utils';

const studentSchema = z.object({
  name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Min 6 characters'),
  phone: z.string().optional(),
  enrollment_no: z.string().min(3, 'Enrollment number required'),
  branch: z.string().min(1, 'Select branch'),
  college_code: z.string().min(2, 'College code required'),
});

const facultySchema = z.object({
  name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Min 6 characters'),
  phone: z.string().optional(),
  faculty_id: z.string().min(2, 'Faculty ID required'),
  department: z.string().min(1, 'Department required'),
  college_code: z.string().min(2, 'College code required'),
});

const adminSchema = z.object({
  name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Min 6 characters'),
  phone: z.string().optional(),
  college_name: z.string().min(2, 'College name required'),
  college_code: z.string().optional(),
});

const ROLES = [
  { value: 'student', label: 'Student', icon: GraduationCap },
  { value: 'faculty', label: 'Faculty', icon: BookOpen },
  { value: 'admin', label: 'Admin', icon: Shield },
];

const SignupPage = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('student');

  const schema = role === 'student' ? studentSchema : role === 'faculty' ? facultySchema : adminSchema;

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm({
    resolver: zodResolver(schema),
  });

  const handleRoleChange = (newRole) => { setRole(newRole); reset(); };

  const onSubmit = async (data) => {
    try {
      const result = await signup({ ...data, role });
      toast.success(`Welcome, ${result.user.name.split(' ')[0]}!`);
      // Redirect based on role
      if (role === 'admin') navigate('/admin/dashboard');
      else if (role === 'faculty') navigate('/faculty/dashboard');
      else navigate('/setup/change-password'); // student 2-step
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Account</h1>
          <p className="text-sm text-gray-500 mt-1">Join ProjectHub today</p>
        </div>

        <div className="card p-8">
          {/* Role Toggle */}
          <div className="grid grid-cols-3 gap-1 mb-6 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            {ROLES.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" onClick={() => handleRoleChange(value)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  role === value
                    ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
                }`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Full Name" placeholder="Your name" error={errors.name?.message} {...register('name')} />
            <Input label="Email" type="email" placeholder="you@college.edu" error={errors.email?.message} {...register('email')} />
            <Input label="Password" type="password" placeholder="Min 6 characters" error={errors.password?.message} {...register('password')} />
            <Input label="Phone" type="tel" placeholder="Optional" error={errors.phone?.message} {...register('phone')} />

            {role === 'student' && (
              <>
                <Input label="Enter College Code *" placeholder="e.g. CLG123456" error={errors.college_code?.message} {...register('college_code')} />
                <Input label="Enrollment Number *" placeholder="e.g. 0201CS21001" error={errors.enrollment_no?.message} {...register('enrollment_no')} />
                <Select label="Branch *" error={errors.branch?.message} {...register('branch')}>
                  <option value="">Select branch</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </Select>
              </>
            )}
            {role === 'faculty' && (
              <>
                <Input label="Enter College Code *" placeholder="e.g. CLG123456" error={errors.college_code?.message} {...register('college_code')} />
                <Input label="Faculty ID *" placeholder="e.g. FAC001" error={errors.faculty_id?.message} {...register('faculty_id')} />
                <Input label="Department *" placeholder="e.g. Computer Science" error={errors.department?.message} {...register('department')} />
              </>
            )}
            {role === 'admin' && (
              <>
                <Input label="College Name *" placeholder="e.g. ABC Engineering College" error={errors.college_name?.message} {...register('college_name')} />
                <Input label="College Code (Optional)" placeholder="Auto-generated if empty" error={errors.college_code?.message} {...register('college_code')} />
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3">
                  <p className="text-xs text-amber-700 dark:text-amber-400">Admin accounts have full system access. Make sure you have authorization.</p>
                </div>
              </>
            )}

            <Button type="submit" className="w-full" loading={isSubmitting}>Create Account</Button>
          </form>

          <p className="text-sm text-center text-gray-600 dark:text-gray-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

export const cn = (...inputs) => twMerge(clsx(inputs));

export const formatDate = (date) => {
  if (!date) return '—';
  return format(new Date(date), 'dd MMM yyyy');
};

export const formatDateTime = (date) => {
  if (!date) return '—';
  return format(new Date(date), 'dd MMM yyyy, hh:mm a');
};

export const timeAgo = (date) => {
  if (!date) return '';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

export const BRANCHES = ['CSE', 'IT', 'ECE', 'ME', 'CE', 'EE'];
export const YEARS = [1, 2, 3, 4];
export const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
export const GENDERS = ['Male', 'Female', 'Other'];

export const STATUS_COLORS = {
  pending: 'badge-pending',
  approved: 'badge-approved',
  rejected: 'badge-rejected',
  open: 'badge-open',
  closed: 'badge-closed',
  completed: 'badge-completed',
  draft: 'badge-closed',
  inprogress: 'badge-inprogress',
  not_started: 'badge-closed',
};

export const MODULE_STATUS_COLORS = {
  not_started: 'bg-gray-100 text-gray-600',
  inprogress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
};

export const getErrorMessage = (error) => {
  const data = error?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.join(', ');
  }
  return data?.message || error?.message || 'Something went wrong';
};

export const downloadCSV = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const profileCompletion = (profile, role) => {
  if (!profile) return 0;
  const studentFields = ['github_link', 'linkedin_link', 'phone', 'skills', 'branch', 'semester', 'year', 'dob', 'gender', 'address', 'guardian_name', 'guardian_phone'];
  const facultyFields = ['phone', 'department', 'designation', 'qualification', 'github_link', 'linkedin_link', 'experience_years', 'subjects'];
  const fields = role === 'student' ? studentFields : facultyFields;
  const filled = fields.filter(f => {
    const val = profile[f];
    return val && (Array.isArray(val) ? val.length > 0 : String(val).trim() !== '');
  }).length;
  return Math.round((filled / fields.length) * 100);
};

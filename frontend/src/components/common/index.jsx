import { forwardRef, useState } from 'react';
import { cn } from '../../utils';
import { X, Loader2 } from 'lucide-react';

// Button
export const Button = ({ children, variant = 'primary', size = 'md', loading, className, ...props }) => {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-blue-700 hover:bg-blue-800 text-white',
    secondary: 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white',
    ghost: 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400',
    success: 'bg-green-600 hover:bg-green-700 text-white',
  };
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-6 py-2.5 text-base' };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

// Input — forwardRef required for react-hook-form register()
export const Input = forwardRef(({ label, error, className, ...props }, ref) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
    <input ref={ref} className={cn('input', error && 'border-red-400 focus:ring-red-400', className)} {...props} />
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
));
Input.displayName = 'Input';

// Select — forwardRef required for react-hook-form register()
export const Select = forwardRef(({ label, error, children, className, ...props }, ref) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
    <select ref={ref} className={cn('input', error && 'border-red-400', className)} {...props}>{children}</select>
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
));
Select.displayName = 'Select';

// Textarea — forwardRef required for react-hook-form register()
export const Textarea = forwardRef(({ label, error, className, ...props }, ref) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
    <textarea ref={ref} className={cn('input min-h-[100px] resize-y', error && 'border-red-400', className)} {...props} />
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
));
Textarea.displayName = 'Textarea';

// Badge
export const Badge = ({ children, variant = 'default', className }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    open: 'bg-blue-100 text-blue-800',
    closed: 'bg-gray-100 text-gray-600',
    completed: 'bg-teal-100 text-teal-800',
    inprogress: 'bg-blue-100 text-blue-800',
    not_started: 'bg-gray-100 text-gray-600',
    draft: 'bg-yellow-100 text-yellow-800',
  };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize', variants[variant] || variants.default, className)}>
      {children}
    </span>
  );
};

// Skeleton
export const Skeleton = ({ className }) => (
  <div className={cn('skeleton-shimmer', className)} />
);

export const SkeletonCard = () => (
  <div className="card p-4 space-y-3">
    <Skeleton className="h-5 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-4 w-2/3" />
  </div>
);

// Modal
export const Modal = ({ open, onClose, title, children, size = 'md' }) => {
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative card w-full p-6 max-h-[90vh] overflow-y-auto', sizes[size])}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// Empty State
export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="text-center py-12">
    {Icon && <Icon className="w-12 h-12 text-gray-400 mx-auto mb-4" />}
    <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">{title}</h3>
    {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
    {action}
  </div>
);

// Progress Bar
export const ProgressBar = ({ percent, className }) => (
  <div className={cn('w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2', className)}>
    <div
      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
      style={{ width: `${Math.min(100, Math.max(0, percent || 0))}%` }}
    />
  </div>
);

// Stats Card
export const StatsCard = ({ label, value, icon: Icon, color = 'blue' }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/20',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/20',
    teal: 'bg-teal-50 text-teal-700 dark:bg-teal-900/20',
  };
  return (
    <div className="card p-4 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      {Icon && (
        <div className={cn('p-2.5 rounded-xl', colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
};

// Tag Input
export const TagInput = ({ value = [], onChange, placeholder }) => {
  const [input, setInput] = useState('');
  const addTag = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      if (!value.includes(input.trim())) onChange([...value, input.trim()]);
      setInput('');
    }
  };
  const removeTag = (tag) => onChange(value.filter(t => t !== tag));
  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-2 min-h-[42px] flex flex-wrap gap-2 focus-within:ring-2 focus-within:ring-blue-500 bg-white dark:bg-gray-800">
      {value.map(tag => (
        <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-sm">
          {tag}
          <button type="button" onClick={() => removeTag(tag)} className="hover:text-blue-600"><X className="w-3 h-3" /></button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={addTag}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[100px] outline-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
      />
    </div>
  );
};

// Multi-Select Dropdown
export const MultiSelect = ({ label, options, value = [], onChange, placeholder = 'Select...' }) => {
  const [open, setOpen] = useState(false);
  const toggle = (opt) => {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  };
  return (
    <div className="space-y-1 relative">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      <div className="input cursor-pointer min-h-[42px] flex flex-wrap gap-1 items-center" onClick={() => setOpen(!open)}>
        {value.length === 0
          ? <span className="text-gray-400 text-sm">{placeholder}</span>
          : value.map(v => (
            <span key={v} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">{v}</span>
          ))}
      </div>
      {open && (
        <div className="absolute z-20 w-full mt-1 card shadow-lg max-h-48 overflow-y-auto">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
              <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)} className="rounded" />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

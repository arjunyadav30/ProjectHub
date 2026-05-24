import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Button, Input } from '../../components/common';
import { UserCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils';

const CompleteProfile = () => {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    phone: '', dob: '', gender: '', address: '',
    guardian_name: '', guardian_phone: '',
    skills: [],
  });
  const [skillInput, setSkillInput] = useState('');
  const [saving, setSaving] = useState(false);

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !form.skills.includes(s)) {
      setForm(f => ({ ...f, skills: [...f.skills, s] }));
    }
    setSkillInput('');
  };

  const removeSkill = (s) => setForm(f => ({ ...f, skills: f.skills.filter(x => x !== s) }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await authAPI.completeProfile(form);
      toast.success('Profile completed!');
      if (refreshUser) await refreshUser();
      navigate('/student/dashboard', { replace: true });
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-green-100 dark:bg-green-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserCheck className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Complete Your Profile</h1>
          <p className="text-gray-500 text-sm mt-2">This step is optional and can be done later from your profile page.</p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
            <Input label="Date of Birth" type="date" value={form.dob} onChange={e => setForm(f => ({...f, dob: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender</label>
            <select className="input w-full" value={form.gender} onChange={e => setForm(f => ({...f, gender: e.target.value}))}>
              <option value="">Select...</option>
              <option>Male</option><option>Female</option><option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
            <textarea className="input w-full h-20 resize-none" value={form.address}
              onChange={e => setForm(f => ({...f, address: e.target.value}))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Guardian Name" value={form.guardian_name} onChange={e => setForm(f => ({...f, guardian_name: e.target.value}))} />
            <Input label="Guardian Phone" value={form.guardian_phone} onChange={e => setForm(f => ({...f, guardian_phone: e.target.value}))} />
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Skills</label>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="e.g. React, Python..."
                value={skillInput} onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} />
              <Button size="sm" variant="secondary" onClick={addSkill}>Add</Button>
            </div>
            {form.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.skills.map(s => (
                  <span key={s} className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-sm">
                    {s}
                    <button onClick={() => removeSkill(s)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => toast.error('Please complete verification first')}>
              Complete this step to continue
            </Button>
            <Button className="flex-1" onClick={handleSubmit} loading={saving}>
              Save Profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfile;

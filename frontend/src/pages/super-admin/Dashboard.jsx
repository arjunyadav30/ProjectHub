import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, Calendar, CreditCard, RefreshCw, Users, Users2 } from 'lucide-react';
import { superAdminAPI } from '../../api';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, Select, StatsCard } from '../../components/common';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import { getErrorMessage } from '../../utils';

const formatDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const statusClass = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  trial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  expired: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  inactive: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const SuperAdminDashboard = () => {
  const [data, setData] = useState({ summary: null, colleges: [] });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const loadDashboard = useCallback(() => {
    setLoading(true);
    superAdminAPI.getDashboard()
      .then((res) => {
        const payload = res.data.data;
        setData(payload);
        const nextDrafts = {};
        payload.colleges.forEach((college) => {
          nextDrafts[college._id] = {
            plan: college.subscription?.plan || 'monthly',
            status: college.subscription?.status || college.subscription_status || 'trial',
            expires_at: formatDateInput(college.subscription?.expires_at),
          };
        });
        setDrafts(nextDrafts);
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useRefetchOnFocus(loadDashboard);

  const summaryCards = useMemo(() => {
    const summary = data.summary || {};
    return [
      { label: 'Colleges', value: summary.colleges || 0, icon: Building2, color: 'blue' },
      { label: 'Students', value: summary.students || 0, icon: Users, color: 'green' },
      { label: 'Faculty', value: summary.faculty || 0, icon: Users2, color: 'teal' },
      { label: 'Teams', value: summary.teams || 0, icon: Calendar, color: 'amber' },
    ];
  }, [data.summary]);

  const updateDraft = (collegeId, field, value) => {
    setDrafts(prev => ({
      ...prev,
      [collegeId]: { ...prev[collegeId], [field]: value },
    }));
  };

  const saveSubscription = async (collegeId) => {
    const draft = drafts[collegeId];
    setSavingId(collegeId);
    try {
      await superAdminAPI.updateSubscription(collegeId, draft);
      toast.success('Subscription updated');
      loadDashboard();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Super Admin Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">All-college usage, subscriptions, and platform overview</p>
          </div>
          <Button variant="secondary" onClick={loadDashboard} loading={loading}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map(card => (
            <StatsCard
              key={card.label}
              label={card.label}
              value={loading ? '...' : card.value}
              icon={card.icon}
              color={card.color}
            />
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {['active', 'trial', 'expired'].map(status => (
            <div key={status} className="card p-4">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm capitalize">
                <CreditCard className="w-4 h-4" />
                {status} subscriptions
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {data.summary?.subscriptions?.[status] || 0}
              </p>
            </div>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Colleges and Usage Analytics</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">College</th>
                  <th className="text-left px-4 py-3 font-medium">Usage</th>
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Expires</th>
                  <th className="text-right px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.colleges.map((college) => {
                  const draft = drafts[college._id] || {};
                  return (
                    <tr key={college._id} className="align-top">
                      <td className="px-4 py-4 min-w-[220px]">
                        <p className="font-semibold text-gray-900 dark:text-white">{college.name}</p>
                        <p className="text-xs text-gray-500">Code: {college.code}</p>
                        <span className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${statusClass[college.subscription?.status || college.subscription_status] || statusClass.inactive}`}>
                          {college.subscription?.status || college.subscription_status || 'trial'}
                        </span>
                      </td>
                      <td className="px-4 py-4 min-w-[220px]">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <span className="text-gray-500">Students</span><span className="font-medium">{college.usage.students}</span>
                          <span className="text-gray-500">Faculty</span><span className="font-medium">{college.usage.faculty}</span>
                          <span className="text-gray-500">Admins</span><span className="font-medium">{college.usage.admins}</span>
                          <span className="text-gray-500">Events</span><span className="font-medium">{college.usage.events}</span>
                          <span className="text-gray-500">Teams</span><span className="font-medium">{college.usage.teams}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 min-w-[130px]">
                        <Select value={draft.plan || 'monthly'} onChange={e => updateDraft(college._id, 'plan', e.target.value)}>
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </Select>
                      </td>
                      <td className="px-4 py-4 min-w-[130px]">
                        <Select value={draft.status || 'trial'} onChange={e => updateDraft(college._id, 'status', e.target.value)}>
                          <option value="active">Active</option>
                          <option value="trial">Trial</option>
                          <option value="expired">Expired</option>
                          <option value="inactive">Inactive</option>
                        </Select>
                      </td>
                      <td className="px-4 py-4 min-w-[150px]">
                        <input
                          type="date"
                          className="input"
                          value={draft.expires_at || ''}
                          onChange={e => updateDraft(college._id, 'expires_at', e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => saveSubscription(college._id)}
                          loading={savingId === college._id}
                        >
                          Save
                        </Button>
                      </td>
                    </tr>
                  );
                })}

                {!loading && data.colleges.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-10 text-center text-gray-500">No colleges found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminDashboard;

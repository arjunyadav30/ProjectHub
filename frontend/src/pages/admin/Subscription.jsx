import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/common/Layout';
import { Button } from '../../components/common';
import { subscriptionAPI } from '../../api';
import toast from 'react-hot-toast';

const SubscriptionPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    subscriptionAPI.getStatus()
      .then((res) => setData(res.data.data))
      .catch(() => toast.error('Failed to load subscription'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const activate = async (plan) => {
    try {
      await subscriptionAPI.activate(plan);
      toast.success('Subscription activated');
      load();
    } catch {
      toast.error('Activation failed');
    }
  };

  const sub = data?.subscription;
  const pricing = data?.pricing || { monthly: 999, yearly: 8999 };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscription</h1>
        <div className="card p-5">
          {loading ? 'Loading...' : (
            <div className="space-y-2 text-sm text-gray-300">
              <p>Current plan: <span className="font-semibold text-white">{sub?.plan || 'trial'}</span></p>
              <p>Status: <span className="font-semibold text-white">{sub?.status}</span></p>
              <p>Expiry: <span className="font-semibold text-white">{sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString() : 'N/A'}</span></p>
            </div>
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-2">Monthly</h2>
            <p className="text-gray-300 mb-4">₹{pricing.monthly}/month</p>
            <Button onClick={() => activate('monthly')}>Activate Monthly</Button>
          </div>
          <div className="card p-5 border border-blue-500/50">
            <h2 className="font-semibold text-white mb-2">Yearly</h2>
            <p className="text-gray-300 mb-4">₹{pricing.yearly}/year</p>
            <Button onClick={() => activate('yearly')}>Activate Yearly</Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SubscriptionPage;

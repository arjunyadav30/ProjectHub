import { useEffect, useState } from 'react';
import { adminAPI } from '../../api';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, Input, Modal } from '../../components/common';
import { Upload, Globe, Image, Star, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils';

const AdminWebsite = () => {
  const [config, setConfig] = useState({ site_name: 'ProjectHub', logo_url: '', hero_image_url: '', featured_projects: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState('');
  const [heroPreview, setHeroPreview] = useState('');

  useEffect(() => {
    adminAPI.getWebsiteConfig()
      .then(res => {
        const data = res.data.data || {};
        setConfig(data);
        setLogoPreview(data.logo_url || '');
        setHeroPreview(data.hero_image_url || '');
      })
      .catch(() => toast.error('Failed to load config'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminAPI.updateWebsiteConfig({
        site_name: config.site_name,
        logo_url: logoPreview,
        hero_image_url: heroPreview,
      });
      toast.success('Website config updated!');
      setConfig(c => ({ ...c, logo_url: logoPreview, hero_image_url: heroPreview }));
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleUnfeature = async (teamId) => {
    if (!confirm('Remove this project from featured?')) return;
    try {
      await adminAPI.unfeatureProject(teamId);
      toast.success('Removed from featured');
      setConfig(c => ({
        ...c,
        featured_projects: c.featured_projects.filter(fp => fp.project_id?.toString() !== teamId),
      }));
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="card p-6 space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Website Management</h1>
          <p className="text-gray-500 text-sm mt-1">Customize homepage appearance</p>
        </div>

        {/* Site Name */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Site Settings</h2>
          </div>
          <Input
            label="Site Name"
            value={config.site_name}
            onChange={e => setConfig(c => ({ ...c, site_name: e.target.value }))}
            placeholder="ProjectHub"
          />
        </div>

        {/* Logo */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Image className="w-5 h-5 text-purple-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Logo</h2>
          </div>
          <Input
            label="Logo URL (Cloudinary)"
            value={logoPreview}
            onChange={e => setLogoPreview(e.target.value)}
            placeholder="https://res.cloudinary.com/..."
          />
          {logoPreview && (
            <div className="flex items-center gap-4">
              <img src={logoPreview} alt="logo preview" className="h-20 w-20 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-white p-1" />
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Preview</p>
                <button onClick={() => setLogoPreview('')} className="text-xs text-red-500 hover:underline mt-1">Remove</button>
              </div>
            </div>
          )}
        </div>

        {/* Hero Image */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Upload className="w-5 h-5 text-green-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Hero Background Image</h2>
          </div>
          <Input
            label="Hero Image URL (Cloudinary)"
            value={heroPreview}
            onChange={e => setHeroPreview(e.target.value)}
            placeholder="https://res.cloudinary.com/..."
          />
          {heroPreview && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview</p>
              <div className="relative rounded-xl overflow-hidden h-40 bg-gray-900">
                <img src={heroPreview} alt="hero preview" className="w-full h-full object-cover opacity-60" />
                <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                  {config.site_name}
                </div>
              </div>
              <button onClick={() => setHeroPreview('')} className="text-xs text-red-500 hover:underline mt-2">Remove</button>
            </div>
          )}
        </div>

        <Button onClick={handleSave} loading={saving} className="w-full">
          Save Changes
        </Button>

        {/* Featured Projects */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Currently Featured Projects</h2>
          </div>
          {!config.featured_projects?.length ? (
            <p className="text-gray-500 text-sm">No featured projects. Go to an event's team list to feature a project.</p>
          ) : (
            <div className="space-y-3">
              {config.featured_projects.map((fp, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{fp.title}</p>
                    {fp.deployed_link && (
                      <a href={fp.deployed_link} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline truncate block max-w-xs">
                        {fp.deployed_link}
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => handleUnfeature(fp.project_id)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminWebsite;

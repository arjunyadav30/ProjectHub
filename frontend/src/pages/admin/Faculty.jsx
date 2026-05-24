import { useEffect, useState, useRef } from 'react';
import { adminAPI } from '../../api';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, Input, Badge, Modal, ProgressBar } from '../../components/common';
import { Plus, Upload, Download, Trash2, Pencil, Search, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { getErrorMessage } from '../../utils';

const IMPORT_BATCH_SIZE = 25;

const AdminFaculty = () => {
  const [faculty, setFaculty] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', department: '', status: '' });
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFaculty, setEditFaculty] = useState(null);
  const [saving, setSaving] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [addForm, setAddForm] = useState({ name: '', email: '', faculty_id: '', department: '', designation: '', phone: '' });
  const fileInputRef = useRef();

  const fetchFaculty = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10, ...filters };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);
      const res = await adminAPI.getFaculty(params);
      setFaculty(res.data.data.faculty);
      setPagination(res.data.data.pagination);
    } catch (e) { toast.error('Failed to load faculty'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFaculty(); }, [page, filters]);

  const handleAdd = async () => {
    if (!addForm.name || !addForm.email) return toast.error('Name and email required');
    setSaving(true);
    try {
      await adminAPI.addFaculty(addForm);
      toast.success('Faculty added and credentials emailed');
      setShowAddModal(false);
      setAddForm({ name: '', email: '', faculty_id: '', department: '', designation: '', phone: '' });
      fetchFaculty();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data.filter(row => Object.values(row).some(value => String(value || '').trim()));
        if (rows.length === 0) return toast.error('CSV has no faculty rows');

        const summary = { created: 0, failed: 0, emailsSent: 0, emailsFailed: 0, emailErrors: [] };
        setImportProgress({
          status: 'importing',
          processed: 0,
          total: rows.length,
          ...summary,
        });

        try {
          for (let start = 0; start < rows.length; start += IMPORT_BATCH_SIZE) {
            const batch = rows.slice(start, start + IMPORT_BATCH_SIZE);
            const res = await adminAPI.bulkImportFaculty({ faculty: batch });
            const data = res.data.data;
            summary.created += data.created || 0;
            summary.failed += data.failed?.length || 0;
            summary.emailsSent += data.emailsSent || 0;
            summary.emailsFailed += data.emailsFailed || 0;
            summary.emailErrors.push(...(data.emailErrors || []));
            setImportProgress({
              status: 'importing',
              processed: Math.min(start + batch.length, rows.length),
              total: rows.length,
              ...summary,
            });
          }
          setImportProgress(prev => ({ ...prev, status: 'done' }));
          toast.success(`${summary.created} faculty imported, ${summary.emailsSent} emails sent`);
          if (summary.emailsFailed > 0) {
            const firstError = summary.emailErrors[0]?.reason;
            toast.error(`${summary.emailsFailed} credential emails failed${firstError ? `: ${firstError}` : ''}`);
          }
          if (summary.failed > 0) toast.error(`${summary.failed} failed`);
          fetchFaculty();
        } catch (e) {
          setImportProgress(prev => prev ? ({ ...prev, status: 'failed' }) : null);
          toast.error(getErrorMessage(e));
        }
      },
      error: () => toast.error('Failed to read CSV file'),
    });
    e.target.value = '';
  };

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this faculty?')) return;
    try {
      await adminAPI.deleteFaculty(id);
      toast.success('Faculty deactivated');
      fetchFaculty();
    } catch (e) { toast.error(getErrorMessage(e)); }
  };

  const handleEdit = async () => {
    setSaving(true);
    try {
      await adminAPI.updateFaculty(editFaculty._id, editFaculty);
      toast.success('Faculty updated');
      setShowEditModal(false);
      fetchFaculty();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  const downloadTemplate = async () => {
    try {
      const res = await adminAPI.downloadFacultyTemplate();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'faculty-template.csv'; a.click();
    } catch (e) { toast.error('Download failed'); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Faculty</h1>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={downloadTemplate}><FileDown className="w-4 h-4" /> Template</Button>
            <Button size="sm" variant="secondary" disabled={importProgress?.status === 'importing'} onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4" /> Import CSV</Button>
            <Button size="sm" onClick={() => setShowAddModal(true)}><Plus className="w-4 h-4" /> Add Faculty</Button>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9 w-56" placeholder="Search name/ID..." value={filters.search}
              onChange={e => { setFilters(f => ({...f, search: e.target.value})); setPage(1); }} />
          </div>
          <select className="input w-40" value={filters.status} onChange={e => { setFilters(f => ({...f, status: e.target.value})); setPage(1); }}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-left">
                <tr>
                  {['Faculty ID', 'Name', 'Email', 'Department', 'Designation', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td></tr>
                  ))
                ) : faculty.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No faculty found</td></tr>
                ) : faculty.map(f => (
                  <tr key={f._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-mono font-medium text-purple-600 dark:text-purple-400">{f.faculty_id}</td>
                    <td className="px-4 py-3 font-medium">{f.name}</td>
                    <td className="px-4 py-3 text-gray-500">{f.email}</td>
                    <td className="px-4 py-3">{f.department || '—'}</td>
                    <td className="px-4 py-3">{f.designation || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={f.status === 'active' ? 'approved' : 'rejected'}>{f.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditFaculty({...f}); setShowEditModal(true); }}
                          className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-blue-600">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(f._id)}
                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500">Total: {pagination.total}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(p => p-1)}>Previous</Button>
                <Button size="sm" variant="secondary" disabled={page >= pagination.pages} onClick={() => setPage(p => p+1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      <Modal open={Boolean(importProgress)} onClose={() => importProgress?.status !== 'importing' && setImportProgress(null)} title="Import Faculty">
        {importProgress && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {importProgress.status === 'done' ? 'Import complete' : importProgress.status === 'failed' ? 'Import stopped' : 'Importing faculty...'}
                </span>
                <span className="text-gray-500">{importProgress.processed}/{importProgress.total}</span>
              </div>
              <ProgressBar percent={(importProgress.processed / importProgress.total) * 100} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                <p className="text-gray-500">Created</p>
                <p className="text-xl font-semibold">{importProgress.created}</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                <p className="text-gray-500">Failed</p>
                <p className="text-xl font-semibold">{importProgress.failed}</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                <p className="text-gray-500">Emails sent</p>
                <p className="text-xl font-semibold">{importProgress.emailsSent}</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                <p className="text-gray-500">Email failed</p>
                <p className="text-xl font-semibold">{importProgress.emailsFailed}</p>
              </div>
            </div>
            {importProgress.status !== 'importing' && (
              <Button onClick={() => setImportProgress(null)}>Close</Button>
            )}
          </div>
        )}
      </Modal>

      {/* Add Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Faculty">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name *" value={addForm.name} onChange={e => setAddForm(f=>({...f,name:e.target.value}))} />
            <Input label="Email *" type="email" value={addForm.email} onChange={e => setAddForm(f=>({...f,email:e.target.value}))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Faculty ID" value={addForm.faculty_id} placeholder="FAC001" onChange={e => setAddForm(f=>({...f,faculty_id:e.target.value}))} />
            <Input label="Phone" value={addForm.phone} onChange={e => setAddForm(f=>({...f,phone:e.target.value}))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Department" value={addForm.department} onChange={e => setAddForm(f=>({...f,department:e.target.value}))} />
            <Input label="Designation" value={addForm.designation} placeholder="Asst. Professor" onChange={e => setAddForm(f=>({...f,designation:e.target.value}))} />
          </div>
          <p className="text-xs text-gray-500">A temporary password will be auto-generated and emailed.</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAdd} loading={saving}>Add Faculty</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      {editFaculty && (
        <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Faculty">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Name" value={editFaculty.name} onChange={e => setEditFaculty(f=>({...f,name:e.target.value}))} />
              <Input label="Faculty ID" value={editFaculty.faculty_id} onChange={e => setEditFaculty(f=>({...f,faculty_id:e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Department" value={editFaculty.department} onChange={e => setEditFaculty(f=>({...f,department:e.target.value}))} />
              <Input label="Designation" value={editFaculty.designation} onChange={e => setEditFaculty(f=>({...f,designation:e.target.value}))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select className="input w-full" value={editFaculty.status} onChange={e => setEditFaculty(f=>({...f,status:e.target.value}))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
              <Button onClick={handleEdit} loading={saving}>Save Changes</Button>
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
};

export default AdminFaculty;

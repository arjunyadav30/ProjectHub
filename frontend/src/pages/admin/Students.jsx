import { useEffect, useState, useRef } from 'react';
import { adminAPI } from '../../api';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, Input, Select, Badge, Modal, ProgressBar } from '../../components/common';
import { Plus, Upload, Download, Trash2, Pencil, Search, TrendingUp, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { getErrorMessage } from '../../utils';

const BRANCHES = ['CSE', 'IT', 'ECE', 'ME', 'CE', 'EE'];
const SEMESTERS = [1,2,3,4,5,6,7,8];
const IMPORT_BATCH_SIZE = 25;

const AdminStudents = () => {
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ branch: '', semester: '', status: '', search: '' });
  const [page, setPage] = useState(1);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [importProgress, setImportProgress] = useState(null);

  // Promote
  const [promoteFrom, setPromoteFrom] = useState('');
  const [promoteTo, setPromoteTo] = useState('');

  // Add form
  const [addForm, setAddForm] = useState({ name: '', email: '', enrollment_no: '', branch: '', semester: '', year: '', session: '', phone: '' });

  const fileInputRef = useRef();

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10, ...filters };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);
      const res = await adminAPI.getStudents(params);
      setStudents(res.data.data.students);
      setPagination(res.data.data.pagination);
    } catch (e) { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStudents(); }, [page, filters]);

  const handleAdd = async () => {
    if (!addForm.name || !addForm.email || !addForm.enrollment_no) {
      toast.error('Name, email, and enrollment number are required');
      return;
    }
    setSaving(true);
    try {
      await adminAPI.addStudent(addForm);
      toast.success('Student added and credentials emailed');
      setShowAddModal(false);
      setAddForm({ name: '', email: '', enrollment_no: '', branch: '', semester: '', year: '', session: '', phone: '' });
      fetchStudents();
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
        if (rows.length === 0) return toast.error('CSV has no student rows');

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
            const res = await adminAPI.bulkImportStudents({ students: batch });
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
          toast.success(`${summary.created} students imported, ${summary.emailsSent} emails sent`);
          if (summary.emailsFailed > 0) {
            const firstError = summary.emailErrors[0]?.reason;
            toast.error(`${summary.emailsFailed} credential emails failed${firstError ? `: ${firstError}` : ''}`);
          }
          if (summary.failed > 0) toast.error(`${summary.failed} failed`);
          fetchStudents();
        } catch (e) {
          setImportProgress(prev => prev ? ({ ...prev, status: 'failed' }) : null);
          toast.error(getErrorMessage(e));
        }
      },
      error: () => toast.error('Failed to read CSV file'),
    });
    e.target.value = '';
  };

  const handlePromote = async () => {
    if (!promoteFrom || !promoteTo) return toast.error('Select both semesters');
    setSaving(true);
    try {
      const res = await adminAPI.promoteStudents({ from_semester: parseInt(promoteFrom), to_semester: parseInt(promoteTo) });
      toast.success(`${res.data.data.modified} students promoted`);
      setShowPromoteModal(false);
      fetchStudents();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this student?')) return;
    try {
      await adminAPI.deleteStudent(id);
      toast.success('Student deactivated');
      fetchStudents();
    } catch (e) { toast.error(getErrorMessage(e)); }
  };

  const handleEdit = async () => {
    setSaving(true);
    try {
      await adminAPI.updateStudent(editStudent._id, editStudent);
      toast.success('Student updated');
      setShowEditModal(false);
      fetchStudents();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  const handleExport = async () => {
    try {
      const params = {};
      if (filters.branch) params.branch = filters.branch;
      if (filters.semester) params.semester = filters.semester;
      const res = await adminAPI.exportStudents(params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'students.csv'; a.click();
    } catch (e) { toast.error('Export failed'); }
  };

  const downloadTemplate = async () => {
    try {
      const res = await adminAPI.downloadStudentTemplate();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'student-template.csv'; a.click();
    } catch (e) { toast.error('Download failed'); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Students</h1>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={downloadTemplate}><FileDown className="w-4 h-4" /> Template</Button>
            <Button size="sm" variant="secondary" onClick={handleExport}><Download className="w-4 h-4" /> Export</Button>
            <Button size="sm" variant="secondary" disabled={importProgress?.status === 'importing'} onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4" /> Import CSV</Button>
            <Button size="sm" variant="secondary" onClick={() => setShowPromoteModal(true)}><TrendingUp className="w-4 h-4" /> Promote</Button>
            <Button size="sm" onClick={() => setShowAddModal(true)}><Plus className="w-4 h-4" /> Add Student</Button>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9 w-48"
              placeholder="Search name/enrollment..."
              value={filters.search}
              onChange={e => { setFilters(f => ({...f, search: e.target.value})); setPage(1); }}
            />
          </div>
          <select className="input w-32" value={filters.branch} onChange={e => { setFilters(f => ({...f, branch: e.target.value})); setPage(1); }}>
            <option value="">All Branches</option>
            {BRANCHES.map(b => <option key={b}>{b}</option>)}
          </select>
          <select className="input w-36" value={filters.semester} onChange={e => { setFilters(f => ({...f, semester: e.target.value})); setPage(1); }}>
            <option value="">All Semesters</option>
            {SEMESTERS.map(s => <option key={s} value={s}>Sem {s}</option>)}
          </select>
          <select className="input w-32" value={filters.status} onChange={e => { setFilters(f => ({...f, status: e.target.value})); setPage(1); }}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-left">
                <tr>
                  {['Enrollment No', 'Name', 'Email', 'Branch', 'Semester', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td></tr>
                  ))
                ) : students.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No students found</td></tr>
                ) : students.map(s => (
                  <tr key={s._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-mono font-medium text-blue-600 dark:text-blue-400">{s.enrollment_no}</td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500">{s.email}</td>
                    <td className="px-4 py-3">{s.branch || '—'}</td>
                    <td className="px-4 py-3">{s.semester ? `Sem ${s.semester}` : '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={s.status === 'active' ? 'approved' : 'rejected'}>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditStudent({...s}); setShowEditModal(true); }}
                          className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-blue-600 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(s._id)}
                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500">Showing {((page-1)*10)+1}–{Math.min(page*10, pagination.total)} of {pagination.total}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(p => p-1)}>Previous</Button>
                <Button size="sm" variant="secondary" disabled={page >= pagination.pages} onClick={() => setPage(p => p+1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      <Modal open={Boolean(importProgress)} onClose={() => importProgress?.status !== 'importing' && setImportProgress(null)} title="Import Students">
        {importProgress && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {importProgress.status === 'done' ? 'Import complete' : importProgress.status === 'failed' ? 'Import stopped' : 'Importing students...'}
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
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Student">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name *" value={addForm.name} onChange={e => setAddForm(f=>({...f,name:e.target.value}))} />
            <Input label="Email *" type="email" value={addForm.email} onChange={e => setAddForm(f=>({...f,email:e.target.value}))} />
          </div>
          <Input label="Enrollment No *" value={addForm.enrollment_no} onChange={e => setAddForm(f=>({...f,enrollment_no:e.target.value}))} placeholder="e.g. 0201CS21001" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Branch</label>
              <select className="input w-full" value={addForm.branch} onChange={e => setAddForm(f=>({...f,branch:e.target.value}))}>
                <option value="">Select...</option>
                {BRANCHES.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
              <select className="input w-full" value={addForm.semester} onChange={e => setAddForm(f=>({...f,semester:e.target.value}))}>
                <option value="">Select...</option>
                {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Year" type="number" min={1} max={4} value={addForm.year || ''} onChange={e => setAddForm(f=>({...f,year:e.target.value}))} />
            <Input label="Session" value={addForm.session} placeholder="2021-25" onChange={e => setAddForm(f=>({...f,session:e.target.value}))} />
          </div>
          <Input label="Phone" value={addForm.phone} onChange={e => setAddForm(f=>({...f,phone:e.target.value}))} />
          <p className="text-xs text-gray-500">A temporary password will be auto-generated and emailed to the student.</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAdd} loading={saving}>Add Student</Button>
          </div>
        </div>
      </Modal>

      {/* Promote Modal */}
      <Modal open={showPromoteModal} onClose={() => setShowPromoteModal(false)} title="Semester Promotion">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">This will promote all active students from one semester to another.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">From Semester</label>
              <select className="input w-full" value={promoteFrom} onChange={e => setPromoteFrom(e.target.value)}>
                <option value="">Select...</option>
                {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">To Semester</label>
              <select className="input w-full" value={promoteTo} onChange={e => setPromoteTo(e.target.value)}>
                <option value="">Select...</option>
                {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowPromoteModal(false)}>Cancel</Button>
            <Button variant="warning" onClick={handlePromote} loading={saving}>Promote All Students</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      {editStudent && (
        <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Student">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Name" value={editStudent.name} onChange={e => setEditStudent(s=>({...s,name:e.target.value}))} />
              <Input label="Enrollment No" value={editStudent.enrollment_no} onChange={e => setEditStudent(s=>({...s,enrollment_no:e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Branch</label>
                <select className="input w-full" value={editStudent.branch} onChange={e => setEditStudent(s=>({...s,branch:e.target.value}))}>
                  <option value="">Select...</option>
                  {BRANCHES.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Semester</label>
                <select className="input w-full" value={editStudent.semester} onChange={e => setEditStudent(s=>({...s,semester:parseInt(e.target.value)}))}>
                  <option value="">Select...</option>
                  {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Year" type="number" value={editStudent.year || ''} onChange={e => setEditStudent(s=>({...s,year:parseInt(e.target.value) || ''}))} />
              <Input label="Session" value={editStudent.session || ''} onChange={e => setEditStudent(s=>({...s,session:e.target.value}))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select className="input w-full" value={editStudent.status} onChange={e => setEditStudent(s=>({...s,status:e.target.value}))}>
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

export default AdminStudents;

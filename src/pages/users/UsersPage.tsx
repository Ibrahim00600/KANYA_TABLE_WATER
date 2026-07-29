import { useEffect, useState, useCallback } from 'react';
import { Plus, Users, Search, ToggleLeft, ToggleRight, UserPlus, Pencil, Trash2, Eye, Upload, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types';
import { Button, Input, Select, Modal, Badge, AvatarCircle, EmptyState, Spinner, Alert } from '@/components/ui';
import { formatDate, formatDateTime, ROLE_LABEL, ROLE_COLOR } from '@/lib/utils';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'sales_officer', label: 'Sales Officer' },
  { value: 'delivery', label: 'Delivery Driver' },
  { value: 'operator', label: 'Operator' },
  { value: 'customer', label: 'Customer' },
];

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || 'https://hfvhiirrmfpnukynwody.supabase.co') as string;
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmdmhpaXJybWZwbnVreW53b2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMzIzNDMsImV4cCI6MjEwMDcwODM0M30.PE7u_FC_jL92aRqSkNRJOOb4-nqQjoT9niWsXmCiomI') as string;

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '', role: 'customer' as UserRole });

  // View modal
  const [viewUser, setViewUser] = useState<Profile | null>(null);

  // Edit modal
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', role: 'customer' as UserRole });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirmation
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // File upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNote, setUploadNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploadError, setUploadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // --- Create user ---
  async function createUser() {
    if (!form.email || !form.password || !form.full_name) { setError('Email, password, and name are required.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setSaving(true); setError('');
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const tempClient = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
      const { data: authData, error: signUpErr } = await tempClient.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.full_name, phone: form.phone, role: form.role } },
      });
      if (signUpErr) { setError(signUpErr.message); return; }
      if (authData.user) {
        await supabase.from('profiles').upsert({ id: authData.user.id, full_name: form.full_name, phone: form.phone, role: form.role });
      }
      setSuccess(`User "${form.full_name}" created successfully!`);
      setShowCreate(false);
      setForm({ email: '', password: '', full_name: '', phone: '', role: 'customer' });
      setTimeout(() => setSuccess(''), 4000);
      load();
    } catch (err: any) {
      setError(err?.message || 'Failed to create user.');
    } finally { setSaving(false); }
  }

  // --- Edit user ---
  function openEdit(user: Profile) {
    setEditUser(user);
    setEditForm({ full_name: user.full_name, phone: user.phone, role: user.role });
    setEditError('');
  }

  async function saveEdit() {
    if (!editUser) return;
    if (!editForm.full_name.trim()) { setEditError('Full name is required.'); return; }
    setEditSaving(true); setEditError('');
    const { error: err } = await supabase.from('profiles').update({
      full_name: editForm.full_name.trim(),
      phone: editForm.phone.trim(),
      role: editForm.role,
      updated_at: new Date().toISOString(),
    }).eq('id', editUser.id);
    setEditSaving(false);
    if (err) { setEditError(err.message); return; }
    setSuccess(`User "${editForm.full_name}" updated successfully!`);
    setEditUser(null);
    setTimeout(() => setSuccess(''), 4000);
    load();
  }

  // --- Toggle active ---
  async function toggleActive(user: Profile) {
    await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id);
    load();
  }

  // --- Delete user ---
  async function confirmDelete() {
    if (!deleteUser) return;
    setDeleting(true);
    await supabase.from('profiles').delete().eq('id', deleteUser.id);
    setDeleting(false);
    setDeleteUser(null);
    setSuccess('User deleted.');
    setTimeout(() => setSuccess(''), 3000);
    load();
  }

  // --- File upload ---
  async function handleUpload() {
    if (!uploadFile) { setUploadError('Please select a file.'); return; }
    setUploading(true); setUploadError('');
    try {
      const ext = uploadFile.name.split('.').pop();
      const fileName = `manual_records/${Date.now()}_${uploadFile.name}`;
      const { error: upErr } = await supabase.storage.from('uploads').upload(fileName, uploadFile, { upsert: true });
      if (upErr) {
        // If storage not configured, just save metadata
        await supabase.from('messages').insert({
          sender_id: null,
          recipient_id: null,
          is_broadcast: true,
          subject: `📎 Manual Record Upload: ${uploadFile.name}`,
          body: uploadNote || `File uploaded: ${uploadFile.name} (${(uploadFile.size / 1024).toFixed(1)} KB)`,
        });
      } else {
        await supabase.from('messages').insert({
          sender_id: null,
          recipient_id: null,
          is_broadcast: true,
          subject: `📎 Manual Record Upload: ${uploadFile.name}`,
          body: uploadNote || `File: ${fileName} (${(uploadFile.size / 1024).toFixed(1)} KB)`,
        });
      }
      setUploadSuccess(`"${uploadFile.name}" uploaded successfully!`);
      setUploadFile(null);
      setUploadNote('');
      setTimeout(() => { setUploadSuccess(''); setShowUpload(false); }, 2500);
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed.');
    } finally { setUploading(false); }
  }

  const filtered = users.filter(u => {
    const matchSearch = !search || u.full_name.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleCounts = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage all staff and customer accounts</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" icon={<Upload className="w-4 h-4" />} onClick={() => { setShowUpload(true); setUploadError(''); setUploadSuccess(''); }}>
            Upload Record
          </Button>
          <Button icon={<UserPlus className="w-4 h-4" />} onClick={() => { setShowCreate(true); setError(''); }}>
            Add User
          </Button>
        </div>
      </div>

      {success && <Alert type="success">{success}</Alert>}

      {/* Role counts */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {ROLE_OPTIONS.map(r => (
          <div key={r.value} className="card px-4 py-3 text-center">
            <p className="text-2xl font-display font-bold text-gray-900 dark:text-white">{roleCounts[r.value] ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">{r.label}</p>
          </div>
        ))}
      </div>

      {/* Search / filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} leftIcon={<Search className="w-4 h-4" />} className="sm:max-w-xs" />
        <Select options={ROLE_OPTIONS} placeholder="All Roles" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="sm:max-w-xs" />
      </div>

      {/* Table */}
      <div className="table-container">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner className="w-7 h-7" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users className="w-8 h-8" />} title="No users found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <AvatarCircle name={user.full_name || 'User'} size="sm" />
                        <span className="font-medium">{user.full_name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="text-gray-500">{user.phone || '—'}</td>
                    <td>
                      <Badge className={ROLE_COLOR[user.role] ?? 'bg-gray-100 text-gray-600'}>
                        {ROLE_LABEL[user.role] ?? user.role}
                      </Badge>
                    </td>
                    <td className="text-gray-400 text-xs">{formatDate(user.created_at)}</td>
                    <td>
                      <Badge className={user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {/* View */}
                        <button title="View" onClick={() => setViewUser(user)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Edit */}
                        <button title="Edit" onClick={() => openEdit(user)} className="p-1.5 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-yellow-500 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        {/* Toggle active */}
                        <button title={user.is_active ? 'Deactivate' : 'Activate'} onClick={() => toggleActive(user)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors">
                          {user.is_active ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                        </button>
                        {/* Delete */}
                        <button title="Delete" onClick={() => setDeleteUser(user)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== CREATE USER MODAL ===== */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add New User" size="md">
        <div className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          <Input label="Full Name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. Emeka Okafor" required />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="emeka@example.com" required />
          <Input label="Phone" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="08012345678" />
          <Input label="Password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimum 6 characters" required />
          <Select label="Role" options={ROLE_OPTIONS} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)} className="flex-1">Cancel</Button>
            <Button onClick={createUser} loading={saving} className="flex-1" icon={<Plus className="w-4 h-4" />}>Create User</Button>
          </div>
        </div>
      </Modal>

      {/* ===== VIEW USER MODAL ===== */}
      <Modal open={!!viewUser} onClose={() => setViewUser(null)} title="User Details" size="md">
        {viewUser && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
              <AvatarCircle name={viewUser.full_name || 'User'} size="lg" />
              <div className="text-center">
                <p className="font-display font-bold text-lg text-gray-900 dark:text-white">{viewUser.full_name}</p>
                <Badge className={`${ROLE_COLOR[viewUser.role] ?? 'bg-gray-100 text-gray-600'} mt-1`}>{ROLE_LABEL[viewUser.role] ?? viewUser.role}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Phone', value: viewUser.phone || '—' },
                { label: 'Status', value: viewUser.is_active ? 'Active' : 'Inactive' },
                { label: 'Joined', value: formatDate(viewUser.created_at) },
                { label: 'Last Updated', value: formatDateTime(viewUser.updated_at) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setViewUser(null)}>Close</Button>
              <Button className="flex-1" icon={<Pencil className="w-4 h-4" />} onClick={() => { setViewUser(null); openEdit(viewUser); }}>Edit User</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== EDIT USER MODAL ===== */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User" size="md">
        {editUser && (
          <div className="space-y-4">
            {editError && <Alert type="error">{editError}</Alert>}
            <Input label="Full Name" value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Full name" required />
            <Input label="Phone" type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="08012345678" />
            <Select label="Role" options={ROLE_OPTIONS} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value as UserRole }))} />
            <p className="text-xs text-gray-400">Note: Email and password changes must be done from Supabase Auth dashboard.</p>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button className="flex-1" loading={editSaving} icon={<Pencil className="w-4 h-4" />} onClick={saveEdit}>Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== DELETE CONFIRM MODAL ===== */}
      <Modal open={!!deleteUser} onClose={() => setDeleteUser(null)} title="Delete User" size="sm">
        {deleteUser && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete <span className="font-bold text-gray-900 dark:text-white">{deleteUser.full_name}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setDeleteUser(null)}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" loading={deleting} icon={<Trash2 className="w-4 h-4" />} onClick={confirmDelete}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== UPLOAD MANUAL RECORD MODAL ===== */}
      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="📂 Upload Manual Record" size="md">
        <div className="space-y-4">
          {uploadError && <Alert type="error">{uploadError}</Alert>}
          {uploadSuccess && <Alert type="success">{uploadSuccess}</Alert>}
          <p className="text-sm text-gray-500 dark:text-gray-400">Upload a photo, scan, or document of manually recorded data (book records, receipts, etc.)</p>

          {/* File input area */}
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-brand-300 dark:border-brand-700 rounded-2xl p-8 cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors">
            <input
              type="file"
              accept="image/*,application/pdf,.xlsx,.xls,.csv,.doc,.docx"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setUploadFile(f); }}
            />
            <Upload className="w-10 h-10 text-brand-400 mb-3" />
            {uploadFile ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">{uploadFile.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{(uploadFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Click to browse or take photo</p>
                <p className="text-xs text-gray-400 mt-1">Images, PDF, Excel, Word supported</p>
              </div>
            )}
          </label>

          {uploadFile && (
            <button onClick={() => setUploadFile(null)} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
              <X className="w-3 h-3" /> Remove file
            </button>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note / Description (optional)</label>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="e.g. Monthly sales record — July 2026..."
              value={uploadNote}
              onChange={e => setUploadNote(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button className="flex-1" loading={uploading} icon={<Upload className="w-4 h-4" />} onClick={handleUpload}>Upload Record</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

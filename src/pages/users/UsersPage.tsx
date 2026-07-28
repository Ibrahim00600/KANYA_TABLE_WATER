import { useEffect, useState, useCallback } from 'react';
import { Plus, Users, Search, ToggleLeft, ToggleRight, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types';
import { Button, Input, Select, Modal, Badge, AvatarCircle, EmptyState, Spinner, StatCard, Alert } from '@/components/ui';
import { formatDate, ROLE_LABEL, ROLE_COLOR } from '@/lib/utils';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'sales_officer', label: 'Sales Officer' },
  { value: 'delivery', label: 'Delivery Driver' },
  { value: 'customer', label: 'Customer' },
];

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', phone: '', role: 'customer' as UserRole,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createUser() {
    if (!form.email || !form.password || !form.full_name) { setError('Email, password, and name are required.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setSaving(true);
    setError('');

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const url = (import.meta.env.VITE_SUPABASE_URL || 'https://hfvhiirrmfpnukynwody.supabase.co') as string;
      const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmdmhpaXJybWZwbnVreW53b2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMzIzNDMsImV4cCI6MjEwMDcwODM0M30.PE7u_FC_jL92aRqSkNRJOOb4-nqQjoT9niWsXmCiomI') as string;
      const tempClient = createClient(url, key, { auth: { persistSession: false } });

      const { data: authData, error: signUpErr } = await tempClient.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.full_name, phone: form.phone, role: form.role } },
      });

      if (signUpErr) { setError(signUpErr.message); return; }

      if (authData.user) {
        await supabase.from('profiles').upsert({
          id: authData.user.id,
          full_name: form.full_name,
          phone: form.phone,
          role: form.role,
        });
      }

      setSuccess(`User "${form.full_name}" created successfully!`);
      setShowModal(false);
      setForm({ email: '', password: '', full_name: '', phone: '', role: 'customer' });
      setTimeout(() => setSuccess(''), 4000);
      load();
    } catch (err: any) {
      setError(err?.message || 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: Profile) {
    await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id);
    load();
  }

  async function updateRole(userId: string, role: UserRole) {
    await supabase.from('profiles').update({ role }).eq('id', userId);
    load();
  }

  const filtered = users.filter(u => {
    const matchSearch = !search || u.full_name.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage all staff and customer accounts</p>
        </div>
        <Button icon={<UserPlus className="w-4 h-4" />} onClick={() => { setShowModal(true); setError(''); }}>
          Add User
        </Button>
      </div>

      {success && <Alert type="success">{success}</Alert>}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {ROLE_OPTIONS.map(r => (
          <div key={r.value} className="card px-4 py-3 text-center">
            <p className="text-2xl font-display font-bold text-gray-900 dark:text-white">{roleCounts[r.value] ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">{r.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className="sm:max-w-xs"
        />
        <Select
          options={ROLE_OPTIONS}
          placeholder="All Roles"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>

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
                      <select
                        className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        value={user.role}
                        onChange={e => updateRole(user.id, e.target.value as UserRole)}
                      >
                        {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </td>
                    <td className="text-gray-400 text-xs">{formatDate(user.created_at)}</td>
                    <td>
                      <Badge className={user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <button onClick={() => toggleActive(user)} className="btn btn-ghost btn-sm">
                        {user.is_active ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add New User" size="md">
        <div className="space-y-4">
          {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</div>}
          <Input label="Full Name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. Emeka Okafor" required />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="emeka@example.com" required />
          <Input label="Phone" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="08012345678" />
          <Input label="Password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimum 8 characters" required />
          <Select label="Role" options={ROLE_OPTIONS} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={createUser} loading={saving} className="flex-1" icon={<Plus className="w-4 h-4" />}>
              Create User
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { Plus, DollarSign, Users, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';
import { Button, Input, Select, Textarea, Modal, StatCard, EmptyState, Spinner } from '@/components/ui';
import { formatNaira, formatDate, formatTime } from '@/lib/utils';

interface StaffCashRecord {
  id: string;
  staff_name: string;
  staff_id: string | null;
  amount_collected: number;
  collection_date: string;
  collection_time: string;
  description: string;
  created_at: string;
}

export default function StaffCashPage() {
  const [records, setRecords] = useState<StaffCashRecord[]>([]);
  const [staff, setStaff] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [form, setForm] = useState({
    staff_id: '', staff_name: '', amount_collected: '',
    collection_date: new Date().toISOString().split('T')[0],
    collection_time: new Date().toTimeString().slice(0, 5),
    description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const start = `${monthFilter}-01`;
    const end = new Date(Number(monthFilter.slice(0, 4)), Number(monthFilter.slice(5, 7)), 0).toISOString().split('T')[0];
    const { data } = await supabase
      .from('staff_cash_collections')
      .select('*')
      .gte('collection_date', start)
      .lte('collection_date', end)
      .order('collection_date', { ascending: false });
    setRecords(data ?? []);
    setLoading(false);
  }, [monthFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from('profiles').select('id, full_name').neq('role', 'customer').then(({ data }) => setStaff(data ?? []));
  }, []);

  function selectStaff(id: string) {
    const s = staff.find(x => x.id === id);
    setForm(f => ({ ...f, staff_id: id, staff_name: s?.full_name ?? '' }));
  }

  async function handleSave() {
    if (!form.staff_name.trim()) { setError('Staff name is required.'); return; }
    if (!form.amount_collected || isNaN(Number(form.amount_collected))) { setError('Amount is required.'); return; }
    setSaving(true); setError('');
    const { error: err } = await supabase.from('staff_cash_collections').insert({
      staff_id: form.staff_id || null,
      staff_name: form.staff_name,
      amount_collected: Number(form.amount_collected),
      collection_date: form.collection_date,
      collection_time: form.collection_time,
      description: form.description,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowModal(false);
    setForm({ staff_id: '', staff_name: '', amount_collected: '', collection_date: new Date().toISOString().split('T')[0], collection_time: new Date().toTimeString().slice(0, 5), description: '' });
    load();
  }

  const total = records.reduce((s, r) => s + r.amount_collected, 0);

  // Count per staff this month
  const staffCounts = records.reduce((acc, r) => {
    acc[r.staff_name] = (acc[r.staff_name] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const months: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = d.toISOString().slice(0, 7);
    months.push({ value: val, label: d.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' }) });
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff Cash Collections</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Record when staff collect money for the company</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setShowModal(true); setError(''); }}>Add Record</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Collected" value={formatNaira(total)} color="green" />
        <StatCard icon={<Users className="w-5 h-5" />} label="Staff Members" value={Object.keys(staffCounts).length} color="brand" />
        <StatCard icon={<Calendar className="w-5 h-5" />} label="Records" value={records.length} color="teal" />
      </div>

      <div className="flex items-center gap-3">
        <Select
          label=""
          options={months}
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Per-staff summary */}
      {Object.keys(staffCounts).length > 0 && (
        <div className="card p-5">
          <h2 className="font-display font-semibold text-gray-900 dark:text-white mb-3 text-sm">Collections this month by staff</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(staffCounts).map(([name, count]) => {
              const staffTotal = records.filter(r => r.staff_name === name).reduce((s, r) => s + r.amount_collected, 0);
              return (
                <div key={name} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <p className="font-medium text-sm text-gray-900 dark:text-white">{name}</p>
                  <p className="text-brand-600 dark:text-brand-400 font-bold">{formatNaira(staffTotal)}</p>
                  <p className="text-xs text-gray-400">{count} time{count > 1 ? 's' : ''} this month</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="table-container">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner className="w-7 h-7" /></div>
        ) : records.length === 0 ? (
          <EmptyState icon={<DollarSign className="w-8 h-8" />} title="No records this month" description="No staff cash collections recorded." action={<Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowModal(true)}>Add Record</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Description</th>
                  <th>Times This Month</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.staff_name}</td>
                    <td className="font-bold text-green-600">{formatNaira(r.amount_collected)}</td>
                    <td>{formatDate(r.collection_date)}</td>
                    <td className="text-xs">{formatTime(r.collection_time)}</td>
                    <td className="text-gray-500 text-sm">{r.description || '—'}</td>
                    <td className="text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 text-xs font-bold">
                        {staffCounts[r.staff_name]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Record Cash Collection" size="sm">
        <div className="space-y-4">
          {error && <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <Select
            label="Select Staff (optional)"
            options={staff.map(s => ({ value: s.id, label: s.full_name }))}
            placeholder="Or type name manually..."
            value={form.staff_id}
            onChange={e => selectStaff(e.target.value)}
          />
          <Input label="Staff Name" value={form.staff_name} onChange={e => setForm(f => ({ ...f, staff_name: e.target.value, staff_id: '' }))} placeholder="Staff member's name" required />
          <Input label="Amount Collected (₦)" type="number" min="0" value={form.amount_collected} onChange={e => setForm(f => ({ ...f, amount_collected: e.target.value }))} placeholder="0.00" required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" value={form.collection_date} onChange={e => setForm(f => ({ ...f, collection_date: e.target.value }))} />
            <Input label="Time" type="time" value={form.collection_time} onChange={e => setForm(f => ({ ...f, collection_time: e.target.value }))} />
          </div>
          <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was the cash collected for?" />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} loading={saving} className="flex-1">Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

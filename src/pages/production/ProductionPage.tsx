import { useEffect, useState, useCallback } from 'react';
import { Plus, ClipboardList, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, ProductionRecord } from '@/types';
import { Button, Input, Select, Textarea, Modal, StatCard, Badge, EmptyState, Spinner, Pagination } from '@/components/ui';
import { formatDate, formatDateTime, formatTime } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const PER_PAGE = 15;

const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Morning Shift' },
  { value: 'afternoon', label: 'Afternoon Shift' },
  { value: 'night', label: 'Night Shift' },
];

export default function ProductionPage() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    product_id: '',
    bags_produced: '',
    bags_damaged: '',
    bags_transferred: '',
    production_date: new Date().toISOString().split('T')[0],
    production_time: new Date().toTimeString().slice(0, 5),
    shift: 'morning' as 'morning' | 'afternoon' | 'night',
    notes: '',
  });

  const role = profile?.role;
  const canApprove = role === 'super_admin' || role === 'manager';

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('production_records')
      .select(`*, recorder:profiles!production_records_recorded_by_fkey(full_name), product:products(name)`, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

    if (!canApprove) query = query.eq('recorded_by', profile!.id);

    const { data, count } = await query;
    setRecords((data as ProductionRecord[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, profile]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from('products').select('id, name').then(({ data }) => setProducts(data ?? []));
  }, []);

  async function handleSubmit() {
    if (!form.bags_produced || isNaN(Number(form.bags_produced))) { setError('Bags produced is required.'); return; }
    setSaving(true);
    setError('');
    const produced = Number(form.bags_produced);
    const damaged = Number(form.bags_damaged || 0);
    const transferred = Number(form.bags_transferred || 0);

    const { error: err } = await supabase.from('production_records').insert({
      product_id: form.product_id || null,
      bags_produced: produced,
      bags_damaged: damaged,
      bags_transferred: transferred,
      production_date: form.production_date,
      production_time: form.production_time,
      shift: form.shift,
      notes: form.notes,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowModal(false);
    load();
  }

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    const record = records.find(r => r.id === id);
    if (!record) return;

    await supabase.from('production_records').update({
      status,
      reviewed_by: profile!.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    // Update inventory if approved
    if (status === 'approved' && record.product_id) {
      const netBags = record.bags_produced - record.bags_damaged;
      const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', record.product_id).maybeSingle();
      if (prod) {
        const newStock = prod.stock_quantity + netBags;
        await supabase.from('products').update({ stock_quantity: newStock, updated_at: new Date().toISOString() }).eq('id', record.product_id);
        await supabase.from('inventory_logs').insert({
          product_id: record.product_id,
          change_type: 'production',
          quantity_change: netBags,
          previous_stock: prod.stock_quantity,
          new_stock: newStock,
          notes: `Production record approved: ${record.bags_produced} produced, ${record.bags_damaged} damaged`,
        });
      }
    }
    load();
  }

  const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const approved = records.filter(r => r.status === 'approved').length;
  const pending = records.filter(r => r.status === 'pending').length;
  const totalBags = records.filter(r => r.status === 'approved').reduce((s, r) => s + r.bags_produced, 0);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Production</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Record and track daily water production</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setShowModal(true); setError(''); }}>
          Log Production
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<ClipboardList className="w-5 h-5" />} label="Total Records" value={total} color="brand" />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Approved" value={approved} color="green" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Pending Review" value={pending} color="orange" />
        <StatCard icon={<ClipboardList className="w-5 h-5" />} label="Bags Produced" value={totalBags.toLocaleString()} color="teal" />
      </div>

      <div className="table-container">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-display font-semibold text-gray-900 dark:text-white">Production Records</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Spinner className="w-7 h-7" /></div>
        ) : records.length === 0 ? (
          <EmptyState icon={<ClipboardList className="w-8 h-8" />} title="No production records" description="Log your first production entry." action={<Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowModal(true)}>Log Production</Button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Product</th>
                    <th>Shift</th>
                    <th>Produced</th>
                    <th>Damaged</th>
                    <th>Net</th>
                    <th>Recorded By</th>
                    <th>Status</th>
                    {canApprove && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id}>
                      <td>{formatDate(r.production_date)}</td>
                      <td className="text-xs">{formatTime(r.production_time)}</td>
                      <td>{r.product ? (r.product as { name: string }).name : <span className="text-gray-400">General</span>}</td>
                      <td className="capitalize text-gray-500">{r.shift}</td>
                      <td className="font-medium text-green-600">{r.bags_produced}</td>
                      <td className="font-medium text-red-500">{r.bags_damaged}</td>
                      <td className="font-bold">{r.bags_produced - r.bags_damaged}</td>
                      <td className="text-sm text-gray-500">{(r.recorder as { full_name: string })?.full_name ?? '—'}</td>
                      <td><Badge className={STATUS_COLORS[r.status]}>{r.status}</Badge></td>
                      {canApprove && (
                        <td>
                          {r.status === 'pending' && (
                            <div className="flex gap-1">
                              <button onClick={() => updateStatus(r.id, 'approved')} className="btn btn-ghost btn-sm text-green-600 hover:bg-green-50">
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button onClick={() => updateStatus(r.id, 'rejected')} className="btn btn-ghost btn-sm text-red-500 hover:bg-red-50">
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={total} perPage={PER_PAGE} onChange={setPage} />
          </>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Log Production" size="md">
        <div className="space-y-4">
          {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</div>}
          <Select
            label="Product (optional)"
            options={products.map(p => ({ value: p.id, label: p.name }))}
            placeholder="General Production"
            value={form.product_id}
            onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" value={form.production_date} onChange={e => setForm(f => ({ ...f, production_date: e.target.value }))} required />
            <Input label="Time" type="time" value={form.production_time} onChange={e => setForm(f => ({ ...f, production_time: e.target.value }))} />
          </div>
          <Select label="Shift" options={SHIFT_OPTIONS} value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value as 'morning' | 'afternoon' | 'night' }))} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Bags Produced" type="number" min="0" value={form.bags_produced} onChange={e => setForm(f => ({ ...f, bags_produced: e.target.value }))} required />
            <Input label="Bags Damaged" type="number" min="0" value={form.bags_damaged} onChange={e => setForm(f => ({ ...f, bags_damaged: e.target.value }))} />
            <Input label="Transferred" type="number" min="0" value={form.bags_transferred} onChange={e => setForm(f => ({ ...f, bags_transferred: e.target.value }))} />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes..." />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSubmit} loading={saving} className="flex-1">Submit Record</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

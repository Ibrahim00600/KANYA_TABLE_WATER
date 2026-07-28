import { useEffect, useState, useCallback } from 'react';
import { Plus, Truck, Clock, CheckCircle, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile, Product } from '@/types';
import { Button, Input, Select, Textarea, Modal, StatCard, Badge, EmptyState, Spinner } from '@/components/ui';
import { formatDate, formatTime, formatDateTime } from '@/lib/utils';

interface DriverLoadRecord {
  id: string;
  driver_name: string;
  driver_id: string | null;
  product_name: string;
  bags_loaded: number;
  bags_delivered: number;
  bags_returned: number;
  load_date: string;
  load_time: string;
  notes: string;
  created_at: string;
}

export default function DriverLoadsPage() {
  const [records, setRecords] = useState<DriverLoadRecord[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; full_name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    driver_id: '', driver_name: '', product_id: '', product_name: '',
    bags_loaded: '', bags_delivered: '', bags_returned: '',
    load_date: new Date().toISOString().split('T')[0],
    load_time: new Date().toTimeString().slice(0, 5),
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('driver_load_records')
      .select('*')
      .order('load_date', { ascending: false })
      .order('load_time', { ascending: false });
    setRecords(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').eq('role', 'delivery').eq('is_active', true).then(({ data }) => setDrivers(data ?? []));
    supabase.from('products').select('id, name').then(({ data }) => setProducts(data ?? []));
  }, []);

  function selectDriver(id: string) {
    const d = drivers.find(d => d.id === id);
    setForm(f => ({ ...f, driver_id: id, driver_name: d?.full_name ?? '' }));
  }

  function selectProduct(id: string) {
    const p = products.find(p => p.id === id);
    setForm(f => ({ ...f, product_id: id, product_name: p?.name ?? '' }));
  }

  async function handleSave() {
    if (!form.driver_name.trim()) { setError('Driver name is required.'); return; }
    if (!form.bags_loaded || isNaN(Number(form.bags_loaded))) { setError('Bags loaded is required.'); return; }
    setSaving(true); setError('');
    const { error: err } = await supabase.from('driver_load_records').insert({
      driver_id: form.driver_id || null,
      driver_name: form.driver_name,
      product_id: form.product_id || null,
      product_name: form.product_name,
      bags_loaded: Number(form.bags_loaded),
      bags_delivered: Number(form.bags_delivered || 0),
      bags_returned: Number(form.bags_returned || 0),
      load_date: form.load_date,
      load_time: form.load_time,
      notes: form.notes,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowModal(false);
    load();
  }

  const totalLoaded = records.reduce((s, r) => s + r.bags_loaded, 0);
  const totalDelivered = records.reduce((s, r) => s + r.bags_delivered, 0);
  const totalReturned = records.reduce((s, r) => s + r.bags_returned, 0);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Driver Loads</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track how many bags each driver carried</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setShowModal(true); setError(''); }}>Record Load</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<Package className="w-5 h-5" />} label="Total Loaded" value={totalLoaded.toLocaleString()} color="brand" />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Delivered" value={totalDelivered.toLocaleString()} color="green" />
        <StatCard icon={<Truck className="w-5 h-5" />} label="Returned" value={totalReturned.toLocaleString()} color="orange" />
      </div>

      <div className="table-container">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-display font-semibold text-gray-900 dark:text-white">Load Records</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Spinner className="w-7 h-7" /></div>
        ) : records.length === 0 ? (
          <EmptyState icon={<Truck className="w-8 h-8" />} title="No driver load records" description="Record when a driver carries bags." action={<Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowModal(true)}>Record Load</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Driver Name</th>
                  <th>Product</th>
                  <th>Bags Loaded</th>
                  <th>Delivered</th>
                  <th>Returned</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td>{formatDate(r.load_date)}</td>
                    <td className="text-xs">{formatTime(r.load_time)}</td>
                    <td className="font-medium">{r.driver_name}</td>
                    <td className="text-gray-500">{r.product_name || '—'}</td>
                    <td className="font-bold text-brand-600 dark:text-brand-400">{r.bags_loaded}</td>
                    <td className="font-medium text-green-600">{r.bags_delivered}</td>
                    <td className="text-orange-500">{r.bags_returned}</td>
                    <td className="text-gray-400 text-xs max-w-xs truncate">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Record Driver Load" size="md">
        <div className="space-y-4">
          {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</div>}
          <Select
            label="Select Driver (optional)"
            options={drivers.map(d => ({ value: d.id, label: d.full_name }))}
            placeholder="Or type name manually below..."
            value={form.driver_id}
            onChange={e => selectDriver(e.target.value)}
          />
          <Input
            label="Driver Name"
            value={form.driver_name}
            onChange={e => setForm(f => ({ ...f, driver_name: e.target.value, driver_id: '' }))}
            placeholder="Driver's full name"
            required
          />
          <Select
            label="Product"
            options={products.map(p => ({ value: p.id, label: p.name }))}
            placeholder="Select product..."
            value={form.product_id}
            onChange={e => selectProduct(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" value={form.load_date} onChange={e => setForm(f => ({ ...f, load_date: e.target.value }))} />
            <Input label="Time" type="time" value={form.load_time} onChange={e => setForm(f => ({ ...f, load_time: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Bags Loaded" type="number" min="0" value={form.bags_loaded} onChange={e => setForm(f => ({ ...f, bags_loaded: e.target.value }))} required />
            <Input label="Bags Delivered" type="number" min="0" value={form.bags_delivered} onChange={e => setForm(f => ({ ...f, bags_delivered: e.target.value }))} />
            <Input label="Bags Returned" type="number" min="0" value={form.bags_returned} onChange={e => setForm(f => ({ ...f, bags_returned: e.target.value }))} />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes..." />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} loading={saving} className="flex-1">Save Record</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

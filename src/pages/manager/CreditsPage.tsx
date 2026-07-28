import { useEffect, useState, useCallback } from 'react';
import { Plus, DollarSign, CheckCircle, Clock, AlertTriangle, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button, Input, Textarea, Modal, StatCard, Badge, EmptyState, Spinner } from '@/components/ui';
import { formatNaira, formatDate, formatTime, formatDateTime } from '@/lib/utils';

interface CreditRecord {
  id: string;
  customer_name: string;
  phone: string;
  amount_owed: number;
  amount_paid: number;
  product_description: string;
  quantity: number;
  credit_date: string;
  credit_time: string;
  status: 'unpaid' | 'partial' | 'paid';
  payment_date: string | null;
  payment_time: string | null;
  payment_notes: string;
  notes: string;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  partial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
};

export default function CreditsPage() {
  const [records, setRecords] = useState<CreditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selected, setSelected] = useState<CreditRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [form, setForm] = useState({
    customer_name: '', phone: '', amount_owed: '',
    product_description: '', quantity: '', credit_date: new Date().toISOString().split('T')[0],
    credit_time: new Date().toTimeString().slice(0, 5), notes: '',
  });

  const [payForm, setPayForm] = useState({
    amount_paid: '', payment_notes: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_time: new Date().toTimeString().slice(0, 5),
  });

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('credit_records').select('*').order('credit_date', { ascending: false });
    if (statusFilter) query = query.eq('status', statusFilter);
    const { data } = await query;
    setRecords(data ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.customer_name.trim()) { setError('Customer name is required.'); return; }
    if (!form.amount_owed || isNaN(Number(form.amount_owed))) { setError('Amount owed is required.'); return; }
    setSaving(true); setError('');
    const { error: err } = await supabase.from('credit_records').insert({
      customer_name: form.customer_name.trim(),
      phone: form.phone,
      amount_owed: Number(form.amount_owed),
      product_description: form.product_description,
      quantity: Number(form.quantity || 0),
      credit_date: form.credit_date,
      credit_time: form.credit_time,
      notes: form.notes,
      status: 'unpaid',
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowModal(false);
    setForm({ customer_name: '', phone: '', amount_owed: '', product_description: '', quantity: '', credit_date: new Date().toISOString().split('T')[0], credit_time: new Date().toTimeString().slice(0, 5), notes: '' });
    load();
  }

  async function handlePayment() {
    if (!selected) return;
    if (!payForm.amount_paid || isNaN(Number(payForm.amount_paid))) { setError('Enter amount paid.'); return; }
    setSaving(true); setError('');
    const newPaid = selected.amount_paid + Number(payForm.amount_paid);
    const newStatus = newPaid >= selected.amount_owed ? 'paid' : 'partial';
    const { error: err } = await supabase.from('credit_records').update({
      amount_paid: newPaid,
      status: newStatus,
      payment_date: newStatus === 'paid' ? payForm.payment_date : selected.payment_date,
      payment_time: newStatus === 'paid' ? payForm.payment_time : selected.payment_time,
      payment_notes: payForm.payment_notes,
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowPayModal(false);
    load();
  }

  const totalOwed = records.filter(r => r.status !== 'paid').reduce((s, r) => s + (r.amount_owed - r.amount_paid), 0);
  const unpaid = records.filter(r => r.status === 'unpaid').length;
  const partial = records.filter(r => r.status === 'partial').length;
  const paid = records.filter(r => r.status === 'paid').length;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Credits & Debts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track customers who collected products on credit</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setShowModal(true); setError(''); }}>Add Credit Record</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="Outstanding Debt" value={formatNaira(totalOwed)} color="red" />
        <StatCard icon={<X className="w-5 h-5" />} label="Unpaid" value={unpaid} color="red" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Partial" value={partial} color="orange" />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Fully Paid" value={paid} color="green" />
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[{ v: '', l: 'All' }, { v: 'unpaid', l: 'Unpaid' }, { v: 'partial', l: 'Partial' }, { v: 'paid', l: 'Paid' }].map(f => (
          <button
            key={f.v}
            onClick={() => setStatusFilter(f.v)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${statusFilter === f.v ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}
          >
            {f.l}
          </button>
        ))}
      </div>

      <div className="table-container">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner className="w-7 h-7" /></div>
        ) : records.length === 0 ? (
          <EmptyState icon={<DollarSign className="w-8 h-8" />} title="No credit records" description="Add a record when a customer takes products on credit." action={<Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowModal(true)}>Add Record</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Product</th>
                  <th>Amount Owed</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.customer_name}</td>
                    <td className="text-gray-500">{r.phone || '—'}</td>
                    <td className="text-gray-500 text-xs">{r.product_description || '—'}</td>
                    <td className="font-semibold">{formatNaira(r.amount_owed)}</td>
                    <td className="text-green-600">{formatNaira(r.amount_paid)}</td>
                    <td className={`font-bold ${r.status !== 'paid' ? 'text-red-500' : 'text-green-600'}`}>{formatNaira(r.amount_owed - r.amount_paid)}</td>
                    <td className="text-xs text-gray-400">{formatDate(r.credit_date)} {formatTime(r.credit_time)}</td>
                    <td><Badge className={STATUS_COLOR[r.status]}>{r.status}</Badge></td>
                    <td>
                      {r.status !== 'paid' && (
                        <button
                          onClick={() => { setSelected(r); setPayForm({ amount_paid: String(r.amount_owed - r.amount_paid), payment_notes: '', payment_date: new Date().toISOString().split('T')[0], payment_time: new Date().toTimeString().slice(0, 5) }); setShowPayModal(true); setError(''); }}
                          className="btn btn-primary btn-sm"
                        >
                          Record Payment
                        </button>
                      )}
                      {r.status === 'paid' && r.payment_date && (
                        <span className="text-xs text-gray-400">Paid {formatDate(r.payment_date)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add credit modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Credit Record" size="md">
        <div className="space-y-4">
          {error && <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <Input label="Customer Name" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Full name of the person" required />
          <Input label="Phone Number" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="08012345678" />
          <Input label="Product / Description" value={form.product_description} onChange={e => setForm(f => ({ ...f, product_description: e.target.value }))} placeholder="e.g. 10 bags of sachet water" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Quantity" type="number" min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
            <Input label="Amount Owed (₦)" type="number" min="0" value={form.amount_owed} onChange={e => setForm(f => ({ ...f, amount_owed: e.target.value }))} placeholder="0.00" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" value={form.credit_date} onChange={e => setForm(f => ({ ...f, credit_date: e.target.value }))} />
            <Input label="Time" type="time" value={form.credit_time} onChange={e => setForm(f => ({ ...f, credit_time: e.target.value }))} />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes..." />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} loading={saving} className="flex-1">Save Record</Button>
          </div>
        </div>
      </Modal>

      {/* Record payment modal */}
      <Modal open={showPayModal} onClose={() => setShowPayModal(false)} title={`Record Payment — ${selected?.customer_name}`} size="sm">
        {selected && (
          <div className="space-y-4">
            {error && <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Total owed</span><span className="font-bold">{formatNaira(selected.amount_owed)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Already paid</span><span className="text-green-600">{formatNaira(selected.amount_paid)}</span></div>
              <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-1"><span className="font-semibold">Balance</span><span className="font-bold text-red-500">{formatNaira(selected.amount_owed - selected.amount_paid)}</span></div>
            </div>
            <Input label="Amount Paid Now (₦)" type="number" min="0" value={payForm.amount_paid} onChange={e => setPayForm(f => ({ ...f, amount_paid: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Date" type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} />
              <Input label="Time" type="time" value={payForm.payment_time} onChange={e => setPayForm(f => ({ ...f, payment_time: e.target.value }))} />
            </div>
            <Textarea label="Payment Notes" value={payForm.payment_notes} onChange={e => setPayForm(f => ({ ...f, payment_notes: e.target.value }))} placeholder="How did they pay? Any notes..." />
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowPayModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handlePayment} loading={saving} className="flex-1">Confirm Payment</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { Plus, ClipboardList, TrendingUp, CheckCircle, Clock, Send, BarChart3, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Select, Textarea, Modal, StatCard, Badge, EmptyState, Spinner, Alert } from '@/components/ui';
import { formatDate, formatTime, formatDateTime } from '@/lib/utils';

interface ProductionRecord {
  id: string;
  product_id: string | null;
  bags_produced: number;
  bags_damaged: number;
  bags_transferred: number;
  production_date: string;
  production_time: string;
  shift: string;
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  product: { name: string } | null;
}

interface OperatorRequest {
  id: string;
  request_type: string;
  amount_or_qty: string;
  description: string;
  status: string;
  review_notes: string;
  created_at: string;
}

const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Morning Shift' },
  { value: 'afternoon', label: 'Afternoon Shift' },
  { value: 'night', label: 'Night Shift' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function OperatorDashboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'production' | 'report' | 'requests'>('production');
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [requests, setRequests] = useState<OperatorRequest[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProd, setShowProd] = useState(false);
  const [showReq, setShowReq] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [prodForm, setProdForm] = useState({
    product_id: '', bags_produced: '', bags_damaged: '', bags_transferred: '',
    production_date: new Date().toISOString().split('T')[0],
    production_time: new Date().toTimeString().slice(0, 5),
    shift: 'morning', notes: '',
  });

  const [reqForm, setReqForm] = useState({
    request_type: 'cash', amount_or_qty: '', description: '',
  });

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const [prodRes, reqRes] = await Promise.all([
      supabase.from('production_records').select(`*, product:products(name)`).eq('recorded_by', profile.id).order('production_date', { ascending: false }).limit(100),
      supabase.from('operator_requests').select('*').eq('operator_id', profile.id).order('created_at', { ascending: false }),
    ]);
    setRecords((prodRes.data as ProductionRecord[]) ?? []);
    setRequests((reqRes.data as OperatorRequest[]) ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from('products').select('id, name').then(({ data }) => setProducts(data ?? []));
  }, []);

  async function submitProduction() {
    if (!prodForm.bags_produced || isNaN(Number(prodForm.bags_produced))) { setError('Bags produced is required.'); return; }
    setSaving(true); setError('');
    const { error: err } = await supabase.from('production_records').insert({
      product_id: prodForm.product_id || null,
      bags_produced: Number(prodForm.bags_produced),
      bags_damaged: Number(prodForm.bags_damaged || 0),
      bags_transferred: Number(prodForm.bags_transferred || 0),
      production_date: prodForm.production_date,
      production_time: prodForm.production_time,
      shift: prodForm.shift,
      notes: prodForm.notes,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowProd(false);
    setProdForm({ product_id: '', bags_produced: '', bags_damaged: '', bags_transferred: '', production_date: new Date().toISOString().split('T')[0], production_time: new Date().toTimeString().slice(0, 5), shift: 'morning', notes: '' });
    load();
  }

  async function submitRequest() {
    if (!reqForm.description.trim()) { setError('Please describe your request.'); return; }
    setSaving(true); setError('');
    const { error: err } = await supabase.from('operator_requests').insert({
      request_type: reqForm.request_type,
      amount_or_qty: reqForm.amount_or_qty,
      description: reqForm.description,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowReq(false);
    setReqForm({ request_type: 'cash', amount_or_qty: '', description: '' });
    load();
  }

  // Weekly report: last 7 days
  const last7 = records.filter(r => {
    const d = new Date(r.production_date);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return d >= cutoff;
  });

  const weeklyBags = last7.reduce((s, r) => s + r.bags_produced, 0);
  const weeklyDamaged = last7.reduce((s, r) => s + r.bags_damaged, 0);
  const weeklyApproved = last7.filter(r => r.status === 'approved').length;
  const totalBags = records.reduce((s, r) => s + r.bags_produced, 0);

  // Daily breakdown for weekly report
  const dailyMap: Record<string, { produced: number; damaged: number; net: number }> = {};
  last7.forEach(r => {
    if (!dailyMap[r.production_date]) dailyMap[r.production_date] = { produced: 0, damaged: 0, net: 0 };
    dailyMap[r.production_date].produced += r.bags_produced;
    dailyMap[r.production_date].damaged += r.bags_damaged;
    dailyMap[r.production_date].net += r.bags_produced - r.bags_damaged;
  });
  const dailyDays = Object.entries(dailyMap).sort((a, b) => b[0].localeCompare(a[0]));
  const maxBags = Math.max(...dailyDays.map(([, v]) => v.produced), 1);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Operator Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Welcome, {profile?.full_name?.split(' ')[0]}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={<Send className="w-4 h-4" />} onClick={() => { setShowReq(true); setError(''); }}>Request / Collect</Button>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setShowProd(true); setError(''); }}>Log Production</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<ClipboardList className="w-5 h-5" />} label="Total Records" value={records.length} color="brand" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="All Bags Produced" value={totalBags.toLocaleString()} color="green" />
        <StatCard icon={<BarChart3 className="w-5 h-5" />} label="This Week" value={weeklyBags.toLocaleString()} color="teal" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Pending Approval" value={records.filter(r => r.status === 'pending').length} color="orange" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {([
          { key: 'production', label: 'My Production' },
          { key: 'report', label: 'Weekly Report' },
          { key: 'requests', label: 'My Requests' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
            {t.key === 'requests' && requests.filter(r => r.status === 'pending').length > 0 && (
              <span className="ml-1 bg-orange-500 text-white text-[10px] w-4 h-4 rounded-full inline-flex items-center justify-center">
                {requests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8" /></div>
      ) : (
        <>
          {tab === 'production' && (
            <div className="table-container">
              {records.length === 0 ? (
                <EmptyState icon={<ClipboardList className="w-8 h-8" />} title="No production records yet" description="Log your first production entry for the day." action={<Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowProd(true)}>Log Production</Button>} />
              ) : (
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
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map(r => (
                        <tr key={r.id}>
                          <td>{formatDate(r.production_date)}</td>
                          <td className="text-xs">{formatTime(r.production_time)}</td>
                          <td className="text-gray-500">{r.product?.name ?? <span className="text-gray-300">General</span>}</td>
                          <td className="capitalize text-gray-500">{r.shift}</td>
                          <td className="font-bold text-green-600">{r.bags_produced}</td>
                          <td className="text-red-500">{r.bags_damaged}</td>
                          <td className="font-bold">{r.bags_produced - r.bags_damaged}</td>
                          <td><Badge className={STATUS_COLORS[r.status]}>{r.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'report' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Bags (7 days)" value={weeklyBags} color="brand" />
                <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Net (after damage)" value={weeklyBags - weeklyDamaged} color="green" />
                <StatCard icon={<Clock className="w-5 h-5" />} label="Damaged" value={weeklyDamaged} color="red" />
                <StatCard icon={<ClipboardList className="w-5 h-5" />} label="Approved Records" value={weeklyApproved} color="teal" />
              </div>
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="font-display font-semibold text-gray-900 dark:text-white">Last 7 Days — Daily Production Report</h2>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Download className="w-4 h-4" />}
                    onClick={() => {
                      const headers = ['Date', 'Produced Bags', 'Damaged Bags', 'Net Bags'];
                      const rows = dailyDays.map(([date, vals]) => [date, vals.produced, vals.damaged, vals.produced - vals.damaged]);
                      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement('a');
                      link.setAttribute('href', encodedUri);
                      link.setAttribute('download', `operator_weekly_report_${profile?.full_name?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    Export Report CSV
                  </Button>
                </div>
                {dailyDays.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">No production data in the last 7 days.</p>
                ) : (
                  <div className="space-y-3">
                    {dailyDays.map(([date, vals]) => (
                      <div key={date} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-24 flex-shrink-0">{formatDate(date, { month: 'short', day: 'numeric' })}</span>
                        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-5 overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full flex items-center pl-2 transition-all"
                            style={{ width: `${(vals.produced / maxBags) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-12 text-right">{vals.produced}</span>
                        <span className="text-xs text-red-400 w-16 text-right">-{vals.damaged} dmg</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-sm">
                  <p className="text-gray-500">Operator: <span className="font-semibold text-gray-900 dark:text-white">{profile?.full_name}</span></p>
                  <p className="text-gray-500">Report Period: Last 7 days — {new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>
            </div>
          )}

          {tab === 'requests' && (
            <div className="space-y-3">
              {requests.length === 0 ? (
                <EmptyState icon={<Send className="w-8 h-8" />} title="No requests submitted" description="Submit a request or log when you collect cash/materials." action={<Button icon={<Send className="w-4 h-4" />} onClick={() => setShowReq(true)}>Submit Request</Button>} />
              ) : (
                requests.map(r => (
                  <div key={r.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{r.request_type} Request</span>
                          {r.amount_or_qty && <span className="text-sm text-brand-600 dark:text-brand-400 font-medium">— {r.amount_or_qty}</span>}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{r.description}</p>
                        {r.review_notes && (
                          <p className="text-xs text-gray-400 mt-1 italic">Manager note: {r.review_notes}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">{formatDateTime(r.created_at)}</p>
                      </div>
                      <Badge className={STATUS_COLORS[r.status]}>{r.status}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Log Production Modal */}
      <Modal open={showProd} onClose={() => setShowProd(false)} title="Log Daily Production" size="md">
        <div className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          <Select label="Product (optional)" options={products.map(p => ({ value: p.id, label: p.name }))} placeholder="General Production" value={prodForm.product_id} onChange={e => setProdForm(f => ({ ...f, product_id: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" value={prodForm.production_date} onChange={e => setProdForm(f => ({ ...f, production_date: e.target.value }))} required />
            <Input label="Time" type="time" value={prodForm.production_time} onChange={e => setProdForm(f => ({ ...f, production_time: e.target.value }))} />
          </div>
          <Select label="Shift" options={SHIFT_OPTIONS} value={prodForm.shift} onChange={e => setProdForm(f => ({ ...f, shift: e.target.value }))} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Bags Produced" type="number" min="0" value={prodForm.bags_produced} onChange={e => setProdForm(f => ({ ...f, bags_produced: e.target.value }))} required />
            <Input label="Bags Damaged" type="number" min="0" value={prodForm.bags_damaged} onChange={e => setProdForm(f => ({ ...f, bags_damaged: e.target.value }))} />
            <Input label="Transferred" type="number" min="0" value={prodForm.bags_transferred} onChange={e => setProdForm(f => ({ ...f, bags_transferred: e.target.value }))} />
          </div>
          <Textarea label="Notes" value={prodForm.notes} onChange={e => setProdForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes for today's production..." />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowProd(false)} className="flex-1">Cancel</Button>
            <Button onClick={submitProduction} loading={saving} className="flex-1">Submit Record</Button>
          </div>
        </div>
      </Modal>

      {/* Request Modal */}
      <Modal open={showReq} onClose={() => setShowReq(false)} title="Submit Request / Log Collection" size="sm">
        <div className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          <Alert type="info">Use this to request items from the manager, or to log when you collected cash or materials.</Alert>
          <Select
            label="Request Type"
            options={[{ value: 'cash', label: 'Cash Collection' }, { value: 'materials', label: 'Materials Request' }, { value: 'other', label: 'Other' }]}
            value={reqForm.request_type}
            onChange={e => setReqForm(f => ({ ...f, request_type: e.target.value }))}
          />
          <Input
            label="Amount / Quantity"
            value={reqForm.amount_or_qty}
            onChange={e => setReqForm(f => ({ ...f, amount_or_qty: e.target.value }))}
            placeholder="e.g. ₦5,000 or 10 bags"
          />
          <Textarea
            label="Description"
            value={reqForm.description}
            onChange={e => setReqForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Describe what you collected or what you need..."
            required
          />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowReq(false)} className="flex-1">Cancel</Button>
            <Button onClick={submitRequest} loading={saving} icon={<Send className="w-4 h-4" />} className="flex-1">Submit</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

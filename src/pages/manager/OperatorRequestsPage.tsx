import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Send, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Modal, Textarea, Badge, EmptyState, Spinner } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

interface OperatorRequest {
  id: string;
  operator_id: string;
  request_type: string;
  amount_or_qty: string;
  description: string;
  status: string;
  review_notes: string;
  created_at: string;
  operator: { full_name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function OperatorRequestsPage() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<OperatorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OperatorRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('operator_requests')
      .select(`*, operator:profiles!operator_requests_operator_id_fkey(full_name)`)
      .order('created_at', { ascending: false });
    if (statusFilter) query = query.eq('status', statusFilter);
    const { data } = await query;
    setRequests((data as OperatorRequest[]) ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function reviewRequest(status: 'approved' | 'rejected') {
    if (!selected) return;
    setSaving(true);
    await supabase.from('operator_requests').update({
      status,
      reviewed_by: profile!.id,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id);
    setSaving(false);
    setSelected(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Operator Requests</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Review requests and collections from operators</p>
        </div>
      </div>

      <div className="flex gap-2">
        {[{ v: 'pending', l: 'Pending' }, { v: 'approved', l: 'Approved' }, { v: 'rejected', l: 'Rejected' }, { v: '', l: 'All' }].map(f => (
          <button
            key={f.v}
            onClick={() => setStatusFilter(f.v)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${statusFilter === f.v ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}
          >
            {f.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-7 h-7" /></div>
      ) : requests.length === 0 ? (
        <EmptyState icon={<Send className="w-8 h-8" />} title="No requests" description="No operator requests to review." />
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="card p-4 hover:shadow-card-hover transition-shadow cursor-pointer" onClick={() => { setSelected(r); setReviewNotes(r.review_notes); }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 dark:text-white">{r.operator?.full_name ?? 'Unknown'}</span>
                    <Badge className="bg-gray-100 text-gray-600 text-xs capitalize">{r.request_type}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{r.description}</p>
                  {r.amount_or_qty && <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 mt-0.5">Amount/Qty: {r.amount_or_qty}</p>}
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(r.created_at)}</p>
                </div>
                <Badge className={STATUS_COLORS[r.status]}>{r.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Review Request" size="sm">
        {selected && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-2">
              <div className="flex justify-between"><span className="text-gray-500">From:</span><span className="font-medium">{selected.operator?.full_name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Type:</span><span className="capitalize">{selected.request_type}</span></div>
              {selected.amount_or_qty && <div className="flex justify-between"><span className="text-gray-500">Amount/Qty:</span><span className="font-semibold">{selected.amount_or_qty}</span></div>}
              <div>
                <p className="text-gray-500 mb-1">Description:</p>
                <p>{selected.description}</p>
              </div>
            </div>
            <Textarea label="Review Notes (optional)" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Add a note for the operator..." />
            {selected.status === 'pending' && (
              <div className="flex gap-3">
                <Button variant="danger" icon={<XCircle className="w-4 h-4" />} onClick={() => reviewRequest('rejected')} loading={saving} className="flex-1">Reject</Button>
                <Button icon={<CheckCircle className="w-4 h-4" />} onClick={() => reviewRequest('approved')} loading={saving} className="flex-1">Approve</Button>
              </div>
            )}
            {selected.status !== 'pending' && (
              <Badge className={STATUS_COLORS[selected.status]}>{selected.status}</Badge>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { Plus, Warehouse, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';
import { Button, Modal, Input, Select, Textarea, StatCard, Spinner, Badge } from '@/components/ui';
import { formatNaira, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface InventoryLogWithProduct {
  id: string;
  product_id: string;
  change_type: string;
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  notes: string;
  created_at: string;
  product: { name: string };
  creator: { full_name: string };
}

export default function InventoryPage() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<InventoryLogWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdjust, setShowAdjust] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adjForm, setAdjForm] = useState({ product_id: '', type: 'add', quantity: '', reason: '' });
  const [adjError, setAdjError] = useState('');

  const canAdjust = ['super_admin', 'manager'].includes(profile?.role ?? '');

  const load = useCallback(async () => {
    const [prodRes, logRes] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('inventory_logs').select(`
        *, 
        product:products(name),
        creator:profiles!inventory_logs_created_by_fkey(full_name)
      `).order('created_at', { ascending: false }).limit(50),
    ]);
    setProducts(prodRes.data ?? []);
    setLogs(logRes.data as InventoryLogWithProduct[] ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdjust() {
    if (!adjForm.product_id) { setAdjError('Select a product.'); return; }
    if (!adjForm.quantity || isNaN(Number(adjForm.quantity)) || Number(adjForm.quantity) <= 0) {
      setAdjError('Enter a valid quantity.'); return;
    }
    if (!adjForm.reason.trim()) { setAdjError('Reason is required.'); return; }
    setSaving(true);
    setAdjError('');

    const product = products.find(p => p.id === adjForm.product_id)!;
    const qty = Number(adjForm.quantity);
    const change = adjForm.type === 'add' ? qty : -qty;
    const newStock = Math.max(0, product.stock_quantity + change);

    await supabase.from('products').update({ stock_quantity: newStock, updated_at: new Date().toISOString() }).eq('id', product.id);
    await supabase.from('inventory_logs').insert({
      product_id: product.id,
      change_type: 'adjustment',
      quantity_change: change,
      previous_stock: product.stock_quantity,
      new_stock: newStock,
      notes: `${adjForm.type === 'add' ? 'Added' : 'Removed'} ${qty}: ${adjForm.reason}`,
    });
    await supabase.from('stock_adjustments').insert({
      product_id: product.id,
      adjustment_type: adjForm.type as 'add' | 'remove',
      quantity: qty,
      reason: adjForm.reason,
    });

    setSaving(false);
    setShowAdjust(false);
    setAdjForm({ product_id: '', type: 'add', quantity: '', reason: '' });
    load();
  }

  const totalStock = products.reduce((s, p) => s + p.stock_quantity, 0);
  const lowStock = products.filter(p => p.stock_quantity <= 20);

  const CHANGE_COLOR: Record<string, string> = {
    production: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    sale: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    adjustment: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    return: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
    damage: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track stock levels and movements</p>
        </div>
        {canAdjust && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowAdjust(true)}>Adjust Stock</Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Warehouse className="w-5 h-5" />} label="Total Stock" value={totalStock.toLocaleString()} color="brand" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Products" value={products.length} color="green" />
        <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="Low Stock" value={lowStock.length} color={lowStock.length > 0 ? 'red' : 'green'} />
        <StatCard icon={<TrendingDown className="w-5 h-5" />} label="Recent Movements" value={logs.length} color="teal" />
      </div>

      {/* Product stock table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-display font-semibold text-gray-900 dark:text-white">Stock Levels</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Spinner className="w-7 h-7" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Unit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.name}</td>
                    <td className="capitalize text-gray-500">{p.category}</td>
                    <td>{formatNaira(p.price)}</td>
                    <td className={`font-bold ${p.stock_quantity <= 20 ? 'text-red-500' : 'text-green-600'}`}>
                      {p.stock_quantity.toLocaleString()}
                    </td>
                    <td className="text-gray-400">{p.unit}</td>
                    <td>
                      {p.stock_quantity <= 20 ? (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                          <AlertTriangle className="w-3 h-3" /> Low Stock
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700">Good</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity log */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-display font-semibold text-gray-900 dark:text-white">Recent Stock Movements</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Type</th>
                <th>Change</th>
                <th>New Stock</th>
                <th>Notes</th>
                <th>By</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td className="font-medium">{log.product?.name ?? '—'}</td>
                  <td><Badge className={CHANGE_COLOR[log.change_type] ?? ''}>{log.change_type}</Badge></td>
                  <td className={`font-mono font-bold ${log.quantity_change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {log.quantity_change >= 0 ? '+' : ''}{log.quantity_change}
                  </td>
                  <td className="font-medium">{log.new_stock}</td>
                  <td className="text-gray-400 text-xs max-w-xs truncate">{log.notes}</td>
                  <td className="text-gray-500 text-xs">{log.creator?.full_name ?? '—'}</td>
                  <td className="text-gray-400 text-xs">{formatDateTime(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust stock modal */}
      <Modal open={showAdjust} onClose={() => setShowAdjust(false)} title="Adjust Stock" size="sm">
        <div className="space-y-4">
          {adjError && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{adjError}</div>}
          <Select
            label="Product"
            options={products.map(p => ({ value: p.id, label: `${p.name} (${p.stock_quantity} in stock)` }))}
            placeholder="Select product..."
            value={adjForm.product_id}
            onChange={e => setAdjForm(f => ({ ...f, product_id: e.target.value }))}
          />
          <Select
            label="Adjustment Type"
            options={[{ value: 'add', label: 'Add Stock' }, { value: 'remove', label: 'Remove Stock' }]}
            value={adjForm.type}
            onChange={e => setAdjForm(f => ({ ...f, type: e.target.value }))}
          />
          <Input
            label="Quantity"
            type="number"
            min="1"
            value={adjForm.quantity}
            onChange={e => setAdjForm(f => ({ ...f, quantity: e.target.value }))}
            placeholder="0"
          />
          <Textarea
            label="Reason"
            value={adjForm.reason}
            onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))}
            placeholder="Reason for adjustment..."
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowAdjust(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleAdjust} loading={saving} className="flex-1">Apply Adjustment</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

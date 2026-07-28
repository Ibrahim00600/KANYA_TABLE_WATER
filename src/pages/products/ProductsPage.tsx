import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, Package, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';
import { Button, Input, Select, Textarea, Modal, StatCard, EmptyState, Spinner, Badge } from '@/components/ui';
import { formatNaira, cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const CATEGORY_OPTIONS = [
  { value: 'sachet', label: 'Sachet Water' },
  { value: 'bottled', label: 'Bottled Water' },
  { value: 'dispenser', label: 'Dispenser Water' },
];

const EMPTY_FORM = {
  name: '', description: '', image_url: '',
  category: 'sachet' as Product['category'],
  price: '', unit: 'bag', stock_quantity: '0', is_available: true,
};

export default function ProductsPage() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canEdit = ['super_admin', 'manager', 'sales_officer'].includes(profile?.role ?? '');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('name');
    setProducts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name, description: p.description, image_url: p.image_url,
      category: p.category, price: String(p.price), unit: p.unit,
      stock_quantity: String(p.stock_quantity), is_available: p.is_available,
    });
    setError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Product name is required.'); return; }
    if (!form.price || isNaN(Number(form.price))) { setError('Valid price is required.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      description: form.description,
      image_url: form.image_url,
      category: form.category,
      price: Number(form.price),
      unit: form.unit,
      stock_quantity: Number(form.stock_quantity),
      is_available: form.is_available,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = editing
      ? await supabase.from('products').update(payload).eq('id', editing.id)
      : await supabase.from('products').insert(payload);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowModal(false);
    load();
  }

  async function toggleAvailability(p: Product) {
    await supabase.from('products').update({ is_available: !p.is_available }).eq('id', p.id);
    load();
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const totalStock = products.reduce((s, p) => s + p.stock_quantity, 0);
  const available = products.filter(p => p.is_available).length;
  const lowStock = products.filter(p => p.stock_quantity <= 20).length;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your water product catalog</p>
        </div>
        {canEdit && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Add Product</Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<Package className="w-5 h-5" />} label="Total Products" value={products.length} color="brand" />
        <StatCard icon={<ToggleRight className="w-5 h-5" />} label="Available" value={available} color="green" />
        <StatCard icon={<Package className="w-5 h-5" />} label="Total Stock" value={totalStock.toLocaleString()} sub={lowStock > 0 ? `${lowStock} low stock` : undefined} color={lowStock > 0 ? 'orange' : 'teal'} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className="sm:max-w-xs"
        />
        <select
          className="input sm:max-w-xs"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Package className="w-8 h-8" />} title="No products found" description="Add products to your catalog to get started." action={canEdit ? <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Add Product</Button> : undefined} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => (
            <div key={p.id} className={cn('card overflow-hidden transition-shadow hover:shadow-card-hover', !p.is_available && 'opacity-60')}>
              <div className="aspect-video bg-gray-100 dark:bg-gray-800 overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-10 h-10 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">{p.name}</h3>
                  <Badge className={p.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                    {p.is_available ? 'Live' : 'Off'}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{p.description}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-brand-600 dark:text-brand-400">{formatNaira(p.price)}</span>
                  <span className="text-xs text-gray-400">Stock: {p.stock_quantity} {p.unit}s</span>
                </div>
                {canEdit && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <button onClick={() => openEdit(p)} className="btn btn-secondary btn-sm flex-1 justify-center">
                      <Edit2 className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => toggleAvailability(p)} className="btn btn-ghost btn-sm">
                      {p.is_available ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Product' : 'Add Product'} size="md">
        <div className="space-y-4">
          {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</div>}
          <Input label="Product Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Kanya 50cl Bottle" required />
          <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief product description..." />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Product['category'] }))} options={CATEGORY_OPTIONS} />
            <Input label="Unit" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="bag, bottle..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Price (₦)" type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" />
            <Input label="Stock Quantity" type="number" min="0" value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} />
          </div>
          <Input label="Image URL" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_available} onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))} className="rounded" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Available for ordering</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} loading={saving} className="flex-1">{editing ? 'Save Changes' : 'Add Product'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

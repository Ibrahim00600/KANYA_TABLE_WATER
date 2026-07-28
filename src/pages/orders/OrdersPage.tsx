import { useEffect, useState, useCallback } from 'react';
import { Search, Filter, Eye, UserCheck, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Order, Profile } from '@/types';
import { Button, Input, Select, Modal, Badge, EmptyState, Spinner, Pagination } from '@/components/ui';
import { formatNaira, formatDateTime, ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, PAYMENT_STATUS_COLOR } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PER_PAGE = 15;

export default function OrdersPage() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; full_name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [driverId, setDriverId] = useState('');
  const [newStatus, setNewStatus] = useState('');

  const role = profile?.role;

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select(`
        *, 
        customer:profiles!orders_customer_id_fkey(full_name, phone),
        driver:profiles!orders_assigned_driver_id_fkey(full_name, phone),
        items:order_items(*, product:products(name, unit))
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

    if (statusFilter) query = query.eq('status', statusFilter);
    if (search) query = query.ilike('order_number', `%${search}%`);

    const { data, count } = await query;
    setOrders(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').eq('role', 'delivery').eq('is_active', true)
      .then(({ data }) => setDrivers(data ?? []));
  }, []);

  async function updateOrderStatus(orderId: string, status: string) {
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString(), ...(status === 'delivered' ? { delivered_at: new Date().toISOString() } : {}) }).eq('id', orderId);
    load();
    setSelectedOrder(null);
  }

  async function assignDriver() {
    if (!selectedOrder || !driverId) return;
    setAssigning(true);
    await supabase.from('orders').update({
      assigned_driver_id: driverId,
      assigned_at: new Date().toISOString(),
      status: 'out_for_delivery',
      updated_at: new Date().toISOString(),
    }).eq('id', selectedOrder.id);
    setAssigning(false);
    setSelectedOrder(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage and track all customer orders</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by order number..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          leftIcon={<Search className="w-4 h-4" />}
          className="sm:max-w-xs"
        />
        <Select
          options={STATUS_OPTIONS}
          placeholder="All Statuses"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="sm:max-w-xs"
        />
      </div>

      <div className="table-container">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
        ) : orders.length === 0 ? (
          <EmptyState icon={<Filter className="w-8 h-8" />} title="No orders found" description="Try adjusting your filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Driver</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id}>
                      <td className="font-mono text-xs text-brand-600 dark:text-brand-400 font-medium">{order.order_number}</td>
                      <td>
                        <div className="text-sm font-medium">{(order.customer as Profile)?.full_name ?? '—'}</div>
                        <div className="text-xs text-gray-400">{(order.customer as Profile)?.phone ?? ''}</div>
                      </td>
                      <td className="text-center">{order.items?.length ?? 0}</td>
                      <td className="font-semibold">{formatNaira(order.total_amount)}</td>
                      <td>
                        <Badge className={PAYMENT_STATUS_COLOR[order.payment_status]}>
                          {order.payment_status}
                        </Badge>
                      </td>
                      <td>
                        <Badge className={ORDER_STATUS_COLOR[order.status]}>
                          {ORDER_STATUS_LABEL[order.status]}
                        </Badge>
                      </td>
                      <td className="text-sm text-gray-500">
                        {(order.driver as Profile)?.full_name ?? '—'}
                      </td>
                      <td className="text-xs text-gray-400">{formatDateTime(order.created_at)}</td>
                      <td>
                        <button
                          onClick={() => { setSelectedOrder(order); setNewStatus(order.status); setDriverId(order.assigned_driver_id ?? ''); }}
                          className="btn btn-ghost btn-sm"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={total} perPage={PER_PAGE} onChange={setPage} />
          </>
        )}
      </div>

      {/* Order detail modal */}
      <Modal open={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Order ${selectedOrder?.order_number}`} size="lg">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Customer</p>
                <p className="font-medium">{(selectedOrder.customer as Profile)?.full_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Phone</p>
                <p className="font-medium">{(selectedOrder.customer as Profile)?.phone ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Payment</p>
                <p className="font-medium capitalize">{selectedOrder.payment_method} · <Badge className={PAYMENT_STATUS_COLOR[selectedOrder.payment_status]}>{selectedOrder.payment_status}</Badge></p>
              </div>
              <div>
                <p className="text-gray-500">Delivery Date</p>
                <p className="font-medium">{selectedOrder.preferred_delivery_date ?? 'Any time'}</p>
              </div>
              {selectedOrder.delivery_address_snapshot && (
                <div className="col-span-2">
                  <p className="text-gray-500">Delivery Address</p>
                  <p className="font-medium text-sm">
                    {(selectedOrder.delivery_address_snapshot as { address?: string; city?: string; state?: string }).address}, {(selectedOrder.delivery_address_snapshot as { address?: string; city?: string; state?: string }).city}, {(selectedOrder.delivery_address_snapshot as { address?: string; city?: string; state?: string }).state}
                  </p>
                </div>
              )}
              {selectedOrder.special_instructions && (
                <div className="col-span-2">
                  <p className="text-gray-500">Instructions</p>
                  <p className="font-medium">{selectedOrder.special_instructions}</p>
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              <p className="text-sm font-semibold mb-2">Items</p>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                {selectedOrder.items?.map(item => (
                  <div key={item.id} className="flex justify-between px-3 py-2 text-sm border-b last:border-0 border-gray-200 dark:border-gray-700">
                    <span>{(item.product as { name: string })?.name} × {item.quantity}</span>
                    <span className="font-medium">{formatNaira(item.subtotal)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-3 py-2 text-sm font-bold border-t border-gray-200 dark:border-gray-700">
                  <span>Total</span>
                  <span>{formatNaira(selectedOrder.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Update status */}
            {(role === 'super_admin' || role === 'manager' || role === 'sales_officer') && (
              <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                <Select
                  label="Update Status"
                  options={STATUS_OPTIONS}
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                />
                <Button onClick={() => updateOrderStatus(selectedOrder.id, newStatus)} className="w-full">
                  Update Status
                </Button>

                {role !== 'sales_officer' && (
                  <>
                    <Select
                      label="Assign Driver"
                      options={drivers.map(d => ({ value: d.id, label: d.full_name }))}
                      placeholder="Select a driver..."
                      value={driverId}
                      onChange={e => setDriverId(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      icon={<UserCheck className="w-4 h-4" />}
                      onClick={assignDriver}
                      loading={assigning}
                      className="w-full"
                    >
                      Assign & Set Out for Delivery
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

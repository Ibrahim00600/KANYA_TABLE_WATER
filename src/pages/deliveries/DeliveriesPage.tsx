import { useEffect, useState, useCallback } from 'react';
import { Truck, MapPin, CheckCircle, Clock, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Order, Profile } from '@/types';
import { Button, Modal, Textarea, StatCard, Badge, EmptyState, Spinner } from '@/components/ui';
import { formatNaira, formatDateTime, ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function DeliveriesPage() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');

  const role = profile?.role;
  const isDriver = role === 'delivery';

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select(`
        *, 
        customer:profiles!orders_customer_id_fkey(full_name, phone),
        driver:profiles!orders_assigned_driver_id_fkey(full_name, phone),
        items:order_items(*, product:products(name))
      `)
      .in('status', ['confirmed', 'processing', 'out_for_delivery', 'delivered'])
      .order('created_at', { ascending: false });

    if (isDriver) {
      query = query.eq('assigned_driver_id', profile!.id);
    }

    const { data } = await query;
    setOrders(data ?? []);
    setLoading(false);
  }, [profile, isDriver]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(orderId: string, status: string) {
    setUpdating(true);
    await supabase.from('orders').update({
      status,
      updated_at: new Date().toISOString(),
      ...(status === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
    }).eq('id', orderId);

    if (status === 'delivered') {
      // Log delivery
      await supabase.from('delivery_logs').insert({
        order_id: orderId,
        driver_id: selected?.assigned_driver_id ?? profile!.id,
        bags_delivered: selected?.items?.reduce((s, i) => s + i.quantity, 0) ?? 0,
        completed_at: new Date().toISOString(),
        notes,
      });
    }
    setUpdating(false);
    setSelected(null);
    load();
  }

  const active = orders.filter(o => o.status !== 'delivered');
  const delivered = orders.filter(o => o.status === 'delivered');

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Deliveries</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isDriver ? 'Your assigned deliveries' : 'All delivery operations'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<Truck className="w-5 h-5" />} label="Total" value={orders.length} color="brand" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Active" value={active.length} color="orange" />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Delivered" value={delivered.length} color="green" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-7 h-7" /></div>
      ) : orders.length === 0 ? (
        <EmptyState icon={<Truck className="w-8 h-8" />} title="No deliveries yet" description={isDriver ? "You have no assigned deliveries." : "No deliveries to show."} />
      ) : (
        <div className="space-y-4">
          {/* Active */}
          {active.length > 0 && (
            <div>
              <h2 className="font-display font-semibold text-gray-900 dark:text-white mb-3">Active Deliveries</h2>
              <div className="grid gap-3">
                {active.map(order => (
                  <DeliveryCard key={order.id} order={order} onSelect={() => { setSelected(order); setNotes(''); }} />
                ))}
              </div>
            </div>
          )}
          {/* Completed */}
          {delivered.length > 0 && (
            <div>
              <h2 className="font-display font-semibold text-gray-900 dark:text-white mb-3">Completed Deliveries</h2>
              <div className="grid gap-3">
                {delivered.map(order => (
                  <DeliveryCard key={order.id} order={order} onSelect={() => { setSelected(order); setNotes(''); }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Delivery — ${selected?.order_number}`} size="md">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-400 text-xs">Customer</p>
                <p className="font-medium">{(selected.customer as Profile)?.full_name}</p>
                <p className="text-gray-500">{(selected.customer as Profile)?.phone}</p>
              </div>
              {!isDriver && (
                <div>
                  <p className="text-gray-400 text-xs">Driver</p>
                  <p className="font-medium">{(selected.driver as Profile)?.full_name ?? 'Unassigned'}</p>
                </div>
              )}
              {selected.delivery_address_snapshot && (
                <div className="col-span-2">
                  <p className="text-gray-400 text-xs mb-1">Delivery Address</p>
                  <div className="flex items-start gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <MapPin className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">
                      {(selected.delivery_address_snapshot as { address?: string }).address},{' '}
                      {(selected.delivery_address_snapshot as { city?: string }).city},{' '}
                      {(selected.delivery_address_snapshot as { state?: string }).state}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">Items</p>
              {selected.items?.map(item => (
                <div key={item.id} className="flex justify-between text-sm py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <span>{(item.product as { name: string })?.name} × {item.quantity}</span>
                  <span className="font-medium">{formatNaira(item.subtotal)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-sm pt-2">
                <span>Total</span>
                <span>{formatNaira(selected.total_amount)}</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold mb-1">Current Status</p>
              <Badge className={ORDER_STATUS_COLOR[selected.status]}>{ORDER_STATUS_LABEL[selected.status]}</Badge>
            </div>

            {selected.status !== 'delivered' && selected.status !== 'cancelled' && (isDriver || role === 'manager' || role === 'super_admin') && (
              <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                <Textarea label="Delivery Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add delivery notes..." />
                <div className="flex gap-2">
                  {selected.status === 'confirmed' && (
                    <Button variant="outline" onClick={() => updateStatus(selected.id, 'processing')} loading={updating} className="flex-1">
                      <Package className="w-4 h-4" /> Start Processing
                    </Button>
                  )}
                  {selected.status === 'processing' && (
                    <Button variant="outline" onClick={() => updateStatus(selected.id, 'out_for_delivery')} loading={updating} className="flex-1">
                      <Truck className="w-4 h-4" /> Out for Delivery
                    </Button>
                  )}
                  {selected.status === 'out_for_delivery' && (
                    <Button onClick={() => updateStatus(selected.id, 'delivered')} loading={updating} className="flex-1">
                      <CheckCircle className="w-4 h-4" /> Mark Delivered
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function DeliveryCard({ order, onSelect }: { order: Order; onSelect: () => void }) {
  const customer = order.customer as Profile;
  const driver = order.driver as Profile;
  const addr = order.delivery_address_snapshot as { address?: string; city?: string; state?: string } | null;
  return (
    <div className="card p-4 hover:shadow-card-hover transition-shadow cursor-pointer" onClick={onSelect}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
            <Truck className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <p className="font-mono text-sm font-bold text-gray-900 dark:text-white">{order.order_number}</p>
            <p className="text-xs text-gray-500">{customer?.full_name} · {customer?.phone}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={ORDER_STATUS_COLOR[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
          <span className="text-sm font-bold text-brand-600 dark:text-brand-400">{formatNaira(order.total_amount)}</span>
        </div>
      </div>
      {addr && (
        <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{addr.address}, {addr.city}</span>
        </div>
      )}
      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
        <span>{driver ? `Driver: ${driver.full_name}` : 'No driver assigned'}</span>
        <span>{formatDateTime(order.created_at)}</span>
      </div>
    </div>
  );
}

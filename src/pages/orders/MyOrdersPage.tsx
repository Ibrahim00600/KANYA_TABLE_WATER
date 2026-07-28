import { useEffect, useState } from 'react';
import { ShoppingBag, Clock, CheckCircle2, XCircle, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Order } from '@/types';
import { Badge, EmptyState, Spinner, Button } from '@/components/ui';
import { formatNaira, formatDateTime, ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, PAYMENT_STATUS_COLOR } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  confirmed: <CheckCircle2 className="w-4 h-4" />,
  processing: <Clock className="w-4 h-4" />,
  out_for_delivery: <Truck className="w-4 h-4" />,
  delivered: <CheckCircle2 className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
};

const STEPS = ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered'];

export default function MyOrdersPage({ onNavigate }: { onNavigate: (v: string) => void }) {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('orders')
      .select(`*, items:order_items(*, product:products(name, unit, image_url))`)
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setOrders(data ?? []); setLoading(false); });
  }, [profile]);

  if (loading) return <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track all your Kanya water orders</p>
        </div>
        <Button onClick={() => onNavigate('shop')}>Shop Again</Button>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-8 h-8" />}
          title="No orders yet"
          description="Place your first order and enjoy fresh Kanya water delivered to you!"
          action={<Button onClick={() => onNavigate('shop')}>Shop Now</Button>}
        />
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const isExpanded = expanded === order.id;
            const stepIdx = STEPS.indexOf(order.status);
            return (
              <div key={order.id} className="card overflow-hidden">
                <div
                  className="px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : order.id)}
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
                        {STATUS_ICONS[order.status]}
                      </div>
                      <div>
                        <p className="font-mono text-sm font-bold text-gray-900 dark:text-white">{order.order_number}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(order.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={ORDER_STATUS_COLOR[order.status]}>
                        {ORDER_STATUS_LABEL[order.status]}
                      </Badge>
                      <Badge className={PAYMENT_STATUS_COLOR[order.payment_status]}>
                        {order.payment_status}
                      </Badge>
                      <span className="font-bold text-brand-600 dark:text-brand-400">{formatNaira(order.total_amount)}</span>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-gray-800 animate-slide-up">
                    {/* Progress tracker */}
                    {order.status !== 'cancelled' && (
                      <div className="pt-4">
                        <div className="flex items-center gap-0">
                          {STEPS.map((step, idx) => (
                            <div key={step} className="flex items-center flex-1 last:flex-none">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors ${
                                idx <= stepIdx
                                  ? 'bg-brand-600 text-white'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                              }`}>
                                {idx < stepIdx ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                              </div>
                              {idx < STEPS.length - 1 && (
                                <div className={`flex-1 h-1 mx-1 rounded transition-colors ${idx < stepIdx ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between mt-1">
                          {STEPS.map(step => (
                            <span key={step} className="text-[9px] text-gray-400 text-center w-8 leading-tight">
                              {ORDER_STATUS_LABEL[step as keyof typeof ORDER_STATUS_LABEL]}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Items */}
                    <div>
                      <p className="text-sm font-semibold mb-2">Items Ordered</p>
                      {order.items?.map(item => (
                        <div key={item.id} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                          <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0">
                            {(item.product as { image_url?: string })?.image_url && (
                              <img src={(item.product as { image_url?: string })?.image_url} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <span className="flex-1 text-sm">{(item.product as { name: string })?.name}</span>
                          <span className="text-sm text-gray-500">× {item.quantity}</span>
                          <span className="text-sm font-medium">{formatNaira(item.subtotal)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-2 font-bold text-sm">
                        <span>Total</span>
                        <span className="text-brand-600 dark:text-brand-400">{formatNaira(order.total_amount)}</span>
                      </div>
                    </div>

                    {/* Delivery address */}
                    {order.delivery_address_snapshot && (
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm">
                        <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Delivery Address</p>
                        <p className="text-gray-500">
                          {(order.delivery_address_snapshot as { address?: string }).address},{' '}
                          {(order.delivery_address_snapshot as { city?: string }).city},{' '}
                          {(order.delivery_address_snapshot as { state?: string }).state}
                        </p>
                      </div>
                    )}

                    {order.special_instructions && (
                      <div className="text-sm">
                        <span className="font-medium">Note: </span>
                        <span className="text-gray-500">{order.special_instructions}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

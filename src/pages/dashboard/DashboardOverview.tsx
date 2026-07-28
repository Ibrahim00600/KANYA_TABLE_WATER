import { useEffect, useState } from 'react';
import { ShoppingCart, Users, Truck, Package, TrendingUp, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { StatCard, Spinner, Alert } from '@/components/ui';
import { formatNaira, formatDateTime, ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from '@/lib/utils';
import type { Order } from '@/types';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
}

export default function DashboardOverview({ onNavigate }: { onNavigate: (v: string) => void }) {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const role = profile?.role;
  const isStaff = role && role !== 'customer';

  useEffect(() => {
    if (!profile) return;
    if (role === 'customer') {
      loadCustomerStats();
    } else {
      loadStaffStats();
    }
  }, [profile]);

  async function loadCustomerStats() {
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, total_amount, created_at, order_number, payment_status')
        .eq('customer_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const allOrders = orders ?? [];
      setStats({
        totalOrders: allOrders.length,
        pendingOrders: allOrders.filter(o => ['pending','confirmed','processing','out_for_delivery'].includes(o.status)).length,
        deliveredOrders: allOrders.filter(o => o.status === 'delivered').length,
        totalRevenue: allOrders.reduce((s, o) => s + o.total_amount, 0),
        totalCustomers: 0,
        totalProducts: 0,
        totalStock: 0,
        lowStockCount: 0,
      });
      setRecentOrders(allOrders as Order[]);
    } catch {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  async function loadStaffStats() {
    try {
      const [ordersRes, customersRes, productsRes] = await Promise.all([
        supabase.from('orders').select('id, status, total_amount, payment_status, created_at, order_number').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'customer'),
        supabase.from('products').select('id, stock_quantity, is_available'),
      ]);

      const orders = ordersRes.data ?? [];
      const products = productsRes.data ?? [];
      const totalRevenue = orders.filter(o => o.payment_status === 'paid').reduce((s, o) => s + o.total_amount, 0);

      setStats({
        totalOrders: orders.length,
        pendingOrders: orders.filter(o => o.status === 'pending').length,
        deliveredOrders: orders.filter(o => o.status === 'delivered').length,
        totalRevenue,
        totalCustomers: customersRes.count ?? 0,
        totalProducts: products.length,
        totalStock: products.reduce((s, p) => s + (p.stock_quantity ?? 0), 0),
        lowStockCount: products.filter(p => (p.stock_quantity ?? 0) <= 20).length,
      });
      setRecentOrders(orders.slice(0, 6) as Order[]);
    } catch {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner className="w-8 h-8" />
    </div>
  );

  if (error) return <Alert type="error">{error}</Alert>;
  if (!stats) return null;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Welcome */}
      <div>
        <h1 className="page-title">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {profile?.full_name?.split(' ')[0] ?? 'there'}! 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          {new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<ShoppingCart className="w-5 h-5" />}
          label={role === 'customer' ? 'My Orders' : 'Total Orders'}
          value={stats.totalOrders}
          color="brand"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Pending"
          value={stats.pendingOrders}
          color="orange"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Delivered"
          value={stats.deliveredOrders}
          color="green"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label={role === 'customer' ? 'Total Spent' : 'Revenue'}
          value={formatNaira(stats.totalRevenue)}
          color="teal"
        />
        {isStaff && (
          <>
            <StatCard icon={<Users className="w-5 h-5" />} label="Customers" value={stats.totalCustomers} color="purple" />
            <StatCard icon={<Package className="w-5 h-5" />} label="Products" value={stats.totalProducts} color="brand" />
            <StatCard icon={<Truck className="w-5 h-5" />} label="Total Stock" value={stats.totalStock.toLocaleString()} sub="units in warehouse" color="teal" />
            <StatCard
              icon={<AlertTriangle className="w-5 h-5" />}
              label="Low Stock"
              value={stats.lowStockCount}
              sub="products need attention"
              color={stats.lowStockCount > 0 ? 'red' : 'green'}
            />
          </>
        )}
      </div>

      {/* Low stock alert */}
      {isStaff && stats.lowStockCount > 0 && (
        <Alert type="warning">
          <span className="font-semibold">{stats.lowStockCount} product{stats.lowStockCount > 1 ? 's are' : ' is'} running low on stock.</span>{' '}
          <button onClick={() => onNavigate('inventory')} className="underline">View inventory</button>
        </Alert>
      )}

      {/* Recent orders */}
      {recentOrders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-display font-semibold text-gray-900 dark:text-white">Recent Orders</h2>
            <button
              onClick={() => onNavigate(role === 'customer' ? 'my-orders' : 'orders')}
              className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
            >
              View all
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => (
                  <tr key={order.id}>
                    <td className="font-mono text-xs text-gray-600 dark:text-gray-300">{order.order_number}</td>
                    <td>
                      <span className={`badge ${ORDER_STATUS_COLOR[order.status]}`}>
                        {ORDER_STATUS_LABEL[order.status]}
                      </span>
                    </td>
                    <td className="font-medium">{formatNaira(order.total_amount)}</td>
                    <td className="text-gray-400 text-xs">{formatDateTime(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer CTA */}
      {role === 'customer' && recentOrders.length === 0 && (
        <div className="card p-8 text-center">
          <Package className="w-12 h-12 text-brand-400 mx-auto mb-3" />
          <h3 className="text-lg font-display font-semibold text-gray-900 dark:text-white mb-1">No orders yet</h3>
          <p className="text-gray-500 text-sm mb-4">Browse our fresh water products and place your first order!</p>
          <button onClick={() => onNavigate('shop')} className="btn btn-primary">Shop Now</button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Users, ShoppingCart, TrendingUp, Package, ClipboardList, DollarSign, Truck, Send, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StatCard, Spinner, AvatarCircle, Badge } from '@/components/ui';
import { formatNaira, formatDateTime, ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, ROLE_LABEL, ROLE_COLOR } from '@/lib/utils';

interface SystemStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  totalStock: number;
  pendingProduction: number;
  pendingRequests: number;
  unpaidCredits: number;
  unpaidCreditAmount: number;
}

interface ActivityItem {
  id: string;
  type: 'order' | 'production' | 'request' | 'credit';
  label: string;
  sub: string;
  time: string;
  status?: string;
}

export default function AdminMonitorPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [users, setUsers] = useState<{ full_name: string; role: string; is_active: boolean; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [
      usersRes, ordersRes, productsRes, prodRecordsRes, reqRes, creditRes
    ] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('id, status, total_amount, payment_status, created_at, order_number, customer:profiles!orders_customer_id_fkey(full_name)').order('created_at', { ascending: false }).limit(8),
      supabase.from('products').select('id, stock_quantity'),
      supabase.from('production_records').select('id, status, bags_produced, production_date, created_at, recorder:profiles!production_records_recorded_by_fkey(full_name)').order('created_at', { ascending: false }).limit(5),
      supabase.from('operator_requests').select('id, request_type, description, status, created_at, operator:profiles!operator_requests_operator_id_fkey(full_name)').order('created_at', { ascending: false }).limit(5),
      supabase.from('credit_records').select('id, customer_name, amount_owed, amount_paid, status, created_at').order('created_at', { ascending: false }).limit(5),
    ]);

    const allOrders = ordersRes.data ?? [];
    const allProducts = productsRes.data ?? [];
    const allProd = prodRecordsRes.data ?? [];
    const allReq = reqRes.data ?? [];
    const allCredits = creditRes.data ?? [];

    setStats({
      totalUsers: usersRes.data?.length ?? 0,
      totalOrders: allOrders.length,
      totalRevenue: allOrders.filter(o => o.payment_status === 'paid').reduce((s: number, o: { total_amount: number }) => s + o.total_amount, 0),
      pendingOrders: allOrders.filter(o => o.status === 'pending').length,
      totalStock: allProducts.reduce((s: number, p: { stock_quantity: number }) => s + p.stock_quantity, 0),
      pendingProduction: allProd.filter(r => r.status === 'pending').length,
      pendingRequests: allReq.filter(r => r.status === 'pending').length,
      unpaidCredits: allCredits.filter(r => r.status !== 'paid').length,
      unpaidCreditAmount: allCredits.filter(r => r.status !== 'paid').reduce((s: number, r: { amount_owed: number; amount_paid: number }) => s + (r.amount_owed - r.amount_paid), 0),
    });

    setUsers(usersRes.data?.slice(0, 10) ?? []);

    const activity: ActivityItem[] = [
      ...allOrders.slice(0, 3).map(o => ({
        id: o.id, type: 'order' as const,
        label: `Order ${o.order_number}`,
        sub: `by ${(o.customer as unknown as { full_name: string } | null)?.full_name ?? 'Unknown'} — ${formatNaira(o.total_amount)}`,
        time: o.created_at, status: o.status,
      })),
      ...allProd.slice(0, 3).map(r => ({
        id: r.id, type: 'production' as const,
        label: `Production: ${r.bags_produced} bags`,
        sub: `by ${(r.recorder as unknown as { full_name: string } | null)?.full_name ?? 'Unknown'}`,
        time: r.created_at, status: r.status,
      })),
      ...allReq.slice(0, 2).map(r => ({
        id: r.id, type: 'request' as const,
        label: `${r.request_type} request`,
        sub: `${(r.operator as unknown as { full_name: string } | null)?.full_name ?? 'Unknown'}: ${r.description}`,
        time: r.created_at, status: r.status,
      })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);

    setRecentActivity(activity);
    setLoading(false);
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="page-title">System Monitor</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Full overview of all Kanya Water operations</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-5 h-5" />} label="Total Users" value={stats?.totalUsers ?? 0} color="brand" />
        <StatCard icon={<ShoppingCart className="w-5 h-5" />} label="Total Orders" value={stats?.totalOrders ?? 0} color="teal" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Revenue (Paid)" value={formatNaira(stats?.totalRevenue ?? 0)} color="green" />
        <StatCard icon={<Package className="w-5 h-5" />} label="Total Stock" value={(stats?.totalStock ?? 0).toLocaleString()} color="brand" />
        <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="Pending Orders" value={stats?.pendingOrders ?? 0} color="orange" />
        <StatCard icon={<ClipboardList className="w-5 h-5" />} label="Awaiting Approval" value={stats?.pendingProduction ?? 0} color="orange" sub="production records" />
        <StatCard icon={<Send className="w-5 h-5" />} label="Pending Requests" value={stats?.pendingRequests ?? 0} color="purple" />
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Unpaid Credits" value={formatNaira(stats?.unpaidCreditAmount ?? 0)} color={stats?.unpaidCreditAmount ? 'red' : 'green'} sub={`${stats?.unpaidCredits ?? 0} people`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-display font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {recentActivity.map(a => {
              const iconMap = { order: <ShoppingCart className="w-4 h-4" />, production: <ClipboardList className="w-4 h-4" />, request: <Send className="w-4 h-4" />, credit: <DollarSign className="w-4 h-4" /> };
              const colorMap = { order: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20', production: 'bg-green-50 text-green-600 dark:bg-green-900/20', request: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20', credit: 'bg-red-50 text-red-600 dark:bg-red-900/20' };
              return (
                <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[a.type]}`}>
                    {iconMap[a.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{a.label}</p>
                    <p className="text-xs text-gray-500 truncate">{a.sub}</p>
                    <p className="text-xs text-gray-400">{formatDateTime(a.time)}</p>
                  </div>
                  {a.status && (
                    <Badge className={ORDER_STATUS_COLOR[a.status as keyof typeof ORDER_STATUS_COLOR] ?? 'bg-gray-100 text-gray-600 text-[10px]'}>
                      {ORDER_STATUS_LABEL[a.status as keyof typeof ORDER_STATUS_LABEL] ?? a.status}
                    </Badge>
                  )}
                </div>
              );
            })}
            {recentActivity.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No recent activity.</p>}
          </div>
        </div>

        {/* Recent Users */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-display font-semibold text-gray-900 dark:text-white">Recent Users</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {users.map((u, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <AvatarCircle name={u.full_name || 'User'} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.full_name || 'Unknown'}</p>
                  <p className="text-xs text-gray-400">{formatDateTime(u.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className={ROLE_COLOR[u.role as keyof typeof ROLE_COLOR] ?? ''}>{ROLE_LABEL[u.role as keyof typeof ROLE_LABEL] ?? u.role}</Badge>
                  <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

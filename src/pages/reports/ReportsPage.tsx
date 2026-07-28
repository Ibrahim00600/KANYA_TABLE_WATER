import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Calendar, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StatCard, Spinner, Button } from '@/components/ui';
import { formatNaira, formatDate } from '@/lib/utils';

interface DailySale {
  date: string;
  orders: number;
  revenue: number;
}

interface ProductStat {
  name: string;
  quantity: number;
  revenue: number;
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [productStats, setProductStats] = useState<ProductStat[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [deliveredOrders, setDeliveredOrders] = useState(0);

  useEffect(() => {
    loadReports();
  }, [period]);

  async function loadReports() {
    setLoading(true);
    const now = new Date();
    let start: Date;
    if (period === 'week') start = new Date(now.getTime() - 7 * 86400000);
    else if (period === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
    else start = new Date(now.getFullYear(), 0, 1);

    const startStr = start.toISOString().split('T')[0];

    const { data: orders } = await supabase
      .from('orders')
      .select('*, items:order_items(quantity, unit_price, subtotal, product:products(name))')
      .gte('created_at', startStr)
      .order('created_at', { ascending: true });

    const all = orders ?? [];
    const delivered = all.filter(o => o.status === 'delivered');
    const revenue = delivered.reduce((s: number, o: { total_amount: number }) => s + o.total_amount, 0);

    setTotalOrders(all.length);
    setDeliveredOrders(delivered.length);
    setTotalRevenue(revenue);

    // Daily sales
    const dayMap: Record<string, { orders: number; revenue: number }> = {};
    all.forEach((o: { created_at: string; total_amount: number; status: string }) => {
      const d = o.created_at.split('T')[0];
      if (!dayMap[d]) dayMap[d] = { orders: 0, revenue: 0 };
      dayMap[d].orders += 1;
      if (o.status === 'delivered') dayMap[d].revenue += o.total_amount;
    });
    const days = Object.entries(dayMap).map(([date, v]) => ({ date, ...v }));
    setDailySales(days);

    // Product stats
    const prodMap: Record<string, { quantity: number; revenue: number }> = {};
    all.forEach((o: { items: Array<{ product: { name: string } | null; quantity: number; subtotal: number }> }) => {
      o.items?.forEach((item) => {
        const name = item.product?.name ?? 'Unknown';
        if (!prodMap[name]) prodMap[name] = { quantity: 0, revenue: 0 };
        prodMap[name].quantity += item.quantity;
        prodMap[name].revenue += item.subtotal;
      });
    });
    setProductStats(Object.entries(prodMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue));

    setLoading(false);
  }

  const maxRevenue = Math.max(...dailySales.map(d => d.revenue), 1);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Business performance overview</p>
        </div>
        <div className="flex gap-2 items-center">
          {(['week', 'month', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                period === p ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              {p}
            </button>
          ))}
          <Button
            size="sm"
            variant="outline"
            icon={<Download className="w-4 h-4" />}
            onClick={() => {
              const headers = ['Date', 'Orders', 'Revenue (NGN)'];
              const rows = dailySales.map(d => [d.date, d.orders, d.revenue]);
              const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement('a');
              link.setAttribute('href', encodedUri);
              link.setAttribute('download', `kanya_sales_report_${period}_${new Date().toISOString().split('T')[0]}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Revenue" value={formatNaira(totalRevenue)} color="green" />
            <StatCard icon={<BarChart3 className="w-5 h-5" />} label="Total Orders" value={totalOrders} color="brand" />
            <StatCard icon={<Calendar className="w-5 h-5" />} label="Delivered" value={deliveredOrders} color="teal" />
            <StatCard
              icon={<TrendingDown className="w-5 h-5" />}
              label="Delivery Rate"
              value={totalOrders > 0 ? `${Math.round((deliveredOrders / totalOrders) * 100)}%` : '0%'}
              color={totalOrders > 0 && deliveredOrders / totalOrders >= 0.8 ? 'green' : 'orange'}
            />
          </div>

          {/* Revenue Chart */}
          <div className="card p-6">
            <h2 className="font-display font-semibold text-gray-900 dark:text-white mb-4">Revenue Trend</h2>
            {dailySales.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No data for selected period</p>
            ) : (
              <div className="space-y-2">
                {dailySales.slice(-14).map(d => (
                  <div key={d.date} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-20 flex-shrink-0">{formatDate(d.date, { month: 'short', day: 'numeric' })}</span>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all duration-500"
                        style={{ width: `${(d.revenue / maxRevenue) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-28 text-right">{formatNaira(d.revenue)}</span>
                    <span className="text-xs text-gray-400 w-16 text-right">{d.orders} orders</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product performance */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-display font-semibold text-gray-900 dark:text-white">Product Performance</h2>
            </div>
            {productStats.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No sales data for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty Sold</th>
                      <th>Revenue</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productStats.map(p => (
                      <tr key={p.name}>
                        <td className="font-medium">{p.name}</td>
                        <td>{p.quantity.toLocaleString()}</td>
                        <td className="font-semibold">{formatNaira(p.revenue)}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 max-w-[80px] bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                              <div
                                className="h-full bg-brand-500 rounded-full"
                                style={{ width: `${totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400">
                              {totalRevenue > 0 ? Math.round((p.revenue / totalRevenue) * 100) : 0}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

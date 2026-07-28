import { Suspense, lazy, useState, Component, type ReactNode } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { Spinner } from '@/components/ui';

const LandingPage = lazy(() => import('@/pages/landing/LandingPage'));
const AuthPage = lazy(() => import('@/pages/auth/AuthPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const DashboardLayout = lazy(() => import('@/components/DashboardLayout'));

const DashboardOverview = lazy(() => import('@/pages/dashboard/DashboardOverview'));
const ShopPage = lazy(() => import('@/pages/shop/ShopPage'));
const MyOrdersPage = lazy(() => import('@/pages/orders/MyOrdersPage'));
const OrdersPage = lazy(() => import('@/pages/orders/OrdersPage'));
const ProductsPage = lazy(() => import('@/pages/products/ProductsPage'));
const InventoryPage = lazy(() => import('@/pages/inventory/InventoryPage'));
const ProductionPage = lazy(() => import('@/pages/production/ProductionPage'));
const DeliveriesPage = lazy(() => import('@/pages/deliveries/DeliveriesPage'));
const UsersPage = lazy(() => import('@/pages/users/UsersPage'));
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'));
const MessagesPage = lazy(() => import('@/pages/messages/MessagesPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
// Manager
const DriverLoadsPage = lazy(() => import('@/pages/manager/DriverLoadsPage'));
const CreditsPage = lazy(() => import('@/pages/manager/CreditsPage'));
const StaffCashPage = lazy(() => import('@/pages/manager/StaffCashPage'));
const OperatorRequestsPage = lazy(() => import('@/pages/manager/OperatorRequestsPage'));
// Operator
const OperatorDashboard = lazy(() => import('@/pages/operator/OperatorDashboard'));
// Admin
const AdminMonitorPage = lazy(() => import('@/pages/admin/AdminMonitorPage'));

function PageLoader() {
  return <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>;
}

function PageView({ view, setView, role }: { view: string; setView: (v: string) => void; role: string }) {
  const nav = (v: string) => setView(v);

  // Operators get their own dashboard as default
  if (role === 'sales_officer' && view === 'dashboard') {
    return <OperatorDashboard />;
  }

  switch (view) {
    case 'dashboard': return <DashboardOverview onNavigate={nav} />;
    case 'monitor': return <AdminMonitorPage />;
    case 'shop': return <ShopPage onNavigate={nav} />;
    case 'my-orders': return <MyOrdersPage onNavigate={nav} />;
    case 'orders': return <OrdersPage />;
    case 'products': return <ProductsPage />;
    case 'inventory': return <InventoryPage />;
    case 'production': return <ProductionPage />;
    case 'deliveries': return <DeliveriesPage />;
    case 'users': return <UsersPage />;
    case 'reports': return <ReportsPage />;
    case 'messages': return <MessagesPage />;
    case 'settings': return <SettingsPage />;
    case 'driver-loads': return <DriverLoadsPage />;
    case 'credits': return <CreditsPage />;
    case 'staff-cash': return <StaffCashPage />;
    case 'op-requests': return <OperatorRequestsPage />;
    case 'op-dashboard': return <OperatorDashboard />;
    default: return <DashboardOverview onNavigate={nav} />;
  }
}

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="w-10 h-10" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading Kanya Water...</p>
      </div>
    </div>
  );
}

function AppRouter() {
  const { user, profile, loading } = useAuth();

  const isResetPage = window.location.hash.includes('access_token') && window.location.hash.includes('type=recovery');
  if (isResetPage) {
    return <Suspense fallback={<FullPageLoader />}><ResetPasswordPage /></Suspense>;
  }

  if (loading) return <FullPageLoader />;

  if (!user) {
    return <Suspense fallback={<FullPageLoader />}><AppEntry /></Suspense>;
  }

  const role = profile?.role ?? 'customer';

  return (
    <Suspense fallback={<FullPageLoader />}>
      <DashboardLayout>
        {(view, setView) => (
          <Suspense fallback={<PageLoader />}>
            <PageView view={view} setView={setView} role={role} />
          </Suspense>
        )}
      </DashboardLayout>
    </Suspense>
  );
}

function AppEntry() {
  const [showAuth, setShowAuth] = useState(false);
  const { user } = useAuth();
  if (user) return null;
  if (showAuth) return <AuthPage />;
  return <LandingPage onLogin={() => setShowAuth(true)} />;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.error("App Error Boundary:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 p-6 text-center">
          <h2 className="font-display font-bold text-2xl text-gray-900 dark:text-white mb-2">Something went wrong</h2>
          <p className="text-gray-500 text-sm mb-4 max-w-md">{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-medium text-sm">
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <Suspense fallback={<FullPageLoader />}>
              <AppRouter />
            </Suspense>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

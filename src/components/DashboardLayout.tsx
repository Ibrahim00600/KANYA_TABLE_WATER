import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Truck, Users, BarChart3,
  MessageSquare, Settings, LogOut, Menu, X, Bell, Moon, Sun,
  Droplets, ClipboardList, Warehouse, BoxIcon, DollarSign,
  CreditCard, Send, Activity, ChevronDown, Upload
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useCart } from '@/contexts/CartContext';
import { KanyaLogo } from '@/components/KanyaLogo';
import { AvatarCircle, Badge } from '@/components/ui';
import { cn, ROLE_LABEL } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface NavItem {
  label: string;
  view: string;
  icon: ReactNode;
  roles: string[];
  badge?: number;
  group?: string;
}

interface DashboardLayoutProps {
  children: (view: string, setView: (v: string) => void) => ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { totalItems } = useCart();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState(() => {
    // Default view based on role
    return 'dashboard';
  });
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);

  // Quick upload modal (for manager + delivery)
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNote, setUploadNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  async function handleQuickUpload() {
    if (!uploadFile) return;
    setUploading(true);
    try {
      await supabase.from('messages').insert({
        sender_id: profile?.id ?? null,
        recipient_id: null,
        is_broadcast: true,
        subject: `📎 File Upload: ${uploadFile.name}`,
        body: uploadNote || `Uploaded by ${profile?.full_name ?? 'Staff'}: ${uploadFile.name} (${(uploadFile.size / 1024).toFixed(1)} KB)`,
      });
      setUploadMsg('Record uploaded successfully!');
      setUploadFile(null);
      setUploadNote('');
      setTimeout(() => { setUploadMsg(''); setShowUpload(false); }, 2000);
    } catch (err: any) {
      setUploadMsg('Upload failed: ' + (err?.message || 'Unknown error'));
    } finally { setUploading(false); }
  }

  useEffect(() => {
    if (!profile) return;
    supabase.from('messages').select('id', { count: 'exact' }).eq('recipient_id', profile.id).eq('is_read', false)
      .then(({ count }) => setUnreadMessages(count ?? 0));
    if (profile.role === 'manager' || profile.role === 'super_admin') {
      supabase.from('operator_requests').select('id', { count: 'exact' }).eq('status', 'pending')
        .then(({ count }) => setPendingRequests(count ?? 0));
    }
  }, [profile]);

  const role = profile?.role ?? 'customer';

  const navItems: NavItem[] = [
    // Common
    { label: 'Dashboard', view: 'dashboard', icon: <LayoutDashboard className="w-4 h-4" />, roles: ['super_admin','manager','sales_officer','delivery','customer'] },
    // Admin only
    { label: 'System Monitor', view: 'monitor', icon: <Activity className="w-4 h-4" />, roles: ['super_admin'], group: 'Admin' },
    { label: 'Users', view: 'users', icon: <Users className="w-4 h-4" />, roles: ['super_admin'], group: 'Admin' },
    { label: 'Reports', view: 'reports', icon: <BarChart3 className="w-4 h-4" />, roles: ['super_admin','manager'], group: 'Admin' },
    // Customer
    { label: 'Shop', view: 'shop', icon: <Package className="w-4 h-4" />, roles: ['customer'], badge: totalItems || undefined },
    { label: 'My Orders', view: 'my-orders', icon: <ShoppingCart className="w-4 h-4" />, roles: ['customer'] },
    // Staff shared
    { label: 'Orders', view: 'orders', icon: <ShoppingCart className="w-4 h-4" />, roles: ['super_admin','manager','sales_officer'], group: 'Operations' },
    { label: 'Products', view: 'products', icon: <BoxIcon className="w-4 h-4" />, roles: ['super_admin','manager','sales_officer'], group: 'Operations' },
    { label: 'Inventory', view: 'inventory', icon: <Warehouse className="w-4 h-4" />, roles: ['super_admin','manager','sales_officer'], group: 'Operations' },
    { label: 'Production', view: 'production', icon: <ClipboardList className="w-4 h-4" />, roles: ['super_admin','manager','sales_officer'], group: 'Operations' },
    { label: 'Deliveries', view: 'deliveries', icon: <Truck className="w-4 h-4" />, roles: ['super_admin','manager','delivery'], group: 'Operations' },
    // Manager specific
    { label: 'Driver Loads', view: 'driver-loads', icon: <Truck className="w-4 h-4" />, roles: ['super_admin','manager'], group: 'Manager' },
    { label: 'Credits & Debts', view: 'credits', icon: <CreditCard className="w-4 h-4" />, roles: ['super_admin','manager'], group: 'Manager' },
    { label: 'Staff Cash', view: 'staff-cash', icon: <DollarSign className="w-4 h-4" />, roles: ['super_admin','manager'], group: 'Manager' },
    { label: 'Operator Requests', view: 'op-requests', icon: <Send className="w-4 h-4" />, roles: ['super_admin','manager'], badge: pendingRequests || undefined, group: 'Manager' },
    // Operator specific
    { label: 'My Production', view: 'op-dashboard', icon: <ClipboardList className="w-4 h-4" />, roles: ['sales_officer'] },
    // Shared comms
    { label: 'Messages', view: 'messages', icon: <MessageSquare className="w-4 h-4" />, roles: ['super_admin','manager','sales_officer','delivery'], badge: unreadMessages || undefined },
    { label: 'Settings', view: 'settings', icon: <Settings className="w-4 h-4" />, roles: ['super_admin','manager','sales_officer','delivery','customer'] },
  ];

  const visibleNav = navItems.filter(n => n.roles.includes(role));

  // Group items
  const grouped: { label: string; items: NavItem[] }[] = [];
  const ungrouped: NavItem[] = [];
  visibleNav.forEach(n => {
    if (n.group) {
      const g = grouped.find(g => g.label === n.group);
      if (g) g.items.push(n);
      else grouped.push({ label: n.group, items: [n] });
    } else {
      ungrouped.push(n);
    }
  });

  function NavLink({ item }: { item: NavItem }) {
    const active = view === item.view;
    return (
      <button
        onClick={() => { setView(item.view); setSidebarOpen(false); }}
        className={cn('sidebar-link w-full', active ? 'sidebar-link-active' : 'sidebar-link-inactive')}
      >
        {item.icon}
        <span className="flex-1 text-left text-sm">{item.label}</span>
        {!!item.badge && (
          <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {item.badge > 9 ? '9+' : item.badge}
          </span>
        )}
      </button>
    );
  }

  function Sidebar() {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-gray-900">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-800">
          <img src="/WhatsApp_Image_2026-07-27_at_1.04.57_PM.jpeg" alt="Kanya" className="w-9 h-9 rounded-lg object-contain border border-gray-200 dark:border-gray-700" />
          <div className="min-w-0">
            <h1 className="font-display font-bold text-gray-900 dark:text-white text-sm leading-none">Kanya Water</h1>
            <p className="text-gray-400 text-[10px] mt-0.5">Management System</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin space-y-4">
          {/* Ungrouped first */}
          {ungrouped.length > 0 && (
            <div className="space-y-0.5">
              {ungrouped.map(item => <NavLink key={item.view} item={item} />)}
            </div>
          )}
          {/* Grouped sections */}
          {grouped.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-1">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map(item => <NavLink key={item.view} item={item} />)}
              </div>
            </div>
          ))}
        </nav>

        {/* Profile */}
        <div className="border-t border-gray-100 dark:border-gray-800 p-3">
          <div className="flex items-center gap-2 px-2 py-2 mb-1">
            <AvatarCircle name={profile?.full_name || 'User'} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{profile?.full_name || 'User'}</p>
              <Badge className="text-[9px] px-1.5 py-0 bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400">
                {ROLE_LABEL[profile?.role ?? 'customer']}
              </Badge>
            </div>
          </div>
          <button onClick={signOut} className="sidebar-link sidebar-link-inactive w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 text-sm">
            <LogOut className="w-4 h-4" />Sign Out
          </button>
        </div>
      </div>
    );
  }

  const currentLabel = visibleNav.find(n => n.view === view)?.label ?? 'Dashboard';

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <aside className="hidden lg:flex flex-col w-[256px] flex-shrink-0 border-r border-gray-200 dark:border-gray-800">
        <Sidebar />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[256px] border-r border-gray-200 dark:border-gray-800 z-10">
            <div className="absolute top-3 right-3 z-20">
              <button onClick={() => setSidebarOpen(false)} className="btn-ghost rounded-lg p-1.5"><X className="w-5 h-5" /></button>
            </div>
            <Sidebar />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 px-4 lg:px-5 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <button className="lg:hidden btn-ghost rounded-lg p-1.5" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-brand-500" />
            <span className="font-display font-semibold text-gray-900 dark:text-white text-sm">{currentLabel}</span>
          </div>
          <div className="flex-1" />
          <button onClick={toggleTheme} className="btn-ghost rounded-lg p-2">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {/* Upload Record button for manager + delivery */}
          {(role === 'manager' || role === 'delivery' || role === 'super_admin') && (
            <button
              onClick={() => { setShowUpload(true); setUploadMsg(''); setUploadFile(null); }}
              className="btn-ghost rounded-lg p-2 text-brand-500 hover:text-brand-600"
              title="Upload Record"
            >
              <Upload className="w-4 h-4" />
            </button>
          )}
          <button className="btn-ghost rounded-lg p-2 relative" onClick={() => setView('messages')}>
            <Bell className="w-4 h-4" />
            {(unreadMessages + pendingRequests) > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />}
          </button>
          <button className="flex items-center gap-1.5 btn-ghost rounded-lg px-2 py-1">
            <AvatarCircle name={profile?.full_name || 'User'} size="sm" />
            <span className="hidden sm:block text-xs font-medium text-gray-700 dark:text-gray-300 max-w-[90px] truncate">
              {profile?.full_name?.split(' ')[0] || 'User'}
            </span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 lg:p-5 max-w-7xl mx-auto animate-fade-in">
            {children(view, setView)}
          </div>
        </main>
      </div>

      {/* Quick Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowUpload(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-gray-900 dark:text-white">📂 Upload Record</h2>
              <button onClick={() => setShowUpload(false)} className="btn-ghost rounded-lg p-1.5"><X className="w-4 h-4" /></button>
            </div>
            {uploadMsg && (
              <div className={`text-sm px-3 py-2 rounded-lg ${uploadMsg.includes('fail') || uploadMsg.includes('error') ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-green-50 text-green-700 dark:bg-green-900/20'}`}>
                {uploadMsg}
              </div>
            )}
            <p className="text-xs text-gray-400">Upload a photo, scan, or document of manually recorded book data</p>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-brand-300 dark:border-brand-700 rounded-2xl p-6 cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors">
              <input type="file" accept="image/*,application/pdf,.xlsx,.xls,.csv" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setUploadFile(f); }} />
              <Upload className="w-8 h-8 text-brand-400 mb-2" />
              {uploadFile ? (
                <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">{uploadFile.name}</p>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Tap to take photo or browse</p>
                  <p className="text-xs text-gray-400 mt-0.5">Image, PDF, Excel supported</p>
                </div>
              )}
            </label>
            <textarea
              rows={2}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="Note (optional): e.g. July delivery records..."
              value={uploadNote}
              onChange={e => setUploadNote(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowUpload(false)} className="flex-1 btn btn-secondary btn-md">Cancel</button>
              <button
                onClick={handleQuickUpload}
                disabled={!uploadFile || uploading}
                className="flex-1 btn btn-primary btn-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : (<><Upload className="w-4 h-4" /> Upload</>)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert } from '@/components/ui';

type AuthMode = 'login' | 'register' | 'forgot';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '', confirmPassword: '', role: 'super_admin' as string });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    setError('');
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');

    if (mode === 'forgot') {
      setLoading(true);
      const { error: err } = await import('@/lib/supabase').then(m =>
        m.supabase.auth.resetPasswordForEmail(form.email, { redirectTo: `${window.location.origin}/reset-password` })
      );
      setLoading(false);
      if (err) setError(err.message);
      else setSuccess('Password reset email sent! Check your inbox.');
      return;
    }

    if (mode === 'register') {
      if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
      if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
      if (!form.full_name.trim()) { setError('Full name is required.'); return; }
      setLoading(true);
      const { error: err } = await signUp(form.email, form.password, { full_name: form.full_name, phone: form.phone, role: form.role });
      setLoading(false);
      if (err) setError(err);
      else { setSuccess('Account created! You can now sign in.'); setMode('login'); }
      return;
    }

    setLoading(true);
    const { error: err } = await signIn(form.email, form.password);
    setLoading(false);
    if (err) setError(err);
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-8">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(/WhatsApp_Image_2026-07-27_at_1.04.57_PM.jpeg)` }}
      />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <img
            src="/WhatsApp_Image_2026-07-27_at_1.04.57_PM.jpeg"
            alt="Kanya Water"
            className="w-20 h-20 rounded-xl object-contain border-2 border-white/30 mx-auto mb-3 shadow-xl"
          />
          <h1 className="font-display font-bold text-2xl text-white">Kanya Water</h1>
          <p className="text-blue-200 text-sm">Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl p-6">
          <h2 className="font-display font-bold text-xl text-gray-900 dark:text-white mb-1">
            {mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Reset Password'}
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            {mode === 'login' ? 'Enter your credentials to continue.' : mode === 'register' ? 'Register as a customer.' : 'Enter your email address.'}
          </p>

          {error && <Alert type="error" className="mb-3 text-sm">{error}</Alert>}
          {success && <Alert type="success" className="mb-3 text-sm">{success}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="label">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input className="input pl-9" type="text" placeholder="Your full name" value={form.full_name} onChange={set('full_name')} required />
                </div>
              </div>
            )}

            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="input pl-9" type="email" placeholder="example@email.com" value={form.email} onChange={set('email')} required />
              </div>
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label className="label">Account Type / Role</label>
                  <select className="input" value={form.role} onChange={set('role')}>
                    <option value="super_admin">Super Admin (System Owner)</option>
                    <option value="manager">Manager</option>
                    <option value="sales_officer">Sales Officer / Operator</option>
                    <option value="delivery">Delivery Driver</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>
                <div>
                  <label className="label">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input className="input pl-9" type="tel" placeholder="08012345678" value={form.phone} onChange={set('phone')} />
                  </div>
                </div>
              </>
            )}

            {mode !== 'forgot' && (
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    className="input pl-9 pr-10"
                    type={showPwd ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={set('password')}
                    required
                  />
                  <button type="button" onClick={() => setShowPwd(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="label">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input className="input pl-9" type={showPwd ? 'text' : 'password'} placeholder="••••••••" value={form.confirmPassword} onChange={set('confirmPassword')} required />
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="flex justify-end">
                <button type="button" onClick={() => setMode('forgot')} className="text-xs text-brand-600 hover:underline">Forgot password?</button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            {mode !== 'login' && (
              <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }} className="flex items-center gap-1 text-brand-600 hover:underline">
                <ArrowLeft className="w-3 h-3" /> Back to Sign In
              </button>
            )}
            {mode === 'login' && (
              <button onClick={() => { setMode('register'); setError(''); }} className="text-brand-600 hover:underline ml-auto">
                New customer? Register
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

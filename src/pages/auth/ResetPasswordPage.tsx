import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button, Input, Alert } from '@/components/ui';
import { KanyaLogo } from '@/components/KanyaLogo';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Parse token from URL hash
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.replace('#', '?'));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) setError(err.message);
    else setDone(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <KanyaLogo className="w-10 h-10" />
          <div>
            <h1 className="font-display font-bold text-xl text-gray-900 dark:text-white">Kanya Water</h1>
          </div>
        </div>

        {done ? (
          <div className="card p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-display font-bold text-gray-900 dark:text-white mb-2">Password Reset!</h2>
            <p className="text-gray-500 mb-6">Your password has been updated. You can now sign in.</p>
            <a href="/" className="btn btn-primary w-full justify-center">Go to Sign In</a>
          </div>
        ) : (
          <div className="card p-8">
            <h2 className="text-2xl font-display font-bold text-gray-900 dark:text-white mb-1">Set New Password</h2>
            <p className="text-gray-500 text-sm mb-6">Enter your new password below.</p>

            {error && <Alert type="error" className="mb-4">{error}</Alert>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="New Password"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                required
                leftIcon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button type="button" onClick={() => setShowPwd(s => !s)}>
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
              <Input
                label="Confirm New Password"
                type={showPwd ? 'text' : 'password'}
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError(''); }}
                placeholder="••••••••"
                required
                leftIcon={<Lock className="w-4 h-4" />}
              />
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Reset Password
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

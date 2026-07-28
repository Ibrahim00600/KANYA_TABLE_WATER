import { useState } from 'react';
import { User, Phone, Mail, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button, Input, Alert } from '@/components/ui';
import { AvatarCircle } from '@/components/ui';
import { ROLE_LABEL } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<'profile' | 'password'>('profile');

  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdError, setPwdError] = useState('');

  async function saveProfile() {
    if (!profileForm.full_name.trim()) { setProfileError('Name is required.'); return; }
    setSavingProfile(true);
    setProfileError('');
    const { error } = await supabase.from('profiles').update({
      full_name: profileForm.full_name,
      phone: profileForm.phone,
      updated_at: new Date().toISOString(),
    }).eq('id', profile!.id);
    setSavingProfile(false);
    if (error) { setProfileError(error.message); return; }
    await refreshProfile();
    setProfileSuccess('Profile updated successfully!');
    setTimeout(() => setProfileSuccess(''), 3000);
  }

  async function changePassword() {
    if (!pwdForm.newPwd || pwdForm.newPwd.length < 8) { setPwdError('New password must be at least 8 characters.'); return; }
    if (pwdForm.newPwd !== pwdForm.confirm) { setPwdError('Passwords do not match.'); return; }
    setSavingPwd(true);
    setPwdError('');
    const { error } = await supabase.auth.updateUser({ password: pwdForm.newPwd });
    setSavingPwd(false);
    if (error) { setPwdError(error.message); return; }
    setPwdSuccess('Password changed successfully!');
    setPwdForm({ current: '', newPwd: '', confirm: '' });
    setTimeout(() => setPwdSuccess(''), 3000);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile header */}
      <div className="card p-6 flex items-center gap-4">
        <AvatarCircle name={profile?.full_name || 'User'} size="lg" />
        <div>
          <h2 className="font-display font-semibold text-gray-900 dark:text-white text-lg">{profile?.full_name}</h2>
          <p className="text-sm text-gray-500">{ROLE_LABEL[profile?.role ?? 'customer']}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-1 text-xs ${profile?.is_active ? 'text-green-600' : 'text-red-500'}`}>
              <CheckCircle className="w-3 h-3" />
              {profile?.is_active ? 'Account Active' : 'Account Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {([
          { key: 'profile', label: 'Profile', icon: <User className="w-3.5 h-3.5" /> },
          { key: 'password', label: 'Password', icon: <Lock className="w-3.5 h-3.5" /> },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="card p-6 space-y-4">
          {profileSuccess && <Alert type="success">{profileSuccess}</Alert>}
          {profileError && <Alert type="error">{profileError}</Alert>}
          <Input
            label="Full Name"
            value={profileForm.full_name}
            onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
            leftIcon={<User className="w-4 h-4" />}
            placeholder="Your full name"
          />
          <Input
            label="Phone Number"
            type="tel"
            value={profileForm.phone}
            onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
            leftIcon={<Phone className="w-4 h-4" />}
            placeholder="08012345678"
          />
          <Button onClick={saveProfile} loading={savingProfile} icon={<CheckCircle className="w-4 h-4" />}>
            Save Profile
          </Button>

          {/* System Role Access */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Role & Administrative Access</p>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Current Role: <span className="font-bold text-brand-600 dark:text-brand-400">{ROLE_LABEL[profile?.role ?? 'customer']}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Account roles and permissions are managed by system Super Admins.</p>
            </div>
          </div>

          {/* Appearance */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Appearance</p>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Dark Mode</p>
                <p className="text-xs text-gray-400">Switch between light and dark theme</p>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative w-11 h-6 rounded-full transition-colors ${theme === 'dark' ? 'bg-brand-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${theme === 'dark' ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'password' && (
        <div className="card p-6 space-y-4">
          {pwdSuccess && <Alert type="success">{pwdSuccess}</Alert>}
          {pwdError && <Alert type="error">{pwdError}</Alert>}
          <Input
            label="New Password"
            type={showPwd ? 'text' : 'password'}
            value={pwdForm.newPwd}
            onChange={e => setPwdForm(f => ({ ...f, newPwd: e.target.value }))}
            leftIcon={<Lock className="w-4 h-4" />}
            placeholder="At least 8 characters"
            rightIcon={
              <button type="button" onClick={() => setShowPwd(s => !s)}>
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          <Input
            label="Confirm New Password"
            type={showPwd ? 'text' : 'password'}
            value={pwdForm.confirm}
            onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))}
            leftIcon={<Lock className="w-4 h-4" />}
            placeholder="Repeat new password"
          />
          <Button onClick={changePassword} loading={savingPwd}>
            Change Password
          </Button>
        </div>
      )}
    </div>
  );
}

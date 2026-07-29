import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Send, Users, Bell, Inbox, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Message, Profile } from '@/types';
import { Button, Input, Textarea, Select, Modal, AvatarCircle, Badge, EmptyState, Spinner, Alert } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function MessagesPage() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'inbox' | 'sent' | 'broadcast'>('inbox');
  const [showCompose, setShowCompose] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');
  const [compose, setCompose] = useState({ recipient_id: '', subject: '', body: '', is_broadcast: false });

  // View message
  const [viewMsg, setViewMsg] = useState<Message | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    let query = supabase
      .from('messages')
      .select(`*, sender:profiles!messages_sender_id_fkey(full_name, role), recipient:profiles!messages_recipient_id_fkey(full_name)`)
      .order('created_at', { ascending: false });

    if (tab === 'inbox') {
      // All messages addressed to me OR broadcasts (but NOT ones I sent, unless it was broadcast)
      query = query.or(`recipient_id.eq.${profile.id},is_broadcast.eq.true`);
    } else if (tab === 'sent') {
      query = query.eq('sender_id', profile.id);
    } else {
      query = query.eq('is_broadcast', true);
    }

    const { data, error } = await query;
    if (error) console.error('Messages load error:', error);
    setMessages((data as Message[]) ?? []);
    setLoading(false);
  }, [profile, tab]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.from('profiles')
      .select('id, full_name, role')
      .order('full_name')
      .then(({ data }) => setStaff((data as Profile[]) ?? []));
  }, []);

  async function markRead(msgId: string) {
    await supabase.from('messages').update({ is_read: true }).eq('id', msgId);
    setMessages(m => m.map(x => x.id === msgId ? { ...x, is_read: true } : x));
  }

  async function deleteMessage(msgId: string) {
    await supabase.from('messages').delete().eq('id', msgId);
    setMessages(m => m.filter(x => x.id !== msgId));
    if (viewMsg?.id === msgId) setViewMsg(null);
  }

  async function handleSend() {
    if (!compose.subject.trim() || !compose.body.trim()) { setSendError('Subject and message are required.'); return; }
    if (!compose.is_broadcast && !compose.recipient_id) { setSendError('Select a recipient or enable broadcast.'); return; }
    if (!profile) { setSendError('You must be logged in to send a message.'); return; }
    setSending(true); setSendError('');
    const { error } = await supabase.from('messages').insert({
      sender_id: profile.id,
      recipient_id: compose.is_broadcast ? null : compose.recipient_id || null,
      is_broadcast: compose.is_broadcast,
      subject: compose.subject.trim(),
      body: compose.body.trim(),
    });
    setSending(false);
    if (error) { setSendError(error.message); return; }
    setSendSuccess('Message sent successfully!');
    setCompose({ recipient_id: '', subject: '', body: '', is_broadcast: false });
    setTimeout(() => { setSendSuccess(''); setShowCompose(false); }, 1800);
    load();
  }

  const unread = messages.filter(m => !m.is_read && m.recipient_id === profile?.id).length;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Messages</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Internal staff communication</p>
        </div>
        <Button icon={<Send className="w-4 h-4" />} onClick={() => { setShowCompose(true); setSendError(''); setSendSuccess(''); }}>
          Compose
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {([
          { key: 'inbox', label: 'Inbox', icon: <Inbox className="w-3.5 h-3.5" /> },
          { key: 'sent', label: 'Sent', icon: <Send className="w-3.5 h-3.5" /> },
          { key: 'broadcast', label: 'Broadcasts', icon: <Bell className="w-3.5 h-3.5" /> },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}{t.label}
            {t.key === 'inbox' && unread > 0 && (
              <span className="bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{unread}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-7 h-7" /></div>
      ) : messages.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="w-8 h-8" />}
          title="No messages"
          description={tab === 'inbox' ? 'Your inbox is empty.' : tab === 'sent' ? "You haven't sent any messages." : 'No broadcasts yet.'}
          action={<Button icon={<Send className="w-4 h-4" />} onClick={() => setShowCompose(true)}>Compose</Button>}
        />
      ) : (
        <div className="space-y-2">
          {messages.map(msg => {
            const isUnread = !msg.is_read && msg.recipient_id === profile?.id;
            const sender = msg.sender as Profile;
            return (
              <div
                key={msg.id}
                className={`card p-4 cursor-pointer hover:shadow-card-hover transition-all ${isUnread ? 'border-l-4 border-brand-500' : ''}`}
                onClick={() => { if (isUnread) markRead(msg.id); setViewMsg(msg); }}
              >
                <div className="flex items-start gap-3">
                  <AvatarCircle name={sender?.full_name || 'System'} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${isUnread ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                          {sender?.full_name ?? 'Unknown'}
                        </span>
                        {msg.is_broadcast && <Badge className="bg-purple-100 text-purple-700 text-[10px]">Broadcast</Badge>}
                        {isUnread && <span className="w-2 h-2 bg-brand-500 rounded-full" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{formatDateTime(msg.created_at)}</span>
                        <button
                          onClick={e => { e.stopPropagation(); deleteMessage(msg.id); }}
                          className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-colors"
                          title="Delete message"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className={`text-sm mt-0.5 ${isUnread ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                      {msg.subject}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{msg.body}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Message Modal */}
      <Modal open={!!viewMsg} onClose={() => setViewMsg(null)} title="Message" size="md">
        {viewMsg && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
              <AvatarCircle name={(viewMsg.sender as Profile)?.full_name || 'System'} size="sm" />
              <div>
                <p className="font-semibold text-sm text-gray-900 dark:text-white">{(viewMsg.sender as Profile)?.full_name ?? 'Unknown'}</p>
                <p className="text-xs text-gray-400">{formatDateTime(viewMsg.created_at)}</p>
              </div>
              {viewMsg.is_broadcast && <Badge className="bg-purple-100 text-purple-700 ml-auto">Broadcast</Badge>}
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white mb-2">{viewMsg.subject}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{viewMsg.body}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setViewMsg(null)}>Close</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" icon={<Trash2 className="w-4 h-4" />}
                onClick={() => deleteMessage(viewMsg.id)}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Compose Modal */}
      <Modal open={showCompose} onClose={() => setShowCompose(false)} title="Compose Message" size="md">
        <div className="space-y-4">
          {sendError && <Alert type="error">{sendError}</Alert>}
          {sendSuccess && <Alert type="success">{sendSuccess}</Alert>}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={compose.is_broadcast}
              onChange={e => setCompose(c => ({ ...c, is_broadcast: e.target.checked, recipient_id: '' }))}
              className="rounded"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Send to all users (broadcast)
            </span>
          </label>
          {!compose.is_broadcast && (
            <Select
              label="Recipient"
              options={staff.filter(s => s.id !== profile?.id).map(s => ({ value: s.id, label: `${s.full_name} (${s.role})` }))}
              placeholder="Select recipient..."
              value={compose.recipient_id}
              onChange={e => setCompose(c => ({ ...c, recipient_id: e.target.value }))}
            />
          )}
          <Input
            label="Subject"
            value={compose.subject}
            onChange={e => setCompose(c => ({ ...c, subject: e.target.value }))}
            placeholder="Message subject..."
          />
          <Textarea
            label="Message"
            value={compose.body}
            onChange={e => setCompose(c => ({ ...c, body: e.target.value }))}
            placeholder="Write your message..."
            rows={5}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCompose(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSend} loading={sending} icon={<Send className="w-4 h-4" />} className="flex-1">Send</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

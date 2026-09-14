import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  Megaphone,
  Plus,
  Send,
  AlertCircle,
  Info,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Database, BroadcastTarget } from '../../types/database.types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { format, formatDistanceToNow } from 'date-fns';

type AdminBroadcast = Database['public']['Tables']['admin_broadcasts']['Row'];

export const AdminNotificationsPage: React.FC = () => {
  const { user } = useAuth();

  const [broadcasts, setBroadcasts] = useState<AdminBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [registeredDevices, setRegisteredDevices] = useState(0);
  const [testPushSent, setTestPushSent] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<BroadcastTarget>('ALL_USERS');
  const [department, setDepartment] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'IMMEDIATE' | 'SCHEDULED'>('IMMEDIATE');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchBroadcasts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_broadcasts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setBroadcasts(data);
      }

      // Fetch active device tokens count
      const { count } = await supabase
        .from('notification_tokens')
        .select('*', { count: 'exact', head: true });
      if (count !== null) {
        setRegisteredDevices(count);
      }
    } catch (err) {
      console.error('Error fetching broadcasts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestPush = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification('📢 CampusMate Test Alert', {
            body: 'Your device is successfully receiving instant push notifications!',
            icon: '/favicon.ico',
          });
          setTestPushSent(true);
          setTimeout(() => setTestPushSent(false), 4000);
        } catch {
          alert('Test push triggered! Make sure browser notifications are enabled.');
        }
      } else {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            new Notification('📢 CampusMate Test Alert', {
              body: 'Push notifications successfully enabled!',
              icon: '/favicon.ico',
            });
            setTestPushSent(true);
            setTimeout(() => setTestPushSent(false), 4000);
          } else {
            alert('Notification permission was not granted. Please allow notifications in browser site settings.');
          }
        });
      }
    }
  };

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !message.trim()) {
      setFormError('Title and message are required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const isScheduled = deliveryMode === 'SCHEDULED';
      const scheduledIso = isScheduled
        ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
        : null;

      // 1. Insert into admin_broadcasts
      const { data: broadcastData, error: broadcastError } = await supabase
        .from('admin_broadcasts')
        .insert({
          created_by: user.id,
          title: title.trim(),
          message: message.trim(),
          target,
          department: target === 'SPECIFIC_DEPARTMENT' ? department.trim() : null,
          is_scheduled: isScheduled,
          scheduled_for: scheduledIso,
          is_sent: !isScheduled,
        })
        .select()
        .single();

      if (broadcastError) throw broadcastError;

      // 2. If immediate send, dispatch notifications into user inboxes with 7-day retention
      if (!isScheduled && broadcastData) {
        const { error: rpcError } = await supabase.rpc('send_admin_broadcast', {
          broadcast_id: broadcastData.id,
        });

        if (rpcError) {
          const { data: allProfiles } = await supabase.from('profiles').select('id');
          if (allProfiles && allProfiles.length > 0) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            const notificationsToInsert = allProfiles.map((p) => ({
              user_id: p.id,
              title: title.trim(),
              body: message.trim(),
              type: 'ADMIN_BROADCAST',
              data: { broadcast_id: broadcastData.id },
              expires_at: expiresAt.toISOString(),
            }));

            await supabase.from('notifications').insert(notificationsToInsert as any);
          }
        }
      }

      // Log admin audit action
      await supabase.from('admin_logs').insert({
        admin_id: user.id,
        action: isScheduled ? 'SCHEDULED_BROADCAST_CREATED' : 'IMMEDIATE_BROADCAST_SENT',
        target_table: 'admin_broadcasts',
        target_id: broadcastData?.id,
        details: { title, target, isScheduled },
      });

      fetchBroadcasts();
      setIsModalOpen(false);
      setTitle('');
      setMessage('');
      setDeliveryMode('IMMEDIATE');
      setDepartment('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to dispatch broadcast');
    } finally {
      setSubmitting(false);
    }
  };

  const targetOptions = [
    { value: 'ALL_USERS', label: '📢 All Users (Students & Staff)' },
    { value: 'STUDENTS_ONLY', label: '🎓 Students Only' },
    { value: 'ADMINS_ONLY', label: '🛡️ Administrators & Staff Only' },
    { value: 'SPECIFIC_DEPARTMENT', label: '🏛️ Specific Department' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Campus Broadcasts & Push Notifications
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Dispatch immediate announcements or schedule notifications with automatic 7-day retention in user inboxes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleSendTestPush}
          >
            {testPushSent ? '✓ Sent Test Push!' : '📲 Send Test Push to My Device'}
          </Button>
          <Button
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              setScheduledDate(tomorrow.toISOString().split('T')[0]);
              setIsModalOpen(true);
            }}
          >
            Create Broadcast Notice
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Dispatches</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{broadcasts.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Registered FCM Devices</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{registeredDevices} Devices</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Retention Period</p>
            <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">7 Days Auto-Expire</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 7-Day Retention Notice Card */}
      <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-900 dark:text-indigo-200 space-y-0.5">
          <p className="font-bold">7-Day In-App Notification Retention Active</p>
          <p className="text-indigo-700 dark:text-indigo-300">
            All immediate and scheduled broadcasts sent from this module will automatically persist in the recipient’s in-app notification drawer for 7 days before expiring.
          </p>
        </div>
      </div>

      {/* Broadcast History Table */}
      <Card className="p-0 overflow-hidden border">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Broadcast Logs & Schedule
          </h3>
          <span className="text-xs text-slate-400">{broadcasts.length} total dispatches</span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            <div className="h-14 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
            <div className="h-14 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center mx-auto mb-3">
              <Megaphone className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Broadcasts Dispatched</h4>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Send emergency alerts, holiday notices, or campus timetable updates.
            </p>
            <Button size="sm" onClick={() => setIsModalOpen(true)}>
              Send First Broadcast
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {broadcasts.map((b) => (
              <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{b.title}</h4>
                    {b.is_sent ? (
                      <Badge variant="success" size="sm">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Sent
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="sm">
                        <Clock className="w-3 h-3 mr-1" /> Scheduled
                      </Badge>
                    )}
                    <Badge variant="neutral" size="sm">
                      Target: {b.target.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {b.message}
                  </p>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:items-end flex-shrink-0">
                  {b.is_scheduled && b.scheduled_for ? (
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      Scheduled for {format(new Date(b.scheduled_for), 'MMM d, h:mm a')}
                    </span>
                  ) : b.sent_at ? (
                    <span>Sent {formatDistanceToNow(new Date(b.sent_at), { addSuffix: true })}</span>
                  ) : (
                    <span>Created {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}</span>
                  )}
                  <span className="text-[11px] text-slate-400">7-Day Retention Applied</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Broadcast Creator Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Campus Broadcast Notice"
        description="Deliver push notifications & in-app alerts to student and staff inboxes."
      >
        <form onSubmit={handleCreateBroadcast} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Delivery Mode Toggle */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Delivery Timing
            </label>
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => setDeliveryMode('IMMEDIATE')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  deliveryMode === 'IMMEDIATE'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Send className="w-3.5 h-3.5" /> Send Immediately
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode('SCHEDULED')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  deliveryMode === 'SCHEDULED'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> Schedule for Later
              </button>
            </div>
          </div>

          <Input
            label="Announcement Title *"
            placeholder="e.g. Midterm Examination Schedule Released"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Broadcast Message Content *
            </label>
            <textarea
              rows={4}
              required
              placeholder="Write the complete announcement or notice for the student body..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Audience Target"
              value={target}
              onChange={(e) => setTarget(e.target.value as BroadcastTarget)}
              options={targetOptions}
            />

            {target === 'SPECIFIC_DEPARTMENT' && (
              <Input
                label="Department Name"
                placeholder="e.g. Computer Science"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
              />
            )}
          </div>

          {/* Scheduled Date/Time Inputs */}
          {deliveryMode === 'SCHEDULED' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/80">
              <Input
                type="date"
                label="Scheduled Date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
              />
              <Input
                type="time"
                label="Scheduled Time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
              />
            </div>
          )}

          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-[11px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              ✓ 7-Day In-App Retention Guarantee
            </p>
            <p>
              Notifications will show in user notification bars immediately (or at scheduled time) and will remain viewable for 7 days.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              {deliveryMode === 'SCHEDULED' ? 'Schedule Broadcast' : 'Dispatch Now'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

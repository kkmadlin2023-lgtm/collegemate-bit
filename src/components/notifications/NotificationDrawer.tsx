import React, { useState, useEffect } from 'react';
import { Bell, Check, Clock, Megaphone, X, Smartphone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { registerPushNotificationToken, getNotificationPermissionState, showLocalDeviceNotification } from '../../lib/firebase';
import type { Database } from '../../types/database.types';
import { Badge } from '../common/Badge';
import { formatDistanceToNow } from 'date-fns';

type Notification = Database['public']['Tables']['notifications']['Row'];

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onUnreadCountChange,
}) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState<NotificationPermission>('default');
  const [enablingPush, setEnablingPush] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  useEffect(() => {
    setPushStatus(getNotificationPermissionState());
  }, [isOpen]);

  const handleEnablePush = async () => {
    if (!user) return;
    setEnablingPush(true);
    setPushMessage(null);
    try {
      const { token, error } = await registerPushNotificationToken(user.id);
      setPushStatus(getNotificationPermissionState());
      if (error) {
        setPushMessage(error);
      } else if (token) {
        setPushMessage('Push notifications enabled for this device!');
        showLocalDeviceNotification(
          'Notifications Enabled!',
          'You will now receive instant campus alerts, schedule reminders, and announcements.'
        );
      }
    } catch (err: any) {
      setPushMessage(err.message || 'Failed to enable push notifications');
    } finally {
      setEnablingPush(false);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (!error && data) {
        setNotifications(data);
        const unread = data.filter((n: Notification) => !n.is_read).length;
        if (onUnreadCountChange) onUnreadCountChange(unread);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();

      const channel = supabase
        .channel('public:notifications')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id);

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      const unread = notifications.filter((n) => n.id !== id && !n.is_read).length;
      if (onUnreadCountChange) onUnreadCountChange(unread);
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      if (onUnreadCountChange) onUnreadCountChange(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Notifications</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Retained in your inbox for 7 days
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {notifications.some((n) => !n.is_read) && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
            {/* Device Push Notification Card */}
            <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50/70 to-purple-50/70 dark:from-indigo-950/40 dark:to-purple-950/40 text-left">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Device Push Notifications</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {pushStatus === 'granted'
                        ? 'Active • Receiving push alerts on this device'
                        : pushStatus === 'denied'
                        ? 'Blocked in browser settings'
                        : 'Get instant alerts when closed'}
                    </p>
                  </div>
                </div>

                {pushStatus !== 'granted' && (
                  <button
                    type="button"
                    onClick={handleEnablePush}
                    disabled={enablingPush}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                  >
                    {enablingPush ? 'Enabling...' : 'Enable'}
                  </button>
                )}

                {pushStatus === 'granted' && (
                  <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    <Check className="w-3 h-3 mr-0.5" /> Enabled
                  </span>
                )}
              </div>
              {pushMessage && (
                <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 mt-2 bg-white/60 dark:bg-slate-900/60 p-1.5 rounded-lg">
                  {pushMessage}
                </p>
              )}
            </div>
            {loading ? (
              <div className="space-y-3">
                <div className="h-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
                <div className="h-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No active notifications</p>
                <p className="text-xs text-slate-400 mt-1">
                  You're all caught up! Updates from schedules, reminders, and admin announcements will appear here.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 rounded-xl border transition-all ${
                    n.is_read
                      ? 'bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-300 opacity-80'
                      : 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200/80 dark:border-indigo-800/80 shadow-sm text-slate-900 dark:text-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {n.type === 'ADMIN_BROADCAST' ? (
                        <Badge variant="purple" size="sm">
                          <Megaphone className="w-3 h-3 mr-1" /> Campus Announcement
                        </Badge>
                      ) : n.type === 'REMINDER' ? (
                        <Badge variant="warning" size="sm">
                          <Clock className="w-3 h-3 mr-1" /> Reminder
                        </Badge>
                      ) : (
                        <Badge variant="indigo" size="sm">
                          {n.type}
                        </Badge>
                      )}
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold mt-2">{n.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap leading-relaxed">
                    {n.body}
                  </p>

                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      Expires in {formatDistanceToNow(new Date(n.expires_at))}
                    </span>
                    {!n.is_read && (
                      <button
                        onClick={() => markAsRead(n.id)}
                        className="inline-flex items-center text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> Mark read
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

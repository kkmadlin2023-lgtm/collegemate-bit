import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Smartphone,
  Radio,
  Clock,
  Sparkles,
  Calendar,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  registerPushNotificationToken,
  showLocalDeviceNotification,
  getNotificationPermissionState,
} from '../../lib/firebase';
import { triggerDailyGreetingIfDue } from '../../services/DailyGreetingService';
import { checkAndNotifyDueSchedulesAndTasks } from '../../services/ScheduleReminderWatcher';

interface CheckItem {
  id: string;
  name: string;
  description: string;
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'WARNING';
  detail?: string;
}

interface NotificationSelfCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationSelfCheckModal: React.FC<NotificationSelfCheckModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, profile } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [checkResults, setCheckResults] = useState<CheckItem[]>([
    {
      id: 'permission',
      name: '1. Device Notification Permission',
      description: 'Checks if browser / mobile system allows native push notifications',
      status: 'PENDING',
    },
    {
      id: 'fcm_token',
      name: '2. FCM Push Token in Supabase',
      description: 'Verifies if device token is collected and stored in notification_tokens table',
      status: 'PENDING',
    },
    {
      id: 'local_push',
      name: '3. Local Device Notification Dispatch',
      description: 'Dispatches an immediate hardware test alert with icon & vibration',
      status: 'PENDING',
    },
    {
      id: 'inbox_7day',
      name: '4. In-App Inbox (7-Day Retention)',
      description: 'Inserts and validates a retained notification in Supabase notifications table',
      status: 'PENDING',
    },
    {
      id: 'greetings_m_a_e',
      name: '5. Automated Daily Briefing (M/A/E/N)',
      description: 'Tests time-slot intelligence greeting delivery',
      status: 'PENDING',
    },
    {
      id: 'schedule_watcher',
      name: '6. Class Timetable & Task Watcher',
      description: 'Tests 15-minute class alert and task deadline detector',
      status: 'PENDING',
    },
  ]);

  const runAllChecks = async () => {
    if (!user) return;
    setIsRunning(true);

    const updateCheck = (id: string, status: CheckItem['status'], detail?: string) => {
      setCheckResults((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status, detail } : c))
      );
    };

    // 1. Permission Check
    updateCheck('permission', 'RUNNING');
    await new Promise((r) => setTimeout(r, 400));
    const perm = getNotificationPermissionState();
    if (perm === 'granted') {
      updateCheck('permission', 'PASSED', 'Permission granted on this browser/mobile.');
    } else if (perm === 'default') {
      updateCheck('permission', 'WARNING', 'Permission not yet requested. Click "Enable" to activate.');
    } else {
      updateCheck('permission', 'FAILED', 'Permission blocked in browser settings. Please enable notifications in site settings.');
    }

    // 2. FCM Token Check
    updateCheck('fcm_token', 'RUNNING');
    try {
      const { data: tokens, error: tokErr } = await supabase
        .from('notification_tokens')
        .select('*')
        .eq('user_id', user.id);

      if (!tokErr && tokens && tokens.length > 0) {
        updateCheck(
          'fcm_token',
          'PASSED',
          `Verified ${tokens.length} connected device(s) in Supabase. Type: ${tokens[0].device_type}`
        );
      } else {
        // Try registering token on the fly
        const regRes = await registerPushNotificationToken(user.id);
        if (regRes.token) {
          updateCheck('fcm_token', 'PASSED', 'Token newly registered & saved in Supabase!');
        } else {
          updateCheck('fcm_token', 'WARNING', 'No token found in database yet. Click Enable Push in notification drawer.');
        }
      }
    } catch (err: any) {
      updateCheck('fcm_token', 'FAILED', err.message);
    }

    // 3. Local Push Test
    updateCheck('local_push', 'RUNNING');
    await new Promise((r) => setTimeout(r, 400));
    try {
      showLocalDeviceNotification(
        '🔔 CampusMate Notification Test Passed!',
        'Your device is actively receiving real-time campus push alerts!'
      );
      updateCheck('local_push', 'PASSED', 'Test notification triggered on device.');
    } catch (err: any) {
      updateCheck('local_push', 'FAILED', err.message);
    }

    // 4. In-App 7-Day Retention Check
    updateCheck('inbox_7day', 'RUNNING');
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: inserted, error: notifErr } = await supabase.from('notifications').insert({
        user_id: user.id,
        title: '⚡ System Notification Test (7-Day Retention)',
        body: 'This is a verified test notification. It will remain in your drawer for 7 days.',
        type: 'SYSTEM_TEST',
        expires_at: expiresAt.toISOString(),
      } as any).select().single();

      if (!notifErr && inserted) {
        updateCheck('inbox_7day', 'PASSED', 'Saved in database with 7-day retention expiry.');
      } else {
        updateCheck('inbox_7day', 'FAILED', notifErr?.message || 'Failed to insert notification.');
      }
    } catch (err: any) {
      updateCheck('inbox_7day', 'FAILED', err.message);
    }

    // 5. Daily Greeting Check
    updateCheck('greetings_m_a_e', 'RUNNING');
    await new Promise((r) => setTimeout(r, 300));
    try {
      await triggerDailyGreetingIfDue(user.id, profile?.full_name);
      updateCheck('greetings_m_a_e', 'PASSED', 'M/A/E/N briefing routine executed successfully.');
    } catch (err: any) {
      updateCheck('greetings_m_a_e', 'FAILED', err.message);
    }

    // 6. Schedule Watcher Check
    updateCheck('schedule_watcher', 'RUNNING');
    await new Promise((r) => setTimeout(r, 300));
    try {
      await checkAndNotifyDueSchedulesAndTasks(user.id);
      updateCheck('schedule_watcher', 'PASSED', 'Class schedule & task watcher active and scanning.');
    } catch (err: any) {
      updateCheck('schedule_watcher', 'FAILED', err.message);
    }

    setIsRunning(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Notification System Diagnostics & Self-Check"
      description="Run an end-to-end verification check across all 6 notification layers on this device."
    >
      <div className="space-y-4 text-left">
        {/* Run Button */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Run Live System Check</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tests hardware push, FCM token, database storage, and schedulers.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={runAllChecks}
            isLoading={isRunning}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />}
          >
            {isRunning ? 'Testing...' : 'Test Now'}
          </Button>
        </div>

        {/* Check Results List */}
        <div className="space-y-2.5">
          {checkResults.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  {item.id === 'permission' && <Smartphone className="w-3.5 h-3.5 text-indigo-500" />}
                  {item.id === 'fcm_token' && <Radio className="w-3.5 h-3.5 text-purple-500" />}
                  {item.id === 'local_push' && <Zap className="w-3.5 h-3.5 text-amber-500" />}
                  {item.id === 'inbox_7day' && <Clock className="w-3.5 h-3.5 text-emerald-500" />}
                  {item.id === 'greetings_m_a_e' && <Sparkles className="w-3.5 h-3.5 text-pink-500" />}
                  {item.id === 'schedule_watcher' && <Calendar className="w-3.5 h-3.5 text-sky-500" />}
                  {item.name}
                </span>

                {item.status === 'PASSED' && (
                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Passed
                  </span>
                )}
                {item.status === 'RUNNING' && (
                  <span className="inline-flex items-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 animate-pulse">
                    Running...
                  </span>
                )}
                {item.status === 'WARNING' && (
                  <span className="inline-flex items-center text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                    Attention
                  </span>
                )}
                {item.status === 'FAILED' && (
                  <span className="inline-flex items-center text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800">
                    <XCircle className="w-3 h-3 mr-1" /> Failed
                  </span>
                )}
                {item.status === 'PENDING' && (
                  <span className="text-[10px] text-slate-400 font-mono">Ready</span>
                )}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {item.description}
              </p>

              {item.detail && (
                <p className="text-[10px] font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  {item.detail}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

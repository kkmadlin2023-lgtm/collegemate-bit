import React, { useState, useEffect } from 'react';
import { Bell, Smartphone, X, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { registerPushNotificationToken, showLocalDeviceNotification } from '../../lib/firebase';
import { Button } from '../common/Button';

export const PushNotificationPrompt: React.FC = () => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user) return;

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const dismissedAt = localStorage.getItem(`push_prompt_dismissed_${user.id}`);
        if (!dismissedAt || Date.now() - parseInt(dismissedAt, 10) > 24 * 60 * 60 * 1000) {
          // Show after a brief gentle delay
          const timer = setTimeout(() => {
            setVisible(true);
          }, 1500);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [user]);

  const handleEnable = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { token, error } = await registerPushNotificationToken(user.id);
      if (token) {
        setSuccess(true);
        showLocalDeviceNotification(
          '🎉 Device Push Notifications Active!',
          'You will receive real-time campus schedule reminders, task alerts, and broadcast notices.'
        );
        setTimeout(() => {
          setVisible(false);
        }, 2200);
      } else {
        console.warn('Could not register push token:', error);
        setVisible(false);
      }
    } catch (err) {
      console.error('Error enabling push notification:', err);
      setVisible(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    if (user) {
      localStorage.setItem(`push_prompt_dismissed_${user.id}`, Date.now().toString());
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 max-w-sm w-full animate-in slide-in-from-bottom-5 duration-300">
      <div className="p-4 sm:p-5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-indigo-200/80 dark:border-indigo-800/80 shadow-2xl shadow-indigo-500/10 dark:shadow-black/50 text-left relative overflow-hidden">
        {/* Decorative Top Gradient Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        {success ? (
          <div className="flex items-center gap-3 py-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Push Notifications Enabled!</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                FCM token connected to your device.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-600/30">
                <Bell className="w-5 h-5 animate-pulse" />
              </div>
              <div className="pr-6">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  Enable Smart Push Notifications
                  <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Never miss an important campus event or class deadline on your device.
                </p>
              </div>
            </div>

            {/* Feature Pills */}
            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                🌅 Daily M/A/E Briefings
              </span>
              <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                📚 15m Class Reminders
              </span>
              <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                ⏰ Task Due Alerts
              </span>
              <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                💬 Admin Ticket Replies
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="primary"
                className="flex-1 shadow-md shadow-indigo-600/20"
                leftIcon={loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
                onClick={handleEnable}
                disabled={loading}
              >
                {loading ? 'Connecting Device...' : 'Enable Notifications'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
              >
                Later
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
 

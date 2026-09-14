import React, { useState, useEffect } from 'react';
import { Megaphone, Clock, Sparkles, X, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { setupForegroundNotificationListener } from '../../lib/firebase';

interface ActiveToast {
  id: string;
  title: string;
  body: string;
  type?: string;
}

interface RealtimeNotificationToastProps {
  onOpenDrawer?: () => void;
}

export const RealtimeNotificationToast: React.FC<RealtimeNotificationToastProps> = ({ onOpenDrawer }) => {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  const addToast = (toast: ActiveToast) => {
    setToasts((prev) => [toast, ...prev.slice(0, 2)]);
    setTimeout(() => {
      removeToast(toast.id);
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    if (!user) return;

    // 1. Supabase Realtime Listener for new in-app notifications
    const channel = supabase
      .channel(`public:realtime-toasts:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          if (payload.new) {
            addToast({
              id: payload.new.id || Math.random().toString(),
              title: payload.new.title || 'New Campus Notification',
              body: payload.new.body || 'You received a new update.',
              type: payload.new.type,
            });
          }
        }
      )
      .subscribe();

    // 2. Firebase Foreground Push Listener
    let unsubscribeFCM: any = null;
    setupForegroundNotificationListener((payload) => {
      addToast({
        id: Math.random().toString(),
        title: payload.notification?.title || payload.data?.title || 'Campus Alert',
        body: payload.notification?.body || payload.data?.body || 'New alert received on your device.',
        type: payload.data?.type || 'ADMIN_BROADCAST',
      });
    }).then((unsub) => {
      unsubscribeFCM = unsub;
    });

    return () => {
      supabase.removeChannel(channel);
      if (typeof unsubscribeFCM === 'function') {
        unsubscribeFCM();
      }
    };
  }, [user]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 sm:right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => {
            if (onOpenDrawer) onOpenDrawer();
            removeToast(toast.id);
          }}
          className="pointer-events-auto p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-indigo-200/90 dark:border-indigo-800/90 shadow-2xl shadow-indigo-500/20 text-left cursor-pointer transition-all duration-300 hover:scale-[1.02] animate-in slide-in-from-top-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-600/30">
                {toast.type === 'ADMIN_BROADCAST' ? (
                  <Megaphone className="w-4 h-4" />
                ) : toast.type === 'REMINDER' ? (
                  <Clock className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </div>
              <div className="pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {toast.type === 'ADMIN_BROADCAST' ? 'Broadcast' : 'Alert'}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 mt-0.5">
                  {toast.title}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5 leading-relaxed">
                  {toast.body}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
            <span>Tap to open notification drawer</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      ))}
    </div>
  );
};
 

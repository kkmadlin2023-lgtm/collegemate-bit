import React, { useState, useEffect } from 'react';
import { Bell, LogOut, Menu, Shield, User, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';
import { NotificationDrawer } from '../notifications/NotificationDrawer';
import { supabase } from '../../lib/supabase';

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user, profile, isSuperAdmin, isAdmin, signOut } = useAuth();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    if (!user) return;
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .gt('expires_at', new Date().toISOString());

    if (!error && count !== null) {
      setUnreadCount(count);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      const channel = supabase
        .channel('public:notifications-badge')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 sm:px-6">
        {/* Left Side */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
              CampusMate
            </span>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          {/* Notification Bell Button */}
          <button
            onClick={() => setIsNotificationOpen(true)}
            className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900 animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                {profile?.full_name || user?.email?.split('@')[0] || 'Student'}
              </span>
              <div className="mt-0.5">
                {isSuperAdmin ? (
                  <Badge variant="purple" size="sm">
                    <Shield className="w-2.5 h-2.5 mr-0.5" /> SUPER ADMIN
                  </Badge>
                ) : isAdmin ? (
                  <Badge variant="indigo" size="sm">
                    <Shield className="w-2.5 h-2.5 mr-0.5" /> ADMIN
                  </Badge>
                ) : (
                  <Badge variant="neutral" size="sm">
                    STUDENT
                  </Badge>
                )}
              </div>
            </div>

            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs uppercase overflow-hidden ring-1 ring-indigo-500/20">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                profile?.full_name?.charAt(0) || user?.email?.charAt(0) || <User className="w-4 h-4" />
              )}
            </div>

            {/* Logout button */}
            <button
              onClick={() => signOut()}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Notification Center Sliding Drawer (7-day retention) */}
      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onUnreadCountChange={(count) => setUnreadCount(count)}
      />
    </>
  );
};

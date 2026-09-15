import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Calendar,
  CheckSquare,
  Search,
  LayoutDashboard,
  Shield,
  Users,
  Bell,
  FolderTree,
  FileText,
  Settings,
  Sparkles,
  School,
  Ticket,
  X,
  MessageSquare,
  User,
  UserCog,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { ThemeToggle } from '../common/ThemeToggle';
import { EditProfileModal } from '../profile/EditProfileModal';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, profile, isAdmin, isSuperAdmin } = useAuth();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const studentNavItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/events', label: 'Events & Fests', icon: Ticket },
    { to: '/schedule', label: 'Schedule Manager', icon: Calendar },
    { to: '/reminders', label: 'Reminders & Tasks', icon: CheckSquare },
    { to: '/lost-found', label: 'Lost & Found Hub', icon: Search },
    { to: '/feedback', label: 'Support & Feedback', icon: MessageSquare },
  ];

  const adminNavItems = [
    { to: '/admin/dashboard', label: 'Admin Overview', icon: Shield },
    { to: '/admin/events', label: 'Event Moderation', icon: Ticket },
    { to: '/admin/users', label: 'User Directory', icon: Users },
    { to: '/admin/colleges', label: 'Campuses & Merge', icon: School },
    { to: '/admin/lost-found', label: 'Lost & Found Moderation', icon: Search },
    { to: '/admin/notifications', label: 'Broadcasts & Alerts', icon: Bell },
    { to: '/admin/feedback', label: 'Feedback Desk', icon: MessageSquare },
    { to: '/admin/categories', label: 'Taxonomy & Categories', icon: FolderTree },
    { to: '/admin/logs', label: 'System Audit Logs', icon: FileText },
    { to: '/admin/settings', label: 'Campus Settings', icon: Settings },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 transition-transform duration-300 ease-in-out md:static md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
              CampusMate
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          <div>
            <p className="px-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              Student Space
            </p>
            <nav className="space-y-1">
              {studentNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-950/60 dark:text-indigo-300 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                      )
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {isAdmin && (
            <div>
              <div className="flex items-center justify-between px-3 mb-2">
                <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Administration
                </p>
                {isSuperAdmin && (
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300">
                    SUPER
                  </span>
                )}
              </div>
              <nav className="space-y-1">
                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all',
                          isActive
                            ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                        )
                      }
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        {/* Sidebar Footer: Profile Card & Theme Selector */}
        <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
          {/* User Profile Card button */}
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-slate-800 transition-all text-left group shadow-sm"
            title="Edit Your Profile"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase overflow-hidden flex-shrink-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="User" className="w-full h-full object-cover" />
                ) : (
                  profile?.full_name?.charAt(0) || user?.email?.charAt(0) || <User className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  {profile?.full_name || user?.email?.split('@')[0] || 'Student'}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                  {profile?.college_name || 'Edit Profile'}
                </p>
              </div>
            </div>
            <UserCog className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex-shrink-0 ml-1" />
          </button>

          {/* Theme Selector segmented control */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Theme</span>
            </div>
            <ThemeToggle variant="segmented" />
          </div>
        </div>
      </aside>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </>
  );
};

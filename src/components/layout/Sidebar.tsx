import React from 'react';
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
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { isAdmin, isSuperAdmin } = useAuth();

  const studentNavItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/schedule', label: 'Schedule Manager', icon: Calendar },
    { to: '/reminders', label: 'Reminders & Tasks', icon: CheckSquare },
    { to: '/lost-found', label: 'Lost & Found Hub', icon: Search },
  ];

  const adminNavItems = [
    { to: '/admin/dashboard', label: 'Admin Overview', icon: Shield },
    { to: '/admin/users', label: 'User Directory', icon: Users },
    { to: '/admin/lost-found', label: 'Lost & Found Moderation', icon: Search },
    { to: '/admin/notifications', label: 'Broadcasts & Alerts', icon: Bell },
    { to: '/admin/categories', label: 'Taxonomy & Categories', icon: FolderTree },
    { to: '/admin/logs', label: 'System Audit Logs', icon: FileText },
    { to: '/admin/settings', label: 'Campus Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 transition-transform duration-300 ease-in-out md:static md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
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

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {/* Student Portal Navigation */}
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

          {/* Admin Portal Navigation (Visible to Admin & Super Admin) */}
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

        {/* Footer info */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            CampusMate v1.0 • Web & Android
          </p>
        </div>
      </aside>
    </>
  );
};

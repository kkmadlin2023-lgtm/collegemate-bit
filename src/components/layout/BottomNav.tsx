import React from 'react';
import { NavLink } from 'react-router-dom';
import { Calendar, CheckSquare, Search, LayoutDashboard, Shield, Ticket } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

export const BottomNav: React.FC = () => {
  const { isAdmin } = useAuth();

  const items = [
    { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { to: '/events', label: 'Events', icon: Ticket },
    { to: '/schedule', label: 'Schedule', icon: Calendar },
    { to: '/reminders', label: 'Tasks', icon: CheckSquare },
    { to: '/lost-found', label: 'Lost', icon: Search },
    ...(isAdmin ? [{ to: '/admin/dashboard', label: 'Admin', icon: Shield }] : []),
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/80 bg-white/95 px-2 py-1.5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 md:hidden">
      <nav className="flex items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[10px] font-medium transition-colors',
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                )
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

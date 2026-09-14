import React from 'react';
import { ShieldAlert, Mail, LogOut, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';

export const AccountSuspendedScreen: React.FC = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-100 dark:border-rose-950/60 p-6 sm:p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10 border border-rose-200 dark:border-rose-900">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Account Access Suspended
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Your CampusMate student account (<span className="font-semibold text-slate-700 dark:text-slate-300">{user?.email}</span>) has been deactivated by a campus administrator.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs text-left space-y-2">
          <p className="font-bold text-slate-800 dark:text-slate-200">Why am I seeing this?</p>
          <p className="text-slate-500 dark:text-slate-400">
            Administrators may deactivate accounts for policy compliance, campus graduation, or moderation reviews.
          </p>
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-indigo-600 dark:text-indigo-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Support:
            </span>
            <a
              href="mailto:kkmadlin2023@gmail.com?subject=CampusMate%20Account%20Reactivation%20Request"
              className="hover:underline inline-flex items-center gap-1"
            >
              kkmadlin2023@gmail.com <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="space-y-2.5">
          <Button
            variant="outline"
            className="w-full text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
            onClick={() => {
              window.location.href = 'mailto:kkmadlin2023@gmail.com?subject=CampusMate%20Account%20Reactivation%20Request';
            }}
            leftIcon={<Mail className="w-4 h-4" />}
          >
            Contact Campus Administrator
          </Button>

          <Button
            variant="danger"
            className="w-full"
            onClick={() => signOut()}
            leftIcon={<LogOut className="w-4 h-4" />}
          >
            Sign Out of Account
          </Button>
        </div>
      </div>
    </div>
  );
};

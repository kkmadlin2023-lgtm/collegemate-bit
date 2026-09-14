import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  CheckSquare,
  Search,
  Bell,
  Shield,
  FileCheck,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { formatDistanceToNow } from 'date-fns';

export const AdminDashboard: React.FC = () => {
  const { isSuperAdmin } = useAuth();

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSchedules: 0,
    totalReminders: 0,
    pendingLost: 0,
    pendingFound: 0,
    pendingClaims: 0,
    totalBroadcasts: 0,
  });

  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdminStats = async () => {
    setLoading(true);
    try {
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { count: schedCount } = await supabase
        .from('schedules')
        .select('*', { count: 'exact', head: true });

      const { count: remCount } = await supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true });

      const { count: lostCount } = await supabase
        .from('lost_items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING');

      const { count: foundCount } = await supabase
        .from('found_items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING');

      const { count: claimsCount } = await supabase
        .from('claims')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING');

      const { count: broadcastCount } = await supabase
        .from('admin_broadcasts')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalUsers: usersCount || 0,
        totalSchedules: schedCount || 0,
        totalReminders: remCount || 0,
        pendingLost: lostCount || 0,
        pendingFound: foundCount || 0,
        pendingClaims: claimsCount || 0,
        totalBroadcasts: broadcastCount || 0,
      });

      const { data: logsData } = await supabase
        .from('admin_logs')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(5);

      if (logsData) setRecentLogs(logsData);
    } catch (err) {
      console.error('Error fetching admin dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminStats();
  }, []);

  const totalPendingModeration = stats.pendingLost + stats.pendingFound + stats.pendingClaims;

  return (
    <div className="space-y-6">
      {/* Admin Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Administration Command Center
            </h2>
            {isSuperAdmin && (
              <Badge variant="purple" size="sm">
                SUPER ADMIN
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monitor campus metrics, verify claims, broadcast announcements, and audit system activity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/admin/notifications">
            <Button size="sm" leftIcon={<Bell className="w-4 h-4" />}>
              Broadcast Notice
            </Button>
          </Link>
          <Link to="/admin/lost-found">
            <Button size="sm" variant="outline" leftIcon={<FileCheck className="w-4 h-4" />}>
              Moderation Queue ({totalPendingModeration})
            </Button>
          </Link>
        </div>
      </div>

      {/* Moderation Alert Banner */}
      {totalPendingModeration > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                {totalPendingModeration} Items Awaiting Review
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {stats.pendingLost} Lost Reports • {stats.pendingFound} Found Reports • {stats.pendingClaims} Ownership Claims
              </p>
            </div>
          </div>
          <Link to="/admin/lost-found">
            <Button size="sm" className="bg-amber-600 text-white hover:bg-amber-700 shadow-none">
              Review Queue
            </Button>
          </Link>
        </div>
      )}

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Students & Staff
            </p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {loading ? '...' : stats.totalUsers}
            </h3>
            <span className="text-[11px] text-emerald-600 font-medium inline-flex items-center mt-1">
              <TrendingUp className="w-3 h-3 mr-0.5" /> Active accounts
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Classes & Schedules
            </p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {loading ? '...' : stats.totalSchedules}
            </h3>
            <span className="text-[11px] text-indigo-600 font-medium inline-flex items-center mt-1">
              Student schedules
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tasks & Reminders
            </p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {loading ? '...' : stats.totalReminders}
            </h3>
            <span className="text-[11px] text-emerald-600 font-medium inline-flex items-center mt-1">
              Student task alarms
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckSquare className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Campus Broadcasts
            </p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {loading ? '...' : stats.totalBroadcasts}
            </h3>
            <span className="text-[11px] text-purple-600 font-medium inline-flex items-center mt-1">
              7-Day Push Alerts
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Bell className="w-6 h-6" />
          </div>
        </Card>
      </div>

      {/* Quick Navigation Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Administrative Management Hub
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link to="/admin/users" className="group">
              <Card hoverable className="p-4 flex items-center justify-between border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                      User Management
                    </h4>
                    <p className="text-xs text-slate-400">Search, edit roles & deactivate</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
              </Card>
            </Link>

            <Link to="/admin/lost-found" className="group">
              <Card hoverable className="p-4 flex items-center justify-between border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
                    <Search className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors">
                      Lost & Found Moderation
                    </h4>
                    <p className="text-xs text-slate-400">Approve listings & verify claims</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600" />
              </Card>
            </Link>

            <Link to="/admin/notifications" className="group">
              <Card hoverable className="p-4 flex items-center justify-between border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
                      Push Notifications
                    </h4>
                    <p className="text-xs text-slate-400">Immediate & scheduled broadcasts</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600" />
              </Card>
            </Link>

            <Link to="/admin/settings" className="group">
              <Card hoverable className="p-4 flex items-center justify-between border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                      System Settings
                    </h4>
                    <p className="text-xs text-slate-400">Auto-approval rules & semester config</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
              </Card>
            </Link>
          </div>
        </div>

        {/* Right: Recent Audit Log Feed */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Recent System Audit Activity
            </h3>
            <Link
              to="/admin/logs"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              All Logs
            </Link>
          </div>

          <Card className="divide-y divide-slate-100 dark:divide-slate-800 p-0 overflow-hidden">
            {recentLogs.length === 0 ? (
              <p className="p-6 text-xs text-slate-400 text-center">No recent admin actions recorded.</p>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="p-3.5 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Table: <span className="font-mono">{log.target_table}</span> • By:{' '}
                    {log.profiles?.full_name || 'Admin'}
                  </p>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

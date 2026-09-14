import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  Smartphone,
  Eye,
  School,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth, SUPER_ADMIN_EMAIL } from '../../context/AuthContext';
import type { Database, AppRole } from '../../types/database.types';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { AdminUserDetailModal } from './AdminUserDetailModal';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Role = Database['public']['Tables']['roles']['Row'];

export const AdminUsersPage: React.FC = () => {
  const { user, isSuperAdmin } = useAuth();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'STUDENTS' | 'ADMINS' | 'WITH_DEVICES'>('ALL');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*, user_roles(role_id, roles(id, name)), notification_tokens(id, device_type, created_at)')
        .order('created_at', { ascending: false });

      if (profilesData) setUsersList(profilesData);

      const { data: rolesData } = await supabase.from('roles').select('*');
      if (rolesData) setRoles(rolesData);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    // Setup Supabase Realtime Channels for live Web synchronization
    const profileChannel = supabase
      .channel('public:admin-users-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchUsers()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles' },
        () => fetchUsers()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notification_tokens' },
        () => fetchUsers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, []);

  const toggleUserStatus = async (targetUser: Profile) => {
    if (targetUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      alert('Cannot deactivate the root Super Admin account.');
      return;
    }

    const newStatus = !targetUser.is_active;
    try {
      await supabase
        .from('profiles')
        .update({ is_active: newStatus } as any)
        .eq('id', targetUser.id);

      await supabase.from('admin_logs').insert({
        admin_id: user!.id,
        action: newStatus ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        target_table: 'profiles',
        target_id: targetUser.id,
        details: { email: targetUser.email, is_active: newStatus },
      } as any);

      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: newStatus } : u))
      );
    } catch (err) {
      console.error('Error updating user status:', err);
    }
  };

  const handleRoleChange = async (targetUserId: string, targetEmail: string, roleName: AppRole) => {
    if (!isSuperAdmin) {
      alert('Only SUPER_ADMIN can modify account roles.');
      return;
    }
    if (targetEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && roleName !== 'SUPER_ADMIN') {
      alert('Cannot change role of the primary Super Admin.');
      return;
    }

    try {
      const selectedRole = roles.find((r) => r.name === roleName);
      if (!selectedRole) return;

      await supabase.from('user_roles').delete().eq('user_id', targetUserId);

      await supabase.from('user_roles').insert({
        user_id: targetUserId,
        role_id: selectedRole.id,
        assigned_by: user!.id,
      } as any);

      await supabase.from('admin_logs').insert({
        admin_id: user!.id,
        action: 'USER_ROLE_CHANGED',
        target_table: 'user_roles',
        target_id: targetUserId,
        details: { targetEmail, newRole: roleName },
      } as any);

      fetchUsers();
    } catch (err) {
      console.error('Error modifying user role:', err);
    }
  };

  const filteredUsers = usersList.filter((u) => {
    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.college_name?.toLowerCase().includes(q) ||
        u.student_id?.toLowerCase().includes(q) ||
        u.department?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }

    // 2. Filter Tabs
    const roleName = u.user_roles?.[0]?.roles?.name || 'STUDENT';
    const deviceCount = u.notification_tokens?.length || 0;

    if (filterTab === 'STUDENTS') return roleName === 'STUDENT';
    if (filterTab === 'ADMINS') return roleName === 'ADMIN' || roleName === 'SUPER_ADMIN';
    if (filterTab === 'WITH_DEVICES') return deviceCount > 0;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Detail Modal */}
      <AdminUserDetailModal
        isOpen={isDetailModalOpen}
        user={selectedUser}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedUser(null);
        }}
        onUserUpdated={fetchUsers}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              User Directory & Device Diagnostics
            </h2>
            <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 animate-pulse">
              ● Live Realtime
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Inspect live campus student accounts, college assignments, FCM push tokens, and permission privileges.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={fetchUsers}
          >
            Refresh
          </Button>
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search student, email, college..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Quick Counter */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1.5">
          {[
            { id: 'ALL', label: `All Users (${usersList.length})` },
            { id: 'STUDENTS', label: 'Students' },
            { id: 'ADMINS', label: 'Administrators' },
            { id: 'WITH_DEVICES', label: '📲 With FCM Devices' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                filterTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-500 dark:text-slate-400">
          Showing <span className="font-bold text-slate-900 dark:text-white">{filteredUsers.length}</span> entries
        </span>
      </div>

      {/* Users Table */}
      <Card className="p-0 overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">College / University</th>
                <th className="py-3 px-4">Department / ID</th>
                <th className="py-3 px-4">FCM Devices</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading real-time campus directory...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const userRoleName: AppRole =
                    u.user_roles?.[0]?.roles?.name ||
                    (u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
                      ? 'SUPER_ADMIN'
                      : 'STUDENT');
                  const deviceCount = u.notification_tokens?.length || 0;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center flex-shrink-0 text-xs overflow-hidden">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt={u.full_name} className="w-full h-full object-cover" />
                            ) : (
                              u.full_name?.charAt(0).toUpperCase() || 'U'
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {u.full_name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* College Name */}
                      <td className="py-3.5 px-4">
                        {u.college_name ? (
                          <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            <School className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                            {u.college_name}
                          </span>
                        ) : (
                          <span className="italic text-amber-500 text-[11px]">Pending Selection</span>
                        )}
                      </td>

                      {/* ID / Dept */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        <div className="font-medium text-slate-900 dark:text-slate-200">{u.department || '—'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{u.student_id || 'No ID'}</div>
                      </td>

                      {/* FCM Devices */}
                      <td className="py-3.5 px-4">
                        {deviceCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                            <Smartphone className="w-3 h-3" /> {deviceCount} {deviceCount === 1 ? 'Device' : 'Devices'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">None</span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        {isSuperAdmin && u.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase() ? (
                          <select
                            value={userRoleName}
                            onChange={(e) =>
                              handleRoleChange(u.id, u.email, e.target.value as AppRole)
                            }
                            className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-semibold outline-none"
                          >
                            <option value="STUDENT">STUDENT</option>
                            <option value="MODERATOR">MODERATOR</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                          </select>
                        ) : (
                          <Badge
                            variant={
                              userRoleName === 'SUPER_ADMIN'
                                ? 'danger'
                                : userRoleName === 'ADMIN'
                                ? 'indigo'
                                : userRoleName === 'MODERATOR'
                                ? 'purple'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            <Shield className="w-3 h-3 mr-1" /> {userRoleName}
                          </Badge>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {u.is_active ? (
                          <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-semibold gap-1 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-rose-600 dark:text-rose-400 font-semibold gap-1 text-[11px]">
                            <XCircle className="w-3.5 h-3.5" /> Suspended
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
                            title="View Full Profile & Diagnostics"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => toggleUserStatus(u)}
                            disabled={u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                              u.is_active
                                ? 'text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            } disabled:opacity-40 disabled:pointer-events-none`}
                          >
                            {u.is_active ? 'Disable' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};


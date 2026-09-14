import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  Smartphone,
  Eye,
  School,
  Shield,
  RefreshCw,
  Users,
  AlertCircle,
  GraduationCap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth, SUPER_ADMIN_EMAIL } from '../../context/AuthContext';
import type { Database, AppRole } from '../../types/database.types';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { AdminUserDetailModal } from './AdminUserDetailModal';

type Role = Database['public']['Tables']['roles']['Row'];

export const AdminUsersPage: React.FC = () => {
  const { user, isSuperAdmin } = useAuth();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'STUDENTS' | 'ADMINS' | 'WITH_DEVICES' | 'NO_COLLEGE'>('ALL');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      // 1. Try fetching via RPC first (High performance, auto-syncs auth users)
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_admin_users_directory');

      if (!rpcErr && rpcData && Array.isArray(rpcData)) {
        setUsersList(rpcData);
      } else {
        console.warn('RPC get_admin_users_directory not available, falling back to direct table fetch:', rpcErr?.message);
        
        // 2. Resilient Direct Table Fetching (Multi-table fallback)
        const { data: profiles, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (profErr) {
          throw profErr;
        }

        if (profiles) {
          // Fetch roles & tokens in parallel with error insulation
          const [userRolesRes, tokensRes] = await Promise.allSettled([
            supabase.from('user_roles').select('user_id, role_id, roles(id, name)'),
            supabase.from('notification_tokens').select('id, user_id, device_type, token, device_info, created_at'),
          ]);

          const userRolesMap = new Map<string, string>();
          if (userRolesRes.status === 'fulfilled' && userRolesRes.value.data) {
            userRolesRes.value.data.forEach((ur: any) => {
              const rName = ur.roles?.name;
              if (rName) userRolesMap.set(ur.user_id, rName);
            });
          }

          const tokensMap = new Map<string, any[]>();
          if (tokensRes.status === 'fulfilled' && tokensRes.value.data) {
            tokensRes.value.data.forEach((tok: any) => {
              const list = tokensMap.get(tok.user_id) || [];
              list.push(tok);
              tokensMap.set(tok.user_id, list);
            });
          }

          const merged = profiles.map((p) => {
            const assignedRole =
              userRolesMap.get(p.id) ||
              (p.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ? 'SUPER_ADMIN' : 'STUDENT');
            const devices = tokensMap.get(p.id) || [];

            return {
              ...p,
              role_name: assignedRole,
              device_count: devices.length,
              devices: devices,
            };
          });

          setUsersList(merged);
        }
      }

      // Fetch master roles list for role dropdowns
      const { data: rolesData } = await supabase.from('roles').select('*');
      if (rolesData) setRoles(rolesData);
    } catch (err: any) {
      console.error('Error fetching users directory:', err);
      setFetchError(err.message || 'Failed to fetch user directory from Supabase.');
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [fetchUsers]);

  const toggleUserStatus = async (targetUser: any) => {
    if (targetUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      alert('Cannot deactivate the root Super Admin account.');
      return;
    }

    const newStatus = !targetUser.is_active;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus } as any)
        .eq('id', targetUser.id);

      if (error) throw error;

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
    } catch (err: any) {
      console.error('Error updating user status:', err);
      alert(err.message || 'Failed to update user status.');
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
    } catch (err: any) {
      console.error('Error modifying user role:', err);
      alert(err.message || 'Failed to update role.');
    }
  };

  // Directory Metrics Counters
  const totalUsers = usersList.length;
  const totalStudents = usersList.filter((u) => u.role_name === 'STUDENT' || !u.role_name).length;
  const totalAdmins = usersList.filter((u) => u.role_name === 'ADMIN' || u.role_name === 'SUPER_ADMIN').length;
  const totalWithDevices = usersList.filter((u) => (u.device_count || 0) > 0).length;
  const pendingCollege = usersList.filter((u) => !u.college_name).length;

  const filteredUsers = usersList.filter((u) => {
    // 1. Search Query filter across all student attributes
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.college_name?.toLowerCase().includes(q) ||
        u.student_id?.toLowerCase().includes(q) ||
        u.department?.toLowerCase().includes(q) ||
        u.phone_number?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }

    // 2. Tab filter
    const roleName = u.role_name || (u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ? 'SUPER_ADMIN' : 'STUDENT');
    const deviceCount = u.device_count || (u.devices?.length) || 0;

    if (filterTab === 'STUDENTS') return roleName === 'STUDENT';
    if (filterTab === 'ADMINS') return roleName === 'ADMIN' || roleName === 'SUPER_ADMIN';
    if (filterTab === 'WITH_DEVICES') return deviceCount > 0;
    if (filterTab === 'NO_COLLEGE') return !u.college_name;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Detail & Diagnostics Modal */}
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
              User Directory & Student Diagnostics
            </h2>
            <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 animate-pulse">
              ● Live Realtime
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Complete database directory of all registered students, colleges, roll numbers, FCM tokens, and accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchUsers}
          >
            Refresh
          </Button>
          <div className="relative min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, email, college, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Metric Quick Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Accounts</p>
            <h4 className="text-xl font-black text-slate-900 dark:text-white">{loading ? '...' : totalUsers}</h4>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Students</p>
            <h4 className="text-xl font-black text-slate-900 dark:text-white">{loading ? '...' : totalStudents}</h4>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Push Connected</p>
            <h4 className="text-xl font-black text-slate-900 dark:text-white">{loading ? '...' : totalWithDevices}</h4>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold">
            <School className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Pending College</p>
            <h4 className="text-xl font-black text-slate-900 dark:text-white">{loading ? '...' : pendingCollege}</h4>
          </div>
        </div>
      </div>

      {/* Error / Diagnostic Alert */}
      {fetchError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 text-rose-800 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
            <div>
              <p className="font-bold">Supabase Query Diagnostic:</p>
              <p className="font-mono text-[11px] mt-0.5">{fetchError}</p>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Make sure you have executed the latest SQL migration in the Supabase SQL Editor.
              </p>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={fetchUsers}>
            Retry Fetch
          </Button>
        </div>
      )}

      {/* Filter Tabs & Quick Counter */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'ALL', label: `All Users (${usersList.length})` },
            { id: 'STUDENTS', label: `Students (${totalStudents})` },
            { id: 'ADMINS', label: `Admins (${totalAdmins})` },
            { id: 'WITH_DEVICES', label: `📲 Push Active (${totalWithDevices})` },
            { id: 'NO_COLLEGE', label: `⚠️ No College (${pendingCollege})` },
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
          Showing <span className="font-bold text-slate-900 dark:text-white">{filteredUsers.length}</span> of {usersList.length} entries
        </span>
      </div>

      {/* Users Table */}
      <Card className="p-0 overflow-hidden border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Student / User Profile</th>
                <th className="py-3.5 px-4">College / University</th>
                <th className="py-3.5 px-4">Department & Roll ID</th>
                <th className="py-3.5 px-4">FCM Push Status</th>
                <th className="py-3.5 px-4">Assigned Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="font-medium text-slate-700 dark:text-slate-300">Fetching student directory from Supabase...</p>
                    <p className="text-[11px] text-slate-400 mt-1">Retrieving profile metadata, college records, and connected devices</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-bold text-slate-700 dark:text-slate-300">No users found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {searchQuery ? 'Try adjusting your search filters.' : 'No registered profiles in database.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const userRoleName: AppRole =
                    u.role_name ||
                    u.user_roles?.[0]?.roles?.name ||
                    (u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ? 'SUPER_ADMIN' : 'STUDENT');
                  
                  const deviceCount = u.device_count || (u.devices?.length) || (u.notification_tokens?.length) || 0;

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-indigo-50/30 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      {/* Name, Email, Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-xs shadow-sm overflow-hidden">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt={u.full_name} className="w-full h-full object-cover" />
                            ) : (
                              u.full_name?.charAt(0).toUpperCase() || 'U'
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              {u.full_name || 'Unnamed User'}
                              {u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && (
                                <span className="text-[9px] font-extrabold bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 px-1.5 py-0.2 rounded">
                                  ROOT
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">{u.email}</div>
                            {u.phone_number && (
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{u.phone_number}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* College Name */}
                      <td className="py-3.5 px-4">
                        {u.college_name ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <School className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                              {u.college_name}
                            </span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              ✓ Verified Campus
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                              <AlertCircle className="w-3 h-3" /> Pending Selection
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Department & ID */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {u.department || <span className="text-slate-400 italic">—</span>}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {u.student_id ? (
                            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                              {u.student_id}
                            </span>
                          ) : (
                            <span className="text-slate-400">No Student ID</span>
                          )}
                        </div>
                      </td>

                      {/* FCM Devices */}
                      <td className="py-3.5 px-4">
                        {deviceCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800">
                            <Smartphone className="w-3.5 h-3.5" /> {deviceCount} {deviceCount === 1 ? 'Device' : 'Devices'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No Push Token</span>
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
                            className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 font-semibold outline-none text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
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
                            title="Inspect Profile & Diagnostics"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => toggleUserStatus(u)}
                            disabled={u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                              u.is_active
                                ? 'text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            } disabled:opacity-30 disabled:pointer-events-none`}
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

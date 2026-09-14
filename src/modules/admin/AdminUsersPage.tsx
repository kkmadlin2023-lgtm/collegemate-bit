import React, { useState, useEffect } from 'react';
import { Search, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth, SUPER_ADMIN_EMAIL } from '../../context/AuthContext';
import type { Database, AppRole } from '../../types/database.types';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { format } from 'date-fns';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Role = Database['public']['Tables']['roles']['Row'];

export const AdminUsersPage: React.FC = () => {
  const { user, isSuperAdmin } = useAuth();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*, user_roles(role_id, roles(id, name))')
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
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.student_id?.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            User Directory & Access Control
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Search registered students and manage permission roles with audit trail protection.
          </p>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, student ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
          />
        </div>
      </div>

      {/* Users Table */}
      <Card className="p-0 overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">Student ID / Dept</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Joined Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    Loading registered campus members...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    No users matching search query.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const userRoleName: AppRole =
                    u.user_roles?.[0]?.roles?.name ||
                    (u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
                      ? 'SUPER_ADMIN'
                      : 'STUDENT');

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {u.full_name}
                        </div>
                        <div className="text-[11px] text-slate-400">{u.email}</div>
                      </td>

                      {/* ID / Dept */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        <div>{u.student_id || '—'}</div>
                        <div className="text-[11px] text-slate-400">{u.department || 'General'}</div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        {isSuperAdmin && u.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase() ? (
                          <select
                            value={userRoleName}
                            onChange={(e) =>
                              handleRoleChange(u.id, u.email, e.target.value as AppRole)
                            }
                            className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-semibold"
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
                                ? 'purple'
                                : userRoleName === 'ADMIN'
                                ? 'indigo'
                                : userRoleName === 'MODERATOR'
                                ? 'warning'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            {userRoleName}
                          </Badge>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {u.is_active ? (
                          <span className="inline-flex items-center text-emerald-600 font-semibold gap-1 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-rose-600 font-semibold gap-1 text-[11px]">
                            <XCircle className="w-3.5 h-3.5" /> Disabled
                          </span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {format(new Date(u.created_at), 'MMM d, yyyy')}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
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

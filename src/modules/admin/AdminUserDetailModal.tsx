import React, { useState, useEffect } from 'react';
import {
  Mail,
  School,
  Building,
  CreditCard,
  Phone,
  Calendar,
  Shield,
  Smartphone,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { format, formatDistanceToNow } from 'date-fns';

interface AdminUserDetailModalProps {
  user: any | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated?: () => void;
}

export const AdminUserDetailModal: React.FC<AdminUserDetailModalProps> = ({
  user: targetUser,
  isOpen,
  onClose,
  onUserUpdated,
}) => {
  const { user: currentAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'devices' | 'activity' | 'message'>('profile');
  const [deviceTokens, setDeviceTokens] = useState<any[]>([]);
  const [activityStats, setActivityStats] = useState<{
    schedules: number;
    reminders: number;
    lostItems: number;
    foundItems: number;
    claims: number;
  }>({ schedules: 0, reminders: 0, lostItems: 0, foundItems: 0, claims: 0 });
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Direct Message Form
  const [directTitle, setDirectTitle] = useState('');
  const [directMessage, setDirectMessage] = useState('');
  const [sendingDirect, setSendingDirect] = useState(false);
  const [directSuccess, setDirectSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!targetUser || !isOpen) return;

    // Use pre-fetched devices if available
    if (targetUser.devices && Array.isArray(targetUser.devices)) {
      setDeviceTokens(targetUser.devices);
    }

    const fetchUserDetails = async () => {
      setLoadingDetails(true);
      try {
        // 1. Fetch Connected Device Tokens if not already present
        if (!targetUser.devices || targetUser.devices.length === 0) {
          const { data: tokens } = await supabase
            .from('notification_tokens')
            .select('*')
            .eq('user_id', targetUser.id)
            .order('created_at', { ascending: false });
          if (tokens) setDeviceTokens(tokens);
        }

        // 2. Fetch Activity Counts with safety
        const [
          schedRes,
          remRes,
          lostRes,
          foundRes,
          claimsRes,
        ] = await Promise.allSettled([
          supabase.from('schedules').select('*', { count: 'exact', head: true }).eq('user_id', targetUser.id),
          supabase.from('reminders').select('*', { count: 'exact', head: true }).eq('user_id', targetUser.id),
          supabase.from('lost_items').select('*', { count: 'exact', head: true }).eq('user_id', targetUser.id),
          supabase.from('found_items').select('*', { count: 'exact', head: true }).eq('user_id', targetUser.id),
          supabase.from('claims').select('*', { count: 'exact', head: true }).eq('claimant_id', targetUser.id),
        ]);

        setActivityStats({
          schedules: schedRes.status === 'fulfilled' ? schedRes.value.count || 0 : 0,
          reminders: remRes.status === 'fulfilled' ? remRes.value.count || 0 : 0,
          lostItems: lostRes.status === 'fulfilled' ? lostRes.value.count || 0 : 0,
          foundItems: foundRes.status === 'fulfilled' ? foundRes.value.count || 0 : 0,
          claims: claimsRes.status === 'fulfilled' ? claimsRes.value.count || 0 : 0,
        });
      } catch (err) {
        console.error('Error fetching user details:', err);
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchUserDetails();
  }, [targetUser, isOpen]);

  const handleSendDirectNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAdmin || !targetUser) return;
    if (!directTitle.trim() || !directMessage.trim()) return;

    setSendingDirect(true);
    setDirectSuccess(null);

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Insert directly into user's notifications with 7-day retention
      const { error } = await supabase.from('notifications').insert({
        user_id: targetUser.id,
        title: directTitle.trim(),
        body: directMessage.trim(),
        type: 'ADMIN_BROADCAST',
        data: { sender_admin: currentAdmin.id },
        expires_at: expiresAt.toISOString(),
      } as any);

      if (error) throw error;

      setDirectSuccess('Direct alert dispatched to student inbox & connected devices!');
      setDirectTitle('');
      setDirectMessage('');
      if (onUserUpdated) onUserUpdated();
      setTimeout(() => setDirectSuccess(null), 4000);
    } catch (err: any) {
      console.error('Error sending direct alert:', err);
      alert(err.message || 'Failed to send notification');
    } finally {
      setSendingDirect(false);
    }
  };

  if (!targetUser) return null;

  const roleName = targetUser.user_roles?.[0]?.roles?.name || 'STUDENT';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Profile & Device Diagnostics"
    >
      <div className="space-y-5 text-left">
        {/* User Hero Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-extrabold text-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 overflow-hidden">
              {targetUser.avatar_url ? (
                <img
                  src={targetUser.avatar_url}
                  alt={targetUser.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                targetUser.full_name?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {targetUser.full_name || 'Unnamed Student'}
                </h3>
                {targetUser.is_active ? (
                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3 mr-0.5" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                    <XCircle className="w-3 h-3 mr-0.5" /> Suspended
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> {targetUser.email}
              </p>
            </div>
          </div>

          <Badge
            variant={
              roleName === 'SUPER_ADMIN'
                ? 'danger'
                : roleName === 'ADMIN'
                ? 'indigo'
                : roleName === 'MODERATOR'
                ? 'purple'
                : 'neutral'
            }
            size="md"
          >
            <Shield className="w-3.5 h-3.5 mr-1" /> {roleName}
          </Badge>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
          {[
            { id: 'profile', label: 'Identity & Academics' },
            { id: 'devices', label: `FCM Devices (${deviceTokens.length})` },
            { id: 'activity', label: 'Activity Stats' },
            { id: 'message', label: 'Send Direct Alert' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Profile & Academics */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <School className="w-3.5 h-3.5 text-indigo-500" /> College / University
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {targetUser.college_name || (
                  <span className="text-amber-500 font-normal italic">Pending Onboarding Selection</span>
                )}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-purple-500" /> Department / Major
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {targetUser.department || 'Not Specified'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-emerald-500" /> Roll / Student ID
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {targetUser.student_id || 'Not Assigned'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-sky-500" /> Phone Number
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {targetUser.phone_number || 'Not Added'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-rose-500" /> Registered On
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {format(new Date(targetUser.created_at), 'PPP p')}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" /> Account ID (UUID)
              </span>
              <p className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate">
                {targetUser.id}
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Connected Devices & FCM Tokens */}
        {activeTab === 'devices' && (
          <div className="space-y-3">
            {loadingDetails ? (
              <div className="p-6 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                Loading device tokens...
              </div>
            ) : deviceTokens.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <Smartphone className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No FCM Device Registered</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  This user has not yet approved push notification permissions on any phone or browser.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {deviceTokens.map((tok, idx) => (
                  <div
                    key={tok.id || idx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Device #{idx + 1} ({tok.device_type || 'WEB'})
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Registered {formatDistanceToNow(new Date(tok.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 font-mono truncate">
                      <p>Platform: {tok.device_info?.platform || navigator.platform}</p>
                      <p className="truncate">Token: {tok.token.substring(0, 32)}...</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Activity Breakdown */}
        {activeTab === 'activity' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-center">
              <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
                {activityStats.schedules}
              </span>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">Timetable Classes</p>
            </div>

            <div className="p-4 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50 text-center">
              <span className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
                {activityStats.reminders}
              </span>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">Active Reminders</p>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-center">
              <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
                {activityStats.lostItems}
              </span>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">Lost Reports</p>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 text-center">
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {activityStats.foundItems}
              </span>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">Found Deposited</p>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 text-center col-span-2 sm:col-span-1">
              <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                {activityStats.claims}
              </span>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">Ownership Claims</p>
            </div>
          </div>
        )}

        {/* Tab 4: Direct Message */}
        {activeTab === 'message' && (
          <form onSubmit={handleSendDirectNotification} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Direct Notification Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Schedule Change Alert / Found Item Verification"
                value={directTitle}
                onChange={(e) => setDirectTitle(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Message Body *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Write your direct alert message for this specific student..."
                value={directMessage}
                onChange={(e) => setDirectMessage(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {directSuccess && (
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                {directSuccess}
              </p>
            )}

            <Button
              type="submit"
              size="sm"
              variant="primary"
              className="w-full"
              isLoading={sendingDirect}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Send Direct Device Alert (7-Day Retention)
            </Button>
          </form>
        )}

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close Diagnostics
          </Button>
        </div>
      </div>
    </Modal>
  );
};
 

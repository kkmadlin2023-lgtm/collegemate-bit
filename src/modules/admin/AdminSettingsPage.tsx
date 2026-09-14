import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';

export const AdminSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [appName, setAppName] = useState('CampusMate');
  const [academicSemester, setAcademicSemester] = useState('Fall 2026');
  const [supportEmail, setSupportEmail] = useState('support@campusmate.app');
  const [autoApproveLost, setAutoApproveLost] = useState(false);
  const [autoApproveFound, setAutoApproveFound] = useState(false);
  const [allowGuestBrowsing, setAllowGuestBrowsing] = useState(true);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('system_settings').select('*');
      if (data) {
        data.forEach((item: any) => {
          if (item.key === 'app_name') setAppName(item.value as string);
          if (item.key === 'academic_semester') setAcademicSemester(item.value as string);
          if (item.key === 'contact_support_email') setSupportEmail(item.value as string);
          if (item.key === 'auto_approve_lost_items') setAutoApproveLost(Boolean(item.value));
          if (item.key === 'auto_approve_found_items') setAutoApproveFound(Boolean(item.value));
          if (item.key === 'allow_guest_browsing') setAllowGuestBrowsing(Boolean(item.value));
        });
      }
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      const settingsUpdates = [
        { key: 'app_name', value: appName, updated_by: user?.id },
        { key: 'academic_semester', value: academicSemester, updated_by: user?.id },
        { key: 'contact_support_email', value: supportEmail, updated_by: user?.id },
        { key: 'auto_approve_lost_items', value: autoApproveLost, updated_by: user?.id },
        { key: 'auto_approve_found_items', value: autoApproveFound, updated_by: user?.id },
        { key: 'allow_guest_browsing', value: allowGuestBrowsing, updated_by: user?.id },
      ];

      for (const setting of settingsUpdates) {
        await supabase.from('system_settings').upsert(setting as any, { onConflict: 'key' });
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Campus System Settings
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Configure application parameters, moderation automation, and semester schedule info.
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
            General Campus Parameters
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Application Display Name"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              required
            />
            <Input
              label="Active Academic Semester"
              value={academicSemester}
              onChange={(e) => setAcademicSemester(e.target.value)}
              required
            />
          </div>

          <Input
            type="email"
            label="Campus Support Email"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            required
          />
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
            Moderation & Privacy Policies
          </h3>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoApproveLost}
                onChange={(e) => setAutoApproveLost(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Auto-Approve Lost Item Listings
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Allow student lost item reports to become publicly visible immediately without moderator review.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoApproveFound}
                onChange={(e) => setAutoApproveFound(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Auto-Approve Found Item Listings
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Publish found item notices automatically to the community feed.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowGuestBrowsing}
                onChange={(e) => setAllowGuestBrowsing(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Allow Unauthenticated Visitor Browsing
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Allow guests to view approved lost and found boards without signing in first.
                </span>
              </div>
            </label>
          </div>
        </Card>

        <div className="flex items-center justify-between pt-2">
          {savedSuccess ? (
            <span className="inline-flex items-center text-xs font-semibold text-emerald-600 gap-1">
              <CheckCircle2 className="w-4 h-4" /> System settings updated successfully!
            </span>
          ) : (
            <div />
          )}

          <Button type="submit" isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>
            Save System Settings
          </Button>
        </div>
      </form>
    </div>
  );
};

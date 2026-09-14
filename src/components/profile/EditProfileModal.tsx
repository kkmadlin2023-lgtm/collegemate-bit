import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  School,
  Building,
  CreditCard,
  Image,
  Check,
  Sparkles,
  AlertCircle,
  Camera,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Luna',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Nova',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Max',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Zoe',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Leo',
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  onProfileUpdated,
}) => {
  const { user, profile, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [department, setDepartment] = useState('');
  const [studentId, setStudentId] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [knownColleges, setKnownColleges] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (profile) {
      setFullName(profile.full_name || '');
      setPhoneNumber(profile.phone_number || '');
      setCollegeName(profile.college_name || '');
      setDepartment(profile.department || '');
      setStudentId(profile.student_id || '');
      setAvatarUrl(profile.avatar_url || '');
    } else if (user) {
      setFullName(user.email?.split('@')[0] || '');
    }

    setError(null);
    setSuccess(false);

    // Fetch colleges for suggestions
    const fetchColleges = async () => {
      const { data } = await supabase
        .from('colleges')
        .select('name')
        .eq('is_active', true)
        .order('name');
      if (data) {
        setKnownColleges(data.map((c: any) => c.name));
      }
    };
    fetchColleges();
  }, [isOpen, profile, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!fullName.trim()) {
      setError('Please provide your full name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formattedCollege = collegeName.trim() || null;

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone_number: phoneNumber.trim() || null,
          college_name: formattedCollege,
          department: department.trim() || null,
          student_id: studentId.trim() || null,
          avatar_url: avatarUrl.trim() || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', user.id);

      if (updateErr) throw updateErr;

      // If new college name entered, add to master list
      if (formattedCollege) {
        await supabase
          .from('colleges')
          .insert({ name: formattedCollege } as any)
          .select()
          .maybeSingle();
      }

      await refreshProfile();
      if (onProfileUpdated) onProfileUpdated();

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Student Profile"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-left">
        {error && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-2xl text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>Profile successfully updated!</span>
          </div>
        )}

        {/* Profile Picture Header & Presets */}
        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center overflow-hidden shadow-lg shadow-indigo-600/20 ring-2 ring-indigo-500/20">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                fullName.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-sm">
              <Camera className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left space-y-1.5">
            <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Choose an Avatar or Paste Image URL
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
              {PRESET_AVATARS.map((preset, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setAvatarUrl(preset)}
                  className={`w-7 h-7 rounded-xl overflow-hidden border-2 transition-transform hover:scale-110 ${
                    avatarUrl === preset
                      ? 'border-indigo-600 ring-2 ring-indigo-600/30 scale-105'
                      : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                >
                  <img src={preset} alt={`Avatar ${index + 1}`} className="w-full h-full object-cover bg-white" />
                </button>
              ))}
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="text-[10px] text-slate-400 hover:text-rose-500 ml-1 underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-3.5">
          <Input
            label="Full Name *"
            placeholder="e.g. Madhan Kumar"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Email Address (Locked)"
              value={user?.email || ''}
              disabled
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Phone Number"
              placeholder="e.g. +91 98765 43210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              leftIcon={<Phone className="w-4 h-4" />}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              College / University Name
            </label>
            <div className="relative">
              <Input
                placeholder="e.g. Bannari Amman Institute of Technology (BIT)"
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                leftIcon={<School className="w-4 h-4" />}
                list="college-suggestions"
              />
              <datalist id="college-suggestions">
                {knownColleges.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Department / Major"
              placeholder="e.g. Computer Science (CSE)"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              leftIcon={<Building className="w-4 h-4" />}
            />

            <Input
              label="Roll Number / Student ID"
              placeholder="e.g. 231CS101"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              leftIcon={<CreditCard className="w-4 h-4" />}
            />
          </div>

          <Input
            label="Custom Avatar URL (Optional)"
            placeholder="https://example.com/avatar.jpg"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            leftIcon={<Image className="w-4 h-4" />}
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={loading}
            rightIcon={<Check className="w-4 h-4" />}
          >
            Save Profile Details
          </Button>
        </div>
      </form>
    </Modal>
  );
};

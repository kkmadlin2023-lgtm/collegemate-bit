import React, { useState, useEffect } from 'react';
import { School, Building, CreditCard, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

export const CollegeOnboardingModal: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [collegeName, setCollegeName] = useState('');
  const [department, setDepartment] = useState('');
  const [studentId, setStudentId] = useState('');
  const [knownColleges, setKnownColleges] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMissingCollege = user && profile && !profile.college_name;

  useEffect(() => {
    const fetchColleges = async () => {
      const { data } = await supabase
        .from('colleges')
        .select('name')
        .eq('is_active', true);
      if (data) {
        setKnownColleges(data.map((c: any) => c.name));
      }
    };
    if (isMissingCollege) {
      fetchColleges();
    }
  }, [isMissingCollege]);

  if (!isMissingCollege) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeName.trim()) {
      setError('Please select or enter your College / University name.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formattedCollege = collegeName.trim();

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          college_name: formattedCollege,
          department: department.trim() || null,
          student_id: studentId.trim() || null,
        } as any)
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Upsert into master colleges table if not exists
      await supabase
        .from('colleges')
        .insert({ name: formattedCollege } as any)
        .select()
        .maybeSingle();

      await refreshProfile();
    } catch (err: any) {
      setError(err.message || 'Failed to save campus profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const presetColleges = [
    'Bannari Amman Institute of Technology (BIT)',
    'PSG College of Technology',
    'Kumaraguru College of Technology (KCT)',
    'Coimbatore Institute of Technology (CIT)',
    'Amrita Vishwa Vidyapeetham',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-indigo-600/30">
            <School className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Complete Your Student Profile
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Please enter your college name to connect you with campus schedules, local reminders, and your university lost & found hub.
          </p>
        </div>

        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              College / University Name *
            </label>
            <Input
              placeholder="e.g. Bannari Amman Institute of Technology"
              value={collegeName}
              onChange={(e) => setCollegeName(e.target.value)}
              leftIcon={<School className="w-4 h-4" />}
              required
            />
          </div>

          {/* Quick select chips for popular colleges */}
          <div className="space-y-1.5 text-left">
            <span className="text-[11px] text-slate-400 font-medium">Quick Select Campus:</span>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set([...knownColleges, ...presetColleges])].slice(0, 4).map((college) => (
                <button
                  key={college}
                  type="button"
                  onClick={() => setCollegeName(college)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all text-left ${
                    collegeName === college
                      ? 'bg-indigo-600 text-white border-indigo-600 font-semibold shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  {college}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <Input
              label="Department / Major"
              placeholder="e.g. CSE / IT / ECE"
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

          <Button
            type="submit"
            isLoading={submitting}
            className="w-full mt-4"
            size="lg"
            rightIcon={<Check className="w-4 h-4" />}
          >
            Enter CampusMate
          </Button>
        </form>
      </div>
    </div>
  );
};

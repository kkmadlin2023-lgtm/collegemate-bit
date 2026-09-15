import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Database, RecurrenceType } from '../../types/database.types';
import { createGoogleCalendarEventDirect, updateGoogleCalendarEventDirect, isGoogleCalendarAutoSyncEnabled } from '../../lib/googleCalendarApi';
import { showLocalDeviceNotification } from '../../lib/firebase';

type Schedule = Database['public']['Tables']['schedules']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  scheduleToEdit?: Schedule | null;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  scheduleToEdit,
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [instructor, setInstructor] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('WEEKLY');
  const [color, setColor] = useState('#4f46e5');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [syncToGCal, setSyncToGCal] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('type', 'SCHEDULE')
        .eq('is_active', true);
      if (data) setCategories(data);
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (scheduleToEdit) {
      setTitle(scheduleToEdit.title);
      setDescription(scheduleToEdit.description || '');
      setLocation(scheduleToEdit.location || '');
      setInstructor(scheduleToEdit.instructor || '');
      setDayOfWeek(scheduleToEdit.day_of_week.toString());
      setStartTime(scheduleToEdit.start_time.slice(0, 5));
      setEndTime(scheduleToEdit.end_time.slice(0, 5));
      setRecurrence(scheduleToEdit.recurrence);
      setColor(scheduleToEdit.color);
      setCategoryId(scheduleToEdit.category_id || '');
    } else {
      setTitle('');
      setDescription('');
      setLocation('');
      setInstructor('');
      setDayOfWeek('1');
      setStartTime('09:00');
      setEndTime('10:30');
      setRecurrence('WEEKLY');
      setColor('#4f46e5');
      setCategoryId('');
    }
  }, [scheduleToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) {
      setError('Class / event title is required.');
      return;
    }
    if (startTime >= endTime) {
      setError('End time must be after start time.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let savedGoogleEventId: string | null = (scheduleToEdit as any)?.google_event_id || null;

      // Direct Google Calendar sync in background without page redirect
      if (syncToGCal && isGoogleCalendarAutoSyncEnabled()) {
        try {
          const now = new Date();
          const currentDay = now.getDay();
          const targetDay = parseInt(dayOfWeek, 10);
          let daysUntil = (targetDay - currentDay + 7) % 7;
          if (daysUntil === 0) daysUntil = 7;

          const targetDate = new Date();
          targetDate.setDate(now.getDate() + daysUntil);

          const [sH, sM] = startTime.split(':').map(Number);
          const [eH, eM] = endTime.split(':').map(Number);

          const start = new Date(targetDate);
          start.setHours(sH, sM, 0, 0);

          const end = new Date(targetDate);
          end.setHours(eH, eM, 0, 0);

          const calInput = {
            title: `📚 ${title.trim()}`,
            description: [description.trim(), instructor ? `Instructor: ${instructor}` : '', 'CampusMate Recurring Class'].filter(Boolean).join('\n'),
            location: location.trim() || null,
            startDate: start,
            endDate: end,
            recurrenceRule: 'RRULE:FREQ=WEEKLY',
          };

          if (scheduleToEdit && savedGoogleEventId) {
            await updateGoogleCalendarEventDirect(savedGoogleEventId, calInput);
          } else {
            const { googleEventId } = await createGoogleCalendarEventDirect(calInput);
            if (googleEventId) savedGoogleEventId = googleEventId;
          }
        } catch (calErr) {
          console.warn('Google Calendar class sync warning:', calErr);
        }
      }

      if (scheduleToEdit) {
        const { error: updateError } = await supabase
          .from('schedules')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            location: location.trim() || null,
            instructor: instructor.trim() || null,
            day_of_week: parseInt(dayOfWeek, 10),
            start_time: startTime,
            end_time: endTime,
            recurrence,
            color,
            category_id: categoryId || null,
            google_event_id: savedGoogleEventId,
          } as any)
          .eq('id', scheduleToEdit.id)
          .eq('user_id', user.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('schedules').insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          instructor: instructor.trim() || null,
          day_of_week: parseInt(dayOfWeek, 10),
          start_time: startTime,
          end_time: endTime,
          recurrence,
          color,
          category_id: categoryId || null,
          google_event_id: savedGoogleEventId,
        } as any);

        if (insertError) throw insertError;
      }

      showLocalDeviceNotification(
        `📚 Schedule Saved: ${title.trim()}`,
        `Class slot configured for every ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][parseInt(dayOfWeek, 10)]}`
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save schedule');
    } finally {
      setLoading(false);
    }
  };

  const dayOptions = [
    { value: '1', label: 'Monday' },
    { value: '2', label: 'Tuesday' },
    { value: '3', label: 'Wednesday' },
    { value: '4', label: 'Thursday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' },
    { value: '0', label: 'Sunday' },
  ];

  const recurrenceOptions = [
    { value: 'WEEKLY', label: 'Repeats Weekly' },
    { value: 'BIWEEKLY', label: 'Repeats Bi-Weekly' },
    { value: 'DAILY', label: 'Repeats Daily' },
    { value: 'NONE', label: 'One Time Only' },
  ];

  const categoryOptions = [
    { value: '', label: 'Select Category (Optional)' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const presetColors = [
    '#4f46e5', // Indigo
    '#2563eb', // Blue
    '#059669', // Emerald
    '#d97706', // Amber
    '#dc2626', // Red
    '#7c3aed', // Purple
    '#db2777', // Pink
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={scheduleToEdit ? 'Edit Class Schedule' : 'Add Class / Lab Schedule'}
      description="Add recurring lecture slots and campus commitments."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800">
            {error}
          </div>
        )}

        <Input
          label="Subject / Activity Title *"
          placeholder="e.g. Data Structures & Algorithms"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Location / Room"
            placeholder="e.g. CS Lab 204 / Hall B"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <Input
            label="Faculty / Instructor"
            placeholder="e.g. Dr. Ramesh Kumar"
            value={instructor}
            onChange={(e) => setInstructor(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Day of the Week"
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value)}
            options={dayOptions}
          />
          <Input
            type="time"
            label="Start Time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
          <Input
            type="time"
            label="End Time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Recurrence"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
            options={recurrenceOptions}
          />
          <Select
            label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={categoryOptions}
          />
        </div>

        <div className="space-y-1.5 text-left">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Description / Syllabus Notes
          </label>
          <textarea
            rows={2}
            placeholder="Topic overview, reference links, etc."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Color Tag
          </label>
          <div className="flex items-center gap-2">
            {presetColors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`w-7 h-7 rounded-full transition-transform ${
                  color === c ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : 'hover:scale-105'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Direct Background Google Calendar Auto-assign Checkbox */}
        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 cursor-pointer text-left">
          <input
            type="checkbox"
            checked={syncToGCal}
            onChange={(e) => setSyncToGCal(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
          />
          <div className="text-xs">
            <span className="font-bold text-slate-900 dark:text-white">📅 Auto-sync to Google Calendar in Background</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Directly syncs weekly recurring class timetable without redirecting to a new tab.
            </p>
          </div>
        </label>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            {scheduleToEdit ? 'Save Changes' : 'Create Schedule'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

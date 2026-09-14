import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Database, PriorityLevel, RecurrenceType } from '../../types/database.types';

type Reminder = Database['public']['Tables']['reminders']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reminderToEdit?: Reminder | null;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  reminderToEdit,
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('23:59');
  const [priority, setPriority] = useState<PriorityLevel>('MEDIUM');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('NONE');
  const [notifyBefore, setNotifyBefore] = useState('15');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('type', 'REMINDER')
        .eq('is_active', true);
      if (data) setCategories(data);
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (reminderToEdit) {
      setTitle(reminderToEdit.title);
      setDescription(reminderToEdit.description || '');
      const dt = new Date(reminderToEdit.due_date);
      setDueDate(dt.toISOString().split('T')[0]);
      setDueTime(dt.toTimeString().slice(0, 5));
      setPriority(reminderToEdit.priority);
      setRecurrence(reminderToEdit.recurrence);
      setNotifyBefore(reminderToEdit.notify_before_minutes.toString());
      setCategoryId(reminderToEdit.category_id || '');
    } else {
      setTitle('');
      setDescription('');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDueDate(tomorrow.toISOString().split('T')[0]);
      setDueTime('23:59');
      setPriority('MEDIUM');
      setRecurrence('NONE');
      setNotifyBefore('15');
      setCategoryId('');
    }
  }, [reminderToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) {
      setError('Reminder title is required.');
      return;
    }

    setLoading(true);
    setError(null);

    const fullDueDateTime = new Date(`${dueDate}T${dueTime}:00`).toISOString();

    try {
      if (reminderToEdit) {
        const { error: updateError } = await supabase
          .from('reminders')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            due_date: fullDueDateTime,
            priority,
            recurrence,
            notify_before_minutes: parseInt(notifyBefore, 10),
            category_id: categoryId || null,
          } as any)
          .eq('id', reminderToEdit.id)
          .eq('user_id', user.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('reminders').insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          due_date: fullDueDateTime,
          priority,
          recurrence,
          notify_before_minutes: parseInt(notifyBefore, 10),
          category_id: categoryId || null,
        } as any);

        if (insertError) throw insertError;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save reminder');
    } finally {
      setLoading(false);
    }
  };

  const priorityOptions = [
    { value: 'LOW', label: '🟢 Low Priority' },
    { value: 'MEDIUM', label: '🟡 Medium Priority' },
    { value: 'HIGH', label: '🟠 High Priority' },
    { value: 'URGENT', label: '🔴 Urgent Priority' },
  ];

  const notificationOptions = [
    { value: '0', label: 'At time of event' },
    { value: '15', label: '15 minutes before' },
    { value: '30', label: '30 minutes before' },
    { value: '60', label: '1 hour before' },
    { value: '1440', label: '1 day before' },
  ];

  const categoryOptions = [
    { value: '', label: 'Select Category (Optional)' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={reminderToEdit ? 'Edit Task / Reminder' : 'Create Task / Reminder'}
      description="Stay on top of coursework assignments, exams, and personal errands."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800">
            {error}
          </div>
        )}

        <Input
          label="Reminder Title *"
          placeholder="e.g. Submit Physics Lab Report 3"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            type="date"
            label="Due Date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
          <Input
            type="time"
            label="Due Time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Priority Level"
            value={priority}
            onChange={(e) => setPriority(e.target.value as PriorityLevel)}
            options={priorityOptions}
          />
          <Select
            label="Notification Alarm"
            value={notifyBefore}
            onChange={(e) => setNotifyBefore(e.target.value)}
            options={notificationOptions}
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
            Notes / Details
          </label>
          <textarea
            rows={3}
            placeholder="Add relevant notes, submission links, or checklist..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            {reminderToEdit ? 'Save Changes' : 'Create Reminder'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

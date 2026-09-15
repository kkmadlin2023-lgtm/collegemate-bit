import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  Circle,
  Clock,
  Edit2,
  Plus,
  Trash2,
  CheckSquare,
  Calendar,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Database, PriorityLevel } from '../../types/database.types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { ReminderModal } from './ReminderModal';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { FullCalendarView } from '../../components/calendar/FullCalendarView';
import { generateGoogleCalendarUrlForReminder, openGoogleCalendarUrl } from '../../lib/googleCalendar';

type Reminder = Database['public']['Tables']['reminders']['Row'];

export const RemindersPage: React.FC = () => {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('LIST');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reminderToEdit, setReminderToEdit] = useState<Reminder | null>(null);

  const fetchReminders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: reminderData } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true });

      if (reminderData) setReminders(reminderData);
    } catch (err) {
      console.error('Error fetching reminders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchReminders();
  }, [user]);

  const toggleComplete = async (reminder: Reminder) => {
    const updatedStatus = !reminder.is_completed;
    try {
      await supabase
        .from('reminders')
        .update({
          is_completed: updatedStatus,
          completed_at: updatedStatus ? new Date().toISOString() : null,
        } as any)
        .eq('id', reminder.id)
        .eq('user_id', user!.id);

      setReminders((prev) =>
        prev.map((r) =>
          r.id === reminder.id
            ? { ...r, is_completed: updatedStatus, completed_at: updatedStatus ? new Date().toISOString() : null }
            : r
        )
      );
    } catch (err) {
      console.error('Error updating reminder:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reminder?')) return;
    try {
      await supabase.from('reminders').delete().eq('id', id).eq('user_id', user!.id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Error deleting reminder:', err);
    }
  };

  const filteredReminders = reminders.filter((r) => {
    if (statusFilter === 'ACTIVE' && r.is_completed) return false;
    if (statusFilter === 'COMPLETED' && !r.is_completed) return false;
    if (priorityFilter !== 'ALL' && r.priority !== priorityFilter) return false;
    return true;
  });

  const getPriorityBadge = (p: PriorityLevel) => {
    switch (p) {
      case 'URGENT':
        return <Badge variant="danger">🔴 Urgent</Badge>;
      case 'HIGH':
        return <Badge variant="warning">🟠 High</Badge>;
      case 'MEDIUM':
        return <Badge variant="indigo">🟡 Medium</Badge>;
      default:
        return <Badge variant="neutral">🟢 Low</Badge>;
    }
  };

  const formatDueDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`;
    if (isTomorrow(d)) return `Tomorrow at ${format(d, 'h:mm a')}`;
    return format(d, 'MMM d, yyyy • h:mm a');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Reminder Manager
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Keep track of assignment deadlines, exams, and personal errands.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('LIST')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'LIST'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode('CALENDAR')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'CALENDAR'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              📅 Calendar
            </button>
          </div>

          <Button
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setReminderToEdit(null);
              setIsModalOpen(true);
            }}
          >
            New Reminder
          </Button>
        </div>
      </div>

      {/* List View Mode */}
      {viewMode === 'LIST' ? (
        <>
          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            {/* Status Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Active ({reminders.filter((r) => !r.is_completed).length})
              </button>
              <button
                onClick={() => setStatusFilter('COMPLETED')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === 'COMPLETED'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Completed ({reminders.filter((r) => r.is_completed).length})
              </button>
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All
              </button>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All Priorities</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          {/* Reminders List */}
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                <div className="h-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
                <div className="h-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
              </div>
            ) : filteredReminders.length === 0 ? (
              <EmptyState
                icon={<CheckSquare className="w-6 h-6" />}
                title="No Reminders Found"
                description="All caught up! You have no tasks matching this filter."
                actionLabel="Add New Reminder"
                onAction={() => {
                  setReminderToEdit(null);
                  setIsModalOpen(true);
                }}
              />
            ) : (
              filteredReminders.map((item) => {
                const isOverdue = !item.is_completed && isPast(new Date(item.due_date));

                return (
                  <Card
                    key={item.id}
                    hoverable
                    className={`p-4 flex items-center justify-between transition-all ${
                      item.is_completed ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <button
                        onClick={() => toggleComplete(item)}
                        className="mt-0.5 p-0.5 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors"
                      >
                        {item.is_completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100 dark:fill-emerald-950" />
                        ) : (
                          <Circle className="w-5 h-5 hover:text-indigo-600" />
                        )}
                      </button>

                      <div className="space-y-1">
                        <h4
                          className={`text-sm font-bold text-slate-900 dark:text-white ${
                            item.is_completed ? 'line-through text-slate-400 dark:text-slate-500' : ''
                          }`}
                        >
                          {item.title}
                        </h4>

                        {item.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {item.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                          <span
                            className={`flex items-center gap-1 font-semibold ${
                              isOverdue
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            {formatDueDate(item.due_date)} {isOverdue && '(Overdue)'}
                          </span>
                          {getPriorityBadge(item.priority)}
                          {item.notify_before_minutes > 0 && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <Bell className="w-3 h-3 text-indigo-500" />
                              {item.notify_before_minutes}m before
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const url = generateGoogleCalendarUrlForReminder(item);
                          openGoogleCalendarUrl(url);
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                        title="Add to Google Calendar"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setReminderToEdit(item);
                          setIsModalOpen(true);
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit Reminder"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Delete Reminder"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </>
      ) : (
        <FullCalendarView />
      )}

      {/* Modal */}
      <ReminderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchReminders}
        reminderToEdit={reminderToEdit}
      />
    </div>
  );
};

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
  CalendarPlus,
  Check,
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
import { autoSyncReminderDirect, deleteGoogleCalendarEventDirect } from '../../lib/googleCalendarApi';
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
  const [syncingId, setSyncingId] = useState<string | null>(null);

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

  const handleDelete = async (reminder: Reminder) => {
    if (!confirm('Are you sure you want to delete this reminder?')) return;
    try {
      // 1. Delete from Google Calendar in background if synced
      if ((reminder as any).google_event_id) {
        await deleteGoogleCalendarEventDirect((reminder as any).google_event_id);
      }

      // 2. Delete from Supabase
      await supabase.from('reminders').delete().eq('id', reminder.id).eq('user_id', user!.id);
      setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
    } catch (err) {
      console.error('Error deleting reminder:', err);
    }
  };

  const handleDirectGCalSync = async (reminder: Reminder) => {
    setSyncingId(reminder.id);
    try {
      const googleEventId = await autoSyncReminderDirect(reminder as any, 'CREATE');
      if (googleEventId) {
        await supabase
          .from('reminders')
          .update({ google_event_id: googleEventId } as any)
          .eq('id', reminder.id)
          .eq('user_id', user!.id);

        setReminders((prev) =>
          prev.map((r) => (r.id === reminder.id ? { ...r, google_event_id: googleEventId } as any : r))
        );
      } else {
        const url = generateGoogleCalendarUrlForReminder(reminder);
        openGoogleCalendarUrl(url);
      }
    } catch (e) {
      const url = generateGoogleCalendarUrlForReminder(reminder);
      openGoogleCalendarUrl(url);
    } finally {
      setSyncingId(null);
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
            Keep track of assignment deadlines, exams, and personal errands. Auto-synced to Google Calendar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('LIST')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'LIST'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode('CALENDAR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                viewMode === 'CALENDAR'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Calendar
            </button>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setReminderToEdit(null);
              setIsModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Task
          </Button>
        </div>
      </div>

      {viewMode === 'CALENDAR' ? (
        <FullCalendarView />
      ) : (
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 border-l-4 border-indigo-500">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Tasks</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {reminders.length}
              </p>
            </Card>

            <Card className="p-4 border-l-4 border-amber-500">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending</p>
              <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                {reminders.filter((r) => !r.is_completed).length}
              </p>
            </Card>

            <Card className="p-4 border-l-4 border-rose-500">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Urgent</p>
              <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
                {reminders.filter((r) => !r.is_completed && r.priority === 'URGENT').length}
              </p>
            </Card>

            <Card className="p-4 border-l-4 border-emerald-500">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed</p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {reminders.filter((r) => r.is_completed).length}
              </p>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                }`}
              >
                Active Tasks
              </button>
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  statusFilter === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('COMPLETED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  statusFilter === 'COMPLETED'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                }`}
              >
                Completed
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="ALL">All Priorities</option>
                <option value="URGENT">Urgent Only</option>
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="LOW">Low Priority</option>
              </select>
            </div>
          </div>

          {/* Reminders List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : filteredReminders.length === 0 ? (
            <EmptyState
              icon={<CheckSquare className="w-6 h-6" />}
              title="No Reminders Found"
              description={
                statusFilter === 'COMPLETED'
                  ? "You haven't completed any reminders yet."
                  : 'Great job! You have cleared all your tasks and reminders.'
              }
              actionLabel="Create Task"
              onAction={() => {
                setReminderToEdit(null);
                setIsModalOpen(true);
              }}
            />
          ) : (
            <div className="space-y-3">
              {filteredReminders.map((item) => {
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
                          {(item as any).google_event_id && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" /> GCal Synced
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDirectGCalSync(item)}
                        disabled={syncingId === item.id}
                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                        title="Sync to Google Calendar in background"
                      >
                        <CalendarPlus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setReminderToEdit(item);
                          setIsModalOpen(true);
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create / Edit Modal */}
      <ReminderModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setReminderToEdit(null);
        }}
        onSuccess={fetchReminders}
        reminderToEdit={reminderToEdit}
      />
    </div>
  );
};

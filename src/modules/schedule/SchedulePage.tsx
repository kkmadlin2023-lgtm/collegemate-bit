import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Edit2, MapPin, Plus, Trash2, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Database } from '../../types/database.types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { ScheduleModal } from './ScheduleModal';
import { formatTime, getDayName, getDayShortName } from '../../lib/utils';
import { FullCalendarView } from '../../components/calendar/FullCalendarView';
import { deleteGoogleCalendarEventDirect } from '../../lib/googleCalendarApi';

type Schedule = Database['public']['Tables']['schedules']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

export const SchedulePage: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [viewMode, setViewMode] = useState<'WEEK' | 'DAY' | 'CALENDAR'>('WEEK');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scheduleToEdit, setScheduleToEdit] = useState<Schedule | null>(null);

  const fetchSchedules = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: scheduleData }, { data: catData }] = await Promise.all([
        supabase
          .from('schedules')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('start_time', { ascending: true }),
        supabase
          .from('categories')
          .select('*')
          .eq('type', 'SCHEDULE')
          .eq('is_active', true),
      ]);

      if (scheduleData) setSchedules(scheduleData);
      if (catData) setCategories(catData);
    } catch (err) {
      console.error('Error fetching schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchSchedules();
  }, [user]);

  const handleDelete = async (schedule: Schedule) => {
    if (!confirm('Are you sure you want to remove this class from your schedule?')) return;
    try {
      if ((schedule as any).google_event_id) {
        await deleteGoogleCalendarEventDirect((schedule as any).google_event_id);
      }
      await supabase.from('schedules').delete().eq('id', schedule.id).eq('user_id', user!.id);
      setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
    } catch (err) {
      console.error('Error deleting schedule:', err);
    }
  };

  const filteredSchedules = schedules.filter((s) => {
    if (selectedCategory !== 'ALL' && s.category_id !== selectedCategory) return false;
    return true;
  });

  const daysOfWeek = [1, 2, 3, 4, 5, 6, 0]; // Mon - Sun

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Schedule Manager
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Organize lectures, lab sessions, and recurring weekly commitments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('WEEK')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'WEEK'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Week View
            </button>
            <button
              onClick={() => setViewMode('DAY')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'DAY'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Day View
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
              setScheduleToEdit(null);
              setIsModalOpen(true);
            }}
          >
            Add Class
          </Button>
        </div>
      </div>

      {/* Category Filter Badges — hidden in Calendar view */}
      {viewMode !== 'CALENDAR' && (
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            selectedCategory === 'ALL'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
          }`}
        >
          All Categories
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
              selectedCategory === c.id
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
      )}

      {/* DAY VIEW */}
      {viewMode === 'DAY' && (
        <div className="space-y-4">
          <div className="grid grid-cols-7 gap-2">
            {daysOfWeek.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`py-2 px-1 text-center rounded-xl border transition-all ${
                  selectedDay === day
                    ? 'bg-indigo-50 border-indigo-600 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-500 font-bold shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="text-[10px] uppercase">{getDayShortName(day)}</div>
                <div className="text-xs font-bold mt-0.5">{getDayName(day).slice(0, 3)}</div>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : filteredSchedules.filter((s) => s.day_of_week === selectedDay).length === 0 ? (
              <EmptyState
                icon={<Calendar className="w-6 h-6" />}
                title={`No classes on ${getDayName(selectedDay)}`}
                description="Take a study break or schedule a new lecture or lab session."
                actionLabel="Add Class for this Day"
                onAction={() => {
                  setScheduleToEdit(null);
                  setIsModalOpen(true);
                }}
              />
            ) : (
              filteredSchedules
                .filter((s) => s.day_of_week === selectedDay)
                .map((item) => (
                  <Card key={item.id} hoverable className="flex items-center justify-between p-4">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-3 h-14 rounded-full flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {item.title}
                          </h4>
                          <Badge variant="indigo" size="sm">
                            {item.recurrence}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTime(item.start_time)} - {formatTime(item.end_time)}
                          </span>
                          {item.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {item.location}
                            </span>
                          )}
                          {item.instructor && (
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5" />
                              {item.instructor}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setScheduleToEdit(item);
                          setIsModalOpen(true);
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                ))
            )}
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {viewMode === 'WEEK' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {daysOfWeek.map((day) => {
            const dayClasses = filteredSchedules.filter((s) => s.day_of_week === day);
            const isToday = new Date().getDay() === day;

            return (
              <div
                key={day}
                className={`rounded-2xl border p-3.5 space-y-3 flex flex-col ${
                  isToday
                    ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-800/80 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className={`text-xs font-bold uppercase ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    {getDayName(day)}
                  </span>
                  {isToday && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                  )}
                </div>

                <div className="space-y-2 flex-1">
                  {dayClasses.length === 0 ? (
                    <p className="text-[11px] text-slate-400 text-center py-6">No classes</p>
                  ) : (
                    dayClasses.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 space-y-1 group relative"
                        style={{ borderLeftColor: item.color, borderLeftWidth: '3px' }}
                      >
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                          {item.title}
                        </h5>
                        <p className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                          {formatTime(item.start_time)} - {formatTime(item.end_time)}
                        </p>
                        {item.location && (
                          <p className="text-[10px] text-slate-400 line-clamp-1 flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5" /> {item.location}
                          </p>
                        )}
                        <div className="pt-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setScheduleToEdit(item);
                              setIsModalOpen(true);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CALENDAR VIEW */}
      {viewMode === 'CALENDAR' && (
        <FullCalendarView />
      )}

      {/* Modal */}
      <ScheduleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchSchedules}
        scheduleToEdit={scheduleToEdit}
      />
    </div>
  );
};

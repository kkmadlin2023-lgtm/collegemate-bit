import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Bell,
  MapPin,
  BookOpen,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Database } from '../../types/database.types';
import { formatTime } from '../../lib/utils';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  getDay,
} from 'date-fns';

type Schedule = Database['public']['Tables']['schedules']['Row'];
type Reminder = Database['public']['Tables']['reminders']['Row'];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

interface CalendarEvent {
  id: string;
  type: 'schedule' | 'reminder';
  title: string;
  time?: string;
  color: string;
  priority?: string;
  location?: string;
  instructor?: string;
}

export const FullCalendarView: React.FC = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: sched }, { data: rem }] = await Promise.all([
          supabase.from('schedules').select('*').eq('user_id', user.id).eq('is_active', true),
          supabase.from('reminders').select('*').eq('user_id', user.id).eq('is_completed', false).order('due_date', { ascending: true }),
        ]);
        if (sched) setSchedules(sched);
        if (rem) setReminders(rem);
      } catch (e) {
        console.error('Calendar load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentDate]);

  const getEventsForDay = (date: Date): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const dayOfWeek = getDay(date);

    schedules
      .filter((s) => s.day_of_week === dayOfWeek)
      .forEach((s) => {
        events.push({
          id: `sched-${s.id}-${format(date, 'yyyy-MM-dd')}`,
          type: 'schedule',
          title: s.title,
          time: s.start_time,
          color: s.color || '#4f46e5',
          location: s.location || undefined,
          instructor: s.instructor || undefined,
        });
      });

    reminders
      .filter((r) => r.due_date && isSameDay(parseISO(r.due_date), date))
      .forEach((r) => {
        const priorityColors: Record<string, string> = {
          URGENT: '#ef4444',
          HIGH: '#f97316',
          MEDIUM: '#eab308',
          LOW: '#22c55e',
        };
        events.push({
          id: `rem-${r.id}`,
          type: 'reminder',
          title: r.title,
          time: format(parseISO(r.due_date), 'HH:mm'),
          color: priorityColors[r.priority] || '#6366f1',
          priority: r.priority,
        });
      });

    events.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
    return events;
  };

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  const prevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => { setCurrentDate(new Date()); setSelectedDay(new Date()); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <h3 className="text-base font-bold text-slate-900 dark:text-white min-w-[160px] text-center">
            {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          <button onClick={nextMonth} className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
        <button onClick={goToday} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors">
          Today
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-500" />Class / Schedule</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500" />Reminder / Deadline</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500" />Urgent Task</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800">
              {DAY_NAMES.map((d) => (
                <div key={d} className="py-2 text-center text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">{d}</div>
              ))}
            </div>
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-400 animate-pulse">Loading calendar…</div>
            ) : (
              <div className="grid grid-cols-7">
                {calendarDays.map((day) => {
                  const events = getEventsForDay(day);
                  const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                  const isCurrent = isToday(day);
                  const inMonth = isSameMonth(day, currentDate);
                  const schedEvents = events.filter((e) => e.type === 'schedule');
                  const remEvents = events.filter((e) => e.type === 'reminder');
                  const hasUrgent = remEvents.some((e) => e.priority === 'URGENT');
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDay(day)}
                      className={`relative min-h-[72px] p-1.5 border-b border-r border-slate-100 dark:border-slate-800 text-left transition-colors ${!inMonth ? 'opacity-30' : ''} ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mb-1 mx-auto ${isCurrent ? 'bg-indigo-600 text-white' : isSelected ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-0.5">
                        {schedEvents.slice(0, 2).map((e) => (
                          <div key={e.id} className="w-full text-[9px] font-semibold px-1 py-0.5 rounded truncate text-white leading-tight" style={{ backgroundColor: e.color }}>
                            {e.time ? formatTime(e.time) : ''} {e.title}
                          </div>
                        ))}
                        {remEvents.slice(0, 1).map((e) => (
                          <div key={e.id} className="w-full text-[9px] font-semibold px-1 py-0.5 rounded truncate text-white leading-tight" style={{ backgroundColor: e.color }}>
                            ⏰ {e.title}
                          </div>
                        ))}
                        {events.length > 3 && <div className="text-[9px] text-slate-400 pl-1">+{events.length - 3} more</div>}
                      </div>
                      {hasUrgent && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {selectedDay ? format(selectedDay, 'EEEE, MMMM d') : 'Select a day'}
              </span>
              {selectedDay && isToday(selectedDay) && (
                <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300">TODAY</span>
              )}
            </div>
            <div className="p-4 space-y-3 max-h-[520px] overflow-y-auto">
              {!selectedDay ? (
                <p className="text-sm text-slate-400 text-center py-8">Click on a date to view events.</p>
              ) : selectedDayEvents.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto">
                    <Calendar className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No events on this day</p>
                  <p className="text-xs text-slate-400">Add classes in Schedule Manager or deadlines in Reminders.</p>
                </div>
              ) : (
                <>
                  {selectedDayEvents.filter((e) => e.type === 'schedule').length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Classes</span>
                      </div>
                      <div className="space-y-2">
                        {selectedDayEvents.filter((e) => e.type === 'schedule').map((event) => (
                          <div key={event.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800" style={{ borderLeftColor: event.color, borderLeftWidth: '3px' }}>
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{event.title}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                              {event.time && <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400"><Clock className="w-3 h-3" />{formatTime(event.time)}</span>}
                              {event.location && <span className="flex items-center gap-1 text-[11px] text-slate-500"><MapPin className="w-3 h-3" />{event.location}</span>}
                            </div>
                            {event.instructor && <p className="text-[11px] text-slate-400 mt-0.5">👤 {event.instructor}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedDayEvents.filter((e) => e.type === 'reminder').length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Bell className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Reminders & Deadlines</span>
                      </div>
                      <div className="space-y-2">
                        {selectedDayEvents.filter((e) => e.type === 'reminder').map((event) => (
                          <div key={event.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800" style={{ borderLeftColor: event.color, borderLeftWidth: '3px' }}>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{event.title}</p>
                              {event.priority === 'URGENT' && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />}
                              {event.priority === 'HIGH' && <Zap className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />}
                            </div>
                            {event.time && <span className="flex items-center gap-1 text-[11px] font-semibold mt-0.5" style={{ color: event.color }}><Clock className="w-3 h-3" />Due at {event.time}</span>}
                            {event.priority && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-1 inline-block" style={{ backgroundColor: event.color + '20', color: event.color }}>{event.priority}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-indigo-50 dark:bg-indigo-950/40 rounded-xl p-3 text-center border border-indigo-100 dark:border-indigo-900/40">
              <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{schedules.length}</p>
              <p className="text-[11px] text-indigo-500 dark:text-indigo-400 font-semibold mt-0.5">Weekly Classes</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/40 rounded-xl p-3 text-center border border-amber-100 dark:border-amber-900/40">
              <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{reminders.length}</p>
              <p className="text-[11px] text-amber-500 dark:text-amber-400 font-semibold mt-0.5">Open Tasks</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

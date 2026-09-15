import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckSquare,
  Clock,
  MapPin,
  Plus,
  Search,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  UserCog,
  Ticket,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database.types';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { ScheduleModal } from '../schedule/ScheduleModal';
import { ReminderModal } from '../reminders/ReminderModal';
import { ReportItemModal } from '../lost-found/ReportItemModal';
import { CreateEventModal } from '../events/CreateEventModal';
import { EditProfileModal } from '../../components/profile/EditProfileModal';
import { formatTime, getDayName } from '../../lib/utils';
import { formatDistanceToNow, format } from 'date-fns';

type Schedule = Database['public']['Tables']['schedules']['Row'];
type Reminder = Database['public']['Tables']['reminders']['Row'];
type LostItem = Database['public']['Tables']['lost_items']['Row'];
type FoundItem = Database['public']['Tables']['found_items']['Row'];

export const StudentDashboard: React.FC = () => {
  const { user, profile } = useAuth();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  const [foundItems, setFoundItems] = useState<FoundItem[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal triggers
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [reportType, setReportType] = useState<'LOST' | 'FOUND'>('LOST');

  const currentDayIndex = new Date().getDay();

  const fetchDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: scheduleData } = await supabase
        .from('schedules')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('start_time', { ascending: true });

      if (scheduleData) setSchedules(scheduleData);

      const { data: reminderData } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .order('due_date', { ascending: true })
        .limit(5);

      if (reminderData) setReminders(reminderData);

      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('event_date', { ascending: true })
        .limit(3);

      if (eventData) setEvents(eventData);

      const { data: lostData } = await supabase
        .from('lost_items')
        .select('*')
        .eq('status', 'APPROVED')
        .order('created_at', { ascending: false })
        .limit(3);

      if (lostData) setLostItems(lostData);

      const { data: foundData } = await supabase
        .from('found_items')
        .select('*')
        .eq('status', 'APPROVED')
        .order('created_at', { ascending: false })
        .limit(3);

      if (foundData) setFoundItems(foundData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const toggleReminder = async (reminder: Reminder) => {
    try {
      await supabase
        .from('reminders')
        .update({
          is_completed: !reminder.is_completed,
          completed_at: !reminder.is_completed ? new Date().toISOString() : null,
        } as any)
        .eq('id', reminder.id)
        .eq('user_id', user!.id);

      setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
    } catch (err) {
      console.error('Error toggling reminder:', err);
    }
  };

  const todaySchedules = schedules.filter((s) => s.day_of_week === currentDayIndex);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Student';

  return (
    <div className="space-y-6">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 p-6 sm:p-8 text-white shadow-xl shadow-indigo-500/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-indigo-100">
              <Sparkles className="w-3.5 h-3.5" /> CampusMate Student Hub
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {getGreeting()}, {firstName} 👋
            </h2>
            <p className="text-sm text-indigo-100 max-w-lg">
              Here is your campus schedule overview for today, <span className="font-semibold text-white">{getDayName(currentDayIndex)}</span>.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-white text-indigo-700 hover:bg-indigo-50 font-bold shadow-none"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsScheduleModalOpen(true)}
            >
              Add Schedule
            </Button>
            <Button
              size="sm"
              className="bg-white/15 text-white hover:bg-white/25 border-white/20 shadow-none"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsReminderModalOpen(true)}
            >
              Add Reminder
            </Button>
            <Button
              size="sm"
              className="bg-purple-500/80 text-white hover:bg-purple-500 border-none shadow-none"
              leftIcon={<Ticket className="w-4 h-4" />}
              onClick={() => setIsEventModalOpen(true)}
            >
              Post Event
            </Button>
            <Button
              size="sm"
              className="bg-rose-500/80 text-white hover:bg-rose-500 border-none shadow-none"
              leftIcon={<Search className="w-4 h-4" />}
              onClick={() => {
                setReportType('LOST');
                setIsReportModalOpen(true);
              }}
            >
              Report Lost
            </Button>
            <Button
              size="sm"
              className="bg-emerald-500/80 text-white hover:bg-emerald-500 border-none shadow-none"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setReportType('FOUND');
                setIsReportModalOpen(true);
              }}
            >
              Report Found
            </Button>
            <Button
              size="sm"
              className="bg-white/10 text-white hover:bg-white/20 border-white/20 shadow-none col-span-2 sm:col-span-1"
              leftIcon={<UserCog className="w-4 h-4" />}
              onClick={() => setIsProfileModalOpen(true)}
            >
              Edit Profile
            </Button>
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Schedule & Upcoming Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Today's Schedule */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Today's Classes & Schedule
              </h3>
            </div>
            <Link
              to="/schedule"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
            >
              Full Calendar <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <Card className="divide-y divide-slate-100 dark:divide-slate-800 p-0 overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">
                <div className="h-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
                <div className="h-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
              </div>
            ) : todaySchedules.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No Classes Scheduled for Today
                </h4>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  Enjoy your free time or add your lecture timetable.
                </p>
                <Button size="sm" onClick={() => setIsScheduleModalOpen(true)}>
                  Add Class
                </Button>
              </div>
            ) : (
              todaySchedules.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-2.5 h-12 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color || '#4f46e5' }}
                    />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span className="flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400">
                          <Clock className="w-3.5 h-3.5" />
                          {formatTime(item.start_time)} - {formatTime(item.end_time)}
                        </span>
                        {item.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {item.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {item.instructor && (
                    <Badge variant="neutral" size="sm" className="hidden sm:inline-flex">
                      {item.instructor}
                    </Badge>
                  )}
                </div>
              ))
            )}
          </Card>
        </div>

        {/* Right Column: Upcoming Reminders */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Upcoming Deadlines
              </h3>
            </div>
            <Link
              to="/reminders"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
            >
              All Tasks <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <Card className="divide-y divide-slate-100 dark:divide-slate-800 p-0 overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">
                <div className="h-14 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
                <div className="h-14 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
              </div>
            ) : reminders.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No Pending Tasks
                </h4>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  You're all caught up with your coursework and errands.
                </p>
                <Button size="sm" onClick={() => setIsReminderModalOpen(true)}>
                  Create Reminder
                </Button>
              </div>
            ) : (
              reminders.map((r) => (
                <div key={r.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleReminder(r)}
                      className="w-5 h-5 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-emerald-500 flex items-center justify-center text-transparent hover:text-emerald-500 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <div>
                      <h5 className="text-xs font-semibold text-slate-900 dark:text-white">{r.title}</h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Due {format(new Date(r.due_date), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      r.priority === 'URGENT'
                        ? 'danger'
                        : r.priority === 'HIGH'
                        ? 'warning'
                        : 'neutral'
                    }
                    size="sm"
                  >
                    {r.priority}
                  </Badge>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>

      {/* Upcoming Campus Events & Fests */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Upcoming Campus Events & Fests
            </h3>
          </div>
          <Link
            to="/events"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
          >
            Explore All Events <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {events.length === 0 ? (
          <Card className="p-6 text-center border-dashed border-slate-300 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No upcoming events posted yet for your campus. Be the first to host one!
            </p>
            <div className="mt-3">
              <Button size="sm" onClick={() => setIsEventModalOpen(true)}>
                Post First Event
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {events.map((ev) => (
              <Card key={ev.id} hoverable className="overflow-hidden p-0 flex flex-col justify-between">
                {ev.image_url ? (
                  <div className="h-32 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img
                      src={ev.image_url}
                      alt={ev.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="h-24 bg-gradient-to-r from-purple-600 to-indigo-600 p-3 text-white flex flex-col justify-end">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full w-fit">
                      {ev.category}
                    </span>
                  </div>
                )}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{ev.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{ev.description}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                      <Calendar className="w-3.5 h-3.5" /> {ev.event_date}
                    </span>
                    <span className="truncate max-w-[120px]">{ev.location}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Lost & Found Community Feed Preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Recent Lost & Found Bulletin
            </h3>
          </div>
          <Link
            to="/lost-found"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
          >
            Browse All Items <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lostItems.slice(0, 2).map((item) => (
            <Card key={item.id} hoverable className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="danger" size="sm">
                    LOST
                  </Badge>
                  <span className="text-[11px] text-slate-400">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{item.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {item.description}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {item.last_seen_location}
                </span>
              </div>
            </Card>
          ))}

          {foundItems.slice(0, 1).map((item) => (
            <Card key={item.id} hoverable className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="success" size="sm">
                    FOUND
                  </Badge>
                  <span className="text-[11px] text-slate-400">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{item.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {item.description}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> At: {item.current_location}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Modals */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSuccess={fetchDashboardData}
      />
      <ReminderModal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        onSuccess={fetchDashboardData}
      />
      <ReportItemModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSuccess={fetchDashboardData}
        defaultType={reportType}
      />
      <CreateEventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSuccess={fetchDashboardData}
      />
      <EditProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileUpdated={fetchDashboardData}
      />
    </div>
  );
};

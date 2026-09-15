import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Plus,
  Search,
  School,
  Share2,
  ExternalLink,
  Trash2,
  Sparkles,
  Ticket,
  User,
  MessageCircle,
  CalendarPlus,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { CreateEventModal } from './CreateEventModal';
import { autoSyncCampusEventDirect, deleteGoogleCalendarEventDirect } from '../../lib/googleCalendarApi';
import { generateGoogleCalendarUrlForEvent, openGoogleCalendarUrl } from '../../lib/googleCalendar';
import { format, parseISO, isPast, isToday } from 'date-fns';

export interface CampusEvent {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  event_date: string;
  start_time: string;
  end_time?: string | null;
  location: string;
  college_name: string;
  organizer_name: string;
  contact_mobile: string;
  contact_email?: string | null;
  image_url?: string | null;
  registration_link?: string | null;
  is_featured: boolean;
  google_event_id?: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { id: 'ALL', label: 'All Events' },
  { id: 'HACKATHON', label: '💻 Hackathons' },
  { id: 'WORKSHOP', label: '🛠️ Workshops' },
  { id: 'SYMPOSIUM', label: '🎓 Symposiums' },
  { id: 'CULTURAL', label: '🎭 Fests & Music' },
  { id: 'SPORTS', label: '🏆 Sports' },
  { id: 'SEMINAR', label: '🎤 Seminars' },
  { id: 'WEBINAR', label: '🌐 Webinars' },
  { id: 'CLUB', label: '🤝 Club Meetups' },
];

export const EventsPage: React.FC = () => {
  const { user, isAdmin } = useAuth();

  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedCollege, setSelectedCollege] = useState('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CampusEvent | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      if (data) setEvents(data as CampusEvent[]);
    } catch (err) {
      console.error('Error fetching campus events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const collegesList = useMemo(() => {
    const names = new Set<string>();
    events.forEach((e) => {
      if (e.college_name) names.add(e.college_name);
    });
    return Array.from(names).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // Category filter
      if (selectedCategory !== 'ALL' && ev.category !== selectedCategory) {
        return false;
      }
      // College filter
      if (selectedCollege !== 'ALL' && ev.college_name !== selectedCollege) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          ev.title.toLowerCase().includes(q) ||
          ev.description.toLowerCase().includes(q) ||
          ev.location.toLowerCase().includes(q) ||
          ev.college_name.toLowerCase().includes(q) ||
          ev.organizer_name.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [events, selectedCategory, selectedCollege, searchQuery]);

  const handleDeleteEvent = async (event: CampusEvent) => {
    if (!user) return;
    const canDelete = event.user_id === user.id || isAdmin;
    if (!canDelete) {
      alert('You can only delete events that you created.');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${event.title}"?`)) return;

    try {
      // 1. Delete from Google Calendar in background if synced
      if (event.google_event_id) {
        await deleteGoogleCalendarEventDirect(event.google_event_id);
      }

      // 2. Delete from Supabase
      const { error } = await supabase.from('events').delete().eq('id', event.id);
      if (error) throw error;

      setEvents((prev) => prev.filter((e) => e.id !== event.id));
      if (selectedEvent?.id === event.id) {
        setSelectedEvent(null);
      }
    } catch (err: any) {
      alert('Failed to delete event: ' + err.message);
    }
  };

  const handleDirectGCalSync = async (event: CampusEvent) => {
    setSyncingId(event.id);
    try {
      const googleEventId = await autoSyncCampusEventDirect(event, 'CREATE');
      if (googleEventId) {
        // Save to Supabase
        await supabase.from('events').update({ google_event_id: googleEventId } as any).eq('id', event.id);
        setEvents((prev) =>
          prev.map((e) => (e.id === event.id ? { ...e, google_event_id: googleEventId } : e))
        );
      } else {
        // Fallback to URL intent if not signed in to Google
        const url = generateGoogleCalendarUrlForEvent(event);
        openGoogleCalendarUrl(url);
      }
    } catch (e) {
      const url = generateGoogleCalendarUrlForEvent(event);
      openGoogleCalendarUrl(url);
    } finally {
      setSyncingId(null);
    }
  };

  const handleShare = (event: CampusEvent) => {
    const text = `🎉 *${event.title}*\n📅 ${event.event_date} at ${event.start_time}\n📍 ${event.location}\n🏫 ${event.college_name}\n📞 Contact: ${event.contact_mobile}\n\nCheck out on CampusMate!`;
    if (navigator.share) {
      navigator.share({ title: event.title, text });
    } else {
      navigator.clipboard.writeText(text);
      setCopiedId(event.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const formatEventDate = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      if (isToday(d)) return 'Today';
      return format(d, 'EEE, MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const getCategoryBadgeColor = (cat: string) => {
    switch (cat) {
      case 'HACKATHON':
        return 'indigo';
      case 'WORKSHOP':
        return 'warning';
      case 'CULTURAL':
        return 'danger';
      case 'SPORTS':
        return 'success';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 p-6 sm:p-8 text-white shadow-xl shadow-indigo-500/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-purple-100">
              <Ticket className="w-3.5 h-3.5" /> Campus Events & Fests Hub
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Discover, Host & Connect 🎉
            </h2>
            <p className="text-sm text-purple-100 max-w-xl">
              Explore upcoming hackathons, symposiums, cultural nights, sports tournaments, and workshops across campus.
            </p>
          </div>

          <Button
            size="lg"
            className="bg-white text-purple-800 hover:bg-purple-50 font-extrabold shadow-lg shadow-black/10 flex-shrink-0"
            leftIcon={<Plus className="w-5 h-5" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Post New Event
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search events by title, venue, organizer, college..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
            />
          </div>

          {collegesList.length > 0 && (
            <select
              value={selectedCollege}
              onChange={(e) => setSelectedCollege(e.target.value)}
              className="px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs sm:text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm font-medium"
            >
              <option value="ALL">🏢 All Campuses ({events.length})</option>
              {collegesList.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                selectedCategory === cat.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-80 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-3xl" />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          icon={<Ticket className="w-6 h-6" />}
          title="No Campus Events Found"
          description={
            searchQuery || selectedCategory !== 'ALL' || selectedCollege !== 'ALL'
              ? 'Try changing your search keywords or clearing filters.'
              : 'Be the first student or club to organize an event on your campus!'
          }
          actionLabel="Post an Event"
          onAction={() => {
            setSearchQuery('');
            setSelectedCategory('ALL');
            setSelectedCollege('ALL');
            setIsCreateModalOpen(true);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((ev) => {
            const isAuthor = user?.id === ev.user_id;
            const isOverdue = isPast(new Date(`${ev.event_date}T23:59:59`));

            return (
              <Card
                key={ev.id}
                hoverable
                className={`group flex flex-col justify-between overflow-hidden p-0 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-xl transition-all duration-300 ${
                  isOverdue ? 'opacity-70' : ''
                }`}
              >
                {/* Event Poster / Banner */}
                <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                  {ev.image_url ? (
                    <img
                      src={ev.image_url}
                      alt={ev.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1000&q=80';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-700 via-indigo-800 to-slate-900 flex items-center justify-center">
                      <Sparkles className="w-12 h-12 text-white/20" />
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <Badge variant={getCategoryBadgeColor(ev.category)} size="sm">
                      {ev.category}
                    </Badge>
                    {ev.is_featured && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950 shadow-md">
                        ★ FEATURED
                      </span>
                    )}
                  </div>

                  {/* Date & Time pill on bottom of image */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-semibold">
                    <span className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl">
                      <Calendar className="w-3.5 h-3.5 text-purple-400" />
                      {formatEventDate(ev.event_date)}
                    </span>
                    <span className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      {ev.start_time}
                    </span>
                  </div>
                </div>

                {/* Event Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3
                      onClick={() => setSelectedEvent(ev)}
                      className="text-base font-bold text-slate-900 dark:text-white line-clamp-1 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer transition-colors"
                    >
                      {ev.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {ev.description}
                    </p>

                    <div className="space-y-1.5 pt-2 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <School className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                        <span className="truncate text-slate-500 dark:text-slate-400">{ev.college_name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Organizer & Action Bar */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold">
                        {ev.organizer_name ? ev.organizer_name[0].toUpperCase() : 'U'}
                      </div>
                      <div className="text-left">
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate max-w-[90px]">
                          {ev.organizer_name}
                        </p>
                        <p className="text-[10px] text-slate-400">Host</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* WhatsApp Shortcut */}
                      <a
                        href={`https://wa.me/${ev.contact_mobile.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Hi, I saw your "${ev.title}" event on CampusMate and wanted more details.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 hover:bg-emerald-100 transition-colors"
                        title="Chat on WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>

                      {/* Direct Phone Call */}
                      <a
                        href={`tel:${ev.contact_mobile}`}
                        className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 hover:bg-indigo-100 transition-colors"
                        title={`Call ${ev.contact_mobile}`}
                      >
                        <Phone className="w-4 h-4" />
                      </a>

                      {/* Google Calendar Direct Sync */}
                      <button
                        onClick={() => handleDirectGCalSync(ev)}
                        disabled={syncingId === ev.id}
                        className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 hover:bg-purple-100 transition-colors"
                        title="Add to Google Calendar"
                      >
                        <CalendarPlus className="w-4 h-4" />
                      </button>

                      {/* Share */}
                      <button
                        onClick={() => handleShare(ev)}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Share event link"
                      >
                        {copiedId === ev.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
                      </button>

                      {/* Delete (Author or Admin) */}
                      {(isAuthor || isAdmin) && (
                        <button
                          onClick={() => handleDeleteEvent(ev)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Delete Event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Floating Action Button for Rapid Event Creation */}
      <button
        onClick={() => setIsCreateModalOpen(true)}
        className="fixed bottom-20 right-6 z-30 md:bottom-8 md:right-8 flex items-center gap-2 px-5 py-3.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-2xl shadow-purple-600/40 hover:scale-105 active:scale-95 transition-all duration-200"
      >
        <Plus className="w-5 h-5" />
        <span className="hidden sm:inline">Post Event</span>
      </button>

      {/* Modals */}
      <CreateEventModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchEvents}
      />

      {/* Event Details Inspection Modal */}
      {selectedEvent && (
        <Modal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          title={selectedEvent.title}
        >
          <div className="space-y-4">
            {selectedEvent.image_url && (
              <div className="h-60 w-full overflow-hidden rounded-2xl bg-slate-900 shadow-sm">
                <img
                  src={selectedEvent.image_url}
                  alt={selectedEvent.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getCategoryBadgeColor(selectedEvent.category)}>
                {selectedEvent.category}
              </Badge>
              <Badge variant="neutral">
                <School className="w-3.5 h-3.5 mr-1" />
                {selectedEvent.college_name}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Date & Time</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-purple-500" />
                  {selectedEvent.event_date} ({selectedEvent.start_time} - {selectedEvent.end_time || 'End'})
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Venue / Room</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-500" />
                  {selectedEvent.location}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Organizer</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-500" />
                  {selectedEvent.organizer_name}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Contact Phone</span>
                <p className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Phone className="w-4 h-4" />
                  {selectedEvent.contact_mobile}
                </p>
              </div>
            </div>

            <div className="space-y-1 text-left">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Event Description
              </h4>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                {selectedEvent.description}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDirectGCalSync(selectedEvent)}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 flex items-center gap-1.5 transition-colors"
                >
                  <CalendarPlus className="w-4 h-4" />
                  Add to Google Calendar
                </button>
                <button
                  onClick={() => handleShare(selectedEvent)}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>

              {selectedEvent.registration_link && (
                <a
                  href={selectedEvent.registration_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 shadow-md shadow-purple-600/20 transition-all"
                >
                  Register Now
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { CreateEventModal } from './CreateEventModal';
import { generateGoogleCalendarUrlForEvent, openGoogleCalendarUrl } from '../../lib/googleCalendar';
import { format, parseISO, isPast, isToday } from 'date-fns';

interface CampusEvent {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  event_date: string;
  start_time: string;
  end_time?: string | null;
  location: string;
  college_name?: string | null;
  organizer_name?: string | null;
  contact_mobile: string;
  contact_email?: string | null;
  image_url?: string | null;
  registration_link?: string | null;
  status: string;
  is_featured: boolean;
  created_at: string;
}

const CATEGORY_TABS = [
  { id: 'ALL', label: 'All Events' },
  { id: 'WORKSHOP', label: '🛠️ Workshops' },
  { id: 'HACKATHON', label: '💻 Hackathons' },
  { id: 'SYMPOSIUM', label: '🎓 Symposiums' },
  { id: 'CULTURAL', label: '🎭 Culturals & Fests' },
  { id: 'SPORTS', label: '🏆 Sports' },
  { id: 'SEMINAR', label: '🎤 Seminars' },
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
  const [selectedEventDetails, setSelectedEventDetails] = useState<CampusEvent | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });

      if (!error && data) {
        setEvents(data as CampusEvent[]);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();

    // Setup realtime listener for new event broadcasts
    const channel = supabase
      .channel('public:events_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => fetchEvents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${eventTitle}"?`)) return;

    try {
      const { error } = await supabase.from('events').delete().eq('id', eventId);
      if (error) throw error;
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      if (selectedEventDetails?.id === eventId) {
        setSelectedEventDetails(null);
      }
    } catch (err: any) {
      console.error('Error deleting event:', err);
      alert(err.message || 'Failed to delete event');
    }
  };

  const handleShareEvent = (event: CampusEvent) => {
    const shareText = `🎉 ${event.title}\n📅 Date: ${event.event_date} at ${event.start_time}\n📍 Venue: ${event.location}\n📞 Contact: ${event.contact_mobile}\nExplore on CampusMate!`;
    if (navigator.share) {
      navigator.share({
        title: event.title,
        text: shareText,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      alert('Event details copied to clipboard!');
    }
  };

  const uniqueColleges = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      if (e.college_name) set.add(e.college_name);
    });
    return Array.from(set);
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (selectedCategory !== 'ALL' && e.category !== selectedCategory) return false;
      if (selectedCollege !== 'ALL' && e.college_name !== selectedCollege) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          (e.college_name && e.college_name.toLowerCase().includes(q)) ||
          (e.organizer_name && e.organizer_name.toLowerCase().includes(q)) ||
          e.contact_mobile.includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [events, selectedCategory, selectedCollege, searchQuery]);

  const getCategoryBadgeVariant = (cat: string) => {
    switch (cat) {
      case 'HACKATHON': return 'purple';
      case 'WORKSHOP': return 'indigo';
      case 'CULTURAL': return 'warning';
      case 'SPORTS': return 'success';
      case 'SYMPOSIUM': return 'danger';
      default: return 'neutral';
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Hero Bulletin Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-6 sm:p-8 text-white shadow-xl shadow-indigo-600/15">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold text-white shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Campus Happenings & Inter-College Fests
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Events, Workshops & Hackathons
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100 max-w-xl leading-relaxed">
              Discover upcoming technical symposiums, hackathons, guest lectures, cultural fests, and club meetups across all universities.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              className="bg-white text-indigo-700 hover:bg-indigo-50 font-bold shadow-lg shadow-black/10"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Post New Event
            </Button>
          </div>
        </div>

        {/* Decorative Background Elements */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-32 h-32 rounded-full bg-purple-400/20 blur-xl pointer-events-none" />
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
        {/* Search & College Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by event title, auditorium venue, organizer, or mobile number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={selectedCollege}
              onChange={(e) => setSelectedCollege(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="ALL">🏢 All Campuses ({uniqueColleges.length})</option>
              {uniqueColleges.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-100 dark:border-slate-800">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-80 rounded-3xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          icon={<Ticket className="w-8 h-8 text-indigo-500" />}
          title="No Campus Events Found"
          description="There are currently no events matching your filter. Be the first to publish a workshop, fest, or hackathon!"
          actionLabel="Publish First Event"
          onAction={() => setIsCreateModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvents.map((item) => {
            const eventDateObj = new Date(`${item.event_date}T${item.start_time}`);
            const isEventPast = isPast(eventDateObj) && !isToday(eventDateObj);
            const isOwner = user?.id === item.user_id;

            return (
              <Card
                key={item.id}
                hoverable
                className={`overflow-hidden flex flex-col justify-between border border-slate-200/80 dark:border-slate-800 p-0 group transition-all duration-300 ${
                  isEventPast ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/50' : ''
                }`}
              >
                <div>
                  {/* Poster Image with overlays */}
                  <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                    <img
                      src={item.image_url || 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80'}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Category Tag */}
                    <div className="absolute top-3 left-3">
                      <Badge variant={getCategoryBadgeVariant(item.category)} size="sm">
                        {item.category}
                      </Badge>
                    </div>

                    {/* Share / Actions */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <button
                        onClick={() => handleShareEvent(item)}
                        className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-colors"
                        title="Share Event"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      {(isOwner || isAdmin) && (
                        <button
                          onClick={() => handleDeleteEvent(item.id, item.title)}
                          className="p-1.5 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white backdrop-blur-md transition-colors"
                          title="Delete Event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Bottom Title & College inside image */}
                    <div className="absolute bottom-3 left-3 right-3">
                      <p className="text-[11px] text-indigo-300 font-semibold flex items-center gap-1 truncate">
                        <School className="w-3 h-3 flex-shrink-0" />
                        {item.college_name || 'All Campuses'}
                      </p>
                      <h3 className="text-base font-bold text-white truncate drop-shadow-sm mt-0.5">
                        {item.title}
                      </h3>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-3">
                    {/* Date, Time & Venue */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold">
                        <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                        <span>{format(parseISO(item.event_date), 'EEEE, MMMM d, yyyy')}</span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <span>{item.start_time} {item.end_time ? `to ${item.end_time}` : ''}</span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0" />
                        <span className="truncate">{item.location}</span>
                      </div>
                    </div>

                    {/* Organizer & Mobile */}
                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-600 dark:text-slate-300 truncate font-medium">
                          {item.organizer_name || 'Organizer'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Direct Call Button */}
                        <a
                          href={`tel:${item.contact_mobile}`}
                          className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                          title={`Call: ${item.contact_mobile}`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>

                        {/* WhatsApp Button */}
                        <a
                          href={`https://wa.me/${item.contact_mobile.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I saw your event "${item.title}" on CampusMate!`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                          title="Chat on WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs border-indigo-200 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    leftIcon={<Calendar className="w-3.5 h-3.5" />}
                    onClick={() => {
                      const url = generateGoogleCalendarUrlForEvent(item);
                      openGoogleCalendarUrl(url);
                    }}
                  >
                    Google Cal
                  </Button>

                  <Button
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setSelectedEventDetails(item)}
                  >
                    View Details
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Floating Action Button (FAB) for posting event */}
      <div className="fixed bottom-20 md:bottom-8 right-6 z-40">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-full bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          <span>Post Event</span>
        </button>
      </div>

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchEvents}
      />

      {/* Event Details Modal */}
      {selectedEventDetails && (
        <Modal
          isOpen={!!selectedEventDetails}
          onClose={() => setSelectedEventDetails(null)}
          title={selectedEventDetails.title}
        >
          <div className="space-y-4 text-left max-h-[80vh] overflow-y-auto pr-1">
            {/* Poster */}
            {selectedEventDetails.image_url && (
              <div className="rounded-2xl overflow-hidden h-52 w-full bg-slate-900 shadow-md">
                <img
                  src={selectedEventDetails.image_url}
                  alt={selectedEventDetails.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Quick Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Date & Time
                </span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {format(parseISO(selectedEventDetails.event_date), 'PPP')} ({selectedEventDetails.start_time} - {selectedEventDetails.end_time || 'End'})
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" /> Venue / Location
                </span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {selectedEventDetails.location}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <School className="w-3.5 h-3.5 text-purple-500" /> Campus / College
                </span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {selectedEventDetails.college_name || 'All Universities'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-500" /> Mobile / Coordinator
                </span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {selectedEventDetails.contact_mobile} ({selectedEventDetails.organizer_name})
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Event Description & Highlights
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                {selectedEventDetails.description}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${selectedEventDetails.contact_mobile}`}
                  className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" /> Call Coordinator
                </a>

                <a
                  href={`https://wa.me/${selectedEventDetails.contact_mobile.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I want to inquire about "${selectedEventDetails.title}".`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-200 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Calendar className="w-3.5 h-3.5" />}
                  onClick={() => {
                    const url = generateGoogleCalendarUrlForEvent(selectedEventDetails);
                    openGoogleCalendarUrl(url);
                  }}
                >
                  Sync Google Cal
                </Button>

                {selectedEventDetails.registration_link && (
                  <a
                    href={selectedEventDetails.registration_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-indigo-700 shadow-sm transition-colors"
                  >
                    <span>Register Now</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

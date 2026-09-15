import React, { useState, useEffect, useMemo } from 'react';
import {
  Ticket,
  Phone,
  Search,
  Trash2,
  Star,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { format, parseISO } from 'date-fns';

interface AdminEvent {
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

export const AdminEventsPage: React.FC = () => {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedEvent, setSelectedEvent] = useState<AdminEvent | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setEvents(data as AdminEvent[]);
      }
    } catch (err) {
      console.error('Error fetching admin events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleDeleteEvent = async (eventId: string, title: string) => {
    const reason = prompt(`Enter reason for deleting event "${title}":`, 'Violated campus event guidelines / expired');
    if (reason === null) return; // Cancelled

    try {
      const { error: rpcErr } = await supabase.rpc('admin_delete_event', {
        p_event_id: eventId,
        p_reason: reason.trim() || 'Deleted by admin',
      });

      if (rpcErr) {
        console.warn('RPC delete failed, falling back to direct delete:', rpcErr.message);
        const { error } = await supabase.from('events').delete().eq('id', eventId);
        if (error) throw error;
      }

      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      if (selectedEvent?.id === eventId) {
        setSelectedEvent(null);
      }
    } catch (err: any) {
      console.error('Error deleting event:', err);
      alert(err.message || 'Failed to delete event');
    }
  };

  const handleToggleFeatured = async (event: AdminEvent) => {
    const newFeatured = !event.is_featured;
    try {
      const { error } = await supabase
        .from('events')
        .update({ is_featured: newFeatured } as any)
        .eq('id', event.id);

      if (error) throw error;

      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, is_featured: newFeatured } : e))
      );
    } catch (err: any) {
      console.error('Error updating featured status:', err);
      alert(err.message || 'Failed to update featured status');
    }
  };

  const totalEvents = events.length;
  const workshopsCount = events.filter((e) => e.category === 'WORKSHOP').length;
  const hackathonsCount = events.filter((e) => e.category === 'HACKATHON').length;
  const featuredCount = events.filter((e) => e.is_featured).length;

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          e.title.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          (e.college_name && e.college_name.toLowerCase().includes(q)) ||
          (e.organizer_name && e.organizer_name.toLowerCase().includes(q)) ||
          e.contact_mobile.includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [events, categoryFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Ticket className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Campus Events Moderation Desk
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Overview, verify, feature, or remove user-posted fests, workshops, and hackathons across all campuses.
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={fetchEvents}
          leftIcon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh Directory
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50">
          <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Total Events</p>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{totalEvents}</h4>
        </div>
        <div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50">
          <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Hackathons</p>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{hackathonsCount}</h4>
        </div>
        <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50">
          <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Workshops</p>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{workshopsCount}</h4>
        </div>
        <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50">
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Featured</p>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{featuredCount}</h4>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search events by title, venue, college, organizer, mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="py-2 px-3 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none font-medium"
          >
            <option value="ALL">All Categories</option>
            <option value="WORKSHOP">Workshops</option>
            <option value="HACKATHON">Hackathons</option>
            <option value="SYMPOSIUM">Symposiums</option>
            <option value="CULTURAL">Culturals</option>
            <option value="SPORTS">Sports</option>
            <option value="SEMINAR">Seminars</option>
            <option value="CLUB">Club Meetups</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Event & Poster</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Campus & Location</th>
                <th className="py-3 px-4">Organizer & Mobile</th>
                <th className="py-3 px-4 text-center">Featured</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading events directory...
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No events matching your filter.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    {/* Event & Poster */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-800 overflow-hidden flex-shrink-0">
                          <img
                            src={item.image_url || 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=400&q=80'}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 max-w-[220px]">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{item.title}</p>
                          <p className="text-[11px] text-slate-400 truncate">{item.description}</p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4">
                      <Badge variant="indigo" size="sm">
                        {item.category}
                      </Badge>
                    </td>

                    {/* Date & Time */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="font-semibold text-slate-900 dark:text-white">{format(parseISO(item.event_date), 'MMM d, yyyy')}</p>
                      <p className="text-[11px] text-slate-400">{item.start_time} {item.end_time ? `- ${item.end_time}` : ''}</p>
                    </td>

                    {/* Campus & Location */}
                    <td className="py-3 px-4 max-w-[180px]">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{item.college_name || 'All Campuses'}</p>
                      <p className="text-[11px] text-slate-400 truncate">{item.location}</p>
                    </td>

                    {/* Organizer & Mobile */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="font-semibold text-slate-900 dark:text-white">{item.organizer_name || 'Coordinator'}</p>
                      <a href={`tel:${item.contact_mobile}`} className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {item.contact_mobile}
                      </a>
                    </td>

                    {/* Featured Toggle */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleFeatured(item)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          item.is_featured
                            ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800'
                            : 'text-slate-400 border-slate-200 dark:border-slate-700 hover:text-amber-500'
                        }`}
                        title={item.is_featured ? 'Remove featured' : 'Mark as featured'}
                      >
                        <Star className={`w-4 h-4 ${item.is_featured ? 'fill-amber-400 text-amber-500' : ''}`} />
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedEvent(item)}
                          className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-indigo-600 dark:text-slate-300 transition-colors"
                        >
                          Inspect
                        </button>

                        <button
                          onClick={() => handleDeleteEvent(item.id, item.title)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 transition-colors"
                          title="Delete event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Event Details Modal */}
      {selectedEvent && (
        <Modal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          title={`Event Review: ${selectedEvent.title}`}
        >
          <div className="space-y-4 text-left max-h-[80vh] overflow-y-auto pr-1">
            {selectedEvent.image_url && (
              <div className="rounded-2xl overflow-hidden h-48 w-full bg-slate-900">
                <img src={selectedEvent.image_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-slate-400">Date & Venue</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {selectedEvent.event_date} ({selectedEvent.start_time} - {selectedEvent.end_time || 'End'})
                </p>
                <p className="text-slate-500">{selectedEvent.location}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-slate-400">Coordinator & Campus</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {selectedEvent.organizer_name} ({selectedEvent.contact_mobile})
                </p>
                <p className="text-slate-500">{selectedEvent.college_name || 'All Campuses'}</p>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Description:</span>
              <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                {selectedEvent.description}
              </p>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => handleDeleteEvent(selectedEvent.id, selectedEvent.title)}
              >
                Delete Event
              </Button>

              <Button variant="ghost" size="sm" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

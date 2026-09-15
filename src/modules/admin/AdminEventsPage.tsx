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
import { deleteGoogleCalendarEventDirect } from '../../lib/googleCalendarApi';

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
  college_name: string;
  organizer_name: string;
  contact_mobile: string;
  contact_email?: string | null;
  image_url?: string | null;
  registration_link?: string | null;
  is_featured: boolean;
  google_event_id?: string | null;
  created_at: string;
}

export const AdminEventsPage: React.FC = () => {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedEvent, setSelectedEvent] = useState<AdminEvent | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setEvents(data as AdminEvent[]);
    } catch (err) {
      console.error('Error fetching events for admin moderation:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleToggleFeatured = async (event: AdminEvent) => {
    try {
      const updatedStatus = !event.is_featured;
      const { error } = await supabase
        .from('events')
        .update({ is_featured: updatedStatus } as any)
        .eq('id', event.id);

      if (error) throw error;

      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, is_featured: updatedStatus } : e))
      );
    } catch (err: any) {
      alert('Error updating featured status: ' + err.message);
    }
  };

  const handleDeleteEvent = async (event: AdminEvent) => {
    const reason = prompt(`Enter reason for deleting event "${event.title}":`, 'Violates campus event guidelines');
    if (reason === null) return;

    setDeletingId(event.id);
    try {
      // 1. Delete from Google Calendar if synced
      if (event.google_event_id) {
        await deleteGoogleCalendarEventDirect(event.google_event_id);
      }

      // 2. Call admin delete RPC
      const { error } = await supabase.rpc('admin_delete_event', {
        p_event_id: event.id,
        p_reason: reason || 'Deleted by campus administrator',
      } as any);

      if (error) {
        // Fallback to standard delete if RPC not applied yet
        await supabase.from('events').delete().eq('id', event.id);
      }

      setEvents((prev) => prev.filter((e) => e.id !== event.id));
      if (selectedEvent?.id === event.id) {
        setSelectedEvent(null);
      }
    } catch (err: any) {
      alert('Failed to delete event: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (categoryFilter !== 'ALL' && ev.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          ev.title.toLowerCase().includes(q) ||
          ev.description.toLowerCase().includes(q) ||
          ev.location.toLowerCase().includes(q) ||
          ev.college_name.toLowerCase().includes(q) ||
          ev.organizer_name.toLowerCase().includes(q) ||
          ev.contact_mobile.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [events, categoryFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Ticket className="w-6 h-6 text-purple-600" />
            Campus Event Moderation
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Review, feature, or moderate student and club events posted across all campuses.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
          onClick={fetchEvents}
        >
          Refresh Desk
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-purple-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Events</p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{events.length}</p>
        </Card>
        <Card className="p-4 border-l-4 border-amber-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Featured Highlights</p>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
            {events.filter((e) => e.is_featured).length}
          </p>
        </Card>
        <Card className="p-4 border-l-4 border-indigo-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Categories</p>
          <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
            {new Set(events.map((e) => e.category)).size}
          </p>
        </Card>
        <Card className="p-4 border-l-4 border-emerald-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Colleges Reached</p>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {new Set(events.map((e) => e.college_name)).size}
          </p>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search events by title, organizer, campus, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="ALL">All Categories</option>
          <option value="HACKATHON">Hackathon</option>
          <option value="WORKSHOP">Workshop</option>
          <option value="SYMPOSIUM">Symposium</option>
          <option value="CULTURAL">Cultural</option>
          <option value="SPORTS">Sports</option>
          <option value="SEMINAR">Seminar</option>
          <option value="WEBINAR">Webinar</option>
          <option value="CLUB">Club</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      {/* Table of Events */}
      <Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Event & Poster</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Campus & Venue</th>
                <th className="py-3 px-4">Organizer Contact</th>
                <th className="py-3 px-4 text-center">Featured</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading campus events...
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No matching events found.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {ev.image_url ? (
                          <img
                            src={ev.image_url}
                            alt=""
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center font-bold flex-shrink-0">
                            {ev.title[0]}
                          </div>
                        )}
                        <div className="min-w-0 max-w-[200px]">
                          <p
                            onClick={() => setSelectedEvent(ev)}
                            className="font-bold text-slate-900 dark:text-white truncate hover:text-purple-600 cursor-pointer"
                          >
                            {ev.title}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">{ev.description}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <Badge variant="indigo" size="sm">
                        {ev.category}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">{ev.event_date}</span>
                        <p className="text-[11px] text-slate-400">{ev.start_time}</p>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      <p className="font-semibold truncate max-w-[150px]">{ev.college_name}</p>
                      <p className="text-[11px] text-slate-400 truncate max-w-[150px]">{ev.location}</p>
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      <p className="font-semibold truncate max-w-[130px]">{ev.organizer_name}</p>
                      <a
                        href={`tel:${ev.contact_mobile}`}
                        className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline"
                      >
                        <Phone className="w-3 h-3" /> {ev.contact_mobile}
                      </a>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleFeatured(ev)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          ev.is_featured
                            ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'
                            : 'text-slate-300 hover:text-slate-500'
                        }`}
                        title={ev.is_featured ? 'Remove featured' : 'Mark as featured'}
                      >
                        <Star className={`w-4 h-4 ${ev.is_featured ? 'fill-amber-400' : ''}`} />
                      </button>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedEvent(ev)}>
                          Inspect
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          isLoading={deletingId === ev.id}
                          onClick={() => handleDeleteEvent(ev)}
                          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Inspect Modal */}
      {selectedEvent && (
        <Modal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          title={`Moderating: ${selectedEvent.title}`}
        >
          <div className="space-y-4">
            {selectedEvent.image_url && (
              <div className="h-48 w-full overflow-hidden rounded-2xl bg-slate-900">
                <img src={selectedEvent.image_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                <span className="text-slate-400 font-bold">Category:</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedEvent.category}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                <span className="text-slate-400 font-bold">Campus:</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedEvent.college_name}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                <span className="text-slate-400 font-bold">Timing:</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedEvent.event_date} ({selectedEvent.start_time} - {selectedEvent.end_time || 'N/A'})
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                <span className="text-slate-400 font-bold">Venue:</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedEvent.location}</p>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase">Event Description:</span>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                {selectedEvent.description}
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="danger"
                leftIcon={<Trash2 className="w-4 h-4" />}
                onClick={() => handleDeleteEvent(selectedEvent)}
              >
                Delete Event with Reason
              </Button>
              <Button variant="ghost" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

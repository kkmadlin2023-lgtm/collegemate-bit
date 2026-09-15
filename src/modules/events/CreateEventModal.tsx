import React, { useState, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Phone,
  Mail,
  Image,
  School,
  User,
  Link2,
  Sparkles,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { generateGoogleCalendarUrlForEvent, openGoogleCalendarUrl } from '../../lib/googleCalendar';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EVENT_CATEGORIES = [
  { value: 'WORKSHOP', label: '🛠️ Workshop / Hands-on' },
  { value: 'HACKATHON', label: '💻 Hackathon / Coding' },
  { value: 'SYMPOSIUM', label: '🎓 Technical Symposium' },
  { value: 'CULTURAL', label: '🎭 Cultural Fest & Music' },
  { value: 'SPORTS', label: '🏆 Sports & Tournament' },
  { value: 'SEMINAR', label: '🎤 Seminar / Guest Lecture' },
  { value: 'WEBINAR', label: '🌐 Online Webinar' },
  { value: 'CLUB', label: '🤝 Club Activity / Meetup' },
  { value: 'OTHER', label: '📌 Other Event' },
];

const PRESET_POSTERS = [
  {
    label: 'Tech / Hackathon',
    url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1000&q=80',
  },
  {
    label: 'Workshop / AI',
    url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1000&q=80',
  },
  {
    label: 'Cultural / Fest',
    url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1000&q=80',
  },
  {
    label: 'Sports / Games',
    url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1000&q=80',
  },
  {
    label: 'Seminar / Hall',
    url: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1000&q=80',
  },
];

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, profile } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('WORKSHOP');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('16:00');
  const [location, setLocation] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [organizerName, setOrganizerName] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [registrationLink, setRegistrationLink] = useState('');
  const [syncToGCal, setSyncToGCal] = useState(true);

  const [knownColleges, setKnownColleges] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Prefill user details
    if (profile) {
      setCollegeName(profile.college_name || '');
      setOrganizerName(profile.full_name || '');
      setContactMobile(profile.phone_number || '');
    }
    if (user) {
      setContactEmail(user.email || '');
    }

    // Default event date to next Saturday
    const d = new Date();
    d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
    setEventDate(d.toISOString().split('T')[0]);

    // Select default image
    setImageUrl(PRESET_POSTERS[0].url);

    // Fetch colleges
    const fetchColleges = async () => {
      const { data } = await supabase.from('colleges').select('name').eq('is_active', true);
      if (data) setKnownColleges(data.map((c: any) => c.name));
    };
    fetchColleges();
  }, [isOpen, profile, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!title.trim()) {
      setError('Please provide an event title.');
      return;
    }
    if (!eventDate) {
      setError('Please select the event date.');
      return;
    }
    if (!location.trim()) {
      setError('Please specify the event location or auditorium venue.');
      return;
    }
    if (!contactMobile.trim()) {
      setError('Please provide an organizer contact mobile number.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const eventPayload = {
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || 'Join us for this exciting campus event!',
        category,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime || null,
        location: location.trim(),
        college_name: collegeName.trim() || profile?.college_name || 'All Campuses',
        organizer_name: organizerName.trim() || profile?.full_name || 'Student Coordinator',
        contact_mobile: contactMobile.trim(),
        contact_email: contactEmail.trim() || null,
        image_url: imageUrl.trim() || PRESET_POSTERS[0].url,
        registration_link: registrationLink.trim() || null,
        status: 'APPROVED',
      };

      const { data: insertedEvent, error: insertErr } = await supabase
        .from('events')
        .insert(eventPayload as any)
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Broadcast in-app notification to campus peers with 7-day retention
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: `🎉 New Event: ${title.trim()}`,
        body: `Happening on ${eventDate} at ${location.trim()}. Contact: ${contactMobile.trim()}`,
        type: 'EVENT_ALERT',
        data: {
          event_id: insertedEvent?.id,
          category,
          date: eventDate,
        },
        expires_at: expiresAt.toISOString(),
      } as any);

      // Auto sync to Google Calendar if selected
      if (syncToGCal) {
        const gcalUrl = generateGoogleCalendarUrlForEvent({
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          event_date: eventDate,
          start_time: startTime,
          end_time: endTime,
          college_name: collegeName.trim(),
          organizer_name: organizerName.trim(),
          contact_mobile: contactMobile.trim(),
        });
        openGoogleCalendarUrl(gcalUrl);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating event:', err);
      setError(err.message || 'Failed to publish event.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Publish New Campus Event"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-left max-h-[80vh] overflow-y-auto pr-1">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-2xl text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Basic Info */}
        <div className="space-y-3">
          <Input
            label="Event Title *"
            placeholder="e.g. National Hackathon 2026 / AI Workshop"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            leftIcon={<Sparkles className="w-4 h-4 text-indigo-500" />}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Event Category *"
              options={EVENT_CATEGORIES}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                College / Campus Tag
              </label>
              <Input
                placeholder="e.g. Bannari Amman Institute of Technology"
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                leftIcon={<School className="w-4 h-4" />}
                list="event-colleges-list"
              />
              <datalist id="event-colleges-list">
                {knownColleges.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        {/* Date, Time & Venue */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Schedule & Venue Details
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <Input
              label="Event Date *"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
            <Input
              label="Start Time *"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
            <Input
              label="End Time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          <Input
            label="Location / Venue *"
            placeholder="e.g. Main Auditorium / CSE Lab 3 / Online Google Meet"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            leftIcon={<MapPin className="w-4 h-4 text-rose-500" />}
            required
          />
        </div>

        {/* Organizer & Contact Details */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Organizer Contact Information
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label="Organizer / Club Name *"
              placeholder="e.g. Coding Club / John Doe"
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
              required
            />

            <Input
              label="Mobile Number (Calls & WhatsApp) *"
              placeholder="e.g. +91 98765 43210"
              value={contactMobile}
              onChange={(e) => setContactMobile(e.target.value)}
              leftIcon={<Phone className="w-4 h-4 text-emerald-500" />}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label="Contact Email"
              type="email"
              placeholder="e.g. event@campus.edu"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Registration / Form Link (Optional)"
              placeholder="https://forms.gle/... or website"
              value={registrationLink}
              onChange={(e) => setRegistrationLink(e.target.value)}
              leftIcon={<Link2 className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* Poster Photo / Image URL */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Event Poster / Photo URL
          </label>
          <Input
            placeholder="https://example.com/event-poster.jpg"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            leftIcon={<Image className="w-4 h-4" />}
          />

          {/* Quick preset posters */}
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">Or pick a campus theme photo:</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_POSTERS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setImageUrl(preset.url)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                    imageUrl === preset.url
                      ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Event Description */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Event Description & Itinerary
          </label>
          <textarea
            rows={3}
            placeholder="Describe the rules, registration fee, prizes, and key highlights..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Google Calendar Sync Checkbox */}
        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 cursor-pointer">
          <input
            type="checkbox"
            checked={syncToGCal}
            onChange={(e) => setSyncToGCal(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
          />
          <div className="text-xs">
            <span className="font-bold text-slate-900 dark:text-white">📅 Add to Google Calendar upon publishing</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Automatically creates a Google Calendar event in a new tab so you never miss this event.
            </p>
          </div>
        </label>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting} rightIcon={<Check className="w-4 h-4" />}>
            Publish Campus Event
          </Button>
        </div>
      </form>
    </Modal>
  );
};

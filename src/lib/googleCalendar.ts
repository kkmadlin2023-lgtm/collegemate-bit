/**
 * Google Calendar & iCal Integration Utility
 * Generates direct one-click web intent URLs and standard .ics files
 * for Reminders, Weekly Class Schedules, and Campus Events.
 */

interface CalendarEventData {
  title: string;
  description?: string | null;
  location?: string | null;
  startDate: Date | string;
  endDate?: Date | string;
  allDay?: boolean;
  recurrenceRule?: string; // e.g., 'RRULE:FREQ=WEEKLY'
}

/**
 * Format a Date object to Google Calendar format (YYYYMMDDTHHmmSSZ)
 */
function formatGoogleCalendarDate(date: Date, allDay = false): string {
  if (allDay) {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }
  return date.toISOString().replace(/-|:|\.\d+/g, '');
}

/**
 * Generate a direct Google Calendar web intent URL
 */
export function generateGoogleCalendarUrl(data: CalendarEventData): string {
  const start = new Date(data.startDate);
  let end = data.endDate ? new Date(data.endDate) : new Date(start.getTime() + 60 * 60 * 1000); // default 1 hour

  if (isNaN(start.getTime())) {
    return 'https://calendar.google.com/calendar/render';
  }
  if (isNaN(end.getTime()) || end <= start) {
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }

  const startStr = formatGoogleCalendarDate(start, data.allDay);
  const endStr = formatGoogleCalendarDate(end, data.allDay);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: data.title || 'CampusMate Reminder',
    dates: `${startStr}/${endStr}`,
  });

  if (data.description) {
    params.set('details', data.description);
  }
  if (data.location) {
    params.set('location', data.location);
  }
  if (data.recurrenceRule) {
    params.set('recur', data.recurrenceRule);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Open Google Calendar in a new browser tab with event prefilled
 */
export function openGoogleCalendarEvent(data: CalendarEventData): Window | null {
  const url = generateGoogleCalendarUrl(data);
  return window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Open a generated Google Calendar URL in a new tab
 */
export function openGoogleCalendarUrl(urlOrData: string | CalendarEventData): Window | null {
  const url = typeof urlOrData === 'string' ? urlOrData : generateGoogleCalendarUrl(urlOrData);
  return window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Generate Google Calendar URL for a Task Reminder
 */
export function generateGoogleCalendarUrlForReminder(reminder: {
  title: string;
  description?: string | null;
  due_date: string;
  priority?: string;
}): string {
  const due = new Date(reminder.due_date);
  const end = new Date(due.getTime() + 30 * 60 * 1000); // 30 mins

  const desc = [
    reminder.description ? `${reminder.description}\n` : '',
    reminder.priority ? `Priority: ${reminder.priority}` : '',
    'Created via CampusMate Student Hub',
  ].filter(Boolean).join('\n');

  return generateGoogleCalendarUrl({
    title: `⏰ ${reminder.title}`,
    description: desc,
    startDate: due,
    endDate: end,
  });
}

/**
 * Generate Google Calendar URL for a Weekly Schedule / Class
 */
export function generateGoogleCalendarUrlForSchedule(schedule: {
  title: string;
  description?: string | null;
  location?: string | null;
  instructor?: string | null;
  day_of_week: number; // 0 = Sun, 1 = Mon ...
  start_time: string; // HH:mm
  end_time: string; // HH:mm
}): string {
  // Find next occurrence of this day of week
  const now = new Date();
  const currentDay = now.getDay();
  let daysUntil = (schedule.day_of_week - currentDay + 7) % 7;
  if (daysUntil === 0) daysUntil = 7; // Next week's class

  const targetDate = new Date();
  targetDate.setDate(now.getDate() + daysUntil);

  const [startH, startM] = (schedule.start_time || '09:00').split(':').map(Number);
  const [endH, endM] = (schedule.end_time || '10:30').split(':').map(Number);

  const start = new Date(targetDate);
  start.setHours(startH, startM, 0, 0);

  const end = new Date(targetDate);
  end.setHours(endH, endM, 0, 0);

  const desc = [
    schedule.description || '',
    schedule.instructor ? `Instructor: ${schedule.instructor}` : '',
    'Recurring Class via CampusMate',
  ].filter(Boolean).join('\n');

  return generateGoogleCalendarUrl({
    title: `📚 ${schedule.title}`,
    description: desc,
    location: schedule.location,
    startDate: start,
    endDate: end,
    recurrenceRule: 'RRULE:FREQ=WEEKLY',
  });
}

/**
 * Generate Google Calendar URL for a Campus Event
 */
export function generateGoogleCalendarUrlForEvent(event: {
  title: string;
  description?: string | null;
  location?: string | null;
  event_date: string;
  start_time: string;
  end_time?: string | null;
  college_name?: string | null;
  organizer_name?: string | null;
  contact_mobile?: string | null;
}): string {
  const [year, month, day] = event.event_date.split('-').map(Number);
  const [startH, startM] = (event.start_time || '09:00').split(':').map(Number);

  const start = new Date(year, month - 1, day, startH, startM, 0);

  let end: Date;
  if (event.end_time) {
    const [endH, endM] = event.end_time.split(':').map(Number);
    end = new Date(year, month - 1, day, endH, endM, 0);
  } else {
    end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours
  }

  const desc = [
    event.description || '',
    event.college_name ? `Campus: ${event.college_name}` : '',
    event.organizer_name ? `Organizer: ${event.organizer_name}` : '',
    event.contact_mobile ? `Contact: ${event.contact_mobile}` : '',
    'Event posted on CampusMate',
  ].filter(Boolean).join('\n');

  return generateGoogleCalendarUrl({
    title: `🎉 ${event.title}`,
    description: desc,
    location: event.location,
    startDate: start,
    endDate: end,
  });
}

/**
 * Download a standard .ics calendar file
 */
export function downloadIcsFile(data: CalendarEventData): void {
  const start = new Date(data.startDate);
  const end = data.endDate ? new Date(data.endDate) : new Date(start.getTime() + 60 * 60 * 1000);

  const formatDateIcs = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '');

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CampusMate//Student Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:cm-${Date.now()}@campusmate.app`,
    `DTSTAMP:${formatDateIcs(new Date())}`,
    `DTSTART:${formatDateIcs(start)}`,
    `DTEND:${formatDateIcs(end)}`,
    `SUMMARY:${data.title.replace(/\n/g, ' ')}`,
    data.description ? `DESCRIPTION:${data.description.replace(/\n/g, '\\n')}` : '',
    data.location ? `LOCATION:${data.location.replace(/\n/g, ' ')}` : '',
    data.recurrenceRule ? data.recurrenceRule : '',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([icsLines], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${data.title.slice(0, 20).replace(/\s+/g, '_')}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

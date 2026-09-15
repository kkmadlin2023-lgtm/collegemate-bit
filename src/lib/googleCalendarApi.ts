/**
 * Direct Background Google Calendar REST API v3 Integration
 * Performs direct event creation, modification, and deletion in the background
 * without redirecting or navigating away from CampusMate.
 */

import { supabase } from './supabase';

const GCAL_TOKEN_KEY = 'campusmate_gcal_token';
const GCAL_EXPIRY_KEY = 'campusmate_gcal_token_expires_at';
const GCAL_AUTOSYNC_KEY = 'campusmate_gcal_autosync';

export interface DirectCalendarEventInput {
  title: string;
  description?: string | null;
  location?: string | null;
  startDate: Date | string;
  endDate?: Date | string;
  allDay?: boolean;
  recurrenceRule?: string; // e.g. 'RRULE:FREQ=WEEKLY'
}

/**
 * Check if the user has enabled automatic background Google Calendar sync
 */
export function isGoogleCalendarAutoSyncEnabled(): boolean {
  const pref = localStorage.getItem(GCAL_AUTOSYNC_KEY);
  return pref !== 'false'; // Default to true
}

/**
 * Set user preference for Google Calendar background auto-sync
 */
export function setGoogleCalendarAutoSyncEnabled(enabled: boolean): void {
  localStorage.setItem(GCAL_AUTOSYNC_KEY, enabled ? 'true' : 'false');
}

/**
 * Check if a valid Google access token is currently cached
 */
export function hasActiveGoogleCalendarAuth(): boolean {
  const token = localStorage.getItem(GCAL_TOKEN_KEY);
  const expiry = localStorage.getItem(GCAL_EXPIRY_KEY);
  if (!token) return false;
  if (expiry && Date.now() > parseInt(expiry, 10)) {
    return false;
  }
  return true;
}

/**
 * Store access token with expiry
 */
export function storeGoogleAccessToken(token: string, expiresInSeconds = 3600): void {
  localStorage.setItem(GCAL_TOKEN_KEY, token);
  localStorage.setItem(GCAL_EXPIRY_KEY, (Date.now() + (expiresInSeconds - 60) * 1000).toString());
}

/**
 * Retrieve valid Google access token from Supabase OAuth session or local cache
 */
export async function getGoogleAccessToken(autoPrompt = false): Promise<string | null> {
  // 1. Check local storage cache
  const cachedToken = localStorage.getItem(GCAL_TOKEN_KEY);
  const expiry = localStorage.getItem(GCAL_EXPIRY_KEY);
  if (cachedToken && (!expiry || Date.now() < parseInt(expiry, 10))) {
    return cachedToken;
  }

  // 2. Check Supabase session provider_token
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.provider_token) {
      storeGoogleAccessToken(session.provider_token, 3600);
      return session.provider_token;
    }
  } catch (err) {
    console.warn('Could not read session provider token:', err);
  }

  // 3. If autoPrompt requested, attempt non-redirecting GIS token client or prompt
  if (autoPrompt) {
    return await requestGoogleCalendarAuth();
  }

  return null;
}

/**
 * Load Google Identity Services library dynamically if needed
 */
function loadGisScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).google?.accounts?.oauth2) {
      resolve(true);
      return;
    }
    const existing = document.getElementById('google-gis-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/**
 * Interactive Google Calendar Authorization Popup (without redirecting page)
 */
export async function requestGoogleCalendarAuth(): Promise<string | null> {
  const isLoaded = await loadGisScript();
  if (isLoaded && (window as any).google?.accounts?.oauth2) {
    return new Promise((resolve) => {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '234271373538-web.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/calendar.events',
          callback: (response: any) => {
            if (response.access_token) {
              storeGoogleAccessToken(response.access_token, response.expires_in || 3600);
              resolve(response.access_token);
            } else {
              console.warn('Google auth response missing token:', response);
              resolve(null);
            }
          },
        });
        client.requestAccessToken({ prompt: '' });
      } catch (e) {
        console.warn('Error launching GIS TokenClient:', e);
        resolve(null);
      }
    });
  }

  return null;
}

/**
 * Directly create an event in Google Calendar in the background
 */
export async function createGoogleCalendarEventDirect(
  input: DirectCalendarEventInput
): Promise<{ googleEventId: string | null; error: string | null }> {
  try {
    const token = await getGoogleAccessToken(true);
    if (!token) {
      return { googleEventId: null, error: 'Google Calendar not connected.' };
    }

    const start = new Date(input.startDate);
    let end = input.endDate ? new Date(input.endDate) : new Date(start.getTime() + 60 * 60 * 1000);
    if (isNaN(end.getTime()) || end <= start) {
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    const eventPayload: any = {
      summary: input.title,
      description: input.description || '',
      location: input.location || '',
      start: input.allDay
        ? { date: start.toISOString().split('T')[0] }
        : { dateTime: start.toISOString(), timeZone },
      end: input.allDay
        ? { date: end.toISOString().split('T')[0] }
        : { dateTime: end.toISOString(), timeZone },
    };

    if (input.recurrenceRule) {
      eventPayload.recurrence = [input.recurrenceRule];
    }

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `HTTP ${response.status} failed to create event in Google Calendar`);
    }

    const created = await response.json();
    return { googleEventId: created.id || null, error: null };
  } catch (err: any) {
    console.error('Failed to create Google Calendar event directly:', err);
    return { googleEventId: null, error: err.message || 'Failed to sync to Google Calendar' };
  }
}

/**
 * Directly update an existing event in Google Calendar in the background
 */
export async function updateGoogleCalendarEventDirect(
  googleEventId: string,
  input: DirectCalendarEventInput
): Promise<{ success: boolean; error: string | null }> {
  if (!googleEventId) return { success: false, error: 'Missing googleEventId' };

  try {
    const token = await getGoogleAccessToken(true);
    if (!token) return { success: false, error: 'Google Calendar not connected.' };

    const start = new Date(input.startDate);
    let end = input.endDate ? new Date(input.endDate) : new Date(start.getTime() + 60 * 60 * 1000);
    if (isNaN(end.getTime()) || end <= start) {
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    const eventPayload: any = {
      summary: input.title,
      description: input.description || '',
      location: input.location || '',
      start: input.allDay
        ? { date: start.toISOString().split('T')[0] }
        : { dateTime: start.toISOString(), timeZone },
      end: input.allDay
        ? { date: end.toISOString().split('T')[0] }
        : { dateTime: end.toISOString(), timeZone },
    };

    if (input.recurrenceRule) {
      eventPayload.recurrence = [input.recurrenceRule];
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      }
    );

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `HTTP ${response.status} failed to update event`);
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Failed to update Google Calendar event:', err);
    return { success: false, error: err.message || 'Failed to update Google Calendar' };
  }
}

/**
 * Directly delete an event from Google Calendar in the background without redirecting
 */
export async function deleteGoogleCalendarEventDirect(
  googleEventId: string | null | undefined
): Promise<{ success: boolean; error: string | null }> {
  if (!googleEventId) {
    return { success: true, error: null }; // Nothing to delete
  }

  try {
    const token = await getGoogleAccessToken(false);
    if (!token) {
      console.warn('Cannot delete from Google Calendar: No active access token.');
      return { success: false, error: 'No Google Calendar token' };
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok && response.status !== 404 && response.status !== 410) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `HTTP ${response.status} failed to delete event`);
    }

    console.log(`✅ Successfully deleted Google Calendar event ${googleEventId} in background.`);
    return { success: true, error: null };
  } catch (err: any) {
    console.error('Failed to delete Google Calendar event in background:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Convenience helper to auto-sync a Task/Reminder in background
 */
export async function autoSyncReminderDirect(
  reminder: {
    id?: string;
    title: string;
    description?: string | null;
    due_date: string;
    priority?: string;
    google_event_id?: string | null;
  },
  action: 'CREATE' | 'UPDATE' | 'DELETE'
): Promise<string | null> {
  if (!isGoogleCalendarAutoSyncEnabled()) return null;

  if (action === 'DELETE') {
    if (reminder.google_event_id) {
      await deleteGoogleCalendarEventDirect(reminder.google_event_id);
    }
    return null;
  }

  const due = new Date(reminder.due_date);
  const end = new Date(due.getTime() + 30 * 60 * 1000);
  const desc = [
    reminder.description || '',
    reminder.priority ? `Priority: ${reminder.priority}` : '',
    'Task managed via CampusMate',
  ].filter(Boolean).join('\n');

  const input: DirectCalendarEventInput = {
    title: `⏰ ${reminder.title}`,
    description: desc,
    startDate: due,
    endDate: end,
  };

  if (action === 'UPDATE' && reminder.google_event_id) {
    await updateGoogleCalendarEventDirect(reminder.google_event_id, input);
    return reminder.google_event_id;
  } else {
    const { googleEventId } = await createGoogleCalendarEventDirect(input);
    return googleEventId;
  }
}

/**
 * Convenience helper to auto-sync a Campus Event in background
 */
export async function autoSyncCampusEventDirect(
  event: {
    id?: string;
    title: string;
    description?: string | null;
    location?: string | null;
    event_date: string;
    start_time: string;
    end_time?: string | null;
    college_name?: string | null;
    organizer_name?: string | null;
    contact_mobile?: string | null;
    google_event_id?: string | null;
  },
  action: 'CREATE' | 'UPDATE' | 'DELETE'
): Promise<string | null> {
  if (!isGoogleCalendarAutoSyncEnabled()) return null;

  if (action === 'DELETE') {
    if (event.google_event_id) {
      await deleteGoogleCalendarEventDirect(event.google_event_id);
    }
    return null;
  }

  const [year, month, day] = event.event_date.split('-').map(Number);
  const [startH, startM] = (event.start_time || '09:00').split(':').map(Number);
  const start = new Date(year, month - 1, day, startH, startM, 0);

  let end: Date;
  if (event.end_time) {
    const [endH, endM] = event.end_time.split(':').map(Number);
    end = new Date(year, month - 1, day, endH, endM, 0);
  } else {
    end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  }

  const desc = [
    event.description || '',
    event.college_name ? `Campus: ${event.college_name}` : '',
    event.organizer_name ? `Organizer: ${event.organizer_name}` : '',
    event.contact_mobile ? `Contact: ${event.contact_mobile}` : '',
    'Event posted on CampusMate Hub',
  ].filter(Boolean).join('\n');

  const input: DirectCalendarEventInput = {
    title: `🎉 ${event.title}`,
    description: desc,
    location: event.location,
    startDate: start,
    endDate: end,
  };

  if (action === 'UPDATE' && event.google_event_id) {
    await updateGoogleCalendarEventDirect(event.google_event_id, input);
    return event.google_event_id;
  } else {
    const { googleEventId } = await createGoogleCalendarEventDirect(input);
    return googleEventId;
  }
}

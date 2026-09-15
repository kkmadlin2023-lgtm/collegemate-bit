-- Migration: Add google_event_id column to reminders, schedules, and events for direct Google Calendar synchronization
-- Allows automatic two-way background creation, updates, and deletion.

ALTER TABLE IF EXISTS public.reminders 
ADD COLUMN IF NOT EXISTS google_event_id TEXT;

ALTER TABLE IF EXISTS public.schedules 
ADD COLUMN IF NOT EXISTS google_event_id TEXT;

ALTER TABLE IF EXISTS public.events 
ADD COLUMN IF NOT EXISTS google_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_reminders_google_event_id ON public.reminders(google_event_id);
CREATE INDEX IF NOT EXISTS idx_schedules_google_event_id ON public.schedules(google_event_id);
CREATE INDEX IF NOT EXISTS idx_events_google_event_id ON public.events(google_event_id);

-- Migration: Server-side FCM push via pg_net + Supabase Edge Function
-- This triggers background push even when the browser page is CLOSED

-- 1. Enable pg_net extension (for HTTP calls from DB triggers)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Function that calls the send-fcm-push Edge Function for a given user_id
CREATE OR REPLACE FUNCTION notify_fcm_on_notification_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS 
DECLARE
  v_tokens TEXT[];
  v_token TEXT;
  v_payload JSONB;
  v_supabase_url TEXT := 'https://bzvwqhgwnrigvypjttmf.supabase.co';
  v_edge_url TEXT;
BEGIN
  -- Collect all active FCM tokens for this user
  SELECT ARRAY(
    SELECT token FROM public.notification_tokens
    WHERE user_id = NEW.user_id
    ORDER BY updated_at DESC
    LIMIT 5
  ) INTO v_tokens;

  IF array_length(v_tokens, 1) IS NULL OR array_length(v_tokens, 1) = 0 THEN
    RETURN NEW;
  END IF;

  v_edge_url := v_supabase_url || '/functions/v1/send-fcm-push';

  v_payload := jsonb_build_object(
    'tokens', to_jsonb(v_tokens),
    'title',  NEW.title,
    'message', NEW.body,
    'type',   NEW.type,
    'data',   COALESCE(NEW.data, '{}'::jsonb)
  );

  -- Async HTTP POST to Edge Function (non-blocking)
  PERFORM net.http_post(
    url     := v_edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body    := v_payload::text
  );

  RETURN NEW;
END;
;

-- 3. Drop old trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_fcm_push_on_notification ON public.notifications;

CREATE TRIGGER trg_fcm_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_fcm_on_notification_insert();

-- 4. Create a dedicated RPC for admins/server to manually trigger FCM push
CREATE OR REPLACE FUNCTION send_push_to_user(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_type TEXT DEFAULT 'GENERAL',
  p_data JSONB DEFAULT '{}'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS 
DECLARE
  v_notification_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_expires_at := NOW() + INTERVAL '7 days';

  INSERT INTO public.notifications (user_id, title, body, type, data, expires_at)
  VALUES (p_user_id, p_title, p_body, p_type, p_data, v_expires_at)
  RETURNING id INTO v_notification_id;

  RETURN jsonb_build_object('notification_id', v_notification_id, 'status', 'queued');
END;
;

GRANT EXECUTE ON FUNCTION send_push_to_user TO authenticated;
GRANT EXECUTE ON FUNCTION send_push_to_user TO service_role;

COMMENT ON FUNCTION notify_fcm_on_notification_insert IS
  'Auto-fires FCM push via Edge Function on every notification insert — works when browser is CLOSED';
COMMENT ON FUNCTION send_push_to_user IS
  'Convenience RPC: insert a notification + trigger FCM push to all devices';

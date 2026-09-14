-- ==============================================================================
-- CAMPUSMATE UPGRADE: FEEDBACK SYSTEM, NOTIFICATION TOKENS & BROADCAST DELETION
-- ==============================================================================

-- 1. Ensure notification_tokens table exists and supports all device types
CREATE TABLE IF NOT EXISTS public.notification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'WEB',
  device_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT unique_user_device_token UNIQUE (user_id, token)
);

ALTER TABLE public.notification_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notification_tokens' AND policyname = 'Users manage their own device tokens'
  ) THEN
    CREATE POLICY "Users manage their own device tokens"
      ON public.notification_tokens FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notification_tokens' AND policyname = 'Admins can view device tokens'
  ) THEN
    CREATE POLICY "Admins can view device tokens"
      ON public.notification_tokens FOR SELECT TO authenticated
      USING (public.is_admin_or_superadmin(auth.uid()));
  END IF;
END $$;

-- 2. Create FEEDBACK Table
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('SUGGESTION', 'BUG_REPORT', 'CAMPUS_QUERY', 'COMPLAINT', 'GENERAL')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_REVIEW', 'RESOLVED')),
  image_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Users can create and view their own feedback'
  ) THEN
    CREATE POLICY "Users can create and view their own feedback"
      ON public.feedback FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Admins can manage all feedback'
  ) THEN
    CREATE POLICY "Admins can manage all feedback"
      ON public.feedback FOR ALL TO authenticated
      USING (public.is_admin_or_superadmin(auth.uid()))
      WITH CHECK (public.is_admin_or_superadmin(auth.uid()));
  END IF;
END $$;

-- 3. Create FEEDBACK REPLIES Table
CREATE TABLE IF NOT EXISTS public.feedback_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.feedback_replies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'feedback_replies' AND policyname = 'Users can view replies to their feedback'
  ) THEN
    CREATE POLICY "Users can view replies to their feedback"
      ON public.feedback_replies FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.feedback
          WHERE feedback.id = feedback_replies.feedback_id
            AND (feedback.user_id = auth.uid() OR public.is_admin_or_superadmin(auth.uid()))
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'feedback_replies' AND policyname = 'Admins can insert replies'
  ) THEN
    CREATE POLICY "Admins can insert replies"
      ON public.feedback_replies FOR INSERT TO authenticated
      WITH CHECK (public.is_admin_or_superadmin(auth.uid()));
  END IF;
END $$;

-- 4. RPC: Send Feedback Reply and auto-notify student with 7-day retention
CREATE OR REPLACE FUNCTION public.send_feedback_reply(p_feedback_id UUID, p_message TEXT)
RETURNS UUID AS $$
DECLARE
  v_reply_id UUID;
  v_student_id UUID;
  v_feedback_subject TEXT;
BEGIN
  -- Verify admin privileges
  IF NOT public.is_admin_or_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can reply to user feedback.';
  END IF;

  -- Fetch feedback student & subject
  SELECT user_id, subject INTO v_student_id, v_feedback_subject
  FROM public.feedback
  WHERE id = p_feedback_id;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Feedback record not found.';
  END IF;

  -- Insert reply
  INSERT INTO public.feedback_replies (feedback_id, admin_id, message)
  VALUES (p_feedback_id, auth.uid(), p_message)
  RETURNING id INTO v_reply_id;

  -- Update feedback status to RESOLVED
  UPDATE public.feedback
  SET status = 'RESOLVED', updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_feedback_id;

  -- Insert notification for student with 7-day retention
  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    type,
    data,
    expires_at
  ) VALUES (
    v_student_id,
    '💬 Admin Response: ' || v_feedback_subject,
    p_message,
    'FEEDBACK_REPLY',
    jsonb_build_object('feedback_id', p_feedback_id, 'reply_id', v_reply_id),
    TIMEZONE('utc'::text, NOW()) + INTERVAL '7 days'
  );

  RETURN v_reply_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: Delete Admin Broadcast and clean up user inboxes
CREATE OR REPLACE FUNCTION public.delete_admin_broadcast(p_broadcast_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_admin_or_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can delete broadcasts.';
  END IF;

  -- Delete from notifications where broadcast_id matches
  DELETE FROM public.notifications
  WHERE data->>'broadcast_id' = p_broadcast_id::text;

  -- Delete from admin_broadcasts
  DELETE FROM public.admin_broadcasts
  WHERE id = p_broadcast_id;

  -- Log admin audit action
  INSERT INTO public.admin_logs (admin_id, action, target_table, target_id, details)
  VALUES (
    auth.uid(),
    'BROADCAST_DELETED',
    'admin_broadcasts',
    p_broadcast_id,
    jsonb_build_object('broadcast_id', p_broadcast_id)
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
 

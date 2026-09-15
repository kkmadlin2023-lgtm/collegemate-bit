-- Migration: Create Events Table, Admin Moderation, and Safe College Deletion for 0 Users

-- 1. Create Events Table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'WORKSHOP',
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  location TEXT NOT NULL,
  college_name TEXT,
  organizer_name TEXT,
  contact_mobile TEXT NOT NULL,
  contact_email TEXT,
  image_url TEXT,
  registration_link TEXT,
  status TEXT NOT NULL DEFAULT 'APPROVED',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for High-Performance Querying
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_college ON public.events(college_name);
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events(category);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);

-- 3. Enable RLS on events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- SELECT: All authenticated users can view approved events
CREATE POLICY "Anyone can view approved events"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Authenticated users can insert their own events
CREATE POLICY "Authenticated users can create events"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Owner or Admin can update events
CREATE POLICY "Owner or Admin can update events"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
    )
  );

-- DELETE: Owner or Admin can delete events
CREATE POLICY "Owner or Admin can delete events"
  ON public.events
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- 4. RPC to safely delete empty colleges (0 users)
CREATE OR REPLACE FUNCTION delete_college_if_empty(
  p_college_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
  v_student_count INT;
  v_super_email TEXT := 'kkmadlin2023@gmail.com';
  v_caller_email TEXT;
BEGIN
  -- Verify caller is admin or super admin
  SELECT r.name INTO v_caller_role
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = v_caller_id
  LIMIT 1;

  IF v_caller_role NOT IN ('ADMIN', 'SUPER_ADMIN') THEN
    SELECT email INTO v_caller_email FROM public.profiles WHERE id = v_caller_id;
    IF v_caller_email IS NULL OR LOWER(v_caller_email) != LOWER(v_super_email) THEN
      RAISE EXCEPTION 'Unauthorized: Only Administrators can delete campus records.';
    END IF;
  END IF;

  -- Check if any student/user is registered with this college
  SELECT COUNT(*) INTO v_student_count
  FROM public.profiles
  WHERE TRIM(LOWER(college_name)) = TRIM(LOWER(p_college_name));

  IF v_student_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete campus: % active student(s) are registered with "%". Please merge them into another campus first.', v_student_count, p_college_name;
  END IF;

  -- Delete from colleges master table
  DELETE FROM public.colleges
  WHERE TRIM(LOWER(name)) = TRIM(LOWER(p_college_name));

  -- Record audit log
  INSERT INTO public.admin_logs (
    admin_id,
    action,
    entity_type,
    details
  ) VALUES (
    v_caller_id,
    'COLLEGE_DELETED',
    'COLLEGE',
    jsonb_build_object(
      'deleted_college', p_college_name,
      'student_count', 0,
      'timestamp', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_college', p_college_name,
    'message', format('Successfully deleted campus "%s" (0 enrolled students).', p_college_name)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION delete_college_if_empty TO authenticated;
GRANT EXECUTE ON FUNCTION delete_college_if_empty TO service_role;

-- 5. RPC for Admin Event Deletion with Audit Logging
CREATE OR REPLACE FUNCTION admin_delete_event(
  p_event_id UUID,
  p_reason TEXT DEFAULT 'Deleted by administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_admin_role TEXT;
  v_event_title TEXT;
  v_owner_id UUID;
  v_super_email TEXT := 'kkmadlin2023@gmail.com';
  v_admin_email TEXT;
BEGIN
  -- Verify caller is admin or super admin
  SELECT r.name INTO v_admin_role
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = v_admin_id
  LIMIT 1;

  IF v_admin_role NOT IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR') THEN
    SELECT email INTO v_admin_email FROM public.profiles WHERE id = v_admin_id;
    IF v_admin_email IS NULL OR LOWER(v_admin_email) != LOWER(v_super_email) THEN
      RAISE EXCEPTION 'Unauthorized: Only Administrators can moderate events.';
    END IF;
  END IF;

  -- Get event details
  SELECT title, user_id INTO v_event_title, v_owner_id
  FROM public.events
  WHERE id = p_event_id;

  IF v_event_title IS NULL THEN
    RAISE EXCEPTION 'Event not found.';
  END IF;

  -- Delete event
  DELETE FROM public.events WHERE id = p_event_id;

  -- Record audit log
  INSERT INTO public.admin_logs (
    admin_id,
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    v_admin_id,
    'EVENT_DELETED',
    'EVENT',
    p_event_id,
    jsonb_build_object(
      'title', v_event_title,
      'owner_id', v_owner_id,
      'reason', p_reason,
      'timestamp', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'event_id', p_event_id,
    'message', format('Event "%s" removed by administrator.', v_event_title)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_event TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_event TO service_role;

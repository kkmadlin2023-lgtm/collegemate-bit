-- Migration: User Deactivation / Ban Option and Profile Update Permissions
-- Allows Admins/SuperAdmins to disable/enable user accounts and enables students to update their own profiles

-- 1. Ensure RLS Policy allows users to update their own profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- 2. Ensure RLS Policy allows Admins to update any profile (e.g. is_active)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'Admins can update any profile'
  ) THEN
    CREATE POLICY "Admins can update any profile"
      ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.roles r ON ur.role_id = r.id
          WHERE ur.user_id = auth.uid()
            AND r.name IN ('ADMIN', 'SUPER_ADMIN')
        )
      );
  END IF;
END $$;

-- 3. Dedicated RPC to toggle user active/suspended status with audit log & superadmin guard
CREATE OR REPLACE FUNCTION admin_toggle_user_active_status(
  p_target_user_id UUID,
  p_is_active BOOLEAN,
  p_reason TEXT DEFAULT 'Status updated by administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_admin_role TEXT;
  v_target_email TEXT;
  v_super_email TEXT := 'kkmadlin2023@gmail.com';
BEGIN
  -- Verify caller is admin or super admin
  SELECT r.name INTO v_admin_role
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = v_admin_id
  LIMIT 1;

  -- Also check if caller is super admin email
  IF v_admin_role NOT IN ('ADMIN', 'SUPER_ADMIN') THEN
    SELECT email INTO v_target_email FROM public.profiles WHERE id = v_admin_id;
    IF v_target_email IS NULL OR LOWER(v_target_email) != LOWER(v_super_email) THEN
      RAISE EXCEPTION 'Unauthorized: Only Administrators and Super Admins can modify account status.';
    END IF;
  END IF;

  -- Get target user email
  SELECT email INTO v_target_email FROM public.profiles WHERE id = p_target_user_id;

  -- Guard: Never allow disabling Super Admin
  IF LOWER(COALESCE(v_target_email, '')) = LOWER(v_super_email) AND p_is_active = FALSE THEN
    RAISE EXCEPTION 'Operation forbidden: The Super Administrator account cannot be disabled.';
  END IF;

  -- Update profile status
  UPDATE public.profiles
  SET 
    is_active = p_is_active,
    updated_at = NOW()
  WHERE id = p_target_user_id;

  -- Record audit log in admin_logs
  INSERT INTO public.admin_logs (
    admin_id,
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    v_admin_id,
    CASE WHEN p_is_active THEN 'USER_ENABLED' ELSE 'USER_DISABLED' END,
    'USER',
    p_target_user_id,
    jsonb_build_object(
      'target_email', v_target_email,
      'new_status', p_is_active,
      'reason', p_reason,
      'timestamp', NOW()
    )
  );

  -- If disabling, optionally queue notification
  IF p_is_active = FALSE THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      body,
      type,
      data,
      expires_at
    ) VALUES (
      p_target_user_id,
      '⚠️ Account Access Suspended',
      'Your CampusMate account has been deactivated by an administrator. Please contact support.',
      'SYSTEM_ALERT',
      jsonb_build_object('reason', p_reason),
      NOW() + INTERVAL '7 days'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'is_active', p_is_active,
    'message', CASE WHEN p_is_active THEN 'Account re-activated successfully' ELSE 'Account suspended successfully' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_toggle_user_active_status TO authenticated;
GRANT EXECUTE ON FUNCTION admin_toggle_user_active_status TO service_role;

COMMENT ON FUNCTION admin_toggle_user_active_status IS
  'Admin RPC to safely enable or disable user accounts with SuperAdmin guard and audit logging';

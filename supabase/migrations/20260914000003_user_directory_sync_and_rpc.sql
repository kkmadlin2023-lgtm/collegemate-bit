-- ==============================================================================
-- CAMPUSMATE MIGRATION 20260914000003: USER DIRECTORY SYNC & RPC FETCH
-- ==============================================================================

-- 1. Sync any existing auth.users that might be missing in public.profiles
INSERT INTO public.profiles (id, email, full_name, avatar_url, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  au.raw_user_meta_data->>'avatar_url',
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure roles exist in roles table
INSERT INTO public.roles (name, description)
VALUES 
  ('SUPER_ADMIN', 'Root administrative control with full system access'),
  ('ADMIN', 'Campus administrator with moderation and broadcast rights'),
  ('MODERATOR', 'Moderator for lost & found items and claims'),
  ('STUDENT', 'Standard student life platform user'),
  ('GUEST', 'Guest user with restricted view access')
ON CONFLICT (name) DO NOTHING;

-- 3. Ensure super admin role is assigned to kkmadlin2023@gmail.com
DO $$
DECLARE
  v_admin_id UUID;
  v_role_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM public.profiles WHERE LOWER(email) = LOWER('kkmadlin2023@gmail.com');
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'SUPER_ADMIN';

  IF v_admin_id IS NOT NULL AND v_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_admin_id, v_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;
END $$;

-- 4. Assign default STUDENT role to any profile without a role
INSERT INTO public.user_roles (user_id, role_id)
SELECT p.id, r.id
FROM public.profiles p
CROSS JOIN public.roles r
WHERE r.name = 'STUDENT'
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id)
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 5. Update profiles RLS policy to ensure complete visibility for admins and users
DROP POLICY IF EXISTS "Authenticated users can read all active profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;

CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- 6. RPC: High-Performance Admin User Directory Fetch
CREATE OR REPLACE FUNCTION public.get_admin_users_directory()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  college_name TEXT,
  student_id TEXT,
  department TEXT,
  phone_number TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  role_name TEXT,
  device_count BIGINT,
  devices JSONB
) AS $$
BEGIN
  -- Sync any new auth users on-the-fly
  INSERT INTO public.profiles (id, email, full_name, avatar_url, created_at, updated_at)
  SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
    au.raw_user_meta_data->>'avatar_url',
    au.created_at,
    NOW()
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE p.id IS NULL
  ON CONFLICT (id) DO NOTHING;

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.avatar_url,
    p.college_name,
    p.student_id,
    p.department,
    p.phone_number,
    p.is_active,
    p.created_at,
    p.updated_at,
    COALESCE(
      r.name::text,
      CASE WHEN LOWER(p.email) = LOWER('kkmadlin2023@gmail.com') THEN 'SUPER_ADMIN' ELSE 'STUDENT' END
    ) AS role_name,
    COALESCE(COUNT(DISTINCT nt.id), 0)::BIGINT AS device_count,
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'id', nt.id,
          'token', nt.token,
          'device_type', nt.device_type,
          'device_info', nt.device_info,
          'created_at', nt.created_at
        )
      ) FILTER (WHERE nt.id IS NOT NULL),
      '[]'::jsonb
    ) AS devices
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  LEFT JOIN public.roles r ON r.id = ur.role_id
  LEFT JOIN public.notification_tokens nt ON nt.user_id = p.id
  GROUP BY p.id, p.email, p.full_name, p.avatar_url, p.college_name, p.student_id, p.department, p.phone_number, p.is_active, p.created_at, p.updated_at, r.name
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

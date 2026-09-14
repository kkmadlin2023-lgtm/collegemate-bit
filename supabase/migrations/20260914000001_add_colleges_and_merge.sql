-- ==============================================================================
-- CAMPUSMATE PATCH: ADD COLLEGE SUPPORT & MERGE FUNCTION
-- Run this in Supabase SQL Editor if you already ran the initial schema
-- ==============================================================================

-- 1. Add college_name to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS college_name TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_college ON public.profiles(college_name);

-- 2. Create master colleges directory table
CREATE TABLE IF NOT EXISTS public.colleges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  code TEXT,
  aliases TEXT[] DEFAULT '{}',
  location TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'colleges' AND policyname = 'Anyone can view active colleges'
  ) THEN
    CREATE POLICY "Anyone can view active colleges"
      ON public.colleges FOR SELECT TO authenticated, anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'colleges' AND policyname = 'Admins can manage colleges'
  ) THEN
    CREATE POLICY "Admins can manage colleges"
      ON public.colleges FOR ALL TO authenticated
      USING (public.is_admin_or_superadmin(auth.uid()))
      WITH CHECK (public.is_admin_or_superadmin(auth.uid()));
  END IF;
END $$;

-- 3. Stored procedure to merge multiple college name spellings into one canonical name
CREATE OR REPLACE FUNCTION public.merge_colleges(target_name TEXT, source_names TEXT[])
RETURNS INT AS $$
DECLARE
  updated_count INT := 0;
BEGIN
  -- Update all student profiles matching any source college name variation
  UPDATE public.profiles
  SET college_name = target_name,
      updated_at = TIMEZONE('utc'::text, NOW())
  WHERE college_name = ANY(source_names)
    AND college_name <> target_name;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- Upsert into master colleges table and preserve source names as aliases
  INSERT INTO public.colleges (name, aliases)
  VALUES (target_name, source_names)
  ON CONFLICT (name) DO UPDATE
  SET aliases = ARRAY(
    SELECT DISTINCT unnest(COALESCE(public.colleges.aliases, '{}') || source_names)
  ),
  updated_at = TIMEZONE('utc'::text, NOW());

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Safe Auth User Created Trigger (prevents Database error saving new user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role_id uuid;
  v_is_super boolean;
BEGIN
  v_is_super := LOWER(COALESCE(NEW.email, '')) = 'kkmadlin2023@gmail.com';

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    college_name,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, 'student'), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NULL,
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();

  IF v_is_super THEN
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'SUPER_ADMIN';
  ELSE
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'STUDENT';
  END IF;

  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, v_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


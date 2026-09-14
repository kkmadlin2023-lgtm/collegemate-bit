-- ==============================================================================
-- CAMPUSMATE DATABASE SCHEMA (MIGRATION 20260914000000)
-- PostgreSQL / Supabase Schema with Row Level Security (RLS) & Triggers
-- Enhanced with: Immediate & Scheduled Notifications + 7-Day Retention
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. ENUMS AND CUSTOM TYPES
-- ------------------------------------------------------------------------------
CREATE TYPE app_role AS ENUM (
  'SUPER_ADMIN',
  'ADMIN',
  'MODERATOR',
  'STUDENT',
  'GUEST'
);

CREATE TYPE item_type AS ENUM (
  'LOST',
  'FOUND'
);

CREATE TYPE item_status AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CLAIMED',
  'RESOLVED',
  'RETURNED',
  'ARCHIVED'
);

CREATE TYPE claim_status AS ENUM (
  'PENDING',
  'VERIFIED',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE report_status AS ENUM (
  'PENDING',
  'UNDER_REVIEW',
  'RESOLVED',
  'DISMISSED'
);

CREATE TYPE priority_level AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
);

CREATE TYPE recurrence_type AS ENUM (
  'NONE',
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY'
);

CREATE TYPE broadcast_target AS ENUM (
  'ALL_USERS',
  'STUDENTS_ONLY',
  'ADMINS_ONLY',
  'SPECIFIC_DEPARTMENT'
);

-- ------------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS & TRIGGERS FOR TIMESTAMPS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. TABLES DEFINITIONS
-- ------------------------------------------------------------------------------

-- 3.1 ROLES TABLE
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name app_role UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3.2 PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  student_id TEXT,
  department TEXT,
  phone_number TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3.3 USER ROLES JUNCTION TABLE
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT unique_user_role UNIQUE (user_id, role_id)
);

-- 3.4 CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT DEFAULT '#4f46e5',
  type TEXT NOT NULL CHECK (type IN ('SCHEDULE', 'REMINDER', 'LOST_FOUND', 'GENERAL')),
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3.5 SCHEDULES TABLE (Student timetable & classes)
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  instructor TEXT,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  recurrence recurrence_type DEFAULT 'WEEKLY' NOT NULL,
  color TEXT DEFAULT '#4f46e5',
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT check_schedule_time CHECK (end_time > start_time)
);

-- 3.6 REMINDERS TABLE (Tasks & notifications)
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  priority priority_level DEFAULT 'MEDIUM' NOT NULL,
  recurrence recurrence_type DEFAULT 'NONE' NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE NOT NULL,
  completed_at TIMESTAMPTZ,
  notify_before_minutes INT DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3.7 LOST ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.lost_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  last_seen_location TEXT NOT NULL,
  lost_date TIMESTAMPTZ NOT NULL,
  image_urls TEXT[] DEFAULT '{}',
  status item_status DEFAULT 'PENDING' NOT NULL,
  reward_offered TEXT,
  contact_info TEXT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3.8 FOUND ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.found_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  found_location TEXT NOT NULL,
  current_location TEXT NOT NULL,
  found_date TIMESTAMPTZ NOT NULL,
  image_urls TEXT[] DEFAULT '{}',
  status item_status DEFAULT 'PENDING' NOT NULL,
  handover_notes TEXT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3.9 CLAIMS TABLE (Student claiming a found item)
CREATE TABLE IF NOT EXISTS public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  found_item_id UUID NOT NULL REFERENCES public.found_items(id) ON DELETE CASCADE,
  claimant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  proof_description TEXT NOT NULL,
  proof_image_urls TEXT[] DEFAULT '{}',
  status claim_status DEFAULT 'PENDING' NOT NULL,
  review_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3.10 REPORTS TABLE (Flagging inappropriate items/claims)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('LOST_ITEM', 'FOUND_ITEM', 'CLAIM', 'USER')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status report_status DEFAULT 'PENDING' NOT NULL,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3.11 NOTIFICATIONS TABLE (User In-App Notifications with 7-Day Retention)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL, -- 'REMINDER', 'SCHEDULE', 'LOST_FOUND', 'CLAIM', 'ADMIN_BROADCAST', 'SYSTEM'
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  -- Retained in notification center for 7 days by default
  expires_at TIMESTAMPTZ DEFAULT (TIMEZONE('utc'::text, NOW()) + INTERVAL '7 days') NOT NULL
);

-- 3.12 ADMIN BROADCASTS TABLE (Immediate & Scheduled Push Notifications)
CREATE TABLE IF NOT EXISTS public.admin_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target broadcast_target DEFAULT 'ALL_USERS' NOT NULL,
  department TEXT,
  is_scheduled BOOLEAN DEFAULT FALSE NOT NULL,
  scheduled_for TIMESTAMPTZ,
  is_sent BOOLEAN DEFAULT FALSE NOT NULL,
  sent_at TIMESTAMPTZ,
  total_recipients INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3.13 NOTIFICATION TOKENS TABLE (Firebase FCM tokens)
CREATE TABLE IF NOT EXISTS public.notification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('WEB', 'ANDROID', 'IOS')),
  device_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT unique_user_device_token UNIQUE (user_id, token)
);

-- 3.14 ADMIN LOGS TABLE (Immutable audit trail)
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3.15 SYSTEM SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 4. INDEXES FOR PERFORMANCE OPTIMIZATION
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_schedules_user_day ON public.schedules(user_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_reminders_user_due ON public.reminders(user_id, due_date, is_completed);
CREATE INDEX IF NOT EXISTS idx_lost_items_status ON public.lost_items(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lost_items_user ON public.lost_items(user_id);
CREATE INDEX IF NOT EXISTS idx_found_items_status ON public.found_items(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_found_items_user ON public.found_items(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_found_item ON public.claims(found_item_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimant ON public.claims(claimant_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_broadcasts_schedule ON public.admin_broadcasts(is_scheduled, is_sent, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_tokens_user ON public.notification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);

-- ------------------------------------------------------------------------------
-- 5. AUTOMATIC TIMESTAMP TRIGGERS
-- ------------------------------------------------------------------------------
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_reminders_updated_at BEFORE UPDATE ON public.reminders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_lost_items_updated_at BEFORE UPDATE ON public.lost_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_found_items_updated_at BEFORE UPDATE ON public.found_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_claims_updated_at BEFORE UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_admin_broadcasts_updated_at BEFORE UPDATE ON public.admin_broadcasts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_notification_tokens_updated_at BEFORE UPDATE ON public.notification_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 6. SECURITY HELPER FUNCTIONS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id AND r.name = _role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.has_role(_user_id, 'SUPER_ADMIN');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin(_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id AND r.name IN ('SUPER_ADMIN', 'ADMIN')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_moderator_or_higher(_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id AND r.name IN ('SUPER_ADMIN', 'ADMIN', 'MODERATOR')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 7. FUNCTION: BROADCAST NOTIFICATION DISPATCHER (IMMEDIATE & SCHEDULED)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_admin_broadcast(broadcast_id UUID)
RETURNS INT AS $$
DECLARE
  b_rec RECORD;
  inserted_count INT := 0;
BEGIN
  SELECT * INTO b_rec FROM public.admin_broadcasts WHERE id = broadcast_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Broadcast not found';
  END IF;

  -- Insert notification for each targeted user with 7-day retention
  WITH target_users AS (
    SELECT p.id AS user_id
    FROM public.profiles p
    WHERE p.is_active = true
      AND (
        b_rec.target = 'ALL_USERS'
        OR (b_rec.target = 'STUDENTS_ONLY' AND NOT public.is_admin_or_superadmin(p.id))
        OR (b_rec.target = 'ADMINS_ONLY' AND public.is_admin_or_superadmin(p.id))
        OR (b_rec.target = 'SPECIFIC_DEPARTMENT' AND p.department = b_rec.department)
      )
  ),
  inserted_rows AS (
    INSERT INTO public.notifications (user_id, title, body, type, data, expires_at)
    SELECT
      tu.user_id,
      b_rec.title,
      b_rec.message,
      'ADMIN_BROADCAST',
      jsonb_build_object('broadcast_id', b_rec.id),
      (TIMEZONE('utc'::text, NOW()) + INTERVAL '7 days')
    FROM target_users tu
    RETURNING 1
  )
  SELECT COUNT(*) INTO inserted_count FROM inserted_rows;

  -- Mark broadcast as sent
  UPDATE public.admin_broadcasts
  SET is_sent = true,
      sent_at = TIMEZONE('utc'::text, NOW()),
      total_recipients = inserted_count
  WHERE id = broadcast_id;

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 8. NEW USER SIGNUP TRIGGER (GOOGLE OAUTH & SUPER ADMIN AUTO-ASSIGNMENT)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role_id UUID;
  v_target_role app_role;
BEGIN
  -- Insert into public.profiles
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = TIMEZONE('utc'::text, NOW());

  -- Check if user is the designated SUPER_ADMIN
  IF LOWER(NEW.email) = LOWER('kkmadlin2023@gmail.com') THEN
    v_target_role := 'SUPER_ADMIN';
  ELSE
    v_target_role := 'STUDENT';
  END IF;

  -- Fetch role ID
  SELECT id INTO v_role_id FROM public.roles WHERE name = v_target_role;

  -- Assign role in user_roles
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, v_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.found_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 9.1 ROLES POLICIES
CREATE POLICY "Allow public read access to roles"
  ON public.roles FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Only Super Admins can modify roles"
  ON public.roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 9.2 PROFILES POLICIES
CREATE POLICY "Authenticated users can read all active profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin_or_superadmin(auth.uid()))
  WITH CHECK (public.is_admin_or_superadmin(auth.uid()));

-- 9.3 USER_ROLES POLICIES
CREATE POLICY "Authenticated users can read user roles"
  ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only Super Admins can modify user roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 9.4 CATEGORIES POLICIES
CREATE POLICY "Anyone can view active categories"
  ON public.categories FOR SELECT TO authenticated, anon
  USING (is_active = true OR public.is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Only Admins can modify categories"
  ON public.categories FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin(auth.uid()))
  WITH CHECK (public.is_admin_or_superadmin(auth.uid()));

-- 9.5 SCHEDULES POLICIES
CREATE POLICY "Users can view only their own schedules"
  ON public.schedules FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Users can insert their own schedules"
  ON public.schedules FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own schedules"
  ON public.schedules FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own schedules"
  ON public.schedules FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 9.6 REMINDERS POLICIES
CREATE POLICY "Users can view only their own reminders"
  ON public.reminders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Users can insert their own reminders"
  ON public.reminders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminders"
  ON public.reminders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminders"
  ON public.reminders FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 9.7 LOST ITEMS POLICIES
CREATE POLICY "Anyone can view approved lost items, owners can view their own"
  ON public.lost_items FOR SELECT TO authenticated
  USING (status = 'APPROVED' OR auth.uid() = user_id OR public.is_moderator_or_higher(auth.uid()));

CREATE POLICY "Authenticated users can create lost item reports"
  ON public.lost_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their own lost items"
  ON public.lost_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_moderator_or_higher(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_moderator_or_higher(auth.uid()));

CREATE POLICY "Owners or Admins can delete lost items"
  ON public.lost_items FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_or_superadmin(auth.uid()));

-- 9.8 FOUND ITEMS POLICIES
CREATE POLICY "Anyone can view approved found items, owners can view their own"
  ON public.found_items FOR SELECT TO authenticated
  USING (status = 'APPROVED' OR auth.uid() = user_id OR public.is_moderator_or_higher(auth.uid()));

CREATE POLICY "Authenticated users can create found item reports"
  ON public.found_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their own found items"
  ON public.found_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_moderator_or_higher(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_moderator_or_higher(auth.uid()));

-- 9.9 CLAIMS POLICIES
CREATE POLICY "Claimants, item posters, and admins can view claims"
  ON public.claims FOR SELECT TO authenticated
  USING (
    auth.uid() = claimant_id OR
    EXISTS (SELECT 1 FROM public.found_items fi WHERE fi.id = found_item_id AND fi.user_id = auth.uid()) OR
    public.is_moderator_or_higher(auth.uid())
  );

CREATE POLICY "Authenticated users can submit claims"
  ON public.claims FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = claimant_id);

CREATE POLICY "Claimants and moderators can update claims"
  ON public.claims FOR UPDATE TO authenticated
  USING (auth.uid() = claimant_id OR public.is_moderator_or_higher(auth.uid()))
  WITH CHECK (auth.uid() = claimant_id OR public.is_moderator_or_higher(auth.uid()));

-- 9.10 REPORTS POLICIES
CREATE POLICY "Users can view their own reports, moderators can view all"
  ON public.reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.is_moderator_or_higher(auth.uid()));

CREATE POLICY "Users can create reports"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Moderators can review and resolve reports"
  ON public.reports FOR UPDATE TO authenticated
  USING (public.is_moderator_or_higher(auth.uid()))
  WITH CHECK (public.is_moderator_or_higher(auth.uid()));

-- 9.11 NOTIFICATIONS POLICIES (With 7-Day Active Filter)
CREATE POLICY "Users can view their own active notifications within 7-day window"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND expires_at > TIMEZONE('utc'::text, NOW()));

CREATE POLICY "Users can mark their own notifications as read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can send direct notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_superadmin(auth.uid()) OR auth.uid() = user_id);

-- 9.12 ADMIN BROADCASTS POLICIES
CREATE POLICY "Admins can view and manage broadcasts"
  ON public.admin_broadcasts FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin(auth.uid()))
  WITH CHECK (public.is_admin_or_superadmin(auth.uid()));

-- 9.13 NOTIFICATION TOKENS POLICIES
CREATE POLICY "Users manage their own device tokens"
  ON public.notification_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 9.14 ADMIN LOGS POLICIES
CREATE POLICY "Only Admins can view admin logs"
  ON public.admin_logs FOR SELECT TO authenticated
  USING (public.is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins can insert audit logs"
  ON public.admin_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_superadmin(auth.uid()));

-- 9.15 SYSTEM SETTINGS POLICIES
CREATE POLICY "Anyone can view system settings"
  ON public.system_settings FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "Only Admins can update system settings"
  ON public.system_settings FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin(auth.uid()))
  WITH CHECK (public.is_admin_or_superadmin(auth.uid()));

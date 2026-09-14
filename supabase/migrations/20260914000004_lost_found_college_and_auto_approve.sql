-- ==============================================================================
-- CAMPUSMATE MIGRATION 20260914000004: LOST & FOUND COLLEGE SUPPORT & VISIBILITY
-- ==============================================================================

-- 1. Add college_name column to lost_items and found_items
ALTER TABLE public.lost_items 
  ADD COLUMN IF NOT EXISTS college_name TEXT;

ALTER TABLE public.found_items 
  ADD COLUMN IF NOT EXISTS college_name TEXT;

-- 2. Backfill existing lost & found items with creator's college_name
UPDATE public.lost_items li
SET college_name = p.college_name
FROM public.profiles p
WHERE li.user_id = p.id AND li.college_name IS NULL;

UPDATE public.found_items fi
SET college_name = p.college_name
FROM public.profiles p
WHERE fi.user_id = p.id AND fi.college_name IS NULL;

-- 3. Update RLS policies on lost_items so items are immediately visible to campus users
DROP POLICY IF EXISTS "Anyone can view approved lost items, owners can view their own" ON public.lost_items;
DROP POLICY IF EXISTS "Public view for lost items" ON public.lost_items;

CREATE POLICY "Public view for lost items"
  ON public.lost_items FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create lost item reports" ON public.lost_items;
CREATE POLICY "Authenticated users can create lost item reports"
  ON public.lost_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners can update their own lost items" ON public.lost_items;
CREATE POLICY "Owners can update their own lost items"
  ON public.lost_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_moderator_or_higher(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_moderator_or_higher(auth.uid()));

-- 4. Update RLS policies on found_items
DROP POLICY IF EXISTS "Anyone can view approved found items, owners can view their own" ON public.found_items;
DROP POLICY IF EXISTS "Public view for found items" ON public.found_items;

CREATE POLICY "Public view for found items"
  ON public.found_items FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create found item reports" ON public.found_items;
CREATE POLICY "Authenticated users can create found item reports"
  ON public.found_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners can update their own found items" ON public.found_items;
CREATE POLICY "Owners can update their own found items"
  ON public.found_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_moderator_or_higher(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_moderator_or_higher(auth.uid()));

-- 5. RPC function to report a lost item with auto-notification to campus
CREATE OR REPLACE FUNCTION public.report_lost_item(
  p_title TEXT,
  p_description TEXT,
  p_last_seen_location TEXT,
  p_lost_date TIMESTAMPTZ,
  p_image_urls TEXT[],
  p_reward_offered TEXT,
  p_contact_info TEXT,
  p_category_id UUID,
  p_college_name TEXT
)
RETURNS UUID AS $$
DECLARE
  v_item_id UUID;
  v_user_college TEXT;
BEGIN
  -- Determine college name from parameter or user profile
  IF p_college_name IS NOT NULL AND p_college_name <> '' THEN
    v_user_college := p_college_name;
  ELSE
    SELECT college_name INTO v_user_college FROM public.profiles WHERE id = auth.uid();
  END IF;

  INSERT INTO public.lost_items (
    user_id,
    title,
    description,
    last_seen_location,
    lost_date,
    image_urls,
    reward_offered,
    contact_info,
    category_id,
    college_name,
    status
  ) VALUES (
    auth.uid(),
    p_title,
    p_description,
    p_last_seen_location,
    p_lost_date,
    p_image_urls,
    p_reward_offered,
    p_contact_info,
    p_category_id,
    v_user_college,
    'APPROVED'
  )
  RETURNING id INTO v_item_id;

  -- Create in-app notification for the reporting student (confirmation)
  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    type,
    data,
    expires_at
  ) VALUES (
    auth.uid(),
    '🔍 Lost Item Reported: ' || p_title,
    'Your lost item report has been published to ' || COALESCE(v_user_college, 'Campus') || '. We will notify you when matching items or claims are submitted.',
    'LOST_FOUND_ALERT',
    jsonb_build_object('item_id', v_item_id, 'type', 'LOST'),
    NOW() + INTERVAL '7 days'
  );

  RETURN v_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

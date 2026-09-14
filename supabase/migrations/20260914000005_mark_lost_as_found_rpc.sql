-- ==============================================================================
-- CAMPUSMATE MIGRATION 20260914000005: MARK LOST AS FOUND RPC & WORKFLOW
-- ==============================================================================

-- 1. Function to mark a lost item as found by a finder & notify original owner
CREATE OR REPLACE FUNCTION public.mark_lost_item_as_found(
  p_lost_item_id UUID,
  p_found_location TEXT,
  p_current_location TEXT,
  p_handover_notes TEXT,
  p_image_urls TEXT[],
  p_finder_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_lost_item RECORD;
  v_found_id UUID;
BEGIN
  SELECT * INTO v_lost_item FROM public.lost_items WHERE id = p_lost_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lost item record not found.';
  END IF;

  -- 1. Create Found Item entry linked to the college
  INSERT INTO public.found_items (
    user_id,
    title,
    description,
    found_location,
    current_location,
    college_name,
    found_date,
    image_urls,
    handover_notes,
    category_id,
    status
  ) VALUES (
    p_finder_id,
    v_lost_item.title,
    v_lost_item.description,
    p_found_location,
    p_current_location,
    v_lost_item.college_name,
    NOW(),
    p_image_urls,
    p_handover_notes,
    v_lost_item.category_id,
    'APPROVED'
  )
  RETURNING id INTO v_found_id;

  -- 2. Update Lost Item to RESOLVED
  UPDATE public.lost_items
  SET status = 'RESOLVED',
      updated_at = NOW()
  WHERE id = p_lost_item_id;

  -- 3. Notify the owner who reported it lost with 7-day retention
  IF v_lost_item.user_id <> p_finder_id THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      body,
      type,
      data,
      expires_at
    ) VALUES (
      v_lost_item.user_id,
      '🎉 Great News! Your Lost Item Was Found: ' || v_lost_item.title,
      'A fellow student or campus staff member found your item at ' || p_found_location || ' and deposited it at: ' || p_current_location || '. Note: ' || COALESCE(p_handover_notes, 'Ready for pickup'),
      'LOST_FOUND_ALERT',
      jsonb_build_object('lost_item_id', p_lost_item_id, 'found_item_id', v_found_id),
      NOW() + INTERVAL '7 days'
    );
  END IF;

  RETURN v_found_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function for owner or admin to mark lost item as resolved / recovered by self
CREATE OR REPLACE FUNCTION public.resolve_own_lost_item(p_lost_item_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.lost_items
  SET status = 'RESOLVED',
      updated_at = NOW()
  WHERE id = p_lost_item_id AND (user_id = auth.uid() OR public.is_admin_or_superadmin(auth.uid()));

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

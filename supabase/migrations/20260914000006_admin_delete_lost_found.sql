-- ==============================================================================
-- CAMPUSMATE MIGRATION 20260914000006: ADMIN DELETE LOST & FOUND ITEMS
-- ==============================================================================

-- 1. Ensure DELETE policy on lost_items allows Admins and owners to delete
DROP POLICY IF EXISTS "Owners or Admins can delete lost items" ON public.lost_items;
DROP POLICY IF EXISTS "Admins and owners can delete lost items" ON public.lost_items;

CREATE POLICY "Admins and owners can delete lost items"
  ON public.lost_items FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id OR 
    public.is_admin_or_superadmin(auth.uid()) OR
    public.is_moderator_or_higher(auth.uid())
  );

-- 2. Ensure DELETE policy on found_items allows Admins and owners to delete
DROP POLICY IF EXISTS "Owners or Admins can delete found items" ON public.found_items;
DROP POLICY IF EXISTS "Admins and owners can delete found items" ON public.found_items;

CREATE POLICY "Admins and owners can delete found items"
  ON public.found_items FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id OR 
    public.is_admin_or_superadmin(auth.uid()) OR
    public.is_moderator_or_higher(auth.uid())
  );

-- 3. RPC function for Admin to delete item with audit logging
CREATE OR REPLACE FUNCTION public.delete_lost_found_item(
  p_item_type TEXT,
  p_item_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT (public.is_admin_or_superadmin(auth.uid()) OR public.is_moderator_or_higher(auth.uid())) THEN
    -- Check if user is the item owner
    IF p_item_type = 'LOST' AND NOT EXISTS (SELECT 1 FROM public.lost_items WHERE id = p_item_id AND user_id = auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized: Only item owners or campus administrators can delete this item.';
    END IF;
    IF p_item_type = 'FOUND' AND NOT EXISTS (SELECT 1 FROM public.found_items WHERE id = p_item_id AND user_id = auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized: Only item owners or campus administrators can delete this item.';
    END IF;
  END IF;

  IF p_item_type = 'LOST' THEN
    DELETE FROM public.lost_items WHERE id = p_item_id;
  ELSE
    DELETE FROM public.found_items WHERE id = p_item_id;
  END IF;

  -- Log action
  INSERT INTO public.admin_logs (admin_id, action, target_table, target_id, details)
  VALUES (
    auth.uid(),
    p_item_type || '_ITEM_DELETED',
    CASE WHEN p_item_type = 'LOST' THEN 'lost_items' ELSE 'found_items' END,
    p_item_id,
    jsonb_build_object('item_id', p_item_id, 'type', p_item_type)
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

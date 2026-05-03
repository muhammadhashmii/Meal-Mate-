-- Fix slot capacity counting to current business day only.
-- Without day scoping, historical orders can accumulate forever and mark slots as full.

CREATE OR REPLACE FUNCTION public.business_day_bounds_utc()
RETURNS TABLE(day_start_utc timestamptz, day_end_utc timestamptz)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH tz AS (
    SELECT COALESCE(current_setting('app.timezone', true), 'Asia/Karachi') AS tz
  )
  SELECT
    (date_trunc('day', now() AT TIME ZONE tz.tz) AT TIME ZONE tz.tz) AS day_start_utc,
    ((date_trunc('day', now() AT TIME ZONE tz.tz) + interval '1 day') AT TIME ZONE tz.tz) AS day_end_utc
  FROM tz;
$$;

CREATE OR REPLACE FUNCTION public.get_pickup_slot_availability(slot_labels text[])
RETURNS TABLE (
  slot_label text,
  booked_count integer,
  max_capacity integer,
  remaining integer,
  is_full boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH labels AS (
    SELECT DISTINCT unnest(COALESCE(slot_labels, ARRAY[]::text[])) AS slot_label
  ),
  bounds AS (
    SELECT day_start_utc, day_end_utc FROM public.business_day_bounds_utc()
  ),
  booked AS (
    SELECT
      o.pickup_slot AS slot_label,
      COALESCE(SUM(GREATEST(COALESCE(o.quantity, 1), 1)), 0)::int AS booked_count
    FROM public.orders o
    CROSS JOIN bounds b
    WHERE o.status IN ('pending', 'preparing', 'ready')
      AND o.created_at >= b.day_start_utc
      AND o.created_at < b.day_end_utc
      AND o.pickup_slot = ANY (COALESCE(slot_labels, ARRAY[]::text[]))
    GROUP BY o.pickup_slot
  )
  SELECT
    l.slot_label,
    COALESCE(b.booked_count, 0) AS booked_count,
    public.capacity_for_pickup_slot(l.slot_label) AS max_capacity,
    GREATEST(public.capacity_for_pickup_slot(l.slot_label) - COALESCE(b.booked_count, 0), 0) AS remaining,
    COALESCE(b.booked_count, 0) >= public.capacity_for_pickup_slot(l.slot_label) AS is_full
  FROM labels l
  LEFT JOIN booked b ON b.slot_label = l.slot_label;
$$;

CREATE OR REPLACE FUNCTION public.enforce_order_slot_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_slot text;
  new_units integer;
  slot_cap integer;
  already_booked integer;
  day_start_utc timestamptz;
  day_end_utc timestamptz;
  active_statuses constant text[] := ARRAY['pending', 'preparing', 'ready'];
BEGIN
  IF NEW.status IS NULL THEN
    NEW.status := 'pending';
  END IF;

  IF NEW.status <> ALL(active_statuses) THEN
    RETURN NEW;
  END IF;

  SELECT b.day_start_utc, b.day_end_utc
  INTO day_start_utc, day_end_utc
  FROM public.business_day_bounds_utc() b;

  new_slot := NEW.pickup_slot;
  new_units := GREATEST(COALESCE(NEW.quantity, 1), 1);
  slot_cap := public.capacity_for_pickup_slot(new_slot);

  SELECT COALESCE(SUM(GREATEST(COALESCE(o.quantity, 1), 1)), 0)::int
  INTO already_booked
  FROM public.orders o
  WHERE o.pickup_slot = new_slot
    AND o.status = ANY(active_statuses)
    AND o.created_at >= day_start_utc
    AND o.created_at < day_end_utc
    AND (TG_OP <> 'UPDATE' OR o.id <> NEW.id);

  IF already_booked + new_units > slot_cap THEN
    RAISE EXCEPTION 'Pickup slot is full'
      USING ERRCODE = 'P0001',
            DETAIL = format('slot=%s booked_today=%s requested=%s capacity=%s', new_slot, already_booked, new_units, slot_cap),
            HINT = 'Please choose another pickup slot.';
  END IF;

  RETURN NEW;
END;
$$;

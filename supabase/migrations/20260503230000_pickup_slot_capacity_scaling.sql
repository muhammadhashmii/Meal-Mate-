-- Scalable pickup-slot capacity model with high defaults.
-- This prevents premature "fully booked" states and makes limits configurable.

CREATE TABLE IF NOT EXISTS public.pickup_slot_capacity (
  slot_label text PRIMARY KEY,
  max_capacity integer NOT NULL DEFAULT 1000 CHECK (max_capacity > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pickup_slot_capacity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view slot capacity" ON public.pickup_slot_capacity;
CREATE POLICY "Authenticated users can view slot capacity"
ON public.pickup_slot_capacity
FOR SELECT
TO authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.update_pickup_slot_capacity_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pickup_slot_capacity_updated_at ON public.pickup_slot_capacity;
CREATE TRIGGER trg_pickup_slot_capacity_updated_at
BEFORE UPDATE ON public.pickup_slot_capacity
FOR EACH ROW
EXECUTE FUNCTION public.update_pickup_slot_capacity_updated_at();

CREATE OR REPLACE FUNCTION public.default_pickup_slot_capacity()
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT GREATEST(
    COALESCE(NULLIF(current_setting('app.default_pickup_slot_capacity', true), '')::int, 1000),
    1
  );
$$;

CREATE OR REPLACE FUNCTION public.capacity_for_pickup_slot(slot_text text)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT c.max_capacity FROM public.pickup_slot_capacity c WHERE c.slot_label = slot_text),
    public.default_pickup_slot_capacity()
  );
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
  booked AS (
    SELECT
      o.pickup_slot AS slot_label,
      COALESCE(SUM(GREATEST(COALESCE(o.quantity, 1), 1)), 0)::int AS booked_count
    FROM public.orders o
    WHERE o.status IN ('pending', 'preparing', 'ready')
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

REVOKE EXECUTE ON FUNCTION public.get_pickup_slot_availability(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pickup_slot_availability(text[]) TO authenticated;

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
  active_statuses constant text[] := ARRAY['pending', 'preparing', 'ready'];
BEGIN
  IF NEW.status IS NULL THEN
    NEW.status := 'pending';
  END IF;

  IF NEW.status <> ALL(active_statuses) THEN
    RETURN NEW;
  END IF;

  new_slot := NEW.pickup_slot;
  new_units := GREATEST(COALESCE(NEW.quantity, 1), 1);
  slot_cap := public.capacity_for_pickup_slot(new_slot);

  SELECT COALESCE(SUM(GREATEST(COALESCE(o.quantity, 1), 1)), 0)::int
  INTO already_booked
  FROM public.orders o
  WHERE o.pickup_slot = new_slot
    AND o.status = ANY(active_statuses)
    AND (TG_OP <> 'UPDATE' OR o.id <> NEW.id);

  IF already_booked + new_units > slot_cap THEN
    RAISE EXCEPTION 'Pickup slot is full'
      USING ERRCODE = 'P0001',
            DETAIL = format('slot=%s booked=%s requested=%s capacity=%s', new_slot, already_booked, new_units, slot_cap),
            HINT = 'Please choose another pickup slot.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_enforce_slot_capacity ON public.orders;
CREATE TRIGGER trg_orders_enforce_slot_capacity
BEFORE INSERT OR UPDATE OF pickup_slot, quantity, status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_slot_capacity();

CREATE INDEX IF NOT EXISTS idx_orders_slot_active_status
ON public.orders (pickup_slot, status);

-- Backfill/raise capacity for known UI labels to a large default.
INSERT INTO public.pickup_slot_capacity (slot_label, max_capacity) VALUES
  ('12:00 – 12:30', 1000),
  ('12:30 – 1:00', 1000),
  ('1:00 – 1:30', 1000),
  ('1:30 – 2:00', 1000),
  ('2:00 – 2:30', 1000),
  ('2:30 – 3:00', 1000),
  ('3:00 – 3:30', 1000),
  ('3:30 – 4:00', 1000),
  ('4:00 – 4:30', 1000),
  ('4:30 – 5:00', 1000)
ON CONFLICT (slot_label) DO UPDATE
SET max_capacity = GREATEST(public.pickup_slot_capacity.max_capacity, 1000);

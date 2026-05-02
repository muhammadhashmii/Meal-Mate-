-- Fixes PKT/UTC alignment after 20260502_fix_time_logic.sql:
-- - Slot end parser (12h labels without AM/PM)
-- - Lifecycle job (deterministic transitions; UTC comparisons)
-- - DB enforcement: cancellation only within 2h-before-slot-end window

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Replace incorrect/broken versions from prior migrations
DROP FUNCTION IF EXISTS public.now_pkt();

-- Pickup label examples: "12:30 – 1:00", "1:00-1:30" — trailing HH:MM is SLOT END in Asia/Karachi (campus day).
CREATE OR REPLACE FUNCTION public.pickup_slot_end_timestamptz(slot_text text)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  m text[];
  hour_int int;
  minute_int int;
  tz text;
  local_now timestamp;
  local_end timestamp;
BEGIN
  m := regexp_match(COALESCE(slot_text, ''), '(\d{1,2})\s*:\s*(\d{2})\s*$');
  IF m IS NULL THEN
    RETURN NULL;
  END IF;

  hour_int := m[1]::int;
  minute_int := m[2]::int;

  -- Labels omit AM/PM (Payment UI uses 12h clock); treat small hours as afternoon.
  IF hour_int < 6 THEN
    hour_int := hour_int + 12;
  END IF;

  tz := COALESCE(current_setting('app.timezone', true), 'Asia/Karachi');
  local_now := (now() AT TIME ZONE tz);
  local_end :=
    date_trunc('day', local_now)
    + make_interval(hours => hour_int, mins => minute_int);

  RETURN local_end AT TIME ZONE tz;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_order_lifecycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(55844201);

  UPDATE public.orders
  SET status = 'preparing'
  WHERE status = 'pending'
    AND created_at <= now() - interval '30 seconds';

  UPDATE public.orders
  SET status = 'ready'
  WHERE status = 'preparing'
    AND updated_at <= now() - interval '1 minute';

  UPDATE public.orders
  SET status = 'completed'
  WHERE status = 'ready'
    AND public.pickup_slot_end_timestamptz(pickup_slot) IS NOT NULL
    AND now() >= public.pickup_slot_end_timestamptz(pickup_slot);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_order_cancellation_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  slot_end timestamptz;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'cancelled'
     AND (OLD.status IS DISTINCT FROM 'cancelled') THEN

    IF OLD.status NOT IN ('pending', 'preparing') THEN
      RAISE EXCEPTION 'Order cannot be cancelled in status %', OLD.status;
    END IF;

    slot_end := public.pickup_slot_end_timestamptz(OLD.pickup_slot);
    IF slot_end IS NULL THEN
      RAISE EXCEPTION 'Cannot cancel: invalid pickup slot';
    END IF;

    -- Allow iff now <= slot_end - 2 hours (product rule)
    IF NOT (now() <= slot_end - interval '2 hours') THEN
      RAISE EXCEPTION 'Cancellation window closed (must be at least 2 hours before pickup slot end)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_enforce_cancel_rules ON public.orders;
CREATE TRIGGER trg_orders_enforce_cancel_rules
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_cancellation_window();

DO $$
BEGIN
  PERFORM cron.unschedule('orders-lifecycle-automation');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
  'orders-lifecycle-automation',
  '* * * * *',
  $$SELECT public.advance_order_lifecycle();$$
);

REVOKE EXECUTE ON FUNCTION public.advance_order_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_order_cancellation_window() FROM PUBLIC, anon, authenticated;

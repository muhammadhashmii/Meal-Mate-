-- =========================
-- ENABLE CRON (SAFE)
-- =========================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =========================
-- PICKUP SLOT PARSER (FIXED SAFE VERSION)
-- =========================
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
  local_end timestamp;
BEGIN
  m := regexp_match(COALESCE(slot_text, ''), '(\d{1,2})\s*:\s*(\d{2})\s*$');
  IF m IS NULL THEN
    RETURN NULL;
  END IF;

  hour_int := m[1]::int;
  minute_int := m[2]::int;

  IF hour_int < 6 THEN
    hour_int := hour_int + 12;
  END IF;

  tz := COALESCE(current_setting('app.timezone', true), 'Asia/Karachi');

  local_end :=
    date_trunc('day', now() AT TIME ZONE tz)
    + make_interval(hours => hour_int, mins => minute_int);

  RETURN local_end AT TIME ZONE tz;
END;
$$;

-- =========================
-- LIFECYCLE ENGINE (FIXED)
-- =========================
CREATE OR REPLACE FUNCTION public.advance_order_lifecycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  -- 1. pending → preparing (FIXED: use created_at only)
  UPDATE public.orders
  SET status = 'preparing',
      updated_at = now()
  WHERE status = 'pending'
    AND created_at <= now() - interval '30 seconds';

  -- 2. preparing → ready (FIXED: use updated_at from last state change)
  UPDATE public.orders
  SET status = 'ready',
      updated_at = now()
  WHERE status = 'preparing'
    AND updated_at <= now() - interval '1 minute';

  -- 3. ready → completed (RELIABLE)
  UPDATE public.orders
  SET status = 'completed',
      updated_at = now()
  WHERE status = 'ready'
    AND public.pickup_slot_end_timestamptz(pickup_slot) IS NOT NULL
    AND now() >= public.pickup_slot_end_timestamptz(pickup_slot);

END;
$$;

-- =========================
-- NOTIFICATION TRIGGER (SAFE)
-- =========================
CREATE OR REPLACE FUNCTION public.handle_order_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_order_id)
    VALUES (
      NEW.user_id,
      'order_confirmed',
      'Order confirmed 🎉',
      NEW.meal_name || ' ×' || NEW.quantity || ' • Pickup ' || NEW.pickup_slot || ' • Rs ' || NEW.total_tokens,
      NEW.id
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN

    IF NEW.status = 'cancelled' THEN
      INSERT INTO public.notifications (user_id, type, title, message, related_order_id)
      VALUES (NEW.user_id, 'order_cancelled', 'Order cancelled',
      NEW.meal_name || ' cancelled. Refund Rs ' || NEW.total_tokens, NEW.id);

    ELSIF NEW.status = 'ready' THEN
      INSERT INTO public.notifications (user_id, type, title, message, related_order_id)
      VALUES (NEW.user_id, 'order_ready', 'Order ready 🛎️',
      NEW.meal_name || ' is ready at ' || NEW.pickup_slot, NEW.id);

    ELSIF NEW.status = 'completed' THEN
      INSERT INTO public.notifications (user_id, type, title, message, related_order_id)
      VALUES (NEW.user_id, 'order_completed', 'Order completed ✅',
      NEW.meal_name || ' completed. Enjoy!', NEW.id);
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- =========================
-- TRIGGER (SAFE RESET)
-- =========================
DROP TRIGGER IF EXISTS trg_orders_notifications ON public.orders;

CREATE TRIGGER trg_orders_notifications
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_notifications();

-- =========================
-- CRON JOB (FIXED SAFE VERSION)
-- =========================

-- remove old job safely
DO $$
BEGIN
  PERFORM cron.unschedule('orders-lifecycle-automation');
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

-- schedule again
SELECT cron.schedule(
  'orders-lifecycle-automation',
  '* * * * *',
  $$SELECT public.advance_order_lifecycle();$$
);

-- =========================
-- SECURITY
-- =========================
REVOKE EXECUTE ON FUNCTION public.advance_order_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_order_notifications() FROM PUBLIC, anon, authenticated;
-- FINAL production hotfix:
-- 1) Ensure lifecycle automation exists and is scheduled
-- 2) Ensure notifications are DB-triggered on order events
-- 3) Enforce "completed order only" ratings at DB policy level

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Parse pickup slot end time from strings like "12:30 – 1:00"
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
  end_ts timestamptz;
BEGIN
  -- Capture the END time at the end of the slot text.
  -- Examples: "12:30 – 1:00", "1:00-1:30", "1:00 - 1:30"
  m := regexp_match(COALESCE(slot_text, ''), '(\d{1,2})\s*:\s*(\d{2})\s*$');
  IF m IS NULL THEN
    RETURN NULL;
  END IF;

  hour_int := m[1]::int;
  minute_int := m[2]::int;

  -- UI slots are daytime; normalize low-hour values to afternoon where needed.
  IF hour_int < 6 THEN
    hour_int := hour_int + 12;
  END IF;

  -- Supabase DB timezone is often UTC, while pickup slots are local-campus times.
  -- Compute the slot end in a fixed local timezone and convert back to timestamptz.
  tz := COALESCE(current_setting('app.timezone', true), 'Asia/Karachi');
  local_now := now() AT TIME ZONE tz;
  local_end := date_trunc('day', local_now) + make_interval(hours => hour_int, mins => minute_int);
  end_ts := local_end AT TIME ZONE tz;

  RETURN end_ts;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_order_lifecycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- pending -> preparing
  UPDATE public.orders
  SET status = 'preparing'
  WHERE status = 'pending'
    AND created_at <= now() - interval '30 seconds';

  -- preparing -> ready
  UPDATE public.orders
  SET status = 'ready'
  WHERE status = 'preparing'
    AND updated_at <= now() - interval '1 minute';

  -- ready -> completed
  UPDATE public.orders
  SET status = 'completed'
  WHERE status = 'ready'
    AND public.pickup_slot_end_timestamptz(pickup_slot) IS NOT NULL
    AND now() >= public.pickup_slot_end_timestamptz(pickup_slot);
END;
$$;

-- Notification trigger source of truth (DB-only notifications)
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
      VALUES (
        NEW.user_id,
        'order_cancelled',
        'Order cancelled',
        NEW.meal_name || ' (' || NEW.id || ') was cancelled. Refund Rs ' || NEW.total_tokens || '.',
        NEW.id
      );
    ELSIF NEW.status = 'ready' THEN
      INSERT INTO public.notifications (user_id, type, title, message, related_order_id)
      VALUES (
        NEW.user_id,
        'order_ready',
        'Order ready 🛎️',
        NEW.meal_name || ' is ready for pickup at ' || NEW.pickup_slot || '.',
        NEW.id
      );
    ELSIF NEW.status = 'completed' THEN
      INSERT INTO public.notifications (user_id, type, title, message, related_order_id)
      VALUES (
        NEW.user_id,
        'order_completed',
        'Order completed ✅',
        NEW.meal_name || ' has been marked completed. Enjoy your meal!',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_notifications ON public.orders;
CREATE TRIGGER trg_orders_notifications
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_notifications();

-- DB-level enforcement: only completed own orders can be rated.
DROP POLICY IF EXISTS "Insert own ratings" ON public.ratings;
CREATE POLICY "Insert own ratings"
ON public.ratings
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND order_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = ratings.order_id
      AND o.user_id = auth.uid()
      AND o.status = 'completed'
  )
);

DROP POLICY IF EXISTS "Update own ratings" ON public.ratings;
CREATE POLICY "Update own ratings"
ON public.ratings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND order_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = ratings.order_id
      AND o.user_id = auth.uid()
      AND o.status = 'completed'
  )
);

-- Ensure cron job exists exactly once.
SELECT cron.unschedule('orders-lifecycle-automation')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'orders-lifecycle-automation'
);

SELECT cron.schedule(
  'orders-lifecycle-automation',
  '* * * * *',
  $$SELECT public.advance_order_lifecycle();$$
);

REVOKE EXECUTE ON FUNCTION public.advance_order_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_order_notifications() FROM PUBLIC, anon, authenticated;

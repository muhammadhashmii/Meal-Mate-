-- =========================================
-- FIX TIMEZONE + ORDER LOGIC (CLEAN VERSION)
-- =========================================

-- IMPORTANT:
-- Supabase uses UTC internally. We only convert PKT input → UTC safely.

-- =========================================
-- PICKUP SLOT → UTC CONVERSION (FIXED)
-- =========================================
CREATE OR REPLACE FUNCTION public.pickup_slot_end_timestamptz(slot_text text)
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
DECLARE
  m text[];
  h int;
  min int;
  local_time timestamp;
BEGIN
  -- Extract HH:MM from "2:00 PM" style input
  m := regexp_match(slot_text, '(\d{1,2})\s*:\s*(\d{2})\s*$');

  IF m IS NULL THEN
    RETURN NULL;
  END IF;

  h := m[1]::int;
  min := m[2]::int;

  -- Build PKT local time
  local_time :=
    date_trunc('day', now() AT TIME ZONE 'Asia/Karachi')
    + make_interval(hours => h, mins => min);

  -- Convert PKT → UTC timestamptz (correct DB format)
  RETURN local_time AT TIME ZONE 'Asia/Karachi';
END;
$$;

-- =========================================
-- SAFE CANCEL RULE (USE IN YOUR APP / DB)
-- =========================================
-- IMPORTANT: DO NOT store this as static logic; use in queries only:
--
-- now() < pickup_slot_end_timestamptz(pickup_slot) - interval '2 hours'

-- =========================================
-- OPTIONAL HELPER (FOR DEBUGGING PKT TIME)
-- =========================================
CREATE OR REPLACE FUNCTION public.now_pkt()
RETURNS timestamptz
LANGUAGE sql
AS $$
  SELECT now() AT TIME ZONE 'Asia/Karachi';
$$;

-- =========================================
-- SAFETY NOTE
-- =========================================
-- DO NOT change database timezone.
-- DO NOT store PKT timestamps directly.
-- Always store UTC, convert only when needed.
-- =========================
-- MEALS EXTENSIONS
-- =========================
ALTER TABLE public.meals
  ADD COLUMN IF NOT EXISTS discount_pct integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS closing_time time DEFAULT '17:00:00',
  ADD COLUMN IF NOT EXISTS avg_rating numeric(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0;

-- =========================
-- RATINGS TABLE
-- =========================
CREATE TABLE IF NOT EXISTS public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  meal_id uuid REFERENCES public.meals(id) ON DELETE CASCADE,
  meal_name text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, order_id)
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View ratings" ON public.ratings;
DROP POLICY IF EXISTS "Insert own ratings" ON public.ratings;
DROP POLICY IF EXISTS "Update own ratings" ON public.ratings;

CREATE POLICY "View ratings"
ON public.ratings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Insert own ratings"
ON public.ratings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own ratings"
ON public.ratings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- =========================
-- CROWD LEVELS
-- =========================
CREATE TABLE IF NOT EXISTS public.crowd_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name text NOT NULL UNIQUE,
  crowd_percentage integer NOT NULL DEFAULT 0 CHECK (crowd_percentage BETWEEN 0 AND 100),
  wait_minutes integer DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crowd_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View crowd" ON public.crowd_levels;

CREATE POLICY "View crowd"
ON public.crowd_levels FOR SELECT
TO authenticated
USING (true);

-- =========================
-- NOTIFICATIONS
-- =========================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  related_order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Delete own notifications" ON public.notifications;

CREATE POLICY "View own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Insert own notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Delete own notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =========================
-- RATING RECOMPUTE FUNCTION
-- =========================
CREATE OR REPLACE FUNCTION public.recompute_meal_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE m_id uuid;
BEGIN
  m_id := COALESCE(NEW.meal_id, OLD.meal_id);

  IF m_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.meals
  SET avg_rating = COALESCE(
        (SELECT ROUND(AVG(rating)::numeric, 2)
         FROM public.ratings
         WHERE meal_id = m_id), 0),
      rating_count = (
        SELECT COUNT(*)
        FROM public.ratings
        WHERE meal_id = m_id
      )
  WHERE id = m_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_meal_rating ON public.ratings;

CREATE TRIGGER trg_recompute_meal_rating
AFTER INSERT OR UPDATE OR DELETE ON public.ratings
FOR EACH ROW
EXECUTE FUNCTION public.recompute_meal_rating();

-- =========================
-- SEED MEALS
-- =========================
INSERT INTO public.meals (name, description, price_tokens, category, discount_pct, stock, closing_time)
SELECT * FROM (VALUES
  ('Chicken Biryani', 'Fragrant basmati rice with tender chicken and traditional spices', 350, 'Desi', 0, 50, '15:00'::time),
  ('Zinger Burger', 'Crispy zinger patty with fresh lettuce, mayo & pickles', 280, 'Fast Food', 0, 40, '17:00'::time),
  ('Pasta Alfredo', 'Creamy white sauce pasta with herbs and parmesan', 300, 'Italian', 0, 30, '16:00'::time),
  ('Chicken Karahi', 'Traditional wok-cooked chicken with fresh spices & tomatoes', 420, 'Desi', 0, 25, '15:00'::time),
  ('Fried Egg on Toast', 'Golden sunny-side-up egg on crispy buttered toast', 100, 'Breakfast', 50, 5, '10:00'::time),
  ('Club Sandwich', 'Triple-decker sandwich with chicken, cheese & veggies', 250, 'Fast Food', 0, 35, '17:00'::time),
  ('Samosa', 'Crispy pastry filled with spiced potatoes & peas', 60, 'Desi', 42, 8, '16:00'::time),
  ('Caesar Salad', 'Fresh romaine lettuce with croutons, parmesan & dressing', 220, 'Healthy', 0, 20, '15:00'::time),
  ('Roll Paratha', 'Flaky paratha wrap stuffed with spiced chicken filling', 180, 'Desi', 20, 12, '15:00'::time),
  ('Panini', 'Grilled Italian sandwich with melted cheese & herbs', 260, 'Italian', 0, 25, '16:00'::time),
  ('Chicken Tikka', 'Char-grilled chicken skewers with mint chutney & lemon', 380, 'Desi', 0, 30, '16:00'::time)
) AS v(name, description, price_tokens, category, discount_pct, stock, closing_time)
WHERE NOT EXISTS (SELECT 1 FROM public.meals);

-- =========================
-- SEED CROWD LEVELS
-- =========================
INSERT INTO public.crowd_levels (zone_name, crowd_percentage, wait_minutes)
SELECT * FROM (VALUES
  ('Main Cafeteria', 55, 8),
  ('Coffee Counter', 30, 4),
  ('Fast Food Bay', 75, 12)
) AS v(zone_name, crowd_percentage, wait_minutes)
WHERE NOT EXISTS (SELECT 1 FROM public.crowd_levels);
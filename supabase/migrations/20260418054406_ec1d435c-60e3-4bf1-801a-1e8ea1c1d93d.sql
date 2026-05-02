-- =========================
-- MEALS TABLE
-- =========================
CREATE TABLE IF NOT EXISTS public.meals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_tokens INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  image_url TEXT,
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view meals" ON public.meals;

CREATE POLICY "Anyone authenticated can view meals"
ON public.meals FOR SELECT
TO authenticated
USING (true);

-- =========================
-- ORDERS TABLE
-- =========================
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id UUID REFERENCES public.meals(id) ON DELETE SET NULL,
  meal_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  pickup_slot TEXT NOT NULL,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;

CREATE POLICY "Users can view their own orders"
ON public.orders FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders"
ON public.orders FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- =========================
-- USER PROFILES
-- =========================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token_balance INTEGER NOT NULL DEFAULT 100,
  dietary_preferences TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own user_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own user_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own user_profile" ON public.user_profiles;

CREATE POLICY "Users can view own user_profile"
ON public.user_profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own user_profile"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own user_profile"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- =========================
-- UPDATED AT FUNCTION
-- =========================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================
-- SAFE TRIGGERS (DROP FIRST)
-- =========================
DROP TRIGGER IF EXISTS update_meals_updated_at ON public.meals;
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;

CREATE TRIGGER update_meals_updated_at
BEFORE UPDATE ON public.meals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- USER CREATION HOOK
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_profiles (id, token_balance)
  VALUES (NEW.id, 100)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- BACKFILL USERS
-- =========================
INSERT INTO public.user_profiles (id, token_balance)
SELECT id, 100 FROM auth.users
ON CONFLICT (id) DO NOTHING;
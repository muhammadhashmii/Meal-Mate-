-- DROP ALL POSSIBLE OLD VARIANTS (important)
DROP POLICY IF EXISTS "View ratings" ON public.ratings;
DROP POLICY IF EXISTS "View own ratings" ON public.ratings;
DROP POLICY IF EXISTS "Insert own ratings" ON public.ratings;
DROP POLICY IF EXISTS "Update own ratings" ON public.ratings;

-- RECREATE CLEAN POLICY
CREATE POLICY "View own ratings"
ON public.ratings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
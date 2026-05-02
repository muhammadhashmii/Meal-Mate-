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
      VALUES (NEW.user_id, 'order_cancelled', 'Order cancelled', NEW.meal_name || ' (' || NEW.id || ') was cancelled. Refund Rs ' || NEW.total_tokens || '.', NEW.id);
    ELSIF NEW.status = 'ready' THEN
      INSERT INTO public.notifications (user_id, type, title, message, related_order_id)
      VALUES (NEW.user_id, 'order_ready', 'Order ready 🛎️', NEW.meal_name || ' is ready for pickup at ' || NEW.pickup_slot || '.', NEW.id);
    ELSIF NEW.status = 'completed' THEN
      INSERT INTO public.notifications (user_id, type, title, message, related_order_id)
      VALUES (NEW.user_id, 'order_ready', 'Order completed ✅', NEW.meal_name || ' has been marked completed. Enjoy your meal!', NEW.id);
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

REVOKE EXECUTE ON FUNCTION public.handle_order_notifications() FROM PUBLIC, anon, authenticated;

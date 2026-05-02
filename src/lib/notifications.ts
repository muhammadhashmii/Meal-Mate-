import { supabase } from "@/integrations/supabase/client";

export type NotificationType = "order_confirmed" | "order_cancelled" | "order_ready" | "order_completed" | "discount";

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedOrderId?: string;
}) {
  const { error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    related_order_id: params.relatedOrderId ?? null,
  });
  if (error) console.error("notification insert failed", error);
}

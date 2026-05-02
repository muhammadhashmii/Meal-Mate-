import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Clock, Ban, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { canCancelWithinTwoHourWindowBeforeSlotEnd } from "@/lib/pktTime";

interface ActiveOrder {
  id: string;
  meal_name: string;
  total_tokens: number;
  pickup_slot: string;
  status: string;
  created_at: string;
}

const CANCELLABLE = new Set(["pending", "preparing"]);
const shortId = (id: string) => "#MM" + id.slice(0, 6).toUpperCase();

export default function CancelOrder() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmOrder, setConfirmOrder] = useState<ActiveOrder | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("orders")
      .select("id, meal_name, total_tokens, pickup_slot, status, created_at")
      .eq("user_id", user.id)
      .in("status", ["pending", "preparing", "ready"])
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setOrders(data as ActiveOrder[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const canCancel = (o: ActiveOrder): { ok: boolean; reason?: string } => {
    if (!CANCELLABLE.has(o.status)) return { ok: false, reason: "Order is already being prepared for handover." };
    if (!canCancelWithinTwoHourWindowBeforeSlotEnd(o.pickup_slot)) {
      return { ok: false, reason: "Cancellation not allowed within 2 hours of pickup slot end." };
    }
    return { ok: true };
  };

  const handleConfirm = async () => {
    if (!confirmOrder || !user) return;
    setCancelling(true);
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", confirmOrder.id)
      .eq("user_id", user.id);
    setCancelling(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Order ${shortId(confirmOrder.id)} cancelled. Refund of Rs ${confirmOrder.total_tokens} will be processed. 💸`);
    setConfirmOrder(null);
    fetchOrders();
  };

  if (!user) {
    return <div className="flex flex-col items-center justify-center min-h-[60vh]"><h2 className="text-xl font-bold">Please sign in to manage orders</h2></div>;
  }
  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Cancel Order ❌</h1>
        <p className="text-muted-foreground text-sm font-medium">Manage your active orders</p>
      </div>

      {orders.length === 0 && (
        <Card className="rounded-3xl bg-card border border-border shadow-card">
          <CardContent className="p-8 text-center space-y-2">
            <p className="text-4xl">🎉</p>
            <p className="font-bold text-foreground">No active orders</p>
            <p className="text-sm text-muted-foreground font-medium">You're all caught up!</p>
          </CardContent>
        </Card>
      )}

      {orders.map((order) => {
        const check = canCancel(order);
        return (
          <Card key={order.id} className="rounded-3xl bg-card border border-border shadow-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold">{shortId(order.id)}</CardTitle>
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-warning/10 text-warning">🔥 {order.status}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-secondary rounded-2xl p-3"><p className="text-muted-foreground text-xs font-medium">Meal</p><p className="font-bold">{order.meal_name}</p></div>
                <div className="bg-secondary rounded-2xl p-3"><p className="text-muted-foreground text-xs font-medium">Amount</p><p className="font-bold text-accent">Rs {order.total_tokens}</p></div>
                <div className="bg-secondary rounded-2xl p-3"><p className="text-muted-foreground text-xs font-medium">Pickup Slot</p><p className="font-medium flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-primary" /> {order.pickup_slot}</p></div>
                <div className="bg-secondary rounded-2xl p-3"><p className="text-muted-foreground text-xs font-medium">Status</p><p className="font-medium capitalize">{order.status}</p></div>
              </div>

              {check.ok ? (
                <button className="w-full rounded-full py-2.5 font-bold text-destructive-foreground bg-destructive flex items-center justify-center gap-2 hover:opacity-90 hover:scale-[1.02] transition-all text-sm" onClick={() => setConfirmOrder(order)}>
                  <Ban className="h-4 w-4" /> Cancel Order
                </button>
              ) : (
                <>
                  <button className="w-full rounded-full py-2.5 font-bold flex items-center justify-center gap-2 opacity-50 cursor-not-allowed bg-muted text-muted-foreground text-sm" disabled>
                    <Ban className="h-4 w-4" /> Cancel Order
                  </button>
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> {check.reason}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!confirmOrder} onOpenChange={(o) => !o && setConfirmOrder(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-bold">Cancel Order</DialogTitle>
            <DialogDescription className="font-medium">Are you sure you want to cancel this order?</DialogDescription>
          </DialogHeader>
          {confirmOrder && (
            <div className="bg-warning/10 p-4 rounded-2xl text-sm space-y-1 font-medium">
              <p><strong>Meal:</strong> {confirmOrder.meal_name}</p>
              <p><strong>Slot:</strong> {confirmOrder.pickup_slot}</p>
              <p><strong>Amount:</strong> Rs {confirmOrder.total_tokens} (will be refunded)</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <button className="rounded-full px-5 py-2 font-bold bg-secondary text-foreground hover:bg-secondary/80 text-sm" onClick={() => setConfirmOrder(null)} disabled={cancelling}>Go Back</button>
            <button className="rounded-full px-5 py-2 font-bold bg-destructive text-destructive-foreground hover:opacity-90 text-sm flex items-center gap-2" onClick={handleConfirm} disabled={cancelling}>
              {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm Cancellation
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {orders.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-success/10 rounded-2xl border border-success/20">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <p className="text-xs font-medium text-success">Cancellations are allowed up to 2 hours before your pickup slot ends (Pakistan time).</p>
        </div>
      )}
    </div>
  );
}

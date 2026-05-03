import { useEffect, useMemo, useState } from "react";
import { CreditCard, Wallet, Banknote, CheckCircle2, ShoppingBag, Clock, Loader2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { buildPickupSlots, isAfterPickupWindow } from "@/lib/pktTime";

const paymentMethods = [
  { id: "card", label: "Credit/Debit Card", icon: CreditCard, desc: "Visa, Mastercard" },
  { id: "wallet", label: "Digital Wallet", icon: Wallet, desc: "JazzCash, Easypaisa" },
  { id: "cash", label: "Cash on Pickup", icon: Banknote, desc: "Pay when you collect" },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_AUTH_ENABLED =
  (import.meta.env.VITE_AUTH_MODE as string | undefined)?.toLowerCase() === "local";
const LOCAL_ORDERS_KEY = "mealmate_local_orders_v1";
const SLOT_AVAILABILITY_REFRESH_MS = 10000;
const DEFAULT_SLOT_CAPACITY = Math.max(
  Number.parseInt(import.meta.env.VITE_DEFAULT_SLOT_CAPACITY ?? "1000", 10) || 1000,
  1,
);

type LocalOrder = {
  id: string;
  user_id: string;
  meal_name: string;
  quantity: number;
  pickup_slot: string;
  total_tokens: number;
  payment_method: string;
  status: string;
  created_at: string;
};

const loadLocalOrders = (): LocalOrder[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LocalOrder[]) : [];
  } catch {
    return [];
  }
};

const saveLocalOrders = (orders: LocalOrder[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
  } catch {
    // ignore
  }
};

interface MealLookupRow {
  id: string;
  name: string;
}

interface SlotAvailabilityRow {
  slot_label: string;
  booked_count: number;
  max_capacity: number;
  remaining: number;
  is_full: boolean;
}

export default function Payment() {
  const { items, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedPayment, setSelectedPayment] = useState("cash");
  const timeSlots = buildPickupSlots();
  const slotLabels = useMemo(() => buildPickupSlots().map((slot) => slot.label), []);
  const [slotBookedByLabel, setSlotBookedByLabel] = useState<Record<string, number>>({});
  const [slotCapacityByLabel, setSlotCapacityByLabel] = useState<Record<string, number>>({});
  const [slotLoading, setSlotLoading] = useState(false);
  const firstAvailable = timeSlots.find((s) => s.available)?.label ?? null;
  const [selectedSlot, setSelectedSlot] = useState<string | null>(firstAvailable);
  const [submitting, setSubmitting] = useState(false);
  const showingTomorrowSlots = isAfterPickupWindow();
  const slotUi = useMemo(() => {
    return timeSlots.map((slot) => {
      const maxCapacity = slotCapacityByLabel[slot.label] ?? DEFAULT_SLOT_CAPACITY;
      const bookedCount = slotBookedByLabel[slot.label] ?? 0;
      const capacityFull = bookedCount >= maxCapacity;
      const available = slot.available && !capacityFull;
      return {
        ...slot,
        available,
        bookedCount,
        maxCapacity,
        statusLabel: slot.available ? (capacityFull ? "Fully Booked" : null) : "Unavailable",
      };
    });
  }, [timeSlots, slotBookedByLabel, slotCapacityByLabel]);
  const firstLiveAvailable = slotUi.find((s) => s.available)?.label ?? null;

  useEffect(() => {
    if (!selectedSlot || slotUi.some((slot) => slot.label === selectedSlot && slot.available)) return;
    setSelectedSlot(firstLiveAvailable);
  }, [selectedSlot, slotUi, firstLiveAvailable]);

  useEffect(() => {
    if (LOCAL_AUTH_ENABLED || !user) return;
    let mounted = true;
    let intervalId: number | null = null;

    const fetchAvailability = async () => {
      setSlotLoading(true);
      const { data, error } = await supabase.rpc("get_pickup_slot_availability", {
        slot_labels: slotLabels,
      });
      if (!mounted) return;
      if (!error) {
        const rows = (data ?? []) as SlotAvailabilityRow[];
        const bookedMap: Record<string, number> = {};
        const capMap: Record<string, number> = {};
        rows.forEach((row) => {
          bookedMap[row.slot_label] = row.booked_count;
          capMap[row.slot_label] = Math.max(row.max_capacity ?? DEFAULT_SLOT_CAPACITY, 1);
        });
        setSlotBookedByLabel(bookedMap);
        setSlotCapacityByLabel(capMap);
      }
      setSlotLoading(false);
    };

    void fetchAvailability();
    intervalId = window.setInterval(() => {
      void fetchAvailability();
    }, SLOT_AVAILABILITY_REFRESH_MS);

    return () => {
      mounted = false;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [user, slotLabels]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center">
          <ShoppingBag className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Nothing to pay for 🤷</h2>
        <p className="text-muted-foreground text-sm font-medium">Add items to your cart first!</p>
        <button onClick={() => navigate("/")} className="gradient-primary text-primary-foreground font-bold px-6 py-2.5 rounded-full text-sm hover:opacity-90 transition-all">
          Browse Menu
        </button>
      </div>
    );
  }

  const handleConfirmOrder = async () => {
    if (!selectedSlot) { toast.error("Please select a pickup time slot"); return; }
    if (!user) { toast.error("Please sign in to place an order"); navigate("/login"); return; }

    setSubmitting(true);
    try {
      const totalTokens = totalPrice + 20;

      if (LOCAL_AUTH_ENABLED) {
        const now = new Date();
        const id = "local_" + now.getTime().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
        const orders = loadLocalOrders();
        const newOrders: LocalOrder[] = items.map((i) => ({
          id,
          user_id: user.id,
          meal_name: i.name,
          quantity: i.quantity,
          pickup_slot: selectedSlot,
          total_tokens: i.price * i.quantity,
          payment_method: selectedPayment,
          status: "pending",
          created_at: now.toISOString(),
        }));
        saveLocalOrders([...newOrders, ...orders]);

        const orderId = "#MM" + id.slice(-6).toUpperCase();
        toast.success("Order confirmed! 🎉");
        clearCart();
        navigate("/qr-confirmation", {
          state: { orderId, meal: items.map((i) => `${i.name} ×${i.quantity}`).join(", "), slot: selectedSlot, amount: totalTokens },
        });
        return;
      }

      const { data: selectedAvailability, error: availabilityError } = await supabase.rpc("get_pickup_slot_availability", {
        slot_labels: [selectedSlot],
      });
      if (availabilityError) throw availabilityError;
      const selected = ((selectedAvailability ?? []) as SlotAvailabilityRow[])[0];
      if (selected && selected.is_full) {
        toast.error("Selected slot is full. Please choose another slot.");
        return;
      }

      // Look up meal_ids by name to keep order->meal relation valid.
      const { data: mealRows } = await supabase.from("meals").select("id, name").in("name", items.map((i) => i.name));
      const mealIdByName: Record<string, string> = {};
      ((mealRows || []) as MealLookupRow[]).forEach((m) => { mealIdByName[m.name] = m.id; });

      const rows = items.map((i) => ({
        user_id: user.id,
        meal_id: (UUID_RE.test(i.id) ? i.id : mealIdByName[i.name]) || null,
        meal_name: i.name,
        quantity: i.quantity,
        pickup_slot: selectedSlot,
        total_tokens: i.price * i.quantity,
        payment_method: selectedPayment,
        status: "pending",
      }));

      const { data, error } = await supabase.from("orders").insert(rows).select("id").limit(1);
      if (error) throw error;

      const firstId = data?.[0]?.id;
      const orderId = firstId ? "#MM" + firstId.slice(0, 6).toUpperCase() : "#MM" + Date.now();
      toast.success("Order confirmed! 🎉");
      clearCart();
      navigate("/qr-confirmation", {
        state: { orderId, meal: items.map((i) => `${i.name} ×${i.quantity}`).join(", "), slot: selectedSlot, amount: totalTokens },
      });
    } catch (err: unknown) {
      const rawMessage =
        err instanceof Error
          ? err.message
          : typeof (err as any)?.message === "string"
            ? (err as any).message
            : typeof (err as any)?.error_description === "string"
              ? (err as any).error_description
              : "";
      const status =
        (err as any)?.status ??
        (err as any)?.statusCode ??
        (err as any)?.code;
      const message =
        status === 401 || status === 403 || /jwt/i.test(rawMessage) || /not authenticated/i.test(rawMessage)
          ? "Please sign in again to place an order."
          : rawMessage || "Failed to place order";
      console.error("Order error:", err);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Confirm & Pay 💳</h1>
        <p className="text-muted-foreground text-sm font-medium">Review your order and choose payment method</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="rounded-3xl bg-card border border-border shadow-card">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-bold">Your Items</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 bg-secondary/50 rounded-2xl p-3">
                  <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded-xl" />
                  <div className="flex-1">
                    <p className="font-bold text-sm text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground font-medium">Qty: {item.quantity}</p>
                  </div>
                  <span className="font-bold text-accent text-sm">Rs {item.price * item.quantity}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl bg-card border border-border shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Pickup Time Slot
              </CardTitle>
              {showingTomorrowSlots && (
                <p className="text-xs text-muted-foreground font-medium">
                  Showing tomorrow&apos;s pickup slots (today&apos;s service window has ended).
                </p>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {slotUi.map((slot) => (
                <button
                  key={slot.label}
                  disabled={!slot.available}
                  onClick={() => setSelectedSlot(slot.label)}
                  className={`p-2.5 rounded-full text-sm font-bold transition-all ${
                    !slot.available ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : selectedSlot === slot.label ? "gradient-primary text-primary-foreground"
                    : "bg-secondary text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {slot.label}
                  {!slot.available && <span className="block text-[10px] mt-0.5 font-medium">{slot.statusLabel}</span>}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl bg-card border border-border shadow-card">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-bold">Payment Method</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedPayment(method.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                    selectedPayment === method.id
                      ? "border-2 border-primary bg-primary/5"
                      : "bg-secondary/50 hover:bg-secondary border-2 border-transparent"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    selectedPayment === method.id ? "gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}>
                    <method.icon className="h-4 w-4" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-sm text-foreground">{method.label}</p>
                    <p className="text-xs text-muted-foreground font-medium">{method.desc}</p>
                  </div>
                  {selectedPayment === method.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="rounded-3xl bg-card border border-border shadow-card sticky top-20">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-bold">Payment Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground font-medium">Subtotal</span><span className="font-bold">Rs {totalPrice}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground font-medium">Service Fee</span><span className="font-bold">Rs 20</span></div>
              {selectedSlot && <div className="flex justify-between text-sm"><span className="text-muted-foreground font-medium">Pickup</span><span className="font-bold text-primary">{selectedSlot}</span></div>}
              <div className="border-t pt-3 flex justify-between">
                <span className="font-bold">Total</span>
                <span className="font-bold text-accent text-lg">Rs {totalPrice + 20}</span>
              </div>
              <button
                onClick={handleConfirmOrder}
                disabled={!selectedSlot || submitting || slotLoading}
                className="w-full gradient-primary text-primary-foreground font-bold py-3 rounded-full flex items-center justify-center gap-2 hover:opacity-90 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {submitting ? "Placing order..." : "Confirm Order"}
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

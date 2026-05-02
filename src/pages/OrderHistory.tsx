import { useEffect, useState } from "react";
import { Clock, QrCode, RotateCcw, Eye, Filter, CalendarDays, Receipt, ShoppingBag, Loader2, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/context/CartContext";
import { imageForMeal } from "@/lib/mealImages";

interface OrderRow {
  id: string;
  meal_id: string | null;
  meal_name: string;
  quantity: number;
  pickup_slot: string;
  total_tokens: number;
  payment_method: string | null;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  completed: { bg: "bg-success/10", text: "text-success", icon: "✅", label: "Completed" },
  cancelled: { bg: "bg-destructive/10", text: "text-destructive", icon: "❌", label: "Cancelled" },
  pending: { bg: "bg-warning/10", text: "text-warning", icon: "⏳", label: "Pending" },
  preparing: { bg: "bg-warning/10", text: "text-warning", icon: "👨‍🍳", label: "Preparing" },
  ready: { bg: "bg-success/10", text: "text-success", icon: "🛎️", label: "Ready" },
};

const shortId = (id: string) => "#MM" + id.slice(0, 6).toUpperCase();
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function OrderHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [qrOrder, setQrOrder] = useState<OrderRow | null>(null);
  const [detailOrder, setDetailOrder] = useState<OrderRow | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data, error }) => {
      if (error) toast.error(error.message);
      else setOrders((data || []) as OrderRow[]);
      setLoading(false);
    });
  }, [user]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3 animate-fade-in">
        <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-bold">Please sign in to view your orders</h2>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (dateFilter !== "all") {
      const d = new Date(o.created_at);
      const now = new Date();
      const daysDiff = (now.getTime() - d.getTime()) / 86400000;
      if (dateFilter === "today" && daysDiff > 1) return false;
      if (dateFilter === "week" && daysDiff > 7) return false;
      if (dateFilter === "month" && daysDiff > 30) return false;
    }
    return true;
  });

  const completedCount = orders.filter((o) => o.status === "completed").length;
  const totalSpent = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total_tokens, 0);

  const handleReorder = (o: OrderRow) => {
    addItem({ id: o.meal_id || o.id, name: o.meal_name, price: o.total_tokens / Math.max(o.quantity, 1), image: imageForMeal(o.meal_name) });
    toast.success(`${o.meal_name} added to cart! 🔄`);
    navigate("/cart");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Orders 📋</h1>
        <p className="text-muted-foreground text-sm font-medium">View and manage your past orders</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl gradient-primary p-4 text-primary-foreground">
          <ShoppingBag className="h-5 w-5 mb-1 opacity-80" />
          <p className="text-2xl font-bold">{orders.length}</p>
          <p className="text-xs font-medium opacity-80">Total Orders</p>
        </div>
        <div className="rounded-2xl bg-success/15 p-4 text-success">
          <Receipt className="h-5 w-5 mb-1 opacity-80" />
          <p className="text-2xl font-bold">{completedCount}</p>
          <p className="text-xs font-medium opacity-80">Completed</p>
        </div>
        <div className="rounded-2xl bg-accent/15 p-4 text-accent">
          <CalendarDays className="h-5 w-5 mb-1 opacity-80" />
          <p className="text-2xl font-bold">Rs {totalSpent}</p>
          <p className="text-xs font-medium opacity-80">Total Spent</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <span className="rounded-full px-3 py-1.5 bg-secondary text-sm font-bold flex items-center gap-1.5 text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filter:
        </span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 rounded-full border-border h-9 text-sm font-medium"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="preparing">Preparing</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-32 rounded-full border-border h-9 text-sm font-medium"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-2">🍽️</p>
            <p className="text-muted-foreground text-sm font-medium">{orders.length === 0 ? "You haven't placed any orders yet." : "No orders match your filters."}</p>
          </div>
        )}
        {filteredOrders.map((order, i) => {
          const cfg = statusConfig[order.status] || statusConfig.pending;
          const canReorder = order.status === "completed" || order.status === "cancelled";
          return (
            <Card key={order.id} className="rounded-3xl bg-card border border-border overflow-hidden hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300" style={{ animationDelay: `${i * 0.05}s` }}>
              <CardContent className="p-5">
                <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
                  <div className="flex items-center gap-4">
                    <img src={imageForMeal(order.meal_name)} alt={order.meal_name} className="w-12 h-12 object-cover rounded-2xl flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-foreground">{order.meal_name}</h3>
                        <span className="text-xs text-muted-foreground font-medium">×{order.quantity}</span>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text}`}>{cfg.icon} {cfg.label}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-medium flex-wrap">
                        <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {formatDate(order.created_at)}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {order.pickup_slot}</span>
                        <span className="text-muted-foreground/50">|</span>
                        <span>{shortId(order.id)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="font-bold text-accent text-lg">Rs {order.total_tokens}</span>
                    <div className="flex gap-2 flex-wrap">
                      {(order.status === "completed" || order.status === "ready") && (
                        <button className="rounded-full px-3 py-1.5 text-xs font-bold bg-secondary border border-border flex items-center gap-1.5 hover:shadow-card hover:scale-105 transition-all" onClick={() => setQrOrder(order)}>
                          <QrCode className="h-3.5 w-3.5" /> QR
                        </button>
                      )}
                      {order.status === "completed" && (
                        <button className="rounded-full px-3 py-1.5 text-xs font-bold bg-warning/15 text-warning flex items-center gap-1.5 hover:scale-105 transition-all" onClick={() => navigate(`/rate-meal?orderId=${order.id}`)}>
                          <Star className="h-3.5 w-3.5" /> Rate
                        </button>
                      )}
                      {canReorder && (
                        <button className="rounded-full px-3 py-1.5 text-xs font-bold gradient-primary text-primary-foreground flex items-center gap-1.5 hover:opacity-90 hover:scale-105 transition-all" onClick={() => handleReorder(order)}>
                          <RotateCcw className="h-3.5 w-3.5" /> Reorder
                        </button>
                      )}
                      <button className="rounded-full px-3 py-1.5 text-xs font-bold bg-secondary border border-border flex items-center gap-1.5 hover:shadow-card hover:scale-105 transition-all" onClick={() => setDetailOrder(order)}>
                        <Eye className="h-3.5 w-3.5" /> Details
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!qrOrder} onOpenChange={() => setQrOrder(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle className="font-bold text-base">Order QR Code</DialogTitle></DialogHeader>
          {qrOrder && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="p-4 border-2 border-border rounded-2xl shadow-card">
                <QRCodeSVG value={JSON.stringify({ orderId: shortId(qrOrder.id), meal: qrOrder.meal_name, slot: qrOrder.pickup_slot, amount: qrOrder.total_tokens })} size={160} bgColor="white" fgColor="#FF8C42" level="M" />
              </div>
              <p className="text-sm font-bold">{shortId(qrOrder.id)} — {qrOrder.meal_name}</p>
              <p className="text-xs text-muted-foreground font-medium">Present at cafeteria counter 📱</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle className="font-bold text-base">Order Details</DialogTitle></DialogHeader>
          {detailOrder && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3">
                <img src={imageForMeal(detailOrder.meal_name)} alt={detailOrder.meal_name} className="w-12 h-12 object-cover rounded-xl" />
                <div>
                  <p className="font-bold text-foreground">{detailOrder.meal_name}</p>
                  <p className="text-xs text-muted-foreground font-medium">{shortId(detailOrder.id)}</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-border"><span className="text-muted-foreground font-medium">Date</span><span className="font-medium">{formatDate(detailOrder.created_at)}</span></div>
                <div className="flex justify-between py-2 border-b border-border"><span className="text-muted-foreground font-medium">Time Slot</span><span className="font-medium">{detailOrder.pickup_slot}</span></div>
                <div className="flex justify-between py-2 border-b border-border"><span className="text-muted-foreground font-medium">Quantity</span><span className="font-medium">{detailOrder.quantity}</span></div>
                <div className="flex justify-between py-2 border-b border-border"><span className="text-muted-foreground font-medium">Payment</span><span className="font-medium capitalize">{detailOrder.payment_method || "—"}</span></div>
                <div className="flex justify-between py-2 border-b border-border"><span className="text-muted-foreground font-medium">Amount</span><span className="font-bold text-accent">Rs {detailOrder.total_tokens}</span></div>
                <div className="flex justify-between py-2"><span className="text-muted-foreground font-medium">Status</span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${(statusConfig[detailOrder.status] || statusConfig.pending).bg} ${(statusConfig[detailOrder.status] || statusConfig.pending).text}`}>
                    {(statusConfig[detailOrder.status] || statusConfig.pending).icon} {(statusConfig[detailOrder.status] || statusConfig.pending).label}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

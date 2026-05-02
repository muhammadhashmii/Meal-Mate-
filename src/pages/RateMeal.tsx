import { useEffect, useState } from "react";
import { Star, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface OrderRow { id: string; meal_id: string | null; meal_name: string; created_at: string; status: string; }

export default function RateMeal() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get("orderId");
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(4);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const maxChars = 500;

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      let target: OrderRow | null = null;
      if (orderId) {
        const { data } = await supabase
          .from("orders")
          .select("id, meal_id, meal_name, created_at, status")
          .eq("id", orderId)
          .eq("user_id", user.id)
          .eq("status", "completed")
          .maybeSingle();
        target = data as OrderRow | null;
      } else {
        const { data } = await supabase.from("orders").select("id, meal_id, meal_name, created_at, status").eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle();
        target = data as OrderRow | null;
      }
      setOrder(target);
      if (target) {
        const { data: existing } = await supabase.from("ratings").select("rating, review_text").eq("user_id", user.id).eq("order_id", target.id).maybeSingle();
        if (existing) { setRating(existing.rating); setFeedback(existing.review_text || ""); setSubmitted(true); }
      }
      setLoading(false);
    })();
  }, [user, orderId]);

  const handleSubmit = async () => {
    if (!user || !order) return;
    if (order.status !== "completed") {
      toast.error("You can only rate completed orders.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("ratings").upsert({
      user_id: user.id,
      meal_id: order.meal_id,
      meal_name: order.meal_name,
      order_id: order.id,
      rating,
      review_text: feedback || null,
    }, { onConflict: "user_id,order_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setSubmitted(true);
    toast.success("Thank you! Your feedback has been saved 💕");
  };

  if (!user) return <div className="flex flex-col items-center justify-center min-h-[60vh]"><h2 className="text-xl font-bold">Please sign in to rate</h2></div>;
  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (!order) {
    return (
      <div className="max-w-xl mx-auto space-y-6 animate-fade-in text-center py-12">
        <p className="text-4xl">🍽️</p>
        <h2 className="text-xl font-bold">No completed order to rate yet</h2>
        <p className="text-muted-foreground text-sm font-medium">Once you've enjoyed a meal, come back to share your thoughts!</p>
        <button onClick={() => navigate("/order-history")} className="gradient-primary text-primary-foreground font-bold px-6 py-2.5 rounded-full text-sm">View Orders</button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Rate Your Meal ⭐</h1>
        <p className="text-muted-foreground text-sm font-medium">Share your feedback to help us improve</p>
      </div>

      <Card className="rounded-3xl bg-card border border-border shadow-card">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-bold">Order Details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground font-medium">Meal</span><span className="font-bold">{order.meal_name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground font-medium">Status</span><span className="font-bold flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> {order.status}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground font-medium">Date</span><span className="font-bold">{new Date(order.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span></div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl bg-card border border-border shadow-card">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-bold">Your Rating</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {submitted ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="h-14 w-14 text-success mx-auto" />
              <p className="text-lg font-bold">Feedback Saved! 🎉</p>
              <p className="text-sm text-muted-foreground font-medium">You rated this meal {rating}/5 stars.</p>
              <button onClick={() => setSubmitted(false)} className="text-primary text-sm font-bold hover:underline">Edit your rating</button>
            </div>
          ) : (
            <>
              <div className="flex justify-center gap-2">
                {[1,2,3,4,5].map((star) => (
                  <button key={star} onMouseEnter={() => setHoveredStar(star)} onMouseLeave={() => setHoveredStar(0)} onClick={() => setRating(star)} className="transition-transform duration-200 hover:scale-110">
                    <Star className={`h-10 w-10 ${star <= (hoveredStar || rating) ? "fill-warning text-warning" : "text-border"}`} />
                  </button>
                ))}
              </div>
              <p className="text-center text-sm text-muted-foreground font-medium">
                {rating === 5 ? "Excellent! 🤩" : rating === 4 ? "Very Good 😊" : rating === 3 ? "Average 😐" : rating === 2 ? "Below Average 😕" : "Poor 😞"}
              </p>
              <div className="space-y-2">
                <label className="text-sm font-bold">Feedback (Optional)</label>
                <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value.slice(0, maxChars))} placeholder="Write your feedback about the meal…" rows={4} className="rounded-2xl bg-secondary border-0 text-sm font-medium" />
                <p className="text-xs text-muted-foreground font-medium text-right">{feedback.length} / {maxChars}</p>
              </div>
              <button className="w-full gradient-primary text-primary-foreground font-bold py-2.5 rounded-full hover:opacity-90 hover:scale-[1.02] transition-all text-sm flex items-center justify-center gap-2" onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Feedback 💬
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

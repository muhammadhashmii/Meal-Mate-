import { useEffect, useMemo, useState } from "react";
import { Star, Plus, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { imageForMeal } from "@/lib/mealImages";

interface MealRow { id: string; name: string; price_tokens: number; avg_rating: number | null; rating_count: number | null; image_url: string | null; }

interface Rec { id: string; name: string; price: number; image: string; rating: number; orderCount: number; score: number; }

export function RecommendedSection() {
  const { addItem } = useCart();
  const { user } = useAuth();
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("meals").select("id, name, price_tokens, avg_rating, rating_count, image_url").eq("available", true);
      setMeals((data || []) as MealRow[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("orders").select("meal_name, quantity, created_at").eq("user_id", user.id).then(({ data }) => {
      if (!data) return;
      const now = Date.now();
      const counts: Record<string, number> = {};
      data.forEach((o) => {
        const ageDays = (now - new Date(o.created_at).getTime()) / 86400000;
        const recencyBoost = ageDays < 14 ? 1.5 : 1; // recent popularity
        counts[o.meal_name] = (counts[o.meal_name] || 0) + (o.quantity || 1) * recencyBoost;
      });
      setOrderCounts(counts);
    });
  }, [user]);

  const recommendations = useMemo<Rec[]>(() => {
    if (meals.length === 0) return [];
    const recs: Rec[] = meals.map((m) => {
      const rating = Number(m.avg_rating) || 0;
      const orderCount = orderCounts[m.name] || 0;
      // Highest-rated (50%) + your order frequency (30%) + global popularity proxy via rating_count (20%)
      const score = rating * 0.5 + Math.min(orderCount, 10) * 0.3 + Math.min(m.rating_count || 0, 20) * 0.05;
      return { id: m.id, name: m.name, price: m.price_tokens, image: imageForMeal(m.name, m.image_url), rating, orderCount, score };
    });
    return recs.sort((a,b) => b.score - a.score).slice(0, 3);
  }, [meals, orderCounts]);

  const handleAdd = (rec: Rec) => {
    addItem({ id: rec.id, name: rec.name, price: rec.price, image: rec.image });
    setAddedNames((prev) => new Set(prev).add(rec.name));
    toast.success(`${rec.name} added! ⭐`);
    setTimeout(() => setAddedNames((prev) => { const n = new Set(prev); n.delete(rec.name); return n; }), 400);
  };

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (recommendations.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Recommended For You ⭐
        </h2>
        <p className="text-sm text-muted-foreground font-medium">Picked based on your order history & top ratings</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recommendations.map((rec, i) => (
          <Card key={rec.id} className="relative bg-card rounded-3xl border-2 border-primary/20 overflow-hidden hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-full shadow-card">
              <Star className="h-3 w-3 fill-current" /> Top Pick
            </div>
            <div className="relative overflow-hidden">
              <img src={rec.image} alt={rec.name} className="w-full h-40 object-cover hover:scale-105 transition-transform duration-500" />
              {rec.rating > 0 && (
                <span className="absolute bottom-3 right-3 bg-card/95 backdrop-blur-sm text-foreground text-xs font-bold px-2.5 py-1 rounded-full border border-border flex items-center gap-1">
                  <Star className="h-3 w-3 fill-primary text-primary" />
                  {rec.rating.toFixed(1)}
                </span>
              )}
            </div>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-bold text-foreground text-base">{rec.name}</h3>
              <p className="text-xs text-muted-foreground font-medium">
                {rec.orderCount > 0 ? `You've ordered this ${Math.round(rec.orderCount)}× — a favorite!` : `Loved by students like you`}
              </p>
              <div className="flex items-center justify-between pt-2">
                <span className="font-bold text-accent text-lg">Rs {rec.price}</span>
                <button onClick={() => handleAdd(rec)} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all ${addedNames.has(rec.name) ? "animate-jiggle gradient-primary text-primary-foreground" : "gradient-primary text-primary-foreground hover:scale-105"}`}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

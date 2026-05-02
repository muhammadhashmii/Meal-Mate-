import { useEffect, useState } from "react";
import { RotateCcw, Plus, Calendar, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { imageForMeal } from "@/lib/mealImages";
import { toast } from "sonner";

interface ReorderItem {
  id: string;
  name: string;
  date: string;
  slot: string;
  price: number;
  image: string;
}

export function ReorderSection() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<ReorderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, meal_id, meal_name, pickup_slot, total_tokens, quantity, created_at")
        .eq("user_id", user.id)
        .in("status", ["completed", "cancelled"])
        .order("created_at", { ascending: false })
        .limit(5);

      const mapped: ReorderItem[] = (data || []).map((row) => ({
        id: (row.meal_id || row.id) as string,
        name: row.meal_name as string,
        date: new Date(row.created_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
        slot: row.pickup_slot as string,
        price: Math.round((row.total_tokens as number) / Math.max((row.quantity as number) || 1, 1)),
        image: imageForMeal(row.meal_name as string),
      }));
      setItems(mapped);
      setLoading(false);
    })();
  }, [user]);

  const handleReorder = (item: ReorderItem) => {
    addItem({ id: item.id, name: item.name, price: item.price, image: item.image });
    setAddedIds((prev) => new Set(prev).add(item.id));
    toast.success(`${item.name} added to cart! 🔄`);
    setTimeout(() => setAddedIds((prev) => { const n = new Set(prev); n.delete(item.id); return n; }), 400);
  };

  if (!user) return null;
  if (loading) return <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <RotateCcw className="h-5 w-5 text-primary" />
        Quick Reorder from History 💕
      </h2>

      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((item) => (
          <Card
            key={item.id}
            className="bg-card rounded-3xl border border-border overflow-hidden hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300"
          >
            <CardContent className="p-4 flex items-center gap-4">
              <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-2xl flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-foreground text-sm">{item.name}</h3>
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                  <Calendar className="h-3 w-3" />
                  {item.date} • {item.slot}
                </p>
                <p className="font-bold text-accent text-sm mt-1">Rs {item.price}</p>
              </div>
              <button
                onClick={() => handleReorder(item)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  addedIds.has(item.id)
                    ? "animate-jiggle gradient-primary text-primary-foreground"
                    : "bg-secondary border border-border text-foreground hover:shadow-card hover:scale-105"
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                Reorder
              </button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

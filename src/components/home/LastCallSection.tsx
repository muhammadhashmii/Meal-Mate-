import { useEffect, useState } from "react";
import { Flame, Plus, Timer, Loader2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { imageForMeal } from "@/lib/mealImages";
import { getKarachiYmd, pktWallTimeToUtc } from "@/lib/pktTime";

interface MealRow { id: string; name: string; price_tokens: number; discount_pct: number | null; stock: number | null; closing_time: string | null; image_url: string | null; }

interface DiscountedItem { id: string; name: string; emoji: string; price: number; originalPrice: number; image: string; discount: number; reason: string; }

const emojiFor = (name: string): string => {
  const lc = name.toLowerCase();
  if (lc.includes("biryani")) return "🍛";
  if (lc.includes("burger")) return "🍔";
  if (lc.includes("paratha")) return "🌯";
  if (lc.includes("samosa")) return "🔺";
  if (lc.includes("egg")) return "🍳";
  if (lc.includes("pasta")) return "🍝";
  if (lc.includes("salad")) return "🥗";
  if (lc.includes("panini")) return "🧀";
  if (lc.includes("tikka")) return "🍢";
  if (lc.includes("sandwich")) return "🥪";
  return "🍽️";
};

function parseClosingPkt(t: string | null, refMs: number): Date | null {
  if (!t) return null;
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const { y, m: mo, d } = getKarachiYmd(refMs);
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 6) h += 12;
  return pktWallTimeToUtc(y, mo, d, h, min);
}

function useCountdown(target: Date | null) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const tick = () => {
      if (!target) {
        setSeconds(0);
        return;
      }
      const diff = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
      setSeconds(diff);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LastCallSection() {
  const { addItem } = useCart();
  const [items, setItems] = useState<DiscountedItem[]>([]);
  const [nextClosingAt, setNextClosingAt] = useState<Date | null>(null);
  const countdown = useCountdown(nextClosingAt);
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("meals").select("id, name, price_tokens, discount_pct, stock, closing_time, image_url").eq("available", true);
      const meals = (data || []) as MealRow[];
      const now = Date.now();
      const list: DiscountedItem[] = [];

      let soonestClosing: Date | null = null;
      meals.forEach((m) => {
        const closing = parseClosingPkt(m.closing_time, now);
        const minutesToClose = closing ? (closing.getTime() - now) / 60000 : 999;
        const lowStock = (m.stock ?? 999) > 0 && (m.stock ?? 999) <= 10;
        const adminDiscount = (m.discount_pct ?? 0) > 0;
        const closingSoon = minutesToClose > 0 && minutesToClose <= 90;

        if (!adminDiscount && !lowStock && !closingSoon) return;

        // Auto-discount: admin > closing > stock
        let discount = m.discount_pct ?? 0;
        let reason = "Admin special";
        if (!adminDiscount && closingSoon) { discount = 25; reason = "Closing soon"; }
        else if (!adminDiscount && lowStock) { discount = 15; reason = "Low stock"; }

        if (closing && minutesToClose > 0 && (!soonestClosing || closing < soonestClosing)) {
          soonestClosing = closing;
        }
        const price = Math.round(m.price_tokens * (1 - discount / 100));
        list.push({ id: m.id, name: m.name, emoji: emojiFor(m.name), price, originalPrice: m.price_tokens, image: imageForMeal(m.name, m.image_url), discount, reason });
      });

      setItems(list.sort((a,b) => b.discount - a.discount).slice(0, 5));
      setNextClosingAt(soonestClosing);
      setLoading(false);
    })();
  }, []);

  const handleAdd = (item: DiscountedItem) => {
    addItem({ id: item.id, name: item.name, price: item.price, image: item.image });
    setAddedIds((prev) => new Set(prev).add(item.id));
    toast.success(`${item.name} added to cart! 🔥`);
    setTimeout(() => setAddedIds((prev) => { const n = new Set(prev); n.delete(item.id); return n; }), 400);
  };

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="rounded-3xl p-6 space-y-4" style={{ background: "linear-gradient(135deg, hsl(0 72% 60%), hsl(15 90% 65%))" }}>
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-primary-foreground flex items-center gap-2">
          <Flame className="h-5 w-5" /> Last Call — Discounted Items
        </h2>
        <span className="text-primary-foreground/80 text-sm font-bold flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5" /> (Ending in {countdown}!)
        </span>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between bg-primary-foreground/20 backdrop-blur-sm rounded-2xl px-5 py-4 hover:bg-primary-foreground/30 transition-all">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-primary-foreground text-base">{item.name}</h3>
              <span className="text-lg">{item.emoji}</span>
              <span className="text-primary-foreground/70 text-xs font-medium hidden sm:inline">• {item.reason}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-primary-foreground/70 text-sm line-through">Rs. {item.originalPrice}</span>
              <span className="bg-primary-foreground/20 text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-full">-{item.discount}% Rs. {item.price}</span>
              <button onClick={() => handleAdd(item)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${addedIds.has(item.id) ? "animate-jiggle bg-primary-foreground text-destructive scale-110" : "bg-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/50 hover:scale-110"}`}>
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

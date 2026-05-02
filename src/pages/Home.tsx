import { useEffect, useState } from "react";
import { Plus, Search, Clock, AlertTriangle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { imageForMeal } from "@/lib/mealImages";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import chickenBiryani from "@/assets/chicken-biryani.jpg";
import zingerBurger from "@/assets/zinger-burger.jpg";
import pastaAlfredo from "@/assets/pasta-alfredo.jpg";
import chickenKarahi from "@/assets/chicken-karahi.jpg";
import friedEgg from "@/assets/fried-egg.jpg";
import clubSandwich from "@/assets/club-sandwich.jpg";
import samosa from "@/assets/samosa.jpg";
import caesarSalad from "@/assets/caesar-salad.jpg";
import rollParatha from "@/assets/roll-paratha.jpg";
import panini from "@/assets/panini.jpg";
import chickenTikka from "@/assets/chicken-tikka.jpg";
import { LastCallSection } from "@/components/home/LastCallSection";
import { RecommendedSection } from "@/components/home/RecommendedSection";
import { Footer } from "@/components/home/Footer";
import { ReorderSection } from "@/components/home/ReorderSection";

const categories = ["All", "🍛 Desi", "🍔 Fast Food", "🍝 Italian", "🥗 Healthy", "🍳 Breakfast"];

type Diet = "Vegetarian" | "High-Protein" | "Gluten-Free";
type Allergen = "Nuts" | "Dairy" | "Gluten" | "Eggs" | "Soy";

interface MenuItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  image: string;
  category: string;
  emoji: string;
  available: string;
  diets: Diet[];
  allergens: Allergen[];
  ingredients: string[];
}

interface MealDbRow {
  id: string;
  name: string;
  description: string | null;
  price_tokens: number;
  category: string | null;
  image_url: string | null;
}

const dietFilters: { label: Diet; emoji: string }[] = [
  { label: "Vegetarian", emoji: "🥬" },
  { label: "High-Protein", emoji: "💪" },
  { label: "Gluten-Free", emoji: "🌾" },
];

const allergenColors: Record<Allergen, string> = {
  Nuts: "bg-amber-100 text-amber-800 border-amber-300",
  Dairy: "bg-blue-100 text-blue-800 border-blue-300",
  Gluten: "bg-orange-100 text-orange-800 border-orange-300",
  Eggs: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Soy: "bg-green-100 text-green-800 border-green-300",
};

const menuItems: MenuItem[] = [
  { id: "1", name: "Chicken Biryani", desc: "Fragrant basmati rice with tender chicken and traditional spices", price: 350, image: chickenBiryani, category: "Desi", emoji: "🍛", available: "1:00pm – 3:00pm", diets: ["High-Protein", "Gluten-Free"], allergens: ["Dairy"], ingredients: ["Basmati rice", "Chicken", "Yogurt", "Onions", "Tomatoes", "Biryani spices", "Saffron", "Mint"] },
  { id: "2", name: "Zinger Burger", desc: "Crispy zinger patty with fresh lettuce, mayo & pickles", price: 280, image: zingerBurger, category: "Fast Food", emoji: "🍔", available: "7:00am – 5:00pm", diets: ["High-Protein"], allergens: ["Gluten", "Eggs", "Dairy"], ingredients: ["Chicken breast", "Wheat bun", "Lettuce", "Mayonnaise", "Pickles", "Cheese", "Spice coating"] },
  { id: "3", name: "Pasta Alfredo", desc: "Creamy white sauce pasta with herbs and parmesan", price: 300, image: pastaAlfredo, category: "Italian", emoji: "🍝", available: "12:00pm – 4:00pm", diets: ["Vegetarian"], allergens: ["Gluten", "Dairy"], ingredients: ["Fettuccine pasta", "Cream", "Parmesan", "Butter", "Garlic", "Italian herbs"] },
  { id: "4", name: "Chicken Karahi", desc: "Traditional wok-cooked chicken with fresh spices & tomatoes", price: 420, image: chickenKarahi, category: "Desi", emoji: "🍲", available: "1:00pm – 3:00pm", diets: ["High-Protein", "Gluten-Free"], allergens: [], ingredients: ["Chicken", "Tomatoes", "Ginger", "Garlic", "Green chillies", "Karahi spices", "Coriander"] },
  { id: "5", name: "Fried Egg on Toast", desc: "Golden sunny-side-up egg on crispy buttered toast", price: 100, image: friedEgg, category: "Breakfast", emoji: "🍳", available: "7:00am – 10:00am", diets: ["Vegetarian", "High-Protein"], allergens: ["Gluten", "Eggs", "Dairy"], ingredients: ["Eggs", "Bread", "Butter", "Salt", "Pepper"] },
  { id: "6", name: "Club Sandwich", desc: "Triple-decker sandwich with chicken, cheese & veggies", price: 250, image: clubSandwich, category: "Fast Food", emoji: "🥪", available: "8:00am – 5:00pm", diets: ["High-Protein"], allergens: ["Gluten", "Dairy", "Eggs"], ingredients: ["Bread", "Chicken", "Cheese", "Lettuce", "Tomato", "Mayonnaise", "Cucumber"] },
  { id: "7", name: "Samosa", desc: "Crispy pastry filled with spiced potatoes & peas", price: 60, image: samosa, category: "Desi", emoji: "🔺", available: "10:00am – 4:00pm", diets: ["Vegetarian"], allergens: ["Gluten"], ingredients: ["Wheat flour", "Potatoes", "Peas", "Cumin", "Coriander", "Spices", "Vegetable oil"] },
  { id: "8", name: "Caesar Salad", desc: "Fresh romaine lettuce with croutons, parmesan & dressing", price: 220, image: caesarSalad, category: "Healthy", emoji: "🥗", available: "11:00am – 3:00pm", diets: ["Vegetarian"], allergens: ["Gluten", "Dairy", "Eggs"], ingredients: ["Romaine lettuce", "Croutons", "Parmesan", "Caesar dressing", "Black pepper"] },
  { id: "9", name: "Roll Paratha", desc: "Flaky paratha wrap stuffed with spiced chicken filling", price: 180, image: rollParatha, category: "Desi", emoji: "🌯", available: "12:00pm – 3:00pm", diets: ["High-Protein"], allergens: ["Gluten", "Dairy"], ingredients: ["Paratha (wheat)", "Chicken", "Onions", "Chutney", "Yogurt", "Spices"] },
  { id: "10", name: "Panini", desc: "Grilled Italian sandwich with melted cheese & herbs", price: 260, image: panini, category: "Italian", emoji: "🧀", available: "9:00am – 4:00pm", diets: ["Vegetarian"], allergens: ["Gluten", "Dairy"], ingredients: ["Ciabatta bread", "Mozzarella", "Tomato", "Basil", "Olive oil", "Italian herbs"] },
  { id: "11", name: "Chicken Tikka", desc: "Char-grilled chicken skewers with mint chutney & lemon", price: 380, image: chickenTikka, category: "Desi", emoji: "🍢", available: "1:00pm – 4:00pm", diets: ["High-Protein", "Gluten-Free"], allergens: ["Dairy"], ingredients: ["Chicken", "Yogurt", "Ginger", "Garlic", "Tikka spices", "Lemon", "Mint chutney"] },
];

export default function Home() {
  const { addItem } = useCart();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeDiets, setActiveDiets] = useState<Set<Diet>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [dbItems, setDbItems] = useState<MenuItem[] | null>(null);

  useEffect(() => {
    supabase.from("meals").select("id, name, description, price_tokens, category, image_url").eq("available", true).then(({ data }) => {
      if (!data || data.length === 0) { setDbItems(null); return; }
      const merged: MenuItem[] = (data as MealDbRow[]).map((m) => {
        // Reuse static metadata (diets/allergens/ingredients/available/emoji) when name matches
        const fallback = menuItems.find((s) => s.name === m.name);
        return {
          id: m.id,
          name: m.name,
          desc: m.description || fallback?.desc || "",
          price: m.price_tokens,
          image: imageForMeal(m.name, m.image_url),
          category: m.category || fallback?.category || "Desi",
          emoji: fallback?.emoji || "🍽️",
          available: fallback?.available || "All day",
          diets: fallback?.diets || [],
          allergens: fallback?.allergens || [],
          ingredients: fallback?.ingredients || [],
        };
      });
      setDbItems(merged);
    });
  }, []);
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);

  const toggleDiet = (d: Diet) => {
    setActiveDiets((prev) => {
      const n = new Set(prev);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });
  };

  const sourceItems = dbItems ?? menuItems;
  const filteredItems = sourceItems.filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "All" || activeCategory.includes(item.category);
    const matchDiet = activeDiets.size === 0 || Array.from(activeDiets).every((d) => item.diets.includes(d));
    return matchSearch && matchCat && matchDiet;
  });

  const handleAdd = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    addItem({ id: item.id, name: item.name, price: item.price, image: item.image });
    setAddedIds((prev) => new Set(prev).add(item.id));
    toast.success(`${item.name} added to cart! 🛒`);
    setTimeout(() => setAddedIds((prev) => { const n = new Set(prev); n.delete(item.id); return n; }), 400);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Today's Special Menu 🍊</h1>
        <p className="text-muted-foreground text-sm font-medium">Fresh, hot, made with love — browse & add to cart ✨</p>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search for something yummy... 🍴"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-full bg-card border border-border text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>

      {/* Category Chips */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
              activeCategory === cat
                ? "gradient-primary text-primary-foreground shadow-card"
                : "bg-card text-foreground border border-border hover:shadow-card hover:scale-105"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Dietary Filters */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">🥗 Dietary Preferences</p>
        <div className="flex gap-2 flex-wrap">
          {dietFilters.map(({ label, emoji }) => {
            const active = activeDiets.has(label);
            return (
              <button
                key={label}
                onClick={() => toggleDiet(label)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border ${
                  active
                    ? "bg-accent text-accent-foreground border-accent shadow-card scale-105"
                    : "bg-card text-foreground border-border hover:scale-105"
                }`}
              >
                {emoji} {label}
              </button>
            );
          })}
          {activeDiets.size > 0 && (
            <button
              onClick={() => setActiveDiets(new Set())}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear ✕
            </button>
          )}
        </div>
      </div>

      {/* Menu Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-3xl border border-border">
          <p className="text-4xl mb-2">🔍</p>
          <p className="font-bold text-foreground">No meals match your filters</p>
          <p className="text-sm text-muted-foreground">Try clearing some dietary filters</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item, i) => (
            <Card
              key={item.id}
              onClick={() => setDetailItem(item)}
              className="bg-card rounded-3xl border border-border overflow-hidden hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="relative overflow-hidden">
                <img src={item.image} alt={item.name} className="w-full h-44 object-cover hover:scale-105 transition-transform duration-500" />
                <span className="absolute top-3 left-3 bg-card/90 backdrop-blur-sm text-foreground text-xs font-bold px-2.5 py-1 rounded-full border border-border">
                  {item.emoji} {item.category}
                </span>
                {item.diets.length > 0 && (
                  <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
                    {item.diets.slice(0, 2).map((d) => (
                      <span key={d} className="bg-accent/95 text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                        {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-bold text-foreground text-base">{item.name}</h3>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed line-clamp-2">{item.desc}</p>

                {/* Allergen badges */}
                {item.allergens.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                    {item.allergens.map((a) => (
                      <span key={a} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${allergenColors[a]}`}>
                        {a}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <Clock className="h-3 w-3" />
                  {item.available}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="font-bold text-accent text-lg">Rs {item.price}</span>
                  <button
                    onClick={(e) => handleAdd(e, item)}
                    className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all border border-border ${
                      addedIds.has(item.id)
                        ? "animate-jiggle gradient-primary text-primary-foreground border-transparent"
                        : "bg-card text-foreground hover:shadow-card hover:scale-105"
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Meal Detail Modal */}
      <Dialog open={!!detailItem} onOpenChange={(o) => !o && setDetailItem(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          {detailItem && (
            <>
              <div className="relative -mx-6 -mt-6 mb-2">
                <img src={detailItem.image} alt={detailItem.name} className="w-full h-48 object-cover rounded-t-3xl" />
              </div>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  {detailItem.emoji} {detailItem.name}
                </DialogTitle>
                <DialogDescription className="font-medium">{detailItem.desc}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Diets */}
                {detailItem.diets.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground mb-1.5">Suitable For</p>
                    <div className="flex flex-wrap gap-1.5">
                      {detailItem.diets.map((d) => (
                        <span key={d} className="bg-accent/20 text-accent text-xs font-bold px-2.5 py-1 rounded-full border border-accent/30">
                          ✓ {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Allergens */}
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-destructive" /> Allergen Warnings
                  </p>
                  {detailItem.allergens.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {detailItem.allergens.map((a) => (
                        <span key={a} className={`text-xs font-bold px-2.5 py-1 rounded-full border ${allergenColors[a]}`}>
                          ⚠️ {a}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground font-medium">No common allergens 🎉</p>
                  )}
                </div>

                {/* Ingredients */}
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Info className="h-3 w-3" /> Ingredients
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {detailItem.ingredients.map((ing) => (
                      <span key={ing} className="bg-muted text-foreground text-xs font-medium px-2.5 py-1 rounded-full">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className="font-bold text-accent text-xl">Rs {detailItem.price}</span>
                  <button
                    onClick={(e) => { handleAdd(e, detailItem); setDetailItem(null); }}
                    className="flex items-center gap-1.5 gradient-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-bold hover:scale-105 transition-transform"
                  >
                    <Plus className="h-4 w-4" /> Add to Cart
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Recommended For You */}
      <RecommendedSection />

      {/* Quick reorder from your actual history */}
      <ReorderSection />

      {/* Last Call Discounted Items */}
      <LastCallSection />

      {/* Footer */}
      <Footer />
    </div>
  );
}

import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Cart() {
  const { items, updateQuantity, removeItem, totalPrice, totalItems } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center">
          <ShoppingBag className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Your cart is empty 🛒</h2>
        <p className="text-muted-foreground text-sm font-medium">Add some yummy items from the menu!</p>
        <button
          onClick={() => navigate("/")}
          className="gradient-primary text-primary-foreground font-bold px-6 py-2.5 rounded-full text-sm hover:opacity-90 hover:scale-105 transition-all"
        >
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">My Cart 🛒</h1>
        <p className="text-muted-foreground text-sm font-medium">{totalItems} item{totalItems > 1 ? "s" : ""} in your cart</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="rounded-3xl bg-card border border-border shadow-card">
              <CardContent className="p-4 flex items-center gap-4">
                <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-2xl" />
                <div className="flex-1">
                  <h3 className="font-bold text-foreground">{item.name}</h3>
                  <p className="font-bold text-accent text-lg mt-0.5">Rs {item.price}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center font-bold">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button onClick={() => removeItem(item.id)} className="w-8 h-8 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          <Card className="rounded-3xl bg-card border border-border shadow-card sticky top-20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">{item.name} × {item.quantity}</span>
                  <span className="font-bold">Rs {item.price * item.quantity}</span>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Service Fee</span>
                <span className="font-bold">Rs 20</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="font-bold">Total</span>
                <span className="font-bold text-accent text-lg">Rs {totalPrice + 20}</span>
              </div>
              <button
                onClick={() => navigate("/payment")}
                className="w-full gradient-primary text-primary-foreground font-bold py-2.5 rounded-full flex items-center justify-center gap-2 hover:opacity-90 hover:scale-[1.02] transition-all text-sm"
              >
                Proceed to Payment
                <ArrowRight className="h-4 w-4" />
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

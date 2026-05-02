import { Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-12 rounded-3xl gradient-primary p-8 text-primary-foreground">
      <div className="grid sm:grid-cols-3 gap-8 mb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <span className="text-sm">🍊</span>
            </div>
            <span className="text-lg font-bold">MealMate</span>
          </div>
          <p className="text-xs font-medium leading-relaxed opacity-90">
            Order Smarter, Eat Better, Reduce Waste 🌱
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="font-bold text-sm">Quick Links</h4>
          <ul className="space-y-1.5 text-xs font-medium opacity-90">
            <li><a href="/" className="hover:opacity-100 transition-opacity">Home</a></li>
            <li><a href="/order-history" className="hover:opacity-100 transition-opacity">Order History</a></li>
            <li><a href="/cart" className="hover:opacity-100 transition-opacity">Cart</a></li>
            <li><a href="/crowd-monitor" className="hover:opacity-100 transition-opacity">Crowd Monitor</a></li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="font-bold text-sm">Contact</h4>
          <ul className="space-y-1.5 text-xs font-medium opacity-90">
            <li>📧 support@isb.nu.edu.pk</li>
            <li>📍 FAST-NUCES, Islamabad</li>
            <li>🕐 Mon – Sat, 8am – 5pm</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-primary-foreground/20 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-medium opacity-90">
        <p>© 2026 MealMate. All rights reserved.</p>
        <p className="flex items-center gap-1">
          Made with <Heart className="h-3 w-3 fill-current" /> for FAST-NUCES
        </p>
      </div>
    </footer>
  );
}

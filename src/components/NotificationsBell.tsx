import { useEffect, useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Notif { id: string; type: string; title: string; message: string; read: boolean; created_at: string; }

const iconFor = (t: string) => t === "order_confirmed" ? "✅" : t === "order_cancelled" ? "❌" : t === "order_ready" ? "🛎️" : t === "order_completed" ? "🏁" : t === "discount" ? "🔥" : "🔔";

export function NotificationsBell() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);
  const unread = notifs.filter((n) => !n.read).length;

  const fetchNotifs = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return;
    setNotifs((data || []) as Notif[]);
  };

  useEffect(() => {
    if (!user) { setNotifs([]); return; }
    fetchNotifs();
    const channel = supabase.channel("notifs-rt").on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => fetchNotifs()).subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line
  }, [user]);

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    // Keep badge/UI responsive while request is in flight.
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    setLoading(true);
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setLoading(false);
    if (error) {
      // Restore server state if update failed.
      await fetchNotifs();
      return;
    }
    await fetchNotifs();
  };

  if (!user) {
    return (
      <button className="relative p-2 rounded-xl hover:bg-secondary transition-colors" disabled>
        <Bell className="h-5 w-5 text-muted-foreground" />
      </button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-xl hover:bg-secondary transition-colors" aria-label="Notifications">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">{unread}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <p className="font-bold text-sm">Notifications</p>
          {unread > 0 && (
            <button onClick={markAllRead} disabled={loading} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground font-medium">No notifications yet 🔕</div>
          ) : (
            notifs.map((n) => (
              <div key={n.id} className={`px-4 py-3 border-b border-border/50 last:border-0 ${n.read ? "bg-card" : "bg-primary/5"}`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg leading-none mt-0.5">{iconFor(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground font-medium">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/70 font-medium mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

import { useEffect, useState } from "react";
import { Users, TrendingDown, Info, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

interface Zone { id: string; zone_name: string; crowd_percentage: number; wait_minutes: number | null; updated_at: string; }

const colorFor = (pct: number) => pct >= 75 ? "hsl(0, 72%, 51%)" : pct >= 50 ? "hsl(38, 92%, 50%)" : "hsl(152, 55%, 42%)";
const labelFor = (pct: number) => pct >= 75 ? { label: "High Crowd", emoji: "🔴" } : pct >= 50 ? { label: "Moderate Crowd", emoji: "🟡" } : { label: "Low Crowd", emoji: "🟢" };

export default function CrowdMonitor() {
  const { user } = useAuth();
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrders, setActiveOrders] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [monthSpent, setMonthSpent] = useState(0);

  const fetchZones = async () => {
    const { data } = await supabase.from("crowd_levels").select("*").order("zone_name");
    setZones((data || []) as Zone[]);
  };

  useEffect(() => {
    fetchZones().then(() => setLoading(false));
    const channel = supabase.channel("crowd-rt").on("postgres_changes", { event: "*", schema: "public", table: "crowd_levels" }, () => fetchZones()).subscribe();
    const interval = setInterval(fetchZones, 30000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: all } = await supabase.from("orders").select("status, total_tokens, created_at").eq("user_id", user.id);
      if (!all) return;
      setTotalOrders(all.length);
      setActiveOrders(all.filter((o) => ["pending","preparing","ready"].includes(o.status)).length);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      setMonthSpent(all.filter((o) => o.status !== "cancelled" && new Date(o.created_at) >= monthStart).reduce((s, o) => s + o.total_tokens, 0));
    })();
  }, [user]);

  const main = zones.find((z) => z.zone_name === "Main Cafeteria") || [...zones].sort((a, b) => b.crowd_percentage - a.crowd_percentage)[0];
  const chartData = zones.map((z) => ({ time: z.zone_name, level: z.crowd_percentage, color: colorFor(z.crowd_percentage) }));
  const lowest = [...zones].sort((a,b) => a.crowd_percentage - b.crowd_percentage)[0];

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Crowd Monitor 👥</h1>
        <p className="text-muted-foreground text-sm font-medium">Live cafeteria status and your stats</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          { icon: Users, label: "Active Orders", value: String(activeOrders) },
          { icon: TrendingDown, label: "This Month Spent", value: `Rs ${monthSpent}` },
          { icon: Info, label: "Total Orders", value: String(totalOrders) },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-3xl bg-card border border-border shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center"><stat.icon className="h-5 w-5 text-primary" /></div>
              <div><p className="text-xs text-muted-foreground font-medium">{stat.label}</p><p className="text-xl font-bold">{stat.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl bg-card border border-border shadow-card">
        <CardHeader className="pb-3"><CardTitle className="text-base font-bold">Cafeteria Crowd Monitor</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {main && (() => {
            const meta = labelFor(main.crowd_percentage);
            return (
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-warning/10 border border-warning/20">
                <div className="h-12 w-12 rounded-2xl bg-warning/20 flex items-center justify-center"><span className="text-xl">{meta.emoji}</span></div>
                <div className="flex-1">
                  <p className="text-base font-bold text-foreground">{meta.label}</p>
                  <p className="text-sm text-muted-foreground font-medium">{main.zone_name}: ~{main.crowd_percentage}%</p>
                </div>
                <span className="rounded-full px-3 py-1.5 text-xs font-bold bg-muted text-muted-foreground">Est. wait: {main.wait_minutes ?? 0} min</span>
              </div>
            );
          })()}

          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-success/10 font-bold text-success text-xs">🟢 Low</span>
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-warning/10 font-bold text-warning text-xs">🟡 Moderate</span>
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-destructive/10 font-bold text-destructive text-xs">🔴 High</span>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(25, 20%, 90%)" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} label={{ value: "Crowd %", angle: -90, position: "insideLeft", fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="level" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {lowest && (
            <div className="flex items-center gap-3 p-3 bg-success/10 rounded-2xl border border-success/20">
              <span className="text-lg">💡</span>
              <p className="text-sm font-bold text-success">Least crowded right now: <strong>{lowest.zone_name}</strong> ({lowest.crowd_percentage}%) — head there for a quick pickup!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

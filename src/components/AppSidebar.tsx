import { Home, ShoppingCart, Clock, Star, XCircle, Users } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Home", url: "/", icon: Home },
  { title: "My Cart", url: "/cart", icon: ShoppingCart },
  { title: "Order History", url: "/order-history", icon: Clock },
  { title: "Rate Meal", url: "/rate-meal", icon: Star },
  { title: "Cancel Order", url: "/cancel-order", icon: XCircle },
  { title: "Crowd Monitor", url: "/crowd-monitor", icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-card border-r border-border flex flex-col">
        <div className="p-4 flex items-center gap-2 border-b border-border">
          <div className="w-9 h-9 rounded-2xl gradient-primary flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🍊</span>
          </div>
          {!collapsed && <span className="font-bold text-foreground text-base">MealMate</span>}
        </div>
        <SidebarGroup className="flex-1">
          <SidebarGroupLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="rounded-xl transition-all duration-150 font-semibold hover:bg-secondary"
                      activeClassName="gradient-primary text-primary-foreground font-bold hover:!bg-none hover:!bg-accent hover:!text-accent-foreground"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

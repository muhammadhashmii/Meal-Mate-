import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { HeaderAuthDropdown } from "@/components/HeaderAuthDropdown";
import { NotificationsBell } from "@/components/NotificationsBell";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="flex items-center justify-between px-6 py-3 bg-card border-b border-border sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-foreground hover:bg-secondary rounded-xl" />
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl gradient-primary flex items-center justify-center">
                  <span className="text-lg">🍊</span>
                </div>
                <span className="text-lg font-bold text-foreground">MealMate</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <NotificationsBell />
              <div className="h-6 w-px bg-border" />
              <HeaderAuthDropdown />
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

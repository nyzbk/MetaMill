import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  FileText,
  Sparkles,
  CalendarClock,
  FlaskConical,
  Factory,
  Settings,
} from "lucide-react";

const navItems = [
  { title: "Панель", url: "/", icon: LayoutDashboard },
  { title: "Аккаунты", url: "/accounts", icon: Users },
  { title: "Шаблоны", url: "/templates", icon: FileText },
  { title: "AI Генератор", url: "/generator", icon: Sparkles },
  { title: "Авто-постинг", url: "/scheduler", icon: CalendarClock },
  { title: "Тест треда", url: "/test", icon: FlaskConical },
  { title: "Настройки", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-white/10">
            <Factory className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white" data-testid="text-app-name">MetaMill</span>
            <span className="block text-[11px] text-muted-foreground font-mono tracking-wider">ФАБРИКА КОНТЕНТА</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-4">Навигация</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={isActive}>
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-2 px-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-muted-foreground">Система активна</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

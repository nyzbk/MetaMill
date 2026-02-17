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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Users,
  FileText,
  Sparkles,
  CalendarClock,
  FlaskConical,
  Factory,
  Settings,
  Search,
  LogOut,
  TrendingUp,
  Radar,
  BookOpen,
  Link2,
  BarChart3,
} from "lucide-react";

const mainItems = [
  { title: "Панель", url: "/", icon: LayoutDashboard },
  { title: "Аккаунты", url: "/accounts", icon: Users },
  { title: "Шаблоны", url: "/templates", icon: FileText },
  { title: "AI Генератор", url: "/generator", icon: Sparkles },
  { title: "Авто-постинг", url: "/scheduler", icon: CalendarClock },
  { title: "Аналитика", url: "/analytics", icon: BarChart3 },
];

const toolItems = [
  { title: "Тренды", url: "/trends", icon: TrendingUp },
  { title: "Мониторинг", url: "/monitoring", icon: Radar },
  { title: "Переработка", url: "/repurpose", icon: Link2 },
  { title: "Исследование", url: "/research", icon: Search },
  { title: "Тест треда", url: "/test", icon: FlaskConical },
];

const systemItems = [
  { title: "Meta API", url: "/meta-wizard", icon: BookOpen },
  { title: "Настройки", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map(n => n![0])
    .join("")
    .toUpperCase() || "U";

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Пользователь";

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
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-4">Основное</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
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
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-4">Инструменты</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolItems.map((item) => {
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
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-4">Система</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map((item) => {
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
      <SidebarFooter className="p-3 space-y-2">
        <div className="flex items-center gap-2 px-2">
          <Avatar className="w-7 h-7">
            <AvatarImage src={user?.profileImageUrl || undefined} alt={displayName} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" data-testid="text-user-name">{displayName}</p>
            {user?.email && (
              <p className="text-[10px] text-muted-foreground truncate" data-testid="text-user-email">{user.email}</p>
            )}
          </div>
        </div>
        <a href="/api/logout" data-testid="button-logout">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
            <LogOut className="w-4 h-4" />
            <span>Выйти</span>
          </Button>
        </a>
      </SidebarFooter>
    </Sidebar>
  );
}

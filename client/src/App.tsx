import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { Loader2 } from "lucide-react";
import Dashboard from "@/pages/dashboard";
import Accounts from "@/pages/accounts";
import Templates from "@/pages/templates";
import Generator from "@/pages/generator";
import Scheduler from "@/pages/scheduler";
import ThreadTest from "@/pages/thread-test";
import SettingsPage from "@/pages/settings";
import Research from "@/pages/research";
import Trends from "@/pages/trends";
import Monitoring from "@/pages/monitoring";
import MetaWizard from "@/pages/meta-wizard";
import Repurpose from "@/pages/repurpose";
import Analytics from "@/pages/analytics";
import Carousel from "@/pages/carousel";
import AutoComments from "@/pages/auto-comments";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/accounts" component={Accounts} />
      <Route path="/templates" component={Templates} />
      <Route path="/generator" component={Generator} />
      <Route path="/scheduler" component={Scheduler} />
      <Route path="/research" component={Research} />
      <Route path="/trends" component={Trends} />
      <Route path="/monitoring" component={Monitoring} />
      <Route path="/meta-wizard" component={MetaWizard} />
      <Route path="/repurpose" component={Repurpose} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/carousel" component={Carousel} />
      <Route path="/auto-comments" component={AutoComments} />
      <Route path="/test" component={ThreadTest} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

const sidebarStyle = {
  "--sidebar-width": "15rem",
  "--sidebar-width-icon": "3rem",
};

function AuthenticatedApp() {
  useNotifications();
  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-2 h-12 px-4 border-b border-border flex-shrink-0 sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <span className="text-xs text-muted-foreground font-mono tracking-wider">METAMILL v1.0</span>
          </header>
          <main className="flex-1 overflow-y-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Landing />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

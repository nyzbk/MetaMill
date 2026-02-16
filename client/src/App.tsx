import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Dashboard from "@/pages/dashboard";
import Accounts from "@/pages/accounts";
import Templates from "@/pages/templates";
import Generator from "@/pages/generator";
import Scheduler from "@/pages/scheduler";
import ThreadTest from "@/pages/thread-test";
import SettingsPage from "@/pages/settings";
import Research from "@/pages/research";
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
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
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

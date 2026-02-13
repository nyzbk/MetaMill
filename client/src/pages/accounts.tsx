import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, MoreHorizontal, Wifi, WifiOff, AtSign } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Account } from "@shared/schema";

export default function Accounts() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState("threads");
  const [accessToken, setAccessToken] = useState("");

  const { data: accounts, isLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/accounts", { username, platform, accessToken: accessToken || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setOpen(false);
      setUsername("");
      setAccessToken("");
      toast({ title: "Аккаунт добавлен" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "Аккаунт удалён" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Аккаунты</h1>
          <p className="text-sm text-muted-foreground mt-1">Управление подключёнными аккаунтами Threads и Instagram</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-account">
              <Plus className="w-4 h-4 mr-2" />
              Добавить аккаунт
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить аккаунт</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Имя пользователя</Label>
                <Input
                  placeholder="@username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  data-testid="input-username"
                />
              </div>
              <div className="space-y-2">
                <Label>Платформа</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger data-testid="select-platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="threads">Threads</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Токен доступа (опционально)</Label>
                <Input
                  placeholder="Meta API access token"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  type="password"
                  data-testid="input-access-token"
                />
                <p className="text-xs text-muted-foreground">Необходим для публикации. Получите в Meta Developer Portal.</p>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={!username || createMutation.isPending}
                data-testid="button-submit-account"
              >
                {createMutation.isPending ? "Добавление..." : "Добавить"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {accounts && accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <Card key={acc.id} className="overflow-visible" data-testid={`card-account-${acc.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
                        {acc.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">@{acc.username}</p>
                      <p className="text-xs text-muted-foreground capitalize">{acc.platform}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" data-testid={`button-menu-account-${acc.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(acc.id)}
                        data-testid={`button-delete-account-${acc.id}`}
                      >
                        Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5">
                    {acc.status === "active" ? (
                      <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <Badge variant="secondary" className={acc.status === "active" ? "bg-emerald-500/15 text-emerald-400" : ""}>
                      {acc.status === "active" ? "Онлайн" : "Офлайн"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <AtSign className="w-3.5 h-3.5" />
                    <span>{acc.postsCount ?? 0} постов</span>
                  </div>
                </div>

                {!acc.accessToken && (
                  <div className="mt-3 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs text-amber-400">Нет API токена — публикация отключена</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-visible">
          <CardContent className="p-12 text-center">
            <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <h3 className="font-semibold mb-1">Нет подключённых аккаунтов</h3>
            <p className="text-sm text-muted-foreground">Добавьте первый аккаунт Threads или Instagram для публикации</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Users(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

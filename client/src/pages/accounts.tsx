import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, MoreHorizontal, Wifi, WifiOff, AtSign, Link2, Shield, ShieldCheck, AlertTriangle, RefreshCw, Loader2, Clock, ExternalLink, BookOpen, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import type { Account } from "@shared/schema";
import { HelpButton } from "@/components/help-button";

function getTokenStatus(account: Account): { label: string; color: string; icon: typeof ShieldCheck; urgent: boolean } {
  if (!account.accessToken) {
    return { label: "Нет токена", color: "text-red-400", icon: AlertTriangle, urgent: true };
  }
  if (account.threadsUserId && account.tokenExpiresAt) {
    const expiresAt = new Date(account.tokenExpiresAt);
    const now = new Date();
    const daysLeft = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) {
      return { label: "Токен истёк", color: "text-red-400", icon: AlertTriangle, urgent: true };
    }
    if (daysLeft < 7) {
      return { label: `Истекает через ${daysLeft}д`, color: "text-amber-400", icon: Clock, urgent: true };
    }
    return { label: `OAuth (${daysLeft}д)`, color: "text-emerald-400", icon: ShieldCheck, urgent: false };
  }
  if (account.threadsUserId) {
    return { label: "OAuth подключён", color: "text-emerald-400", icon: ShieldCheck, urgent: false };
  }
  return { label: "Ручной токен", color: "text-amber-400", icon: Shield, urgent: false };
}

export default function Accounts() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState("threads");
  const [accessToken, setAccessToken] = useState("");

  const { data: authStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/auth/threads/status"],
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_success")) {
      toast({ title: "Аккаунт успешно подключён через Threads OAuth" });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      window.history.replaceState({}, "", "/accounts");
    }
    if (params.get("auth_error")) {
      const errorMsg = decodeURIComponent(params.get("auth_error") || "");
      let description = errorMsg;
      if (errorMsg.includes("session_expired")) description = "Сессия истекла. Войдите заново и попробуйте ещё раз.";
      else if (errorMsg.includes("invalid_state")) description = "Ошибка проверки безопасности. Попробуйте ещё раз.";
      else if (errorMsg.includes("missing_params")) description = "Meta не вернул нужные данные. Проверьте настройки приложения.";
      toast({ title: "Ошибка авторизации Threads", description, variant: "destructive" });
      window.history.replaceState({}, "", "/accounts");
    }
  }, []);

  const connectThreads = async () => {
    try {
      const res = await apiRequest("GET", "/api/auth/threads");
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        toast({
          title: "Авторизация открыта",
          description: "Окно авторизации Threads открыто в новой вкладке. После подтверждения вы будете перенаправлены обратно.",
        });
      }
    } catch (e: any) {
      toast({
        title: "Ошибка",
        description: e.message || "Не удалось начать авторизацию. Проверьте настройки Meta API.",
        variant: "destructive",
      });
    }
  };

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

  const refreshTokenMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/accounts/${id}/refresh-token`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "Токен обновлён" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка обновления токена", description: e.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Аккаунты</h1>
            <HelpButton
              title="Помощь: Аккаунты"
              sections={[
                { title: "Что это?", content: "Раздел для управления вашими аккаунтами Threads и Instagram. Здесь вы подключаете аккаунты через Meta API для публикации контента." },
                { title: "Как подключить аккаунт?", content: "1. Сначала настройте Meta API через раздел «Мета API» в боковом меню\n2. Нажмите «Добавить аккаунт» → выберите платформу Threads\n3. Нажмите «Подключить через OAuth» для авторизации\n4. После авторизации аккаунт появится в списке со статусом «Активен»" },
                { title: "Зачем нужен?", content: "Без подключённого аккаунта невозможно публиковать контент в Threads. Аккаунт хранит токен доступа, который позволяет публиковать от вашего имени." },
                { title: "Статус токена", content: "Зелёный — токен активен, всё работает\nЖёлтый — токен скоро истечёт, обновите его\nКрасный — токен истёк или отсутствует, нужна повторная авторизация" },
              ]}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Управление подключёнными аккаунтами Threads и Instagram</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {authStatus?.configured ? (
            <Button
              variant="outline"
              onClick={connectThreads}
              data-testid="button-connect-threads"
            >
              <Link2 className="w-4 h-4 mr-2" />
              Подключить Threads OAuth
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setLocation("/meta-wizard")}
              data-testid="button-setup-meta"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Настроить Meta API
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" data-testid="button-add-account">
                <Plus className="w-4 h-4 mr-2" />
                Вручную
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Добавить аккаунт вручную</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Имя пользователя</Label>
                  <Input
                    placeholder="username (без @)"
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
                  <p className="text-xs text-muted-foreground">Без токена публикация будет недоступна. Лучше подключите через OAuth.</p>
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
      </div>

      {!authStatus?.configured && (
        <Card className="overflow-visible border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-400">Meta API не настроен</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Для подключения Threads через OAuth нужно настроить Meta App ID и Secret.
                  Перейдите в{" "}
                  <button onClick={() => setLocation("/meta-wizard")} className="text-[hsl(263,70%,50%)] underline" data-testid="link-meta-wizard">
                    мастер настройки
                  </button>{" "}
                  для пошаговой инструкции.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {accounts && accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => {
            const tokenStatus = getTokenStatus(acc);
            const TokenIcon = tokenStatus.icon;

            return (
              <Card key={acc.id} className="overflow-visible" data-testid={`card-account-${acc.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        {acc.avatarUrl && <AvatarImage src={acc.avatarUrl} />}
                        <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
                          {acc.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" data-testid={`text-username-${acc.id}`}>@{acc.username}</p>
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
                        {acc.accessToken && acc.threadsUserId && (
                          <DropdownMenuItem
                            onClick={() => refreshTokenMutation.mutate(acc.id)}
                            disabled={refreshTokenMutation.isPending}
                            data-testid={`button-refresh-token-${acc.id}`}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Обновить токен
                          </DropdownMenuItem>
                        )}
                        {acc.platform === "threads" && acc.username && (
                          <DropdownMenuItem asChild>
                            <a href={`https://www.threads.net/@${acc.username}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Открыть в Threads
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(acc.id)}
                          data-testid={`button-delete-account-${acc.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {acc.status === "active" ? (
                        <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      <Badge variant="secondary" className={acc.status === "active" ? "bg-emerald-500/15 text-emerald-400" : ""}>
                        {acc.status === "active" ? "Активен" : "Неактивен"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <AtSign className="w-3.5 h-3.5" />
                      <span>{acc.postsCount ?? 0} постов</span>
                    </div>
                  </div>

                  <div className={`mt-3 p-2.5 rounded-md ${
                    tokenStatus.urgent
                      ? tokenStatus.color.includes("red") ? "bg-red-500/10 border border-red-500/20" : "bg-amber-500/10 border border-amber-500/20"
                      : tokenStatus.color.includes("emerald") ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-amber-500/10 border border-amber-500/20"
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <TokenIcon className={`w-3.5 h-3.5 ${tokenStatus.color}`} />
                        <p className={`text-xs ${tokenStatus.color}`}>{tokenStatus.label}</p>
                      </div>
                      {tokenStatus.urgent && acc.accessToken && acc.threadsUserId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => refreshTokenMutation.mutate(acc.id)}
                          disabled={refreshTokenMutation.isPending}
                          data-testid={`button-quick-refresh-${acc.id}`}
                        >
                          {refreshTokenMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            "Обновить"
                          )}
                        </Button>
                      )}
                      {!acc.accessToken && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={authStatus?.configured ? connectThreads : () => setLocation("/meta-wizard")}
                          data-testid={`button-quick-connect-${acc.id}`}
                        >
                          Подключить
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-visible">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <AtSign className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <h3 className="font-semibold mb-1">Нет подключённых аккаунтов</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              {authStatus?.configured
                ? "Подключите аккаунт Threads через OAuth для безопасной публикации контента"
                : "Сначала настройте Meta API, затем подключите аккаунт Threads"}
            </p>
            <div className="flex items-center justify-center gap-3">
              {authStatus?.configured ? (
                <Button onClick={connectThreads} data-testid="button-connect-empty">
                  <Link2 className="w-4 h-4 mr-2" />
                  Подключить Threads
                </Button>
              ) : (
                <Button onClick={() => setLocation("/meta-wizard")} data-testid="button-setup-empty">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Настроить Meta API
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

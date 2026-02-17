import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TrendingUp, RefreshCw, ExternalLink, Sparkles, Loader2, Flame, CalendarPlus, CheckSquare } from "lucide-react";
import { useLocation } from "wouter";
import type { TrendItem, Account } from "@shared/schema";
import { HelpButton } from "@/components/help-button";

const SOURCE_COLORS: Record<string, string> = {
  HackerNews: "bg-orange-500/15 text-orange-400",
  TechCrunch: "bg-emerald-500/15 text-emerald-400",
};

function getSourceColor(source: string): string {
  if (source.startsWith("Reddit")) return "bg-red-500/15 text-red-400";
  return SOURCE_COLORS[source] || "bg-muted text-muted-foreground";
}

export default function Trends() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedTrends, setSelectedTrends] = useState<Set<number>>(new Set());
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchAccountId, setBatchAccountId] = useState("");
  const [batchStyle, setBatchStyle] = useState("casual");
  const [batchBranches, setBatchBranches] = useState(5);
  const [batchInterval, setBatchInterval] = useState(60);
  const [batchRecurrence, setBatchRecurrence] = useState("once");
  const [batchDate, setBatchDate] = useState(() => {
    const d = new Date(Date.now() + 3600000);
    return d.toISOString().slice(0, 16);
  });

  const { data: trends, isLoading } = useQuery<TrendItem[]>({
    queryKey: ["/api/trends"],
  });

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trends/refresh");
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trends"] });
      toast({ title: `Обновлено: ${data.refreshed} трендов` });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка обновления", description: e.message, variant: "destructive" });
    },
  });

  const batchScheduleMutation = useMutation({
    mutationFn: async () => {
      if (!batchAccountId) throw new Error("Выберите аккаунт");
      if (selectedTrends.size === 0) throw new Error("Выберите тренды");
      const trendTopics = trends?.filter(t => selectedTrends.has(t.id)).map(t => t.title) || [];
      const parsedDate = new Date(batchDate);
      if (isNaN(parsedDate.getTime())) throw new Error("Некорректная дата");
      await apiRequest("POST", "/api/batch-schedule", {
        trends: trendTopics,
        accountId: batchAccountId,
        style: batchStyle,
        branches: batchBranches,
        scheduledAt: parsedDate.toISOString(),
        intervalMinutes: batchInterval,
        isRecurring: batchRecurrence !== "once",
        cronExpression: batchRecurrence === "daily" ? "0 */24 * * *" : batchRecurrence === "weekly" ? "0 0 * * 1" : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setShowBatchDialog(false);
      setSelectedTrends(new Set());
      toast({ title: "Пакетное планирование", description: `${selectedTrends.size} трендов добавлены в планировщик` });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const useInGenerator = (title: string) => {
    sessionStorage.setItem("generator_topic", title);
    setLocation("/generator");
  };

  const toggleTrend = (id: number) => {
    setSelectedTrends(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!trends) return;
    if (selectedTrends.size === trends.length) {
      setSelectedTrends(new Set());
    } else {
      setSelectedTrends(new Set(trends.map(t => t.id)));
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Тренды</h1>
            <HelpButton
              title="Помощь: Тренды"
              sections={[
                { title: "Что это?", content: "Агрегатор актуальных тем и новостей из HackerNews, Reddit и TechCrunch. Помогает находить трендовые темы для создания контента." },
                { title: "Как пользоваться?", content: "1. Нажмите «Обновить» для загрузки свежих трендов\n2. Просмотрите список актуальных тем\n3. Нажмите «Создать тред» рядом с интересной темой\n4. Или выберите несколько трендов и запланируйте пакетно" },
                { title: "Пакетное планирование", content: "Отметьте чекбоксами нужные тренды, нажмите «Запланировать выбранные» — система создаст шаблоны и задачи с интервалом между публикациями." },
              ]}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Актуальные темы для контента из HackerNews, Reddit и TechCrunch</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedTrends.size > 0 && (
            <Button
              variant="default"
              onClick={() => setShowBatchDialog(true)}
              data-testid="button-batch-schedule"
            >
              <CalendarPlus className="w-4 h-4 mr-2" />
              Запланировать ({selectedTrends.size})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            data-testid="button-refresh-trends"
          >
            {refreshMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Обновить
          </Button>
        </div>
      </div>

      {trends && trends.length > 0 && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={toggleAll} data-testid="button-toggle-all">
            <CheckSquare className="w-4 h-4 mr-1.5" />
            {selectedTrends.size === trends.length ? "Снять все" : "Выбрать все"}
          </Button>
          {selectedTrends.size > 0 && (
            <span className="text-xs text-muted-foreground">Выбрано: {selectedTrends.size}</span>
          )}
        </div>
      )}

      {trends && trends.length > 0 ? (
        <div className="space-y-3">
          {trends.map((item) => (
            <Card key={item.id} className="overflow-visible" data-testid={`card-trend-${item.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="pt-0.5">
                    <Checkbox
                      checked={selectedTrends.has(item.id)}
                      onCheckedChange={() => toggleTrend(item.id)}
                      data-testid={`checkbox-trend-${item.id}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="secondary" className={getSourceColor(item.source)}>
                        {item.source}
                      </Badge>
                      {(item.score ?? 0) > 100 && (
                        <Badge variant="secondary" className="bg-amber-500/15 text-amber-400">
                          <Flame className="w-3 h-3 mr-1" />
                          {item.score}
                        </Badge>
                      )}
                      {item.category && item.category !== "story" && item.category !== "general" && item.category !== "news" && (
                        <Badge variant="secondary">{item.category}</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium" data-testid={`text-trend-title-${item.id}`}>{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => useInGenerator(item.title)}
                      data-testid={`button-use-trend-${item.id}`}
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      Создать тред
                    </Button>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        <Button size="icon" variant="ghost" data-testid={`button-open-trend-${item.id}`}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-visible">
          <CardContent className="p-12 text-center">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <h3 className="font-semibold mb-1">Трендов пока нет</h3>
            <p className="text-sm text-muted-foreground mb-4">Нажмите «Обновить» чтобы загрузить актуальные тренды</p>
            <Button onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending} data-testid="button-refresh-empty">
              {refreshMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Загрузить тренды
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Пакетное планирование</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {selectedTrends.size} трендов будут запланированы с интервалом
            </p>
            <div className="space-y-2">
              <Label>Аккаунт</Label>
              <Select value={batchAccountId} onValueChange={setBatchAccountId}>
                <SelectTrigger data-testid="select-batch-account">
                  <SelectValue placeholder="Выберите аккаунт" />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.map((acc) => (
                    <SelectItem key={acc.id} value={String(acc.id)}>
                      {acc.username} ({acc.platform})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Стиль</Label>
                <Select value={batchStyle} onValueChange={setBatchStyle}>
                  <SelectTrigger data-testid="select-batch-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="humorous">Humorous</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                    <SelectItem value="storytelling">Storytelling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Веток в треде</Label>
                <Input
                  type="number"
                  min={2}
                  max={25}
                  value={batchBranches}
                  onChange={(e) => setBatchBranches(parseInt(e.target.value) || 5)}
                  data-testid="input-batch-branches"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Дата первой публикации</Label>
              <Input
                type="datetime-local"
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
                data-testid="input-batch-date"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Интервал (минут)</Label>
                <Input
                  type="number"
                  min={15}
                  max={1440}
                  value={batchInterval}
                  onChange={(e) => setBatchInterval(parseInt(e.target.value) || 60)}
                  data-testid="input-batch-interval"
                />
              </div>
              <div className="space-y-2">
                <Label>Повторение</Label>
                <Select value={batchRecurrence} onValueChange={setBatchRecurrence}>
                  <SelectTrigger data-testid="select-batch-recurrence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Однократно</SelectItem>
                    <SelectItem value="daily">Ежедневно</SelectItem>
                    <SelectItem value="weekly">Еженедельно</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => batchScheduleMutation.mutate()}
              disabled={!batchAccountId || batchScheduleMutation.isPending}
              data-testid="button-confirm-batch-schedule"
            >
              {batchScheduleMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CalendarPlus className="w-4 h-4 mr-2" />
              )}
              Запланировать {selectedTrends.size} трендов
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageCircle, Plus, Trash2, Play, Pause, Loader2, Clock, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle, BarChart3, Timer, RefreshCw } from "lucide-react";
import type { CommentCampaign, CommentLog, Account } from "@shared/schema";
import { HelpButton } from "@/components/help-button";

const STYLES = [
  { value: "helpful", label: "Полезный" },
  { value: "witty", label: "Остроумный" },
  { value: "supportive", label: "Поддерживающий" },
  { value: "question", label: "Вопросы" },
  { value: "expert", label: "Экспертный" },
];

const INTERVALS = [
  { value: "0", label: "Вручную" },
  { value: "60", label: "Каждый час" },
  { value: "120", label: "Каждые 2 часа" },
  { value: "240", label: "Каждые 4 часа" },
  { value: "360", label: "Каждые 6 часов" },
  { value: "720", label: "Каждые 12 часов" },
  { value: "1440", label: "Ежедневно" },
];

function getStyleLabel(value: string) {
  return STYLES.find(s => s.value === value)?.label || value;
}

function getIntervalLabel(minutes: number) {
  const item = INTERVALS.find(i => parseInt(i.value) === minutes);
  if (item && item.value !== "0") return item.label;
  if (minutes === 60) return "каждый час";
  if (minutes === 120) return "каждые 2ч";
  if (minutes === 240) return "каждые 4ч";
  if (minutes === 360) return "каждые 6ч";
  if (minutes === 720) return "каждые 12ч";
  if (minutes === 1440) return "ежедневно";
  return `каждые ${minutes}мин`;
}

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AutoComments() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [keywords, setKeywords] = useState("");
  const [selectedStyles, setSelectedStyles] = useState<string[]>(["helpful"]);
  const [maxComments, setMaxComments] = useState([3]);
  const [minDelay, setMinDelay] = useState("30");
  const [maxDelay, setMaxDelay] = useState("120");
  const [interval_, setInterval_] = useState("0");

  const { data: campaigns, isLoading } = useQuery<CommentCampaign[]>({
    queryKey: ["/api/comment-campaigns"],
  });

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: allLogs } = useQuery<CommentLog[]>({
    queryKey: ["/api/comment-logs"],
  });

  const { data: expandedLogs } = useQuery<CommentLog[]>({
    queryKey: ["/api/comment-campaigns", expandedId, "logs"],
    enabled: !!expandedId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const intervalMinutes = parseInt(interval_) || 0;
      const body: any = {
        accountId: parseInt(accountId),
        name,
        targetKeywords: keywords,
        commentStyle: selectedStyles[0] || "helpful",
        commentStyles: JSON.stringify(selectedStyles),
        maxCommentsPerRun: maxComments[0],
        minDelaySeconds: parseInt(minDelay) || 30,
        maxDelaySeconds: parseInt(maxDelay) || 120,
        intervalMinutes,
      };
      if (intervalMinutes > 0) {
        body.nextRunAt = new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
      }
      await apiRequest("POST", "/api/comment-campaigns", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comment-campaigns"] });
      setOpen(false);
      resetForm();
      toast({ title: "Кампания создана" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/comment-campaigns/${id}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comment-campaigns"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/comment-campaigns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comment-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/comment-logs"] });
      toast({ title: "Кампания удалена" });
    },
  });

  const runMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/comment-campaigns/${id}/run`);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/comment-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/comment-logs"] });
      if (expandedId) {
        queryClient.invalidateQueries({ queryKey: ["/api/comment-campaigns", expandedId, "logs"] });
      }
      toast({ title: `Готово: ${data.success} опубликовано, ${data.failed} ошибок` });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка запуска", description: e.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setName("");
    setAccountId("");
    setKeywords("");
    setSelectedStyles(["helpful"]);
    setMaxComments([3]);
    setMinDelay("30");
    setMaxDelay("120");
    setInterval_("0");
  }

  function toggleStyle(value: string) {
    setSelectedStyles(prev => {
      if (prev.includes(value)) {
        if (prev.length === 1) return prev;
        return prev.filter(s => s !== value);
      }
      return [...prev, value];
    });
  }

  const styleCounts: Record<string, { total: number; published: number; failed: number }> = {};
  if (allLogs) {
    for (const log of allLogs) {
      const s = log.commentStyle || "unknown";
      if (!styleCounts[s]) styleCounts[s] = { total: 0, published: 0, failed: 0 };
      styleCounts[s].total++;
      if (log.status === "published") styleCounts[s].published++;
      if (log.status === "failed") styleCounts[s].failed++;
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <MessageCircle className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-xl font-bold" data-testid="text-page-title">Авто-комментирование</h1>
          <Badge variant="secondary" data-testid="badge-campaign-count">{campaigns?.length || 0}</Badge>
          <HelpButton
            title="Авто-комментирование"
            sections={[
              { title: "Что это?", content: "Автоматический поиск и комментирование тредов по ключевым словам с помощью ИИ." },
              { title: "Как работает?", content: "Создайте кампанию, укажите ключевые слова и стиль. Система найдёт подходящие треды и сгенерирует контекстные комментарии." },
              { title: "Безопасность", content: "Между комментариями добавляется случайная задержка. Рекомендуется не превышать 5 комментариев за запуск." },
            ]}
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-campaign">
              <Plus className="w-4 h-4 mr-2" />
              Создать кампанию
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Новая кампания</DialogTitle>
              <DialogDescription>Настройте авто-комментирование по ключевым словам</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Моя кампания"
                  data-testid="input-campaign-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Аккаунт</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger data-testid="select-campaign-account">
                    <SelectValue placeholder="Выберите аккаунт..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>@{a.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ключевые слова (через запятую)</Label>
                <Input
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  placeholder="маркетинг, бизнес, стартап"
                  data-testid="input-campaign-keywords"
                />
              </div>
              <div className="space-y-2">
                <Label>Стили комментариев (A/B тестирование)</Label>
                <div className="flex flex-wrap gap-2">
                  {STYLES.map(s => (
                    <label
                      key={s.value}
                      className="flex items-center gap-1.5 cursor-pointer"
                      data-testid={`checkbox-style-${s.value}`}
                    >
                      <Checkbox
                        checked={selectedStyles.includes(s.value)}
                        onCheckedChange={() => toggleStyle(s.value)}
                      />
                      <span className="text-sm">{s.label}</span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedStyles.map(s => (
                    <Badge key={s} variant="secondary" className="text-xs">{getStyleLabel(s)}</Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Комментариев за запуск: {maxComments[0]}</Label>
                <Slider
                  value={maxComments}
                  onValueChange={setMaxComments}
                  min={1}
                  max={10}
                  step={1}
                  data-testid="slider-max-comments"
                />
              </div>
              <div className="flex gap-3">
                <div className="space-y-2 flex-1">
                  <Label>Мин. задержка (с)</Label>
                  <Input
                    type="number"
                    value={minDelay}
                    onChange={e => setMinDelay(e.target.value)}
                    data-testid="input-min-delay"
                  />
                </div>
                <div className="space-y-2 flex-1">
                  <Label>Макс. задержка (с)</Label>
                  <Input
                    type="number"
                    value={maxDelay}
                    onChange={e => setMaxDelay(e.target.value)}
                    data-testid="input-max-delay"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Расписание</Label>
                <Select value={interval_} onValueChange={setInterval_}>
                  <SelectTrigger data-testid="select-campaign-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVALS.map(i => (
                      <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !name || !accountId || !keywords || selectedStyles.length === 0}
                data-testid="button-submit-campaign"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Создать
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {allLogs && allLogs.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" data-testid="stat-total-comments">{allLogs.length}</p>
              <p className="text-xs text-muted-foreground">Всего комментариев</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-500" data-testid="stat-published-comments">{allLogs.filter(l => l.status === "published").length}</p>
              <p className="text-xs text-muted-foreground">Опубликовано</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-destructive" data-testid="stat-failed-comments">{allLogs.filter(l => l.status === "failed").length}</p>
              <p className="text-xs text-muted-foreground">Ошибки</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" data-testid="stat-campaigns-count">{campaigns?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Кампании</p>
            </CardContent></Card>
          </div>
          {Object.keys(styleCounts).length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Статистика по стилям</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(styleCounts).map(([style, counts]) => (
                    <Badge key={style} variant="outline" data-testid={`badge-style-stat-${style}`}>
                      {getStyleLabel(style)}: {counts.published}/{counts.total}
                      {counts.total > 0 && (
                        <span className="ml-1 text-muted-foreground">
                          ({Math.round((counts.published / counts.total) * 100)}%)
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {(!campaigns || campaigns.length === 0) && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Нет кампаний. Создайте первую кампанию для автокомментирования.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {campaigns?.map(c => {
          const isExpanded = expandedId === c.id;
          const keywordList = c.targetKeywords.split(",").map(k => k.trim()).filter(Boolean);
          let campaignStyles: string[] = [];
          if (c.commentStyles) {
            try { campaignStyles = JSON.parse(c.commentStyles); } catch {}
          }
          if (campaignStyles.length === 0) campaignStyles = [c.commentStyle];

          return (
            <Card key={c.id} data-testid={`card-campaign-${c.id}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium" data-testid={`text-campaign-name-${c.id}`}>{c.name}</span>
                      <Badge variant={c.isActive ? "default" : "secondary"} data-testid={`badge-campaign-status-${c.id}`}>
                        {c.isActive ? "Активна" : "Пауза"}
                      </Badge>
                      {campaignStyles.map(s => (
                        <Badge key={s} variant="outline" className="text-xs">{getStyleLabel(s)}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {keywordList.map((kw, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>До {c.maxCommentsPerRun} комм./запуск</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {c.minDelaySeconds}-{c.maxDelaySeconds}с
                      </span>
                      {c.intervalMinutes != null && c.intervalMinutes > 0 && (
                        <span className="flex items-center gap-1" data-testid={`text-interval-${c.id}`}>
                          <RefreshCw className="w-3 h-3" />
                          Авто: {getIntervalLabel(c.intervalMinutes)}
                        </span>
                      )}
                      {c.totalComments != null && c.totalComments > 0 && (
                        <span>Всего: {c.totalComments}</span>
                      )}
                      {c.lastRunAt && (
                        <span>Запуск: {formatDate(c.lastRunAt)}</span>
                      )}
                      {c.nextRunAt && (
                        <span className="flex items-center gap-1" data-testid={`text-next-run-${c.id}`}>
                          <Timer className="w-3 h-3" />
                          След.: {formatDate(c.nextRunAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleMutation.mutate(c.id)}
                      disabled={toggleMutation.isPending}
                      data-testid={`button-toggle-campaign-${c.id}`}
                    >
                      {c.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => runMutation.mutate(c.id)}
                      disabled={runMutation.isPending}
                      data-testid={`button-run-campaign-${c.id}`}
                    >
                      {runMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 text-green-500" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      data-testid={`button-expand-campaign-${c.id}`}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(c.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-campaign-${c.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Лог комментариев</p>
                    {(!expandedLogs || expandedLogs.length === 0) ? (
                      <p className="text-xs text-muted-foreground">Нет записей</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {expandedLogs.map(log => (
                          <LogEntry key={log.id} log={log} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {allLogs && allLogs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Последняя активность</h2>
          <div className="space-y-2">
            {allLogs.slice(0, 20).map(log => (
              <LogEntry key={log.id} log={log} showCampaign campaigns={campaigns} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LogEntry({ log, showCampaign, campaigns }: { log: CommentLog; showCampaign?: boolean; campaigns?: CommentCampaign[] }) {
  const campaignName = campaigns?.find(c => c.id === log.campaignId)?.name;
  const statusIcon = log.status === "published"
    ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
    : log.status === "failed"
    ? <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
    : <AlertCircle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />;

  return (
    <Card data-testid={`card-log-${log.id}`}>
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          {statusIcon}
          <Badge variant={log.status === "published" ? "default" : log.status === "failed" ? "destructive" : "secondary"} className="text-xs">
            {log.status === "published" ? "Опубликован" : log.status === "failed" ? "Ошибка" : "Ожидание"}
          </Badge>
          {log.commentStyle && (
            <Badge variant="outline" className="text-xs">{getStyleLabel(log.commentStyle)}</Badge>
          )}
          {showCampaign && campaignName && (
            <span className="text-xs text-muted-foreground">{campaignName}</span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{formatDate(log.createdAt)}</span>
        </div>
        {log.targetThreadText && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {log.targetThreadText.substring(0, 100)}
          </p>
        )}
        {log.commentText && (
          <p className="text-xs">{log.commentText}</p>
        )}
        {log.error && (
          <p className="text-xs text-destructive">{log.error}</p>
        )}
      </CardContent>
    </Card>
  );
}

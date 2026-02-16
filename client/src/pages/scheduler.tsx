import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, CalendarClock, Trash2, Clock, Zap, MoreHorizontal, Play, Pause, RotateCcw, AlertCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ScheduledJob, Account, Template } from "@shared/schema";

interface SchedulerStatus {
  running: boolean;
  processing: boolean;
  pollIntervalMs: number;
}

interface LlmModel {
  provider: string;
  modelId: string;
  displayName: string;
}

const INTERVALS = [
  { value: "every_1h", label: "Каждый час" },
  { value: "every_2h", label: "Каждые 2 часа" },
  { value: "every_4h", label: "Каждые 4 часа" },
  { value: "every_6h", label: "Каждые 6 часов" },
  { value: "every_8h", label: "Каждые 8 часов" },
  { value: "every_12h", label: "Каждые 12 часов" },
  { value: "every_24h", label: "Каждые 24 часа" },
  { value: "every_48h", label: "Каждые 48 часов" },
  { value: "every_week", label: "Каждую неделю" },
];

export default function Scheduler() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("casual");
  const [cronExpression, setCronExpression] = useState("every_24h");
  const [branchCount, setBranchCount] = useState("5");
  const [selectedModel, setSelectedModel] = useState("");

  const { data: jobs, isLoading } = useQuery<ScheduledJob[]>({
    queryKey: ["/api/scheduled-jobs"],
    refetchInterval: 15000,
  });
  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });
  const { data: templates } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });
  const { data: schedulerStatus } = useQuery<SchedulerStatus>({
    queryKey: ["/api/scheduler/status"],
    refetchInterval: 10000,
  });
  const { data: models } = useQuery<LlmModel[]>({
    queryKey: ["/api/llm-models"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const model = models?.find(m => `${m.provider}:${m.modelId}` === selectedModel);
      await apiRequest("POST", "/api/scheduled-jobs", {
        accountId: parseInt(accountId),
        templateId: templateId && templateId !== "none" ? parseInt(templateId) : undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
        isRecurring,
        topic: topic || undefined,
        style,
        branches: parseInt(branchCount) || 5,
        cronExpression: isRecurring ? cronExpression : undefined,
        provider: model?.provider || undefined,
        modelId: model?.modelId || undefined,
        status: "pending",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-jobs"] });
      setOpen(false);
      resetForm();
      toast({ title: "Задача запланирована" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/scheduled-jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-jobs"] });
      toast({ title: "Задача удалена" });
    },
  });

  const runNowMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/scheduled-jobs/${id}/run-now`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-jobs"] });
      toast({ title: "Задача поставлена в очередь" });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/scheduled-jobs/${id}/pause`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-jobs"] });
      toast({ title: "Задача приостановлена" });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/scheduled-jobs/${id}/resume`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-jobs"] });
      toast({ title: "Задача возобновлена" });
    },
  });

  function resetForm() {
    setAccountId("");
    setTemplateId("");
    setScheduledAt("");
    setTopic("");
    setStyle("casual");
    setIsRecurring(false);
    setCronExpression("every_24h");
    setBranchCount("5");
    setSelectedModel("");
  }

  const statusLabels: Record<string, string> = {
    pending: "Ожидает",
    running: "Выполняется",
    completed: "Завершена",
    failed: "Ошибка",
    recurring: "Активна",
    paused: "Пауза",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-400",
    completed: "bg-emerald-500/15 text-emerald-400",
    failed: "bg-red-500/15 text-red-400",
    running: "bg-blue-500/15 text-blue-400",
    recurring: "bg-[hsl(263,70%,50%)]/15 text-[hsl(263,70%,60%)]",
    paused: "bg-muted text-muted-foreground",
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Авто-постинг</h1>
          <p className="text-sm text-muted-foreground mt-1">Планирование и автоматизация публикации контента</p>
        </div>
        <div className="flex items-center gap-3">
          {schedulerStatus && (
            <Badge variant="secondary" className={schedulerStatus.running ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"} data-testid="badge-scheduler-status">
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${schedulerStatus.running ? "bg-emerald-400" : "bg-red-400"}`} />
              {schedulerStatus.running ? "Планировщик активен" : "Планировщик остановлен"}
            </Badge>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-schedule-job">
                <Plus className="w-4 h-4 mr-2" />
                Запланировать
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Запланировать авто-пост</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Аккаунт</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger data-testid="select-job-account">
                      <SelectValue placeholder="Выберите аккаунт..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>@{a.username}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Шаблон (опционально)</Label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger data-testid="select-job-template">
                      <SelectValue placeholder="ИИ сгенерирует..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ИИ-генерация (без шаблона)</SelectItem>
                      {templates?.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(!templateId || templateId === "none") && (
                  <>
                    <div className="space-y-2">
                      <Label>Тема для ИИ-генерации</Label>
                      <Input
                        placeholder="О чём должен написать ИИ?"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        data-testid="input-job-topic"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Кол-во постов</Label>
                        <Select value={branchCount} onValueChange={setBranchCount}>
                          <SelectTrigger data-testid="select-branch-count">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[3, 5, 7, 10].map(n => (
                              <SelectItem key={n} value={String(n)}>{n} постов</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>LLM модель</Label>
                        <Select value={selectedModel} onValueChange={setSelectedModel}>
                          <SelectTrigger data-testid="select-job-model">
                            <SelectValue placeholder="По умолчанию" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">По умолчанию</SelectItem>
                            {models?.map((m) => (
                              <SelectItem key={`${m.provider}:${m.modelId}`} value={`${m.provider}:${m.modelId}`}>
                                {m.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Стиль</Label>
                  <Select value={style} onValueChange={setStyle}>
                    <SelectTrigger data-testid="select-job-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casual">Разговорный</SelectItem>
                      <SelectItem value="expert">Экспертный</SelectItem>
                      <SelectItem value="storytelling">Сторителлинг</SelectItem>
                      <SelectItem value="minimalist">Минималистичный</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Время первой публикации</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    data-testid="input-schedule-time"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Повторение</Label>
                    <p className="text-xs text-muted-foreground">Авто-генерация и публикация по расписанию</p>
                  </div>
                  <Switch checked={isRecurring} onCheckedChange={setIsRecurring} data-testid="switch-recurring" />
                </div>

                {isRecurring && (
                  <div className="space-y-2">
                    <Label>Интервал повторения</Label>
                    <Select value={cronExpression} onValueChange={setCronExpression}>
                      <SelectTrigger data-testid="select-interval">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERVALS.map((int) => (
                          <SelectItem key={int.value} value={int.value}>{int.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate()}
                  disabled={!accountId || createMutation.isPending}
                  data-testid="button-submit-job"
                >
                  {createMutation.isPending ? "Планирование..." : "Запланировать"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {jobs && jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((job) => {
            const account = accounts?.find((a) => a.id === job.accountId);
            const template = job.templateId ? templates?.find((t) => t.id === job.templateId) : null;
            const intervalLabel = job.cronExpression ? INTERVALS.find(i => i.value === job.cronExpression)?.label : null;
            return (
              <Card key={job.id} className="overflow-visible" data-testid={`card-job-${job.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        {job.isRecurring ? (
                          <Zap className="w-5 h-5 text-[hsl(263,70%,50%)]" />
                        ) : (
                          <Clock className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium" data-testid={`text-job-title-${job.id}`}>
                          {template ? template.title : job.topic || "AI-generated content"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                          {account && <span>@{account.username}</span>}
                          {job.scheduledAt && (
                            <>
                              <span className="text-border">|</span>
                              <span>{new Date(job.scheduledAt).toLocaleString("ru-RU")}</span>
                            </>
                          )}
                          {job.isRecurring && intervalLabel && (
                            <Badge variant="secondary" className="text-[10px]">{intervalLabel}</Badge>
                          )}
                          {job.isRecurring && !intervalLabel && (
                            <Badge variant="secondary" className="text-[10px]">Повтор</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                          {job.runCount !== null && job.runCount > 0 && (
                            <span>Запусков: {job.runCount}</span>
                          )}
                          {job.lastRunAt && (
                            <>
                              <span className="text-border">|</span>
                              <span>Последний: {new Date(job.lastRunAt).toLocaleString("ru-RU")}</span>
                            </>
                          )}
                          {job.nextRunAt && (job.status === "recurring" || job.status === "pending") && (
                            <>
                              <span className="text-border">|</span>
                              <span>Следующий: {new Date(job.nextRunAt).toLocaleString("ru-RU")}</span>
                            </>
                          )}
                        </div>
                        {job.lastError && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                            <span className="text-xs text-red-400 truncate max-w-[300px]">{job.lastError}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={statusColors[job.status] || ""} data-testid={`badge-job-status-${job.id}`}>
                        {statusLabels[job.status] || job.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" data-testid={`button-job-menu-${job.id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(job.status === "pending" || job.status === "recurring" || job.status === "failed") && (
                            <DropdownMenuItem
                              onClick={() => runNowMutation.mutate(job.id)}
                              data-testid={`button-run-now-${job.id}`}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Запустить сейчас
                            </DropdownMenuItem>
                          )}
                          {(job.status === "recurring" || job.status === "pending") && (
                            <DropdownMenuItem
                              onClick={() => pauseMutation.mutate(job.id)}
                              data-testid={`button-pause-${job.id}`}
                            >
                              <Pause className="w-4 h-4 mr-2" />
                              Приостановить
                            </DropdownMenuItem>
                          )}
                          {job.status === "paused" && (
                            <DropdownMenuItem
                              onClick={() => resumeMutation.mutate(job.id)}
                              data-testid={`button-resume-${job.id}`}
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Возобновить
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(job.id)}
                            data-testid={`button-delete-job-${job.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
            <CalendarClock className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <h3 className="font-semibold mb-1">Нет запланированных задач</h3>
            <p className="text-sm text-muted-foreground">Запланируйте первую задачу авто-постинга</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

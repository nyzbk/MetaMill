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
import { Plus, CalendarClock, Trash2, Clock, Zap, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ScheduledJob, Account, Template } from "@shared/schema";

export default function Scheduler() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("casual");

  const { data: jobs, isLoading } = useQuery<ScheduledJob[]>({
    queryKey: ["/api/scheduled-jobs"],
  });
  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });
  const { data: templates } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/scheduled-jobs", {
        accountId: parseInt(accountId),
        templateId: templateId ? parseInt(templateId) : undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        isRecurring,
        topic: topic || undefined,
        style,
        status: "pending",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-jobs"] });
      setOpen(false);
      setAccountId("");
      setTemplateId("");
      setScheduledAt("");
      setTopic("");
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

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-400",
    completed: "bg-emerald-500/15 text-emerald-400",
    failed: "bg-red-500/15 text-red-400",
    running: "bg-blue-500/15 text-blue-400",
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Авто-постинг</h1>
          <p className="text-sm text-muted-foreground mt-1">Планирование и автоматизация публикации контента</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-schedule-job">
              <Plus className="w-4 h-4 mr-2" />
              Запланировать
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                <div className="space-y-2">
                  <Label>Тема для ИИ-генерации</Label>
                  <Input
                    placeholder="О чём должен написать ИИ?"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    data-testid="input-job-topic"
                  />
                </div>
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
                <Label>Время публикации</Label>
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
                  <p className="text-xs text-muted-foreground">Повторять ежедневно</p>
                </div>
                <Switch checked={isRecurring} onCheckedChange={setIsRecurring} data-testid="switch-recurring" />
              </div>

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

      {jobs && jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((job) => {
            const account = accounts?.find((a) => a.id === job.accountId);
            const template = job.templateId ? templates?.find((t) => t.id === job.templateId) : null;
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
                        <p className="text-sm font-medium">
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
                          {job.isRecurring && (
                            <Badge variant="secondary" className="text-[10px]">Recurring</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={statusColors[job.status] || ""}>
                        {job.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(job.id)}
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

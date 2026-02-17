import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Sparkles, Send, Copy, Check, Loader2, Zap, FileText, TrendingUp, Radar, Shuffle, CalendarPlus, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Account, LlmSetting, Template, TrendItem, KeywordMonitor } from "@shared/schema";
import { HelpButton } from "@/components/help-button";

interface GeneratedThread {
  branches: string[];
}

export default function Generator() {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [reference, setReference] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  useEffect(() => {
    const saved = sessionStorage.getItem("generator_topic");
    if (saved) {
      setTopic(saved);
      sessionStorage.removeItem("generator_topic");
    }
  }, []);
  const [style, setStyle] = useState("casual");
  const [branches, setBranches] = useState(5);
  const [directives, setDirectives] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState("");
  const [generated, setGenerated] = useState<GeneratedThread | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [showTrendsDialog, setShowTrendsDialog] = useState(false);
  const [showMonitorDialog, setShowMonitorDialog] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date(Date.now() + 3600000);
    return d.toISOString().slice(0, 16);
  });
  const [scheduleRecurrence, setScheduleRecurrence] = useState("once");

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: llmSettings } = useQuery<LlmSetting[]>({
    queryKey: ["/api/llm-settings"],
  });

  const { data: templates } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const { data: trends } = useQuery<TrendItem[]>({
    queryKey: ["/api/trends"],
  });

  const { data: monitors } = useQuery<KeywordMonitor[]>({
    queryKey: ["/api/keyword-monitors"],
  });

  const { data: nicheData } = useQuery<{ niche: string }>({
    queryKey: ["/api/user-niche"],
  });

  const activeTemplates = templates?.filter(t => {
    try { const p = JSON.parse(t.content); return Array.isArray(p) && p.length > 0 && p[0]; } catch { return false; }
  }) || [];

  useEffect(() => {
    if (selectedTemplateId && selectedTemplateId !== "none") {
      const tmpl = activeTemplates.find(t => String(t.id) === selectedTemplateId);
      if (tmpl) {
        try {
          const parsed = JSON.parse(tmpl.content);
          if (Array.isArray(parsed)) {
            setReference(parsed.join("\n\n"));
          }
        } catch {}
      }
    } else if (selectedTemplateId === "none") {
      setReference("");
    }
  }, [selectedTemplateId]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        topic,
        reference,
        style,
        branches,
        directives,
      };
      if (selectedModel && selectedModel !== "default") {
        const setting = llmSettings?.find((s) => `${s.provider}:${s.modelId}` === selectedModel);
        if (setting) {
          body.provider = setting.provider;
          body.modelId = setting.modelId;
        }
      }
      if (selectedTemplateId && selectedTemplateId !== "none") {
        body.templateId = parseInt(selectedTemplateId);
      }
      const res = await apiRequest("POST", "/api/generate", body);
      return await res.json();
    },
    onSuccess: (data) => {
      setGenerated(data);
      toast({ title: "Тред сгенерирован" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка генерации", description: e.message, variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!generated || !accountId) throw new Error("Выберите аккаунт");
      await apiRequest("POST", "/api/publish", {
        accountId: parseInt(accountId),
        branches: generated.branches,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({ title: "Тред опубликован" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка публикации", description: e.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!generated) return;
      await apiRequest("POST", "/api/templates", {
        title: topic || "Сгенерированный тред",
        description: `ИИ-генерация, стиль: ${style}`,
        branches: generated.branches.length,
        content: JSON.stringify(generated.branches),
        style,
        status: "draft",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Сохранено как шаблон" });
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!generated || !accountId) throw new Error("Выберите аккаунт и сгенерируйте тред");
      const tmplRes = await apiRequest("POST", "/api/templates", {
        title: topic || "Запланированный тред",
        description: `Авто-планирование, стиль: ${style}`,
        branches: generated.branches.length,
        content: JSON.stringify(generated.branches),
        style,
        status: "active",
      });
      const tmpl = await tmplRes.json();
      const parsedDate = scheduleDate ? new Date(scheduleDate) : new Date(Date.now() + 3600000);
      if (isNaN(parsedDate.getTime())) throw new Error("Некорректная дата");
      const scheduledTime = parsedDate.toISOString();
      const isRec = scheduleRecurrence !== "once";
      let cron: string | null = null;
      if (scheduleRecurrence === "daily") cron = "0 */24 * * *";
      if (scheduleRecurrence === "weekly") cron = "0 0 * * 1";
      await apiRequest("POST", "/api/scheduled-jobs", {
        accountId: parseInt(accountId),
        templateId: tmpl.id,
        topic: topic || "Запланированный тред",
        branches: generated.branches.length,
        style,
        scheduledAt: scheduledTime,
        nextRunAt: scheduledTime,
        status: isRec ? "recurring" : "pending",
        isRecurring: isRec,
        cronExpression: cron,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setShowScheduleForm(false);
      const recLabel = scheduleRecurrence === "once" ? "" : scheduleRecurrence === "daily" ? " (ежедневно)" : " (еженедельно)";
      toast({ title: "Добавлено в планировщик", description: `Тред запланирован на ${new Date(scheduleDate).toLocaleString("ru-RU")}${recLabel}` });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка планирования", description: e.message, variant: "destructive" });
    },
  });

  const randomNicheMutation = useMutation({
    mutationFn: async () => {
      const niche = nicheData?.niche || "технологии";
      const res = await apiRequest("POST", "/api/generate", {
        topic: `Придумай интересную и актуальную тему для треда в нише "${niche}". Верни ТОЛЬКО название темы, одно предложение, без кавычек.`,
        branches: 1,
        style: "casual",
      });
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.branches && data.branches[0]) {
        setTopic(data.branches[0]);
        toast({ title: "Тема сгенерирована из ниши" });
      }
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const copyBranch = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const insertTrendTopic = (title: string) => {
    setTopic(title);
    setShowTrendsDialog(false);
    toast({ title: "Тема вставлена из трендов" });
  };

  const insertMonitorTopic = (keyword: string) => {
    setTopic(`Тренды и обсуждения по теме: ${keyword}`);
    setShowMonitorDialog(false);
    toast({ title: "Тема вставлена из мониторинга" });
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">AI Генератор</h1>
          <HelpButton
            title="Помощь: AI Генератор"
            sections={[
              { title: "Что это?", content: "Инструмент для создания тредов с помощью AI. Вы задаёте тему, выбираете стиль и количество веток — AI создаёт готовый тред для публикации." },
              { title: "Быстрый импорт темы", content: "Используйте кнопки быстрого импорта:\n\n— «Из трендов» — выберите актуальную тему из агрегатора\n— «Из мониторинга» — используйте ключевые слова из мониторинга\n— «Случайная из ниши» — AI сгенерирует тему на основе вашей ниши\n\nЭти кнопки автоматически заполняют поле темы." },
              { title: "Референс стиля", content: "Выберите шаблон из списка — его содержимое будет использовано как образец стиля для генерации. AI скопирует тон и структуру шаблона." },
              { title: "Генерация + Планирование", content: "После генерации используйте кнопку «Запланировать» чтобы сразу добавить тред в автопостинг. Выберите аккаунт и нажмите кнопку." },
            ]}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-1">Генерация цепочек тредов с помощью ИИ</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px,1fr] gap-6">
        <div className="space-y-4">
          <Card className="overflow-visible">
            <CardContent className="p-5 space-y-4">
              <button
                className="flex items-center justify-between w-full text-left"
                onClick={() => setShowQuickActions(!showQuickActions)}
                data-testid="button-toggle-quick-actions"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[hsl(263,70%,50%)]" />
                  <span className="text-sm font-semibold">Быстрый импорт темы</span>
                </div>
                {showQuickActions ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {showQuickActions && (
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className="h-auto py-3 flex flex-col items-center gap-1.5"
                    onClick={() => setShowTrendsDialog(true)}
                    data-testid="button-import-from-trends"
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-[11px]">Из трендов</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto py-3 flex flex-col items-center gap-1.5"
                    onClick={() => setShowMonitorDialog(true)}
                    data-testid="button-import-from-monitor"
                  >
                    <Radar className="w-4 h-4" />
                    <span className="text-[11px]">Мониторинг</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto py-3 flex flex-col items-center gap-1.5"
                    onClick={() => randomNicheMutation.mutate()}
                    disabled={randomNicheMutation.isPending}
                    data-testid="button-random-niche"
                  >
                    {randomNicheMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
                    <span className="text-[11px]">Из ниши</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-visible">
            <CardContent className="p-5 space-y-5">
              <div className="space-y-2">
                <Label>Тема / Исходный материал</Label>
                <Textarea
                  placeholder="Опишите, о чём должен быть тред..."
                  className="resize-none text-sm"
                  rows={4}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  data-testid="textarea-topic"
                />
              </div>

              <div className="space-y-2">
                <Label>Референс стиля из шаблона</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger data-testid="select-reference-template">
                    <SelectValue placeholder="Выберите шаблон..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без референса</SelectItem>
                    {activeTemplates.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.title} ({t.style})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplateId && selectedTemplateId !== "none" && (
                  <p className="text-xs text-muted-foreground">AI скопирует стиль и тон выбранного шаблона</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Ручной референс (опционально)</Label>
                </div>
                <Textarea
                  placeholder="Или вставьте свой текст-образец..."
                  className="resize-none text-sm"
                  rows={2}
                  value={reference}
                  onChange={(e) => { setReference(e.target.value); setSelectedTemplateId("none"); }}
                  data-testid="textarea-reference"
                />
              </div>

              <div className="space-y-2">
                <Label>Тональность</Label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger data-testid="select-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Разговорный</SelectItem>
                    <SelectItem value="expert">Экспертный анализ</SelectItem>
                    <SelectItem value="storytelling">Сторителлинг</SelectItem>
                    <SelectItem value="controversial">Провокационный</SelectItem>
                    <SelectItem value="minimalist">Минималистичный</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Длина</Label>
                    <span className="text-sm font-mono text-muted-foreground">{branches}</span>
                  </div>
                  <Slider
                    value={[branches]}
                    onValueChange={([v]) => setBranches(v)}
                    min={1}
                    max={10}
                    step={1}
                    data-testid="slider-thread-length"
                  />
                </div>
                <div className="space-y-2">
                  <Label>LLM</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger data-testid="select-llm-model">
                      <SelectValue placeholder="По умолч." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Llama 3.3 70B</SelectItem>
                      {llmSettings?.filter(s => s.isActive && s.provider !== "firecrawl" && s.provider !== "user_niche").map((s) => (
                        <SelectItem key={s.id} value={`${s.provider}:${s.modelId}`}>
                          {s.displayName}
                          {s.isDefault ? " ★" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Директивы (опционально)</Label>
                <Input
                  placeholder="напр. без хэштегов, короткие предложения"
                  value={directives}
                  onChange={(e) => setDirectives(e.target.value)}
                  data-testid="input-directives"
                />
              </div>

              <Button
                className="w-full"
                onClick={() => generateMutation.mutate()}
                disabled={!topic || generateMutation.isPending}
                data-testid="button-generate"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Генерация...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Сгенерировать тред
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {generated ? (
            <>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400">
                    Сгенерировано
                  </Badge>
                  <span className="text-sm text-muted-foreground">{generated.branches.length} веток</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-template">
                    <FileText className="w-4 h-4 mr-2" />
                    Шаблон
                  </Button>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger className="w-[140px]" data-testid="select-publish-account">
                      <SelectValue placeholder="Аккаунт..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>@{a.username}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => publishMutation.mutate()}
                    disabled={!accountId || publishMutation.isPending}
                    data-testid="button-publish"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Публиковать
                  </Button>
                  <Popover open={showScheduleForm} onOpenChange={setShowScheduleForm}>
                    <PopoverTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!accountId}
                        data-testid="button-schedule"
                      >
                        <CalendarPlus className="w-4 h-4 mr-2" />
                        Запланировать
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-4" align="end">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">Расписание</span>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Дата и время</Label>
                          <Input
                            type="datetime-local"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            className="text-sm"
                            data-testid="input-schedule-date"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Повторение</Label>
                          <Select value={scheduleRecurrence} onValueChange={setScheduleRecurrence}>
                            <SelectTrigger className="text-sm" data-testid="select-schedule-recurrence">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="once">Однократно</SelectItem>
                              <SelectItem value="daily">Ежедневно</SelectItem>
                              <SelectItem value="weekly">Еженедельно</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          className="w-full"
                          size="sm"
                          onClick={() => scheduleMutation.mutate()}
                          disabled={scheduleMutation.isPending}
                          data-testid="button-confirm-schedule"
                        >
                          {scheduleMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <CalendarPlus className="w-4 h-4 mr-2" />
                          )}
                          Подтвердить
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-0">
                {generated.branches.map((text, i) => (
                  <div key={i} className="flex gap-3 group" data-testid={`card-branch-${i}`}>
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground flex-shrink-0 border border-border">
                        {i + 1}
                      </div>
                      {i < generated.branches.length - 1 && (
                        <div className="w-[2px] flex-1 bg-border rounded-full min-h-[24px]" />
                      )}
                    </div>
                    <Card className="flex-1 mb-3 overflow-visible">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => copyBranch(i, text)}
                            className="flex-shrink-0"
                            data-testid={`button-copy-${i}`}
                          >
                            {copied === i ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2 font-mono">{text.length}/500</p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Card className="overflow-visible">
              <CardContent className="p-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <h3 className="font-semibold mb-1">Готово к генерации</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Используйте кнопки быстрого импорта или введите тему вручную, затем нажмите Сгенерировать
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showTrendsDialog} onOpenChange={setShowTrendsDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Выберите тему из трендов</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {!trends || trends.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Трендов нет. Обновите тренды в разделе «Тренды».</p>
            ) : (
              trends.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-md border border-border hover-elevate cursor-pointer"
                  onClick={() => insertTrendTopic(item.title)}
                  data-testid={`trend-pick-${item.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <Badge variant="secondary" className="mt-1 text-[10px]">{item.source}</Badge>
                  </div>
                  <Sparkles className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMonitorDialog} onOpenChange={setShowMonitorDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Выберите тему из мониторинга</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {!monitors || monitors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Нет мониторингов. Добавьте ключевые слова в разделе «Мониторинг».</p>
            ) : (
              monitors.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-md border border-border hover-elevate cursor-pointer"
                  onClick={() => insertMonitorTopic(m.keyword)}
                  data-testid={`monitor-pick-${m.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{m.keyword}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Последняя проверка: {m.lastCheckedAt ? new Date(m.lastCheckedAt).toLocaleDateString("ru") : "не проводилась"}
                    </p>
                  </div>
                  <Radar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

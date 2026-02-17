import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, FileText, MoreHorizontal, GitBranch, Trash2, Sparkles, TrendingUp, Link2, Pencil, Loader2, Microscope, BookOpen, ListOrdered, Lightbulb, ClipboardList } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Template, TrendItem } from "@shared/schema";
import { HelpButton } from "@/components/help-button";

const PRESET_ICONS = [Microscope, BookOpen, ListOrdered, Lightbulb, ClipboardList] as const;
const PRESET_CARDS = [
  { title: "Экспертный разбор", description: "Глубокий анализ темы с инсайтами и фактами. Стиль: educational, 5 веток.", iconIdx: 0 },
  { title: "История/Кейс", description: "Storytelling-формат с завязкой, кульминацией и выводом. Стиль: storytelling, 5 веток.", iconIdx: 1 },
  { title: "Топ-лист", description: "Список советов или фактов в формате '5 вещей, которые...'. Стиль: casual, 5 веток.", iconIdx: 2 },
  { title: "Разрушение мифов", description: "Формат 'миф vs реальность' с доказательствами. Стиль: professional, 4 ветки.", iconIdx: 3 },
  { title: "Пошаговая инструкция", description: "Практический гайд с конкретными действиями. Стиль: educational, 5 веток.", iconIdx: 4 },
];

export default function Templates() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [branches, setBranches] = useState(3);
  const [style, setStyle] = useState("casual");
  const [branchContents, setBranchContents] = useState<string[]>(["", "", ""]);
  const [importUrl, setImportUrl] = useState("");
  const [importingTrendId, setImportingTrendId] = useState<number | null>(null);

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const { data: trends, isLoading: trendsLoading } = useQuery<TrendItem[]>({
    queryKey: ["/api/trends"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/templates", {
        title,
        description,
        branches,
        style,
        content: JSON.stringify(branchContents.slice(0, branches)),
        status: "draft",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setBranches(3);
      setBranchContents(["", "", ""]);
      toast({ title: "Шаблон создан" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Шаблон удалён" });
    },
  });

  const presetMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/templates/starter-presets");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Стартовые шаблоны добавлены", description: "5 шаблонов для разных форматов контента" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const urlImportMutation = useMutation({
    mutationFn: async (url: string) => {
      await apiRequest("POST", "/api/research/extract-and-import", { url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setOpen(false);
      setImportUrl("");
      toast({ title: "Шаблон импортирован из URL" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка импорта", description: e.message, variant: "destructive" });
    },
  });

  const trendImportMutation = useMutation({
    mutationFn: async (trend: TrendItem) => {
      setImportingTrendId(trend.id);
      const res = await apiRequest("POST", "/api/generate", {
        topic: trend.title,
        branches: 5,
        style: "casual",
      });
      const data = await res.json();
      const branchesArr = data.branches || [data];
      await apiRequest("POST", "/api/templates", {
        title: trend.title,
        description: `Сгенерировано из тренда (${trend.source})`,
        branches: branchesArr.length,
        style: "casual",
        content: JSON.stringify(branchesArr),
        status: "draft",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setImportingTrendId(null);
      toast({ title: "Шаблон создан из тренда" });
    },
    onError: (e: Error) => {
      setImportingTrendId(null);
      toast({ title: "Ошибка генерации", description: e.message, variant: "destructive" });
    },
  });

  const handleBranchChange = (count: number) => {
    setBranches(count);
    const newContents = [...branchContents];
    while (newContents.length < count) newContents.push("");
    setBranchContents(newContents.slice(0, count));
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Шаблоны</h1>
            <HelpButton
              title="Помощь: Шаблоны"
              sections={[
                { title: "Что это?", content: "Шаблоны — это образцы контента, на основе которых AI генерирует новые треды. Чем больше качественных шаблонов, тем лучше результат генерации." },
                { title: "Как получить шаблоны?", content: "Есть несколько способов:\n\n1. «Готовые шаблоны» — нажмите кнопку «Добавить стартовые шаблоны» для быстрого старта\n\n2. «Исследование» → вкладка «По URL» — вставьте ссылку на популярный тред из Threads и импортируйте его как шаблон\n\n3. «Переработка» — вставьте ссылку на статью/пост из Reddit/новостей и AI переработает его в тред\n\n4. «Тренды» — найдите актуальную тему и нажмите «Использовать в генераторе»\n\n5. Вручную — нажмите «Создать шаблон» и напишите свой" },
                { title: "Стили шаблонов", content: "casual — разговорный стиль\nprofessional — деловой стиль\nhumor — с юмором\nstorytelling — история/рассказ\neducational — обучающий\nreference — импортированный образец (используется как пример стиля для AI)" },
                { title: "Связь с генератором", content: "В AI Генераторе вы можете выбрать шаблон как «образец стиля». AI проанализирует его и создаст новый тред в похожем стиле, но на вашу тему." },
              ]}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Шаблоны цепочек тредов для автоматизации контента</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-template">
              <Plus className="w-4 h-4 mr-2" />
              Новый шаблон
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Новый шаблон</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="trends" className="mt-2">
              <TabsList className="w-full grid grid-cols-4" data-testid="tabs-template-create">
                <TabsTrigger value="trends" data-testid="tab-trends">
                  <TrendingUp className="w-4 h-4 mr-1.5" />
                  Из трендов
                </TabsTrigger>
                <TabsTrigger value="url" data-testid="tab-url">
                  <Link2 className="w-4 h-4 mr-1.5" />
                  Из URL
                </TabsTrigger>
                <TabsTrigger value="presets" data-testid="tab-presets">
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Пресеты
                </TabsTrigger>
                <TabsTrigger value="manual" data-testid="tab-manual">
                  <Pencil className="w-4 h-4 mr-1.5" />
                  Вручную
                </TabsTrigger>
              </TabsList>

              <TabsContent value="trends" className="max-h-[60vh] overflow-y-auto">
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground" data-testid="text-trends-description">
                    Выберите тренд — AI сгенерирует тред и сохранит как шаблон.
                  </p>
                  {trendsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
                    </div>
                  ) : trends && trends.length > 0 ? (
                    <div className="space-y-2">
                      {trends.slice(0, 15).map((trend) => (
                        <Card key={trend.id} className="overflow-visible" data-testid={`card-trend-${trend.id}`}>
                          <CardContent className="p-4 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-medium truncate" data-testid={`text-trend-title-${trend.id}`}>
                                {trend.title}
                              </h4>
                              <Badge variant="secondary" className="mt-1" data-testid={`badge-trend-source-${trend.id}`}>
                                {trend.source}
                              </Badge>
                            </div>
                            <Button
                              variant="outline"
                              disabled={importingTrendId === trend.id || trendImportMutation.isPending}
                              onClick={() => trendImportMutation.mutate(trend)}
                              data-testid={`button-import-trend-${trend.id}`}
                            >
                              {importingTrendId === trend.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Генерация...
                                </>
                              ) : (
                                "Импортировать"
                              )}
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Тренды не найдены. Обновите тренды на странице «Тренды».</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="url" className="max-h-[60vh] overflow-y-auto">
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground" data-testid="text-url-description">
                    Вставьте ссылку на тред из Threads — контент будет извлечён и сохранён как шаблон.
                  </p>
                  <div className="space-y-2">
                    <Label>URL треда</Label>
                    <Input
                      placeholder="https://www.threads.net/@user/post/..."
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      data-testid="input-import-url"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => urlImportMutation.mutate(importUrl)}
                    disabled={!importUrl.trim() || urlImportMutation.isPending}
                    data-testid="button-extract-url"
                  >
                    {urlImportMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Извлечение...
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4 mr-2" />
                        Извлечь и создать
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="presets" className="max-h-[60vh] overflow-y-auto">
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground" data-testid="text-presets-description">
                    Готовые шаблоны для быстрого старта. Добавьте все сразу одной кнопкой.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => presetMutation.mutate()}
                    disabled={presetMutation.isPending}
                    data-testid="button-add-presets"
                  >
                    {presetMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Добавление...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Добавить все 5 шаблонов
                      </>
                    )}
                  </Button>
                  <div className="space-y-2">
                    {PRESET_CARDS.map((preset, idx) => {
                      const Icon = PRESET_ICONS[preset.iconIdx];
                      return (
                        <Card key={idx} className="overflow-visible" data-testid={`card-preset-${idx}`}>
                          <CardContent className="p-4 flex items-start gap-3">
                            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div>
                              <h4 className="text-sm font-medium" data-testid={`text-preset-title-${idx}`}>{preset.title}</h4>
                              <p className="text-xs text-muted-foreground mt-1" data-testid={`text-preset-desc-${idx}`}>{preset.description}</p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="max-h-[60vh] overflow-y-auto">
                <div className="space-y-5 pt-2">
                  <div className="space-y-2">
                    <Label>Название</Label>
                    <Input
                      placeholder="Название шаблона"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      data-testid="input-template-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Описание</Label>
                    <Input
                      placeholder="Краткое описание"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      data-testid="input-template-description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Стиль</Label>
                      <Select value={style} onValueChange={setStyle}>
                        <SelectTrigger data-testid="select-style">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="expert">Expert</SelectItem>
                          <SelectItem value="storytelling">Storytelling</SelectItem>
                          <SelectItem value="controversial">Controversial</SelectItem>
                          <SelectItem value="minimalist">Minimalist</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Ветки</Label>
                        <span className="text-sm font-mono text-muted-foreground">{branches}</span>
                      </div>
                      <Slider
                        value={[branches]}
                        onValueChange={([v]) => handleBranchChange(v)}
                        min={1}
                        max={10}
                        step={1}
                        data-testid="slider-branches"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Цепочка треда ({branches} веток)</Label>
                    <div className="space-y-3">
                      {Array.from({ length: branches }).map((_, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex flex-col items-center gap-1 pt-3">
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground flex-shrink-0">
                              {i + 1}
                            </div>
                            {i < branches - 1 && <div className="w-[2px] flex-1 bg-border rounded-full min-h-[16px]" />}
                          </div>
                          <Textarea
                            placeholder={`Ветка ${i + 1}...`}
                            className="resize-none text-sm"
                            rows={3}
                            value={branchContents[i] || ""}
                            onChange={(e) => {
                              const newContents = [...branchContents];
                              newContents[i] = e.target.value;
                              setBranchContents(newContents);
                            }}
                            data-testid={`textarea-branch-${i}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => createMutation.mutate()}
                    disabled={!title || createMutation.isPending}
                    data-testid="button-submit-template"
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Создание...
                      </>
                    ) : (
                      "Создать шаблон"
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {templates && templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => {
            let parsed: string[] = [];
            try { parsed = JSON.parse(t.content); } catch {}
            return (
              <Card key={t.id} className="overflow-visible" data-testid={`card-template-${t.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{t.title}</h3>
                      {t.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {t.status === "active" ? "Активный" : "Черновик"}
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
                            onClick={() => deleteMutation.mutate(t.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <GitBranch className="w-3.5 h-3.5" />
                      {t.branches} веток
                    </span>
                    <span className="capitalize">{t.style || "casual"}</span>
                  </div>

                  {parsed.length > 0 && parsed[0] && (
                    <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Предпросмотр</p>
                      <p className="text-sm text-foreground line-clamp-2">{parsed[0]}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-visible">
          <CardContent className="p-12 text-center">
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <h3 className="font-semibold mb-1">Шаблонов нет</h3>
            <p className="text-sm text-muted-foreground">Создайте первый шаблон цепочки тредов</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

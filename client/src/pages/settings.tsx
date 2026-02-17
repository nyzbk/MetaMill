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
import { Plus, Star, Trash2, Settings as SettingsIcon, Pencil, MoreHorizontal, Link2, Check, Loader2, Target } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { LlmSetting } from "@shared/schema";
import { HelpButton } from "@/components/help-button";

interface AvailableModel {
  provider: string;
  modelId: string;
  displayName: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  openrouter: "OpenRouter (кредиты Replit)",
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  google: "Google (Gemini)",
  xai: "xAI (Grok)",
  ollama: "Ollama (self-hosted)",
  custom: "Custom API (OpenAI-совместимый)",
};

const PROVIDER_OPTIONS = [
  { value: "openrouter", label: "OpenRouter (кредиты Replit)" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "google", label: "Google (Gemini)" },
  { value: "xai", label: "xAI (Grok)" },
  { value: "ollama", label: "Ollama (self-hosted LLM)" },
  { value: "custom", label: "Custom API (OpenAI-совместимый)" },
];

function needsApiKey(provider: string): boolean {
  return provider === "anthropic" || provider === "google" || provider === "xai" || provider === "custom";
}

function needsBaseUrl(provider: string): boolean {
  return provider === "ollama" || provider === "custom";
}

export default function Settings() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [provider, setProvider] = useState("openrouter");
  const [modelId, setModelId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [firecrawlKey, setFirecrawlKey] = useState("");
  const [firecrawlSaved, setFirecrawlSaved] = useState(false);
  const [nicheValue, setNicheValue] = useState("");
  const [nicheSaved, setNicheSaved] = useState(false);

  const { data: settings, isLoading } = useQuery<LlmSetting[]>({
    queryKey: ["/api/llm-settings"],
  });

  const { data: availableModels } = useQuery<AvailableModel[]>({
    queryKey: ["/api/llm-models"],
  });

  const filteredModels = availableModels?.filter((m) => m.provider === provider) || [];

  const resetForm = () => {
    setProvider("openrouter");
    setModelId("");
    setDisplayName("");
    setApiKey("");
    setBaseUrl("");
    setIsActive(true);
    setEditId(null);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        provider,
        modelId,
        displayName,
        isActive,
      };
      if (needsApiKey(provider) && apiKey) {
        body.apiKey = apiKey;
      }
      if (needsBaseUrl(provider) && baseUrl) {
        body.baseUrl = baseUrl;
      }
      if (editId) {
        await apiRequest("PUT", `/api/llm-settings/${editId}`, body);
      } else {
        await apiRequest("POST", "/api/llm-settings", body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-settings"] });
      setOpen(false);
      resetForm();
      toast({ title: editId ? "Провайдер обновлён" : "Провайдер добавлен" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/llm-settings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-settings"] });
      toast({ title: "Провайдер удалён" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/llm-settings/${id}/set-default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-settings"] });
      toast({ title: "Провайдер по умолчанию обновлён" });
    },
  });

  const firecrawlSetting = settings?.find(s => s.provider === "firecrawl");
  const hasFirecrawl = !!firecrawlSetting;

  const { data: nicheData } = useQuery<{ niche: string }>({
    queryKey: ["/api/user-niche"],
  });

  const saveNicheMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/user-niche", { niche: nicheValue });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-niche"] });
      setNicheSaved(true);
      toast({ title: "Тема/ниша сохранена" });
      setTimeout(() => setNicheSaved(false), 2000);
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const saveFirecrawlMutation = useMutation({
    mutationFn: async () => {
      if (firecrawlSetting) {
        await apiRequest("PUT", `/api/llm-settings/${firecrawlSetting.id}`, {
          provider: "firecrawl",
          modelId: "firecrawl",
          displayName: "Firecrawl API",
          apiKey: firecrawlKey,
          isActive: true,
        });
      } else {
        await apiRequest("POST", "/api/llm-settings", {
          provider: "firecrawl",
          modelId: "firecrawl",
          displayName: "Firecrawl API",
          apiKey: firecrawlKey,
          isActive: true,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-settings"] });
      setFirecrawlSaved(true);
      setFirecrawlKey("");
      toast({ title: "Firecrawl API ключ сохранён" });
      setTimeout(() => setFirecrawlSaved(false), 2000);
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const deleteFirecrawlMutation = useMutation({
    mutationFn: async () => {
      if (firecrawlSetting) {
        await apiRequest("DELETE", `/api/llm-settings/${firecrawlSetting.id}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-settings"] });
      toast({ title: "Firecrawl API ключ удалён" });
    },
  });

  const openEdit = (setting: LlmSetting) => {
    setEditId(setting.id);
    setProvider(setting.provider);
    setModelId(setting.modelId);
    setDisplayName(setting.displayName);
    setApiKey(setting.apiKey || "");
    setBaseUrl((setting as any).baseUrl || "");
    setIsActive(setting.isActive);
    setOpen(true);
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
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Настройки</h1>
          <HelpButton
            title="Помощь: Настройки"
            sections={[
              { title: "Что это?", content: "Центральный раздел для настройки всех интеграций: AI модели (LLM провайдеры), Meta API ключи, Firecrawl, и ваша тема/ниша для генерации контента." },
              { title: "LLM Провайдеры", content: "AI модели для генерации контента. Добавьте API ключ любого провайдера:\n— OpenRouter (бесплатные модели)\n— OpenAI (GPT-4, GPT-3.5)\n— Anthropic (Claude)\n— Google (Gemini)\n— xAI (Grok)\n— Ollama (локальные модели)\n\nВыберите модель по умолчанию, нажав звёздочку." },
              { title: "Meta API", content: "Введите App ID и App Secret из вашего приложения на developers.facebook.com. Без них невозможна публикация в Threads." },
              { title: "Firecrawl", content: "Опциональный сервис для улучшенного извлечения тредов по URL в разделе «Исследование». Без него используется бесплатный метод извлечения." },
              { title: "Тема/Ниша", content: "Задайте свою основную тему или нишу. Она будет автоматически добавляться во все запросы генерации AI — в генераторе, авто-постинге и переработке." },
            ]}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-1">Управление LLM провайдерами и конфигурацией</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold" data-testid="text-section-llm">LLM Провайдеры</h2>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-provider">
                <Plus className="w-4 h-4 mr-2" />
                Добавить провайдер
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editId ? "Редактировать провайдер" : "Добавить провайдер"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Провайдер</Label>
                  <Select value={provider} onValueChange={(v) => { setProvider(v); setModelId(""); setDisplayName(""); }}>
                    <SelectTrigger data-testid="select-provider">
                      <SelectValue placeholder="Выберите провайдер..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {provider === "openrouter" && (
                    <p className="text-xs text-muted-foreground">Использует кредиты Replit, API ключ не требуется</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Модель</Label>
                  {(provider === "ollama" || provider === "custom") ? (
                    <>
                      <Input
                        placeholder={provider === "ollama" ? "llama3.3, qwen2.5, mistral..." : "model-name"}
                        value={modelId}
                        onChange={(e) => {
                          setModelId(e.target.value);
                          if (!displayName) setDisplayName(e.target.value);
                        }}
                        data-testid="input-model-id"
                      />
                      {provider === "ollama" && filteredModels.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-1">
                          {filteredModels.map((m) => (
                            <Badge
                              key={m.modelId}
                              variant="secondary"
                              className="cursor-pointer text-[10px]"
                              onClick={() => { setModelId(m.modelId); setDisplayName(m.displayName); }}
                            >
                              {m.displayName}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Select value={modelId} onValueChange={(v) => {
                      setModelId(v);
                      const model = filteredModels.find(m => m.modelId === v);
                      if (model && !displayName) setDisplayName(model.displayName);
                    }}>
                      <SelectTrigger data-testid="select-model">
                        <SelectValue placeholder="Выберите модель..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredModels.map((m) => (
                          <SelectItem key={m.modelId} value={m.modelId}>{m.displayName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Название</Label>
                  <Input
                    placeholder="Отображаемое имя..."
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    data-testid="input-display-name"
                  />
                </div>

                {needsBaseUrl(provider) && (
                  <div className="space-y-2">
                    <Label>Base URL сервера</Label>
                    <Input
                      placeholder={provider === "ollama" ? "http://your-server:11434/v1" : "https://your-api.com/v1"}
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      data-testid="input-base-url"
                    />
                    {provider === "ollama" && (
                      <p className="text-xs text-muted-foreground">URL вашего Ollama сервера (AWS, Oracle, Azure, Modal и т.д.)</p>
                    )}
                    {provider === "custom" && (
                      <p className="text-xs text-muted-foreground">Любой OpenAI-совместимый API эндпоинт</p>
                    )}
                  </div>
                )}

                {needsApiKey(provider) && (
                  <div className="space-y-2">
                    <Label>API Ключ</Label>
                    <Input
                      type="password"
                      placeholder="Введите API ключ..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      data-testid="input-api-key"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Активный</Label>
                    <p className="text-xs text-muted-foreground">Доступен для выбора в генераторе</p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-active" />
                </div>

                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate()}
                  disabled={!provider || !modelId || !displayName || createMutation.isPending}
                  data-testid="button-submit-provider"
                >
                  {createMutation.isPending ? "Сохранение..." : (editId ? "Обновить" : "Добавить")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {settings && settings.filter(s => s.provider !== "firecrawl").length > 0 ? (
          <div className="space-y-3">
            {settings.filter(s => s.provider !== "firecrawl").map((setting) => (
              <Card key={setting.id} className="overflow-visible" data-testid={`card-llm-setting-${setting.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        {setting.isDefault ? (
                          <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                        ) : (
                          <SettingsIcon className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium" data-testid={`text-setting-name-${setting.id}`}>
                          {setting.displayName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">
                            {PROVIDER_LABELS[setting.provider] || setting.provider}
                          </Badge>
                          <span className="text-border">|</span>
                          <span className="font-mono text-[11px]">{setting.modelId}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {setting.isDefault && (
                        <Badge variant="secondary" className="bg-amber-500/15 text-amber-400">
                          По умолчанию
                        </Badge>
                      )}
                      <Badge variant="secondary" className={setting.isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}>
                        {setting.isActive ? "Активен" : "Неактивен"}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" data-testid={`button-menu-${setting.id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!setting.isDefault && (
                            <DropdownMenuItem
                              onClick={() => setDefaultMutation.mutate(setting.id)}
                              data-testid={`button-set-default-${setting.id}`}
                            >
                              <Star className="w-4 h-4 mr-2" />
                              Сделать по умолчанию
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => openEdit(setting)}
                            data-testid={`button-edit-${setting.id}`}
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(setting.id)}
                            data-testid={`button-delete-${setting.id}`}
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
            ))}
          </div>
        ) : (
          <Card className="overflow-visible">
            <CardContent className="p-12 text-center">
              <SettingsIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <h3 className="font-semibold mb-1">Нет настроенных провайдеров</h3>
              <p className="text-sm text-muted-foreground">Добавьте LLM провайдер для генерации контента</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold" data-testid="text-section-firecrawl">Firecrawl API (опционально)</h2>
        <Card className="overflow-visible">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <Link2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Firecrawl — улучшенное извлечение тредов</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Firecrawl рендерит JavaScript и извлекает полное содержимое тредов из Threads.net.
                  Без ключа используется бесплатный HTML-парсинг (ограниченные результаты).
                </p>
              </div>
              {hasFirecrawl && (
                <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400 flex-shrink-0">
                  <Check className="w-3 h-3 mr-1" />
                  Настроен
                </Badge>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input
                type="password"
                placeholder={hasFirecrawl ? "Ключ уже сохранён (введите новый для обновления)" : "fc-xxxxxxxx..."}
                value={firecrawlKey}
                onChange={(e) => setFirecrawlKey(e.target.value)}
                className="flex-1 min-w-[200px]"
                data-testid="input-firecrawl-key"
              />
              <Button
                onClick={() => saveFirecrawlMutation.mutate()}
                disabled={!firecrawlKey || saveFirecrawlMutation.isPending}
                data-testid="button-save-firecrawl"
              >
                {saveFirecrawlMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : firecrawlSaved ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : null}
                {firecrawlSaved ? "Сохранено" : "Сохранить"}
              </Button>
              {hasFirecrawl && (
                <Button
                  variant="outline"
                  onClick={() => deleteFirecrawlMutation.mutate()}
                  disabled={deleteFirecrawlMutation.isPending}
                  data-testid="button-delete-firecrawl"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Удалить
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Получите ключ на{" "}
              <a href="https://www.firecrawl.dev" target="_blank" rel="noopener noreferrer" className="text-[hsl(263,70%,60%)] underline">
                firecrawl.dev
              </a>
              . Бесплатный тариф: 500 страниц/мес.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold" data-testid="text-section-niche">Тема / Ниша</h2>
        <Card className="overflow-visible">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Глобальная тема контента</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Укажите вашу тему или нишу. Она будет автоматически добавлена во все AI-промпты:
                  генератор, авто-постинг, переработка контента.
                </p>
              </div>
              {nicheData?.niche && (
                <Badge variant="secondary" className="bg-[hsl(263,70%,50%)]/15 text-[hsl(263,70%,60%)] flex-shrink-0">
                  <Check className="w-3 h-3 mr-1" />
                  Настроена
                </Badge>
              )}
            </div>
            {nicheData?.niche && (
              <div className="px-3 py-2 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground">Текущая ниша:</p>
                <p className="text-sm font-medium mt-0.5" data-testid="text-current-niche">{nicheData.niche}</p>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder={nicheData?.niche ? "Введите новую тему для обновления..." : "Например: «криптовалюты и блокчейн», «фитнес и здоровый образ жизни»"}
                value={nicheValue}
                onChange={(e) => setNicheValue(e.target.value)}
                className="flex-1 min-w-[200px]"
                data-testid="input-niche"
              />
              <Button
                onClick={() => saveNicheMutation.mutate()}
                disabled={!nicheValue.trim() || saveNicheMutation.isPending}
                data-testid="button-save-niche"
              >
                {saveNicheMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : nicheSaved ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : null}
                {nicheSaved ? "Сохранено" : "Сохранить"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

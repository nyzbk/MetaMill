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
import { Plus, Star, Trash2, Settings as SettingsIcon, Pencil, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { LlmSetting } from "@shared/schema";

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
};

const PROVIDER_OPTIONS = [
  { value: "openrouter", label: "OpenRouter (кредиты Replit)" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "google", label: "Google (Gemini)" },
  { value: "xai", label: "xAI (Grok)" },
];

function needsApiKey(provider: string): boolean {
  return provider === "anthropic" || provider === "google" || provider === "xai";
}

export default function Settings() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [provider, setProvider] = useState("openrouter");
  const [modelId, setModelId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isActive, setIsActive] = useState(true);

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

  const openEdit = (setting: LlmSetting) => {
    setEditId(setting.id);
    setProvider(setting.provider);
    setModelId(setting.modelId);
    setDisplayName(setting.displayName);
    setApiKey(setting.apiKey || "");
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
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Настройки</h1>
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

        {settings && settings.length > 0 ? (
          <div className="space-y-3">
            {settings.map((setting) => (
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
    </div>
  );
}

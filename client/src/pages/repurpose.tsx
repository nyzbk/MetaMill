import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link2, Loader2, Copy, Check, FileText, Send, Sparkles } from "lucide-react";
import type { Account, LlmSetting } from "@shared/schema";
import { HelpButton } from "@/components/help-button";

export default function Repurpose() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [branches, setBranches] = useState(5);
  const [style, setStyle] = useState("casual");
  const [selectedModel, setSelectedModel] = useState("");
  const [generated, setGenerated] = useState<{ title: string; branches: string[]; source: string } | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [accountId, setAccountId] = useState("");

  const { data: accounts } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });
  const { data: llmSettings } = useQuery<LlmSetting[]>({ queryKey: ["/api/llm-settings"] });

  const repurposeMutation = useMutation({
    mutationFn: async () => {
      const body: any = { url, branches, style };
      if (selectedModel && selectedModel !== "default") {
        const setting = llmSettings?.find((s) => `${s.provider}:${s.modelId}` === selectedModel);
        if (setting) {
          body.provider = setting.provider;
          body.modelId = setting.modelId;
        }
      }
      const res = await apiRequest("POST", "/api/repurpose", body);
      return await res.json();
    },
    onSuccess: (data) => {
      setGenerated(data);
      toast({ title: "Контент переработан" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка переработки", description: e.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!generated) return;
      await apiRequest("POST", "/api/templates", {
        title: generated.title || "Переработанный контент",
        description: `Источник: ${generated.source}`,
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

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!generated || !accountId) return;
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

  const copyBranch = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Переработка контента</h1>
          <HelpButton
            title="Помощь: Переработка контента"
            sections={[
              { title: "Что это?", content: "Инструмент для превращения статей, постов Reddit, новостей и любых веб-страниц в готовые треды для Threads. AI извлекает контент по ссылке и переписывает его в формат треда." },
              { title: "Как пользоваться?", content: "1. Вставьте ссылку на статью, пост Reddit или новость\n2. Задайте количество веток треда\n3. Нажмите «Переработать»\n4. AI извлечёт контент и создаст тред\n5. Результат можно скопировать или сохранить" },
              { title: "Какие ссылки подходят?", content: "— Посты Reddit\n— Статьи из блогов и новостных сайтов\n— Любые публичные веб-страницы с текстовым контентом\n\nНе подходят: страницы за авторизацией, PDF, видео" },
              { title: "Связь с нишей", content: "Если вы задали тему/нишу в «Настройках», AI адаптирует переработанный контент под вашу нишу." },
            ]}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-1">Превращение статей, постов Reddit и новостей в треды для Threads</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-6">
        <div className="space-y-5">
          <Card className="overflow-visible">
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Link2 className="w-4 h-4 text-[hsl(263,70%,50%)]" />
                <span className="text-sm font-semibold">Источник</span>
              </div>

              <div className="space-y-2">
                <Label>URL статьи / поста</Label>
                <Input
                  placeholder="https://reddit.com/r/... или любой URL"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  data-testid="input-repurpose-url"
                />
                <p className="text-xs text-muted-foreground">Поддерживается Reddit, блоги, новостные сайты</p>
              </div>

              <div className="space-y-2">
                <Label>Тональность</Label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger data-testid="select-repurpose-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Разговорный</SelectItem>
                    <SelectItem value="expert">Экспертный</SelectItem>
                    <SelectItem value="storytelling">Сторителлинг</SelectItem>
                    <SelectItem value="controversial">Провокационный</SelectItem>
                    <SelectItem value="minimalist">Минималистичный</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Постов в треде</Label>
                  <span className="text-sm font-mono text-muted-foreground">{branches}</span>
                </div>
                <Slider
                  value={[branches]}
                  onValueChange={([v]) => setBranches(v)}
                  min={1}
                  max={10}
                  step={1}
                  data-testid="slider-repurpose-branches"
                />
              </div>

              <div className="space-y-2">
                <Label>LLM Модель</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger data-testid="select-repurpose-model">
                    <SelectValue placeholder="По умолчанию" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">По умолчанию</SelectItem>
                    {llmSettings?.filter(s => s.isActive).map((s) => (
                      <SelectItem key={s.id} value={`${s.provider}:${s.modelId}`}>
                        {s.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full"
                onClick={() => repurposeMutation.mutate()}
                disabled={!url.trim() || repurposeMutation.isPending}
                data-testid="button-repurpose"
              >
                {repurposeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Обработка...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Переработать в тред
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
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400">
                    Переработано
                  </Badge>
                  <span className="text-sm text-muted-foreground">{generated.branches.length} веток</span>
                  <Badge variant="secondary">{generated.source}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-repurposed">
                    <FileText className="w-4 h-4 mr-2" />
                    Сохранить шаблон
                  </Button>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger className="w-[160px]" data-testid="select-repurpose-account">
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
                    data-testid="button-publish-repurposed"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Опубликовать
                  </Button>
                </div>
              </div>

              <Card className="overflow-visible">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Источник</p>
                  <p className="text-sm font-medium">{generated.title}</p>
                </CardContent>
              </Card>

              <div className="space-y-0">
                {generated.branches.map((text, i) => (
                  <div key={i} className="flex gap-3 group" data-testid={`card-repurpose-branch-${i}`}>
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
                            data-testid={`button-copy-repurpose-${i}`}
                          >
                            {copied === i ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
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
                  <Link2 className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <h3 className="font-semibold mb-1">Вставьте URL</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Вставьте ссылку на статью, пост Reddit или новость — ИИ переработает её в цепочку тредов для Threads
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

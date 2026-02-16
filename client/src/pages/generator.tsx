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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Sparkles, Send, Copy, Check, Loader2, Zap, FileText } from "lucide-react";
import type { Account, LlmSetting } from "@shared/schema";

interface GeneratedThread {
  branches: string[];
}

export default function Generator() {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [reference, setReference] = useState("");

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

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: llmSettings } = useQuery<LlmSetting[]>({
    queryKey: ["/api/llm-settings"],
  });

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

  const copyBranch = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">AI Генератор</h1>
        <p className="text-sm text-muted-foreground mt-1">Генерация цепочек тредов с помощью ИИ</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-6">
        <div className="space-y-5">
          <Card className="overflow-visible">
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-[hsl(263,70%,50%)]" />
                <span className="text-sm font-semibold">Настройки</span>
              </div>

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
                <div className="flex justify-between">
                  <Label>Референс стиля (опционально)</Label>
                </div>
                <Textarea
                  placeholder="Вставьте референс треда для копирования стиля..."
                  className="resize-none text-sm"
                  rows={3}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
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

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Длина треда</Label>
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
                <Label>Директивы (опционально)</Label>
                <Input
                  placeholder="напр. без хэштегов, короткие предложения"
                  value={directives}
                  onChange={(e) => setDirectives(e.target.value)}
                  data-testid="input-directives"
                />
              </div>

              <div className="space-y-2">
                <Label>LLM Модель</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger data-testid="select-llm-model">
                    <SelectValue placeholder="По умолчанию" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Llama 3.3 70B (по умолчанию)</SelectItem>
                    {llmSettings?.filter(s => s.isActive && s.provider !== "firecrawl").map((s) => (
                      <SelectItem key={s.id} value={`${s.provider}:${s.modelId}`}>
                        {s.displayName}
                        {s.isDefault ? " ★" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-template">
                    <FileText className="w-4 h-4 mr-2" />
                    Сохранить шаблон
                  </Button>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger className="w-[160px]" data-testid="select-publish-account">
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
                    Опубликовать
                  </Button>
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
                  Заполните тему и настройки, затем нажмите Сгенерировать для создания цепочки тредов
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

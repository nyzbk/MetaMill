import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Radar, Plus, Trash2, RefreshCw, Loader2, Eye, Heart } from "lucide-react";
import type { KeywordMonitor, MonitorResult } from "@shared/schema";
import { HelpButton } from "@/components/help-button";

export default function Monitoring() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [selectedMonitor, setSelectedMonitor] = useState<number | null>(null);

  const { data: monitors, isLoading } = useQuery<KeywordMonitor[]>({
    queryKey: ["/api/keyword-monitors"],
  });

  const { data: results } = useQuery<MonitorResult[]>({
    queryKey: ["/api/keyword-monitors", selectedMonitor, "results"],
    enabled: !!selectedMonitor,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/keyword-monitors", { keyword });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keyword-monitors"] });
      setOpen(false);
      setKeyword("");
      toast({ title: "Мониторинг добавлен" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/keyword-monitors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keyword-monitors"] });
      if (selectedMonitor) setSelectedMonitor(null);
      toast({ title: "Мониторинг удалён" });
    },
  });

  const checkMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/keyword-monitors/${id}/check`);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/keyword-monitors"] });
      if (selectedMonitor) {
        queryClient.invalidateQueries({ queryKey: ["/api/keyword-monitors", selectedMonitor, "results"] });
      }
      toast({ title: `Найдено ${data.found} результатов` });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка проверки", description: e.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Мониторинг</h1>
            <HelpButton
              title="Помощь: Мониторинг"
              sections={[
                { title: "Что это?", content: "Отслеживание ключевых слов в Threads. Добавьте слова/фразы, и система будет искать их в публичных тредах, чтобы вы были в курсе обсуждений по вашей теме." },
                { title: "Как пользоваться?", content: "1. Нажмите «Добавить ключевое слово»\n2. Введите слово или фразу для отслеживания\n3. Нажмите «Проверить» для ручного поиска\n4. Просмотрите найденные результаты" },
                { title: "Зачем нужен?", content: "Мониторинг помогает:\n— Следить за упоминаниями вашего бренда/продукта\n— Находить обсуждения по вашей нише\n— Быть в курсе конкурентов\n— Находить идеи для контента из реальных обсуждений" },
                { title: "Требования", content: "Для работы мониторинга нужен подключённый аккаунт Threads с активным токеном (раздел «Аккаунты»), так как поиск использует Threads API." },
              ]}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Отслеживание ключевых слов в Threads</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-monitor">
              <Plus className="w-4 h-4 mr-2" />
              Добавить слово
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый мониторинг</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Ключевое слово / фраза</Label>
                <Input
                  placeholder="AI, стартап, маркетинг..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  data-testid="input-keyword"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={!keyword.trim() || createMutation.isPending}
                data-testid="button-submit-monitor"
              >
                {createMutation.isPending ? "Создание..." : "Создать мониторинг"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px,1fr] gap-6">
        <div className="space-y-3">
          {monitors && monitors.length > 0 ? (
            monitors.map((m) => (
              <Card
                key={m.id}
                className={`overflow-visible cursor-pointer transition-colors ${selectedMonitor === m.id ? "border-[hsl(263,70%,50%)]" : ""}`}
                onClick={() => setSelectedMonitor(m.id)}
                data-testid={`card-monitor-${m.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`text-keyword-${m.id}`}>{m.keyword}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.lastCheckedAt ? `Проверено: ${new Date(m.lastCheckedAt).toLocaleDateString("ru-RU")}` : "Не проверялось"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); checkMutation.mutate(m.id); }}
                        disabled={checkMutation.isPending}
                        data-testid={`button-check-${m.id}`}
                      >
                        {checkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(m.id); }}
                        data-testid={`button-delete-monitor-${m.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="overflow-visible">
              <CardContent className="p-8 text-center">
                <Radar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Нет мониторингов</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          {selectedMonitor ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Результаты мониторинга</span>
                <Badge variant="secondary">{results?.length || 0}</Badge>
              </div>
              {results && results.length > 0 ? (
                results.map((r) => (
                  <Card key={r.id} className="overflow-visible" data-testid={`card-result-${r.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {r.author && (
                            <span className="text-xs text-muted-foreground font-mono">@{r.author}</span>
                          )}
                          <p className="text-sm mt-1">{r.threadText.substring(0, 200)}{r.threadText.length > 200 ? "..." : ""}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            {(r.likeCount ?? 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <Heart className="w-3 h-3" />
                                {r.likeCount}
                              </span>
                            )}
                            <span>{new Date(r.fetchedAt).toLocaleDateString("ru-RU")}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="overflow-visible">
                  <CardContent className="p-8 text-center">
                    <Radar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Нажмите «Обновить» на мониторинге для поиска результатов</p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="overflow-visible">
              <CardContent className="p-12 text-center">
                <Radar className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <h3 className="font-semibold mb-1">Выберите мониторинг</h3>
                <p className="text-sm text-muted-foreground">Выберите ключевое слово слева для просмотра результатов</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

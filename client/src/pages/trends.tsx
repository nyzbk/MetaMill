import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TrendingUp, RefreshCw, ExternalLink, Sparkles, Loader2, Flame } from "lucide-react";
import { useLocation } from "wouter";
import type { TrendItem } from "@shared/schema";
import { HelpButton } from "@/components/help-button";

const SOURCE_COLORS: Record<string, string> = {
  HackerNews: "bg-orange-500/15 text-orange-400",
  TechCrunch: "bg-emerald-500/15 text-emerald-400",
};

function getSourceColor(source: string): string {
  if (source.startsWith("Reddit")) return "bg-red-500/15 text-red-400";
  return SOURCE_COLORS[source] || "bg-muted text-muted-foreground";
}

export default function Trends() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: trends, isLoading } = useQuery<TrendItem[]>({
    queryKey: ["/api/trends"],
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trends/refresh");
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trends"] });
      toast({ title: `Обновлено: ${data.refreshed} трендов` });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка обновления", description: e.message, variant: "destructive" });
    },
  });

  const useInGenerator = (title: string) => {
    sessionStorage.setItem("generator_topic", title);
    setLocation("/generator");
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Тренды</h1>
            <HelpButton
              title="Помощь: Тренды"
              sections={[
                { title: "Что это?", content: "Агрегатор актуальных тем и новостей из HackerNews, Reddit и TechCrunch. Помогает находить трендовые темы для создания контента." },
                { title: "Как пользоваться?", content: "1. Нажмите «Обновить» для загрузки свежих трендов\n2. Просмотрите список актуальных тем\n3. Нажмите «Использовать в генераторе» рядом с интересной темой\n4. Вы будете перенаправлены в AI Генератор с этой темой" },
                { title: "Зачем нужны тренды?", content: "Контент на актуальные темы получает больше охвата и просмотров. Используйте тренды как источник идей для ваших тредов." },
              ]}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Актуальные темы для контента из HackerNews, Reddit и TechCrunch</p>
        </div>
        <Button
          variant="outline"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          data-testid="button-refresh-trends"
        >
          {refreshMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Обновить
        </Button>
      </div>

      {trends && trends.length > 0 ? (
        <div className="space-y-3">
          {trends.map((item) => (
            <Card key={item.id} className="overflow-visible" data-testid={`card-trend-${item.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="secondary" className={getSourceColor(item.source)}>
                        {item.source}
                      </Badge>
                      {(item.score ?? 0) > 100 && (
                        <Badge variant="secondary" className="bg-amber-500/15 text-amber-400">
                          <Flame className="w-3 h-3 mr-1" />
                          {item.score}
                        </Badge>
                      )}
                      {item.category && item.category !== "story" && item.category !== "general" && item.category !== "news" && (
                        <Badge variant="secondary">{item.category}</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium" data-testid={`text-trend-title-${item.id}`}>{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => useInGenerator(item.title)}
                      title="Использовать в генераторе"
                      data-testid={`button-use-trend-${item.id}`}
                    >
                      <Sparkles className="w-4 h-4" />
                    </Button>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        <Button size="icon" variant="ghost" data-testid={`button-open-trend-${item.id}`}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-visible">
          <CardContent className="p-12 text-center">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <h3 className="font-semibold mb-1">Трендов пока нет</h3>
            <p className="text-sm text-muted-foreground mb-4">Нажмите «Обновить» чтобы загрузить актуальные тренды</p>
            <Button onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending} data-testid="button-refresh-empty">
              {refreshMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Загрузить тренды
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

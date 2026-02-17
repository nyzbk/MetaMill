import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, CheckCircle, XCircle, Clock, Users, Activity, Heart, MessageCircle, Repeat2, Eye, Download, RefreshCw } from "lucide-react";
import { HelpButton } from "@/components/help-button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AnalyticsOverview {
  totalPosts: number;
  published: number;
  failed: number;
  drafts: number;
  publishedToday: number;
  publishedThisWeek: number;
  totalTemplates: number;
  totalAccounts: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  successRate: number;
  totalLikes: number;
  totalReplies: number;
  totalReposts: number;
  totalViews: number;
}

interface DailyCount {
  date: string;
  count: number;
}

interface AccountStat {
  id: number;
  username: string;
  platform: string;
  totalPosts: number;
  published: number;
  failed: number;
  likes: number;
  replies: number;
  reposts: number;
  views: number;
}

interface RecentPost {
  id: number;
  content: string;
  status: string;
  publishedAt: string;
  accountId: number;
  likes: number;
  replies: number;
  reposts: number;
  views: number;
}

interface AnalyticsData {
  overview: AnalyticsOverview;
  daily: DailyCount[];
  monthly: DailyCount[];
  accountStats: AccountStat[];
  recentPublished: RecentPost[];
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: any; accent?: boolean }) {
  return (
    <Card className="overflow-visible">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold tracking-tight" data-testid={`text-stat-${label.toLowerCase().replace(/\s/g, "-")}`}>{value}</p>
          </div>
          <div className={`flex items-center justify-center w-10 h-10 rounded-md ${accent ? "bg-[hsl(263,70%,50%)]/15 text-[hsl(263,70%,50%)]" : "bg-muted text-muted-foreground"}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getDayAbbr(dateStr: string): string {
  const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const d = new Date(dateStr);
  return days[d.getDay()];
}

export default function Analytics() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
  });

  const refreshEngagement = useMutation({
    mutationFn: () => apiRequest("POST", "/api/engagement/refresh"),
    onSuccess: async (res) => {
      const result = await res.json();
      toast({ title: "Метрики обновлены", description: result.message });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const handleExport = () => {
    window.open("/api/analytics/export", "_blank");
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const overview = data?.overview;
  const daily = data?.daily ?? [];
  const last7 = daily.slice(-7);
  const maxCount = Math.max(...last7.map((d) => d.count), 1);
  const accountStats = data?.accountStats ?? [];
  const recentPublished = data?.recentPublished ?? [];

  const statusColors: Record<string, string> = {
    published: "bg-emerald-500/15 text-emerald-400",
    draft: "bg-muted text-muted-foreground",
    scheduled: "bg-amber-500/15 text-amber-400",
    failed: "bg-red-500/15 text-red-400",
  };
  const statusLabels: Record<string, string> = {
    published: "Опубликован",
    draft: "Черновик",
    scheduled: "Запланирован",
    failed: "Ошибка",
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Аналитика</h1>
            <HelpButton
              title="Помощь: Аналитика"
              sections={[
                { title: "Что это?", content: "Страница аналитики показывает подробную статистику по вашим публикациям, аккаунтам и автоматизации. Здесь вы можете отслеживать эффективность контент-стратегии." },
                { title: "Метрики вовлечённости", content: "Лайки, ответы, репосты и просмотры загружаются из Threads API. Нажмите 'Обновить метрики' для получения актуальных данных." },
                { title: "Экспорт", content: "Кнопка 'Экспорт CSV' скачивает все данные о постах в формате CSV для анализа в Excel или Google Sheets." },
              ]}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => refreshEngagement.mutate()}
              disabled={refreshEngagement.isPending}
              data-testid="button-refresh-engagement"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshEngagement.isPending ? "animate-spin" : ""}`} />
              {refreshEngagement.isPending ? "Обновление..." : "Обновить метрики"}
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              data-testid="button-export-csv"
            >
              <Download className="w-4 h-4 mr-2" />
              Экспорт CSV
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Метрики, вовлечённость и статистика публикаций</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="section-stat-cards">
        <StatCard label="Всего постов" value={overview?.totalPosts ?? 0} icon={BarChart3} />
        <StatCard label="Опубликовано" value={overview?.published ?? 0} icon={CheckCircle} accent />
        <StatCard label="Успешность" value={`${overview?.successRate ?? 0}%`} icon={TrendingUp} />
        <StatCard label="Активные задачи" value={overview?.activeJobs ?? 0} icon={Activity} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="section-engagement-cards">
        <StatCard label="Лайки" value={overview?.totalLikes ?? 0} icon={Heart} accent />
        <StatCard label="Ответы" value={overview?.totalReplies ?? 0} icon={MessageCircle} />
        <StatCard label="Репосты" value={overview?.totalReposts ?? 0} icon={Repeat2} />
        <StatCard label="Просмотры" value={overview?.totalViews ?? 0} icon={Eye} />
      </div>

      <Card className="overflow-visible">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm" data-testid="text-chart-title">Активность за 7 дней</h3>
          </div>
          {last7.length > 0 ? (
            <div className="flex items-end gap-2 h-40" data-testid="chart-activity">
              {last7.map((day, i) => {
                const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" data-testid={`chart-bar-${i}`}>
                    <span className="text-xs text-muted-foreground">{day.count}</span>
                    <div className="w-full flex items-end" style={{ height: "120px" }}>
                      <div
                        className="w-full rounded-sm"
                        style={{
                          height: `${Math.max(height, 2)}%`,
                          backgroundColor: "#8B5CF6",
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{getDayAbbr(day.date)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Данных пока нет</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-visible">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm" data-testid="text-accounts-title">Статистика по аккаунтам</h3>
          </div>
          {accountStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-account-stats">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Аккаунт</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Платформа</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Посты</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">
                      <Heart className="w-3 h-3 inline mr-1" />Лайки
                    </th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">
                      <MessageCircle className="w-3 h-3 inline mr-1" />Ответы
                    </th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">
                      <Repeat2 className="w-3 h-3 inline mr-1" />Репосты
                    </th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">
                      <Eye className="w-3 h-3 inline mr-1" />Просмотры
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accountStats.map((acc) => (
                    <tr key={acc.id} className="border-b border-border last:border-0" data-testid={`row-account-${acc.id}`}>
                      <td className="py-2 px-3 font-medium">{acc.username}</td>
                      <td className="py-2 px-3">
                        <Badge variant="secondary">{acc.platform}</Badge>
                      </td>
                      <td className="py-2 px-3 text-right">{acc.published}</td>
                      <td className="py-2 px-3 text-right text-rose-400">{acc.likes}</td>
                      <td className="py-2 px-3 text-right text-blue-400">{acc.replies}</td>
                      <td className="py-2 px-3 text-right text-green-400">{acc.reposts}</td>
                      <td className="py-2 px-3 text-right text-amber-400">{acc.views}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Аккаунтов пока нет</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-visible">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm" data-testid="text-recent-title">Последние публикации</h3>
            </div>
            <Badge variant="secondary">{recentPublished.length} записей</Badge>
          </div>
          {recentPublished.length > 0 ? (
            <div className="space-y-0">
              {recentPublished.slice(0, 10).map((post) => (
                <div key={post.id} className="flex items-start gap-3 py-3 border-b border-border last:border-0" data-testid={`card-recent-post-${post.id}`}>
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate" data-testid={`text-post-content-${post.id}`}>
                        {post.content.substring(0, 80)}{post.content.length > 80 ? "..." : ""}
                      </p>
                      <Badge variant="secondary" className={statusColors[post.status] || ""}>
                        {statusLabels[post.status] || post.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <p className="text-xs text-muted-foreground">
                        {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                      </p>
                      {(post.likes > 0 || post.replies > 0 || post.reposts > 0 || post.views > 0) && (
                        <div className="flex items-center gap-2 text-xs">
                          {post.likes > 0 && <span className="text-rose-400 flex items-center gap-0.5"><Heart className="w-3 h-3" />{post.likes}</span>}
                          {post.replies > 0 && <span className="text-blue-400 flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{post.replies}</span>}
                          {post.reposts > 0 && <span className="text-green-400 flex items-center gap-0.5"><Repeat2 className="w-3 h-3" />{post.reposts}</span>}
                          {post.views > 0 && <span className="text-amber-400 flex items-center gap-0.5"><Eye className="w-3 h-3" />{post.views}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Публикаций пока нет</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

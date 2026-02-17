import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, CheckCircle, XCircle, Clock, Users, Activity } from "lucide-react";
import { HelpButton } from "@/components/help-button";

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
}

interface RecentPost {
  id: number;
  content: string;
  status: string;
  publishedAt: string;
  accountId: number;
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
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
  });

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
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Аналитика</h1>
          <HelpButton
            title="Помощь: Аналитика"
            sections={[
              { title: "Что это?", content: "Страница аналитики показывает подробную статистику по вашим публикациям, аккаунтам и автоматизации. Здесь вы можете отслеживать эффективность контент-стратегии." },
              { title: "Как пользоваться?", content: "1. Верхние карточки показывают ключевые метрики: общее количество постов, опубликованные, процент успешности и активные задачи.\n2. График активности отображает публикации за последние 7 дней.\n3. Таблица аккаунтов показывает статистику по каждому подключённому аккаунту.\n4. Список последних публикаций позволяет быстро просмотреть недавний контент." },
              { title: "Что такое успешность?", content: "Процент успешности показывает долю постов, которые были успешно опубликованы, от общего числа попыток публикации. Чем выше процент, тем стабильнее работает система." },
            ]}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-1">Метрики и статистика публикаций</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="section-stat-cards">
        <StatCard label="Всего постов" value={overview?.totalPosts ?? 0} icon={BarChart3} />
        <StatCard label="Опубликовано" value={overview?.published ?? 0} icon={CheckCircle} accent />
        <StatCard label="Успешность" value={`${overview?.successRate ?? 0}%`} icon={TrendingUp} />
        <StatCard label="Активные задачи" value={overview?.activeJobs ?? 0} icon={Activity} />
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
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Всего</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Опубликовано</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Ошибки</th>
                  </tr>
                </thead>
                <tbody>
                  {accountStats.map((acc) => (
                    <tr key={acc.id} className="border-b border-border last:border-0" data-testid={`row-account-${acc.id}`}>
                      <td className="py-2 px-3 font-medium">{acc.username}</td>
                      <td className="py-2 px-3">
                        <Badge variant="secondary">{acc.platform}</Badge>
                      </td>
                      <td className="py-2 px-3 text-right">{acc.totalPosts}</td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-emerald-400">{acc.published}</span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-red-400">{acc.failed}</span>
                      </td>
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
                    <p className="text-xs text-muted-foreground mt-1">
                      {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                    </p>
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

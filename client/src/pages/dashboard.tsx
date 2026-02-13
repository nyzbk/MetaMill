import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Send,
  CalendarClock,
  Users,
  TrendingUp,
  Clock,
  Sparkles,
} from "lucide-react";
import type { Post, Account, Template, ScheduledJob } from "@shared/schema";

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

function RecentPostItem({ post }: { post: Post }) {
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
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0" data-testid={`card-post-${post.id}`}>
      <div className="flex flex-col items-center gap-1 pt-1">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="w-[2px] flex-1 bg-border rounded-full min-h-[16px]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground truncate">{post.content.substring(0, 60)}{post.content.length > 60 ? "..." : ""}</p>
          <Badge variant="secondary" className={statusColors[post.status] || ""}>
            {statusLabels[post.status] || post.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("ru-RU") : post.createdAt ? new Date(post.createdAt).toLocaleDateString("ru-RU") : ""}
        </p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: accounts, isLoading: loadingAccounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });
  const { data: posts, isLoading: loadingPosts } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });
  const { data: templates, isLoading: loadingTemplates } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });
  const { data: jobs, isLoading: loadingJobs } = useQuery<ScheduledJob[]>({
    queryKey: ["/api/scheduled-jobs"],
  });

  const isLoading = loadingAccounts || loadingPosts || loadingTemplates || loadingJobs;

  const totalPosts = posts?.length ?? 0;
  const publishedToday = posts?.filter((p) => {
    if (!p.publishedAt) return false;
    const d = new Date(p.publishedAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length ?? 0;
  const scheduled = jobs?.filter((j) => j.status === "pending").length ?? 0;
  const activeAccounts = accounts?.filter((a) => a.status === "active").length ?? 0;

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
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Панель управления</h1>
        <p className="text-sm text-muted-foreground mt-1">Обзор производства контента</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Всего постов" value={totalPosts} icon={FileText} />
        <StatCard label="Опубликовано сегодня" value={publishedToday} icon={Send} accent />
        <StatCard label="Запланировано" value={scheduled} icon={CalendarClock} />
        <StatCard label="Аккаунты" value={activeAccounts} icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="overflow-visible">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Последняя активность</h3>
              </div>
              <Badge variant="secondary">{posts?.length ?? 0} всего</Badge>
            </div>
            <div className="space-y-0">
              {posts && posts.length > 0 ? (
                posts.slice(0, 5).map((post) => <RecentPostItem key={post.id} post={post} />)
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Постов пока нет</p>
                  <p className="text-xs mt-1">Создайте контент с помощью AI Генератора</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-visible">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Шаблоны</h3>
              </div>
              <Badge variant="secondary">{templates?.length ?? 0} всего</Badge>
            </div>
            <div className="space-y-3">
              {templates && templates.length > 0 ? (
                templates.slice(0, 4).map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0" data-testid={`card-template-${t.id}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.branches} {t.branches === 1 ? "ветка" : "веток"}</p>
                    </div>
                    <Badge variant="secondary">
                      {t.status === "active" ? "Активный" : "Черновик"}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Шаблонов пока нет</p>
                  <p className="text-xs mt-1">Создайте первый шаблон контента</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

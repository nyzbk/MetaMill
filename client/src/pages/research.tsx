import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Download, Heart, MessageCircle, Clock, Plus, Sparkles, FileText, Link2, Loader2, ExternalLink, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpButton } from "@/components/help-button";

interface ThreadPost {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  like_count?: number;
  reply_count?: number;
  views?: number;
  media_type?: string;
}

interface ExtractedThread {
  username: string;
  posts: string[];
  source: string;
}

export default function Research() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [userId, setUserId] = useState("");
  const [searchResults, setSearchResults] = useState<ThreadPost[]>([]);
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());
  const [bundleTitle, setBundleTitle] = useState("");
  const [bundleOpen, setBundleOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualSource, setManualSource] = useState("");
  const [manualBranches, setManualBranches] = useState<string[]>([""]);

  const [extractUrl, setExtractUrl] = useState("");
  const [extractedThread, setExtractedThread] = useState<ExtractedThread | null>(null);
  const [extractTitle, setExtractTitle] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [batchResults, setBatchResults] = useState<ExtractedThread[]>([]);
  const [batchErrors, setBatchErrors] = useState<{ url: string; error: string }[]>([]);

  const searchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/research/search", { query: searchQuery, limit: 30 });
      return res.json();
    },
    onSuccess: (data) => {
      setSearchResults(data.threads || []);
      setSelectedThreads(new Set());
      if (data.threads?.length === 0) {
        toast({ title: "Ничего не найдено", description: "Попробуйте другой запрос" });
      }
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка поиска", description: e.message, variant: "destructive" });
    },
  });

  const userThreadsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/research/user-threads", { userId, limit: 50 });
      return res.json();
    },
    onSuccess: (data) => {
      setSearchResults(data.threads || []);
      setSelectedThreads(new Set());
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const importSingleMutation = useMutation({
    mutationFn: async (thread: ThreadPost) => {
      const res = await apiRequest("POST", "/api/research/import-thread", {
        text: thread.text,
        username: thread.username,
        likeCount: thread.like_count,
        timestamp: thread.timestamp,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Импортировано как шаблон" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка импорта", description: e.message, variant: "destructive" });
    },
  });

  const importBundleMutation = useMutation({
    mutationFn: async () => {
      const threads = searchResults.filter(t => selectedThreads.has(t.id));
      const res = await apiRequest("POST", "/api/research/import-bundle", {
        threads,
        title: bundleTitle,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setBundleOpen(false);
      setSelectedThreads(new Set());
      setBundleTitle("");
      toast({ title: "Пакет импортирован как шаблон" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const importManualMutation = useMutation({
    mutationFn: async () => {
      const branches = manualBranches.filter(b => b.trim().length > 0);
      const res = await apiRequest("POST", "/api/research/import-manual", {
        branches,
        title: manualTitle,
        sourceUsername: manualSource,
        style: "reference",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setManualOpen(false);
      setManualTitle("");
      setManualSource("");
      setManualBranches([""]);
      toast({ title: "Шаблон создан из ручного импорта" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const extractMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/research/extract-url", { url: extractUrl });
      return res.json();
    },
    onSuccess: (data: ExtractedThread) => {
      setExtractedThread(data);
      setExtractTitle(`[Извлечено] @${data.username}`);
      toast({ title: "Тред извлечён", description: `${data.posts.length} пост(ов) от @${data.username}` });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка извлечения", description: e.message, variant: "destructive" });
    },
  });

  const importExtractedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/research/extract-and-import", {
        url: extractedThread?.source || extractUrl,
        title: extractTitle,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setExtractedThread(null);
      setExtractUrl("");
      setExtractTitle("");
      toast({ title: "Импортировано как шаблон" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка импорта", description: e.message, variant: "destructive" });
    },
  });

  const batchExtractMutation = useMutation({
    mutationFn: async () => {
      const urls = batchUrls.split("\n").map(u => u.trim()).filter(u => u.length > 0);
      const res = await apiRequest("POST", "/api/research/extract-batch", { urls });
      return res.json();
    },
    onSuccess: (data: { results: ExtractedThread[]; errors: { url: string; error: string }[] }) => {
      setBatchResults(data.results || []);
      setBatchErrors(data.errors || []);
      if (data.results?.length > 0) {
        toast({ title: `Извлечено ${data.results.length} тред(ов)` });
      }
      if (data.errors?.length > 0) {
        toast({ title: `${data.errors.length} ошибок`, variant: "destructive" });
      }
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const importBatchItemMutation = useMutation({
    mutationFn: async (item: ExtractedThread) => {
      const res = await apiRequest("POST", "/api/research/import-manual", {
        branches: item.posts,
        title: `[Извлечено] @${item.username}`,
        sourceUsername: item.username,
        style: "reference",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Импортировано как шаблон" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка импорта", description: e.message, variant: "destructive" });
    },
  });

  function toggleThread(id: string) {
    const next = new Set(selectedThreads);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedThreads(next);
  }

  function addManualBranch() {
    setManualBranches([...manualBranches, ""]);
  }

  function updateManualBranch(index: number, value: string) {
    const next = [...manualBranches];
    next[index] = value;
    setManualBranches(next);
  }

  function removeManualBranch(index: number) {
    if (manualBranches.length <= 1) return;
    setManualBranches(manualBranches.filter((_, i) => i !== index));
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Исследование</h1>
            <HelpButton
              title="Помощь: Исследование"
              sections={[
                { title: "Что это?", content: "Набор инструментов для поиска и импорта контента из Threads: извлечение тредов по URL, поиск по ключевым словам, анализ тредов пользователей." },
                { title: "По URL (вкладка)", content: "Вставьте ссылку на тред из Threads (threads.com) и извлеките его текст. Работает без API через веб-скрейпинг. Для лучших результатов добавьте Firecrawl API ключ в «Настройках»." },
                { title: "Пакетное извлечение", content: "Извлечение нескольких тредов за раз (до 10 URL). Вставьте ссылки по одной на строку." },
                { title: "Поиск (API)", content: "Поиск тредов по ключевым словам через Threads API. Требует подключённый аккаунт с активным токеном." },
                { title: "Треды пользователя (API)", content: "Загрузка тредов конкретного пользователя по его ID. Требует подключённый аккаунт с активным токеном." },
                { title: "Зачем нужно?", content: "Импортируйте успешные треды как шаблоны. AI будет использовать их стиль и структуру для генерации нового контента на вашу тему." },
              ]}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Поиск залетевших тредов, извлечение по URL и импорт как шаблонов</p>
        </div>
        <Dialog open={manualOpen} onOpenChange={setManualOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="button-manual-import">
              <FileText className="w-4 h-4 mr-2" />
              Ручной импорт
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ручной импорт треда</DialogTitle>
              <DialogDescription>Вставьте текст треда вручную для создания шаблона</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Название шаблона</Label>
                <Input
                  placeholder="Например: Тред про AI от @nikidrawsfeels"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  data-testid="input-manual-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Источник (аккаунт)</Label>
                <Input
                  placeholder="@nikidrawsfeels"
                  value={manualSource}
                  onChange={(e) => setManualSource(e.target.value)}
                  data-testid="input-manual-source"
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <Label>Посты (ветки треда)</Label>
                  <Button size="sm" variant="outline" onClick={addManualBranch} data-testid="button-add-branch">
                    <Plus className="w-3 h-3 mr-1" />
                    Добавить ветку
                  </Button>
                </div>
                {manualBranches.map((branch, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-muted text-xs font-mono flex-shrink-0 mt-2">
                      {i + 1}
                    </div>
                    <Textarea
                      placeholder={`Пост ${i + 1}...`}
                      value={branch}
                      onChange={(e) => updateManualBranch(i, e.target.value)}
                      className="min-h-[80px] text-sm"
                      data-testid={`textarea-branch-${i}`}
                    />
                    {manualBranches.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="flex-shrink-0 mt-2 text-muted-foreground"
                        onClick={() => removeManualBranch(i)}
                      >
                        x
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                className="w-full"
                onClick={() => importManualMutation.mutate()}
                disabled={!manualTitle || manualBranches.every(b => !b.trim()) || importManualMutation.isPending}
                data-testid="button-submit-manual"
              >
                {importManualMutation.isPending ? "Импорт..." : "Импортировать как шаблон"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="extract" className="space-y-4">
        <TabsList>
          <TabsTrigger value="extract" data-testid="tab-extract">
            <Link2 className="w-4 h-4 mr-1.5" />
            По URL
          </TabsTrigger>
          <TabsTrigger value="batch" data-testid="tab-batch">
            <ExternalLink className="w-4 h-4 mr-1.5" />
            Пакетное извлечение
          </TabsTrigger>
          <TabsTrigger value="search" data-testid="tab-search">
            <Search className="w-4 h-4 mr-1.5" />
            Поиск (API)
          </TabsTrigger>
          <TabsTrigger value="user" data-testid="tab-user">
            <Sparkles className="w-4 h-4 mr-1.5" />
            Треды пользователя (API)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="extract" className="space-y-4">
          <Card className="overflow-visible">
            <CardContent className="p-4 space-y-3">
              <div className="flex gap-3 flex-wrap">
                <Input
                  placeholder="https://www.threads.com/@username/post/xxxxx"
                  value={extractUrl}
                  onChange={(e) => setExtractUrl(e.target.value)}
                  className="flex-1 min-w-[200px]"
                  onKeyDown={(e) => e.key === "Enter" && extractUrl && extractMutation.mutate()}
                  data-testid="input-extract-url"
                />
                <Button
                  onClick={() => extractMutation.mutate()}
                  disabled={!extractUrl || extractMutation.isPending}
                  data-testid="button-extract"
                >
                  {extractMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Извлечение...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4 mr-2" />
                      Извлечь тред
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Вставьте ссылку на тред из Threads. Контент будет извлечён автоматически без Threads API.
                Для лучшего результата добавьте Firecrawl API ключ в Настройках.
              </p>
            </CardContent>
          </Card>

          {extractMutation.isPending && (
            <div className="space-y-3">
              <Skeleton className="h-32" />
              <Skeleton className="h-20" />
            </div>
          )}

          {extractedThread && (
            <Card className="overflow-visible border-[hsl(263,70%,50%)]/30">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">@{extractedThread.username}</Badge>
                    <Badge variant="outline">{extractedThread.posts.length} пост(ов)</Badge>
                  </div>
                  <a
                    href={extractedThread.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Оригинал
                  </a>
                </div>

                <div className="space-y-2">
                  {extractedThread.posts.map((post, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[hsl(263,70%,50%)]/10 text-xs font-mono text-[hsl(263,70%,60%)] flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words flex-1" data-testid={`text-extracted-post-${i}`}>
                        {post}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3 space-y-3">
                  <div className="space-y-2">
                    <Label>Название шаблона</Label>
                    <Input
                      value={extractTitle}
                      onChange={(e) => setExtractTitle(e.target.value)}
                      placeholder="Название для шаблона..."
                      data-testid="input-extract-title"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => importExtractedMutation.mutate()}
                      disabled={!extractTitle || importExtractedMutation.isPending}
                      data-testid="button-import-extracted"
                    >
                      {importExtractedMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Импорт...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Импортировать как шаблон
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setExtractedThread(null);
                        setExtractTitle("");
                      }}
                      data-testid="button-clear-extracted"
                    >
                      Очистить
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!extractedThread && !extractMutation.isPending && (
            <Card className="overflow-visible">
              <CardContent className="p-12 text-center">
                <Link2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <h3 className="font-semibold mb-1">Извлечение тредов по URL</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Вставьте ссылку на любой публичный тред из Threads.
                  <br />
                  Контент будет автоматически извлечён и готов к импорту как шаблон.
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Без Threads API. Работает через веб-скрейпинг. Firecrawl для лучших результатов (опционально).
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="batch" className="space-y-4">
          <Card className="overflow-visible">
            <CardContent className="p-4 space-y-3">
              <Textarea
                placeholder={"Вставьте ссылки на треды (по одной на строку):\nhttps://www.threads.com/@user1/post/xxx\nhttps://www.threads.com/@user2/post/yyy"}
                value={batchUrls}
                onChange={(e) => setBatchUrls(e.target.value)}
                className="min-h-[120px] text-sm font-mono"
                data-testid="textarea-batch-urls"
              />
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  Максимум 10 URL за раз. Извлечение занимает ~2-3 секунды на URL.
                </p>
                <Button
                  onClick={() => batchExtractMutation.mutate()}
                  disabled={!batchUrls.trim() || batchExtractMutation.isPending}
                  data-testid="button-batch-extract"
                >
                  {batchExtractMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Извлечение...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Извлечь все
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {batchExtractMutation.isPending && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          )}

          {batchErrors.length > 0 && (
            <Card className="overflow-visible border-destructive/30">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-destructive mb-2">Ошибки извлечения:</p>
                {batchErrors.map((err, i) => (
                  <div key={i} className="text-xs text-muted-foreground mb-1">
                    <span className="font-mono">{err.url.substring(0, 60)}...</span>
                    <br />
                    <span className="text-destructive/80">{err.error}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {batchResults.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Извлечено: {batchResults.length} тред(ов)
              </p>
              {batchResults.map((item, idx) => (
                <Card key={idx} className="overflow-visible">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="secondary">@{item.username}</Badge>
                          <Badge variant="outline">{item.posts.length} пост(ов)</Badge>
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words line-clamp-3" data-testid={`text-batch-item-${idx}`}>
                          {item.posts[0]}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => importBatchItemMutation.mutate(item)}
                        disabled={importBatchItemMutation.isPending}
                        data-testid={`button-import-batch-${idx}`}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Импорт
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card className="overflow-visible">
            <CardContent className="p-4">
              <div className="flex gap-3 flex-wrap">
                <Input
                  placeholder="Ключевые слова для поиска тредов..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-[200px]"
                  onKeyDown={(e) => e.key === "Enter" && searchQuery && searchMutation.mutate()}
                  data-testid="input-search-query"
                />
                <Button
                  onClick={() => searchMutation.mutate()}
                  disabled={!searchQuery || searchMutation.isPending}
                  data-testid="button-search"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {searchMutation.isPending ? "Поиск..." : "Найти"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Требует подключённый аккаунт Threads с OAuth токеном.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="user" className="space-y-4">
          <Card className="overflow-visible">
            <CardContent className="p-4">
              <div className="flex gap-3 flex-wrap">
                <Input
                  placeholder="URL, @username или числовой ID (или 'me')"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="flex-1 min-w-[200px]"
                  onKeyDown={(e) => e.key === "Enter" && userId && userThreadsMutation.mutate()}
                  data-testid="input-user-id"
                />
                <Button
                  onClick={() => userThreadsMutation.mutate()}
                  disabled={!userId || userThreadsMutation.isPending}
                  data-testid="button-fetch-user"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {userThreadsMutation.isPending ? "Загрузка..." : "Загрузить треды"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Требует подключённый аккаунт. «me» для своих тредов, числовой ID для чужих (через Threads API).
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {(searchMutation.isPending || userThreadsMutation.isPending) && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      )}

      {selectedThreads.size > 0 && (
        <div className="sticky top-0 z-50 p-3 rounded-md bg-[hsl(263,70%,50%)]/10 border border-[hsl(263,70%,50%)]/20 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-sm font-medium">
            Выбрано: {selectedThreads.size} тред(ов)
          </span>
          <Dialog open={bundleOpen} onOpenChange={setBundleOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-import-bundle">
                <Download className="w-4 h-4 mr-2" />
                Импортировать пакет
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Импорт пакета как шаблон</DialogTitle>
                <DialogDescription>Объедините выбранные треды в один шаблон</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Название шаблона</Label>
                  <Input
                    placeholder="Например: Залетевшие треды @nikidrawsfeels"
                    value={bundleTitle}
                    onChange={(e) => setBundleTitle(e.target.value)}
                    data-testid="input-bundle-title"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedThreads.size} постов будут объединены в один шаблон-цепочку
                </p>
                <Button
                  className="w-full"
                  onClick={() => importBundleMutation.mutate()}
                  disabled={!bundleTitle || importBundleMutation.isPending}
                  data-testid="button-submit-bundle"
                >
                  {importBundleMutation.isPending ? "Импорт..." : "Импортировать"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Найдено: {searchResults.length} тредов (отсортировано по вовлечённости)
          </p>
          {searchResults.map((thread) => (
            <Card
              key={thread.id}
              className={`overflow-visible cursor-pointer transition-colors ${selectedThreads.has(thread.id) ? "border-[hsl(263,70%,50%)]" : ""}`}
              onClick={() => toggleThread(thread.id)}
              data-testid={`card-thread-${thread.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-medium text-[hsl(263,70%,60%)]">@{thread.username}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(thread.timestamp).toLocaleDateString("ru-RU")}
                      </span>
                      {thread.media_type && thread.media_type !== "TEXT_POST" && (
                        <Badge variant="secondary" className="text-[10px]">{thread.media_type}</Badge>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words" data-testid={`text-thread-content-${thread.id}`}>
                      {thread.text}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                      {thread.like_count !== undefined && (
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {thread.like_count.toLocaleString()}
                        </span>
                      )}
                      {thread.reply_count !== undefined && (
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {thread.reply_count.toLocaleString()}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(thread.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {selectedThreads.has(thread.id) && (
                      <Badge className="bg-[hsl(263,70%,50%)] text-white">Выбран</Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        importSingleMutation.mutate(thread);
                      }}
                      disabled={importSingleMutation.isPending}
                      data-testid={`button-import-${thread.id}`}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Импорт
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

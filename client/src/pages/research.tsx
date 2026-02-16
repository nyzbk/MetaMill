import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Download, Heart, MessageCircle, Clock, Plus, Sparkles, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Исследование</h1>
          <p className="text-sm text-muted-foreground mt-1">Поиск залетевших тредов и импорт как шаблонов</p>
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

      <Tabs defaultValue="search" className="space-y-4">
        <TabsList>
          <TabsTrigger value="search" data-testid="tab-search">
            <Search className="w-4 h-4 mr-1.5" />
            Поиск по ключевым словам
          </TabsTrigger>
          <TabsTrigger value="user" data-testid="tab-user">
            <Sparkles className="w-4 h-4 mr-1.5" />
            Треды пользователя
          </TabsTrigger>
        </TabsList>

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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="user" className="space-y-4">
          <Card className="overflow-visible">
            <CardContent className="p-4">
              <div className="flex gap-3 flex-wrap">
                <Input
                  placeholder="ID пользователя Threads (числовой)"
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
                Для @nikidrawsfeels нужен числовой Threads User ID. Используйте ручной импорт если ID неизвестен.
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

      {searchResults.length === 0 && !searchMutation.isPending && !userThreadsMutation.isPending && (
        <Card className="overflow-visible">
          <CardContent className="p-12 text-center">
            <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <h3 className="font-semibold mb-1">Поиск залетевших тредов</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ищите по ключевым словам или загружайте треды пользователя.
              <br />
              Используйте «Ручной импорт» чтобы вставить тред вручную.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Совет: скопируйте тред @nikidrawsfeels и используйте ручной импорт для создания шаблона стиля
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

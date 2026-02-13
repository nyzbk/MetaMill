import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, FileText, MoreHorizontal, GitBranch, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Template } from "@shared/schema";

export default function Templates() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [branches, setBranches] = useState(3);
  const [style, setStyle] = useState("casual");
  const [branchContents, setBranchContents] = useState<string[]>(["", "", ""]);

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/templates", {
        title,
        description,
        branches,
        style,
        content: JSON.stringify(branchContents.slice(0, branches)),
        status: "draft",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setBranches(3);
      setBranchContents(["", "", ""]);
      toast({ title: "Шаблон создан" });
    },
    onError: (e: Error) => {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Шаблон удалён" });
    },
  });

  const handleBranchChange = (count: number) => {
    setBranches(count);
    const newContents = [...branchContents];
    while (newContents.length < count) newContents.push("");
    setBranchContents(newContents.slice(0, count));
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Шаблоны</h1>
          <p className="text-sm text-muted-foreground mt-1">Шаблоны цепочек тредов для автоматизации контента</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-template">
              <Plus className="w-4 h-4 mr-2" />
              Новый шаблон
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Создать шаблон</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input
                  placeholder="Название шаблона"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-template-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Input
                  placeholder="Краткое описание"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="input-template-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Стиль</Label>
                  <Select value={style} onValueChange={setStyle}>
                    <SelectTrigger data-testid="select-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="expert">Expert</SelectItem>
                      <SelectItem value="storytelling">Storytelling</SelectItem>
                      <SelectItem value="controversial">Controversial</SelectItem>
                      <SelectItem value="minimalist">Minimalist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Ветки</Label>
                    <span className="text-sm font-mono text-muted-foreground">{branches}</span>
                  </div>
                  <Slider
                    value={[branches]}
                    onValueChange={([v]) => handleBranchChange(v)}
                    min={1}
                    max={10}
                    step={1}
                    data-testid="slider-branches"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Цепочка треда ({branches} веток)</Label>
                <div className="space-y-3">
                  {Array.from({ length: branches }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center gap-1 pt-3">
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground flex-shrink-0">
                          {i + 1}
                        </div>
                        {i < branches - 1 && <div className="w-[2px] flex-1 bg-border rounded-full min-h-[16px]" />}
                      </div>
                      <Textarea
                        placeholder={`Ветка ${i + 1}...`}
                        className="resize-none text-sm"
                        rows={3}
                        value={branchContents[i] || ""}
                        onChange={(e) => {
                          const newContents = [...branchContents];
                          newContents[i] = e.target.value;
                          setBranchContents(newContents);
                        }}
                        data-testid={`textarea-branch-${i}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={!title || createMutation.isPending}
                data-testid="button-submit-template"
              >
                {createMutation.isPending ? "Создание..." : "Создать шаблон"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {templates && templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => {
            let parsed: string[] = [];
            try { parsed = JSON.parse(t.content); } catch {}
            return (
              <Card key={t.id} className="overflow-visible" data-testid={`card-template-${t.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{t.title}</h3>
                      {t.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {t.status === "active" ? "Активный" : "Черновик"}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(t.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <GitBranch className="w-3.5 h-3.5" />
                      {t.branches} веток
                    </span>
                    <span className="capitalize">{t.style || "casual"}</span>
                  </div>

                  {parsed.length > 0 && parsed[0] && (
                    <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Предпросмотр</p>
                      <p className="text-sm text-foreground line-clamp-2">{parsed[0]}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-visible">
          <CardContent className="p-12 text-center">
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <h3 className="font-semibold mb-1">Шаблонов нет</h3>
            <p className="text-sm text-muted-foreground">Создайте первый шаблон цепочки тредов</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

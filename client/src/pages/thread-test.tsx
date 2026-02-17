import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { FlaskConical, Plus, Trash2, Eye } from "lucide-react";
import { HelpButton } from "@/components/help-button";

export default function ThreadTest() {
  const [branches, setBranches] = useState<string[]>(["", "", ""]);
  const [preview, setPreview] = useState(false);

  const addBranch = () => setBranches([...branches, ""]);
  const removeBranch = (idx: number) => {
    if (branches.length <= 1) return;
    setBranches(branches.filter((_, i) => i !== idx));
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Тест треда</h1>
          <HelpButton
            title="Помощь: Тест треда"
            sections={[
              { title: "Что это?", content: "Инструмент для предпросмотра треда перед публикацией. Вы видите как будет выглядеть ваш тред в Threads." },
              { title: "Как пользоваться?", content: "1. Введите текст каждой ветки треда в редакторе слева\n2. Справа увидите предпросмотр как это будет выглядеть\n3. Добавляйте/удаляйте ветки по необходимости\n4. Когда тред готов — опубликуйте его через AI Генератор или Авто-постинг" },
            ]}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-1">Предпросмотр вашего треда</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Label className="text-sm font-semibold">Редактор ({branches.length} веток)</Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={addBranch} data-testid="button-add-branch">
                <Plus className="w-4 h-4 mr-1" />
                Добавить
              </Button>
              <Button
                variant={preview ? "default" : "outline"}
                size="sm"
                onClick={() => setPreview(!preview)}
                data-testid="button-toggle-preview"
              >
                <Eye className="w-4 h-4 mr-1" />
                Предпросмотр
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {branches.map((text, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center gap-1 pt-3">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground flex-shrink-0">
                    {i + 1}
                  </div>
                  {i < branches.length - 1 && <div className="w-[2px] flex-1 bg-border rounded-full min-h-[16px]" />}
                </div>
                <div className="flex-1 flex gap-2">
                  <Textarea
                    placeholder={`Ветка ${i + 1}...`}
                    className="resize-none text-sm flex-1"
                    rows={3}
                    value={text}
                    onChange={(e) => {
                      const n = [...branches];
                      n[i] = e.target.value;
                      setBranches(n);
                    }}
                    data-testid={`textarea-test-branch-${i}`}
                  />
                  {branches.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeBranch(i)}
                      className="flex-shrink-0 mt-1"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {preview && (
          <div>
            <Label className="text-sm font-semibold mb-4 block">Предпросмотр</Label>
            <Card className="overflow-visible bg-background">
              <CardContent className="p-4">
                <div className="space-y-0">
                  {branches.filter((b) => b.trim()).map((text, i, arr) => (
                    <div key={i} className="flex gap-3 pb-3" data-testid={`preview-branch-${i}`}>
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-xs font-bold text-black flex-shrink-0">
                          M
                        </div>
                        {i < arr.length - 1 && (
                          <div className="w-[2px] flex-1 bg-border rounded-full min-h-[16px]" />
                        )}
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold">metamill</span>
                          <span className="text-xs text-muted-foreground">только что</span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
                        <p className="text-[11px] text-muted-foreground mt-1.5 font-mono">{text.length}/500</p>
                      </div>
                    </div>
                  ))}
                  {branches.every((b) => !b.trim()) && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>Введите текст для предпросмотра</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!preview && (
          <Card className="overflow-visible">
            <CardContent className="p-12 text-center">
              <FlaskConical className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <h3 className="font-semibold mb-1">Предпросмотр треда</h3>
              <p className="text-sm text-muted-foreground">Нажмите Предпросмотр для визуализации треда</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

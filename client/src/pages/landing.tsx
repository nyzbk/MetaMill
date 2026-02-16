import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Factory, Sparkles, CalendarClock, Search, Zap, Shield } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between gap-4 flex-wrap px-6 py-4 border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10">
            <Factory className="w-5 h-5 text-primary" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight" data-testid="text-landing-logo">MetaMill</span>
            <span className="block text-[10px] text-muted-foreground font-mono tracking-wider">ФАБРИКА КОНТЕНТА</span>
          </div>
        </div>
        <a href="/api/login" data-testid="button-login-header">
          <Button>Войти</Button>
        </a>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <section className="max-w-3xl w-full text-center py-16 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-sm text-primary font-medium">
            <Zap className="w-4 h-4" />
            <span>AI-автоматизация для Threads</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight" data-testid="text-landing-headline">
            Контент-фабрика<br />
            <span className="text-primary">нового поколения</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            MetaMill автоматизирует весь цикл создания контента для Threads.net — от AI-генерации до публикации. Подключайте аккаунты, создавайте шаблоны, планируйте публикации.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap pt-4">
            <a href="/api/login" data-testid="button-login-hero">
              <Button size="lg">
                <Sparkles className="w-4 h-4 mr-2" />
                Начать работу
              </Button>
            </a>
          </div>
        </section>

        <section className="max-w-4xl w-full pb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 space-y-3" data-testid="card-feature-ai">
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-base">AI-генерация</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                11 моделей от 6 провайдеров: GPT, Claude, Gemini, Grok, Llama, DeepSeek. Генерация цепочек тредов в один клик.
              </p>
            </Card>

            <Card className="p-5 space-y-3" data-testid="card-feature-scheduler">
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                <CalendarClock className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-base">Авто-постинг</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Планирование публикаций с интервалами от 1 часа. Рекуррентные задачи, автогенерация и публикация по расписанию.
              </p>
            </Card>

            <Card className="p-5 space-y-3" data-testid="card-feature-research">
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                <Search className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-base">Исследование</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Поиск вирусных тредов, импорт стилей, style-matching генерация на основе референсов.
              </p>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 flex-wrap text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="w-3 h-3" />
            <span>MetaMill 2026</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover-elevate px-1 py-0.5 rounded">Конфиденциальность</a>
            <a href="/terms" className="hover-elevate px-1 py-0.5 rounded">Условия</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Circle, ExternalLink, Copy, Check, BookOpen } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

interface MetaConfig {
  hasAppId: boolean;
  hasAppSecret: boolean;
  redirectUri: string;
  configured: boolean;
}

export default function MetaWizard() {
  const [, setLocation] = useLocation();
  const [copiedUri, setCopiedUri] = useState(false);

  const { data: config, isLoading } = useQuery<MetaConfig>({
    queryKey: ["/api/meta/config"],
  });

  const copyRedirectUri = () => {
    if (config?.redirectUri) {
      navigator.clipboard.writeText(config.redirectUri);
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const steps = [
    {
      num: 1,
      title: "Создайте приложение Meta",
      done: false,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Перейдите в Meta for Developers и создайте новое приложение с типом "Business" или "Consumer".
          </p>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Откройте <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-[hsl(263,70%,50%)] underline">developers.facebook.com/apps</a></li>
            <li>Нажмите "Create App"</li>
            <li>Выберите тип "Other" &rarr; "Consumer" или "Business"</li>
            <li>Введите название приложения (например "MetaMill")</li>
          </ol>
          <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" data-testid="button-open-meta-devs">
              <ExternalLink className="w-4 h-4 mr-2" />
              Открыть Meta for Developers
            </Button>
          </a>
        </div>
      ),
    },
    {
      num: 2,
      title: "Добавьте продукт Threads API",
      done: false,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            В панели вашего приложения добавьте продукт "Threads API":
          </p>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>В Dashboard вашего приложения найдите секцию "Add products"</li>
            <li>Найдите "Threads API" и нажмите "Set Up"</li>
            <li>Это активирует API для работы с Threads</li>
          </ol>
        </div>
      ),
    },
    {
      num: 3,
      title: "Скопируйте App ID и App Secret",
      done: config?.hasAppId && config?.hasAppSecret,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            В настройках приложения (Settings &rarr; Basic) найдите и скопируйте:
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {config?.hasAppId ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
              <span className="text-sm"><strong>App ID</strong> — {config?.hasAppId ? "настроен" : "нужно добавить как META_APP_ID в секреты"}</span>
            </div>
            <div className="flex items-center gap-2">
              {config?.hasAppSecret ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
              <span className="text-sm"><strong>App Secret</strong> — {config?.hasAppSecret ? "настроен" : "нужно добавить как META_APP_SECRET в секреты"}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Эти значения нужно добавить как секреты (Secrets) в настройках Replit проекта.
          </p>
        </div>
      ),
    },
    {
      num: 4,
      title: "Настройте Redirect URI",
      done: !!config?.redirectUri,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            В настройках Threads API вашего приложения добавьте следующий Redirect URI:
          </p>
          {config?.redirectUri ? (
            <div className="flex items-center gap-2 bg-muted p-3 rounded-md">
              <code className="text-sm font-mono flex-1 break-all" data-testid="text-redirect-uri">{config.redirectUri}</code>
              <Button size="icon" variant="ghost" onClick={copyRedirectUri} data-testid="button-copy-uri">
                {copiedUri ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-amber-400">Redirect URI будет доступен после деплоя приложения</p>
          )}
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>В Meta App &rarr; Threads API &rarr; Settings</li>
            <li>Добавьте URI выше в "Redirect Callback URLs"</li>
            <li>Также добавьте этот же URI в "Deauthorize Callback URL"</li>
          </ol>
        </div>
      ),
    },
    {
      num: 5,
      title: "Добавьте тестового пользователя",
      done: false,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Пока приложение в режиме разработки (Development), нужно добавить ваш аккаунт Threads как тестового пользователя:
          </p>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>В Meta App &rarr; App Roles &rarr; Roles</li>
            <li>Нажмите "Add People" и введите ваш Threads/Instagram аккаунт</li>
            <li>Выберите роль "Threads Tester"</li>
            <li>Примите приглашение в настройках вашего аккаунта Threads</li>
          </ol>
        </div>
      ),
    },
    {
      num: 6,
      title: "Подключите аккаунт",
      done: config?.configured || false,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Когда всё настроено, перейдите на страницу «Аккаунты» и нажмите «Подключить Threads OAuth».
          </p>
          {config?.configured ? (
            <Button onClick={() => setLocation("/accounts")} data-testid="button-go-accounts">
              Перейти к подключению аккаунта
            </Button>
          ) : (
            <p className="text-sm text-amber-400">Сначала настройте App ID и App Secret (шаг 3)</p>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-[hsl(263,70%,50%)]" />
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Мастер подключения Meta API</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Пошаговая инструкция для подключения Threads API к MetaMill
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="secondary" className={config?.configured ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}>
          {config?.configured ? "API настроен" : "Требуется настройка"}
        </Badge>
      </div>

      <div className="space-y-4">
        {steps.map((step) => (
          <Card key={step.num} className="overflow-visible" data-testid={`card-step-${step.num}`}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 pt-0.5">
                  {step.done ? (
                    <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground">
                      {step.num}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold mb-2">{step.title}</h3>
                  {step.content}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

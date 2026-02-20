import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { insertAccountSchema, insertTemplateSchema, insertPostSchema, insertScheduledJobSchema, insertLlmSettingSchema, insertKeywordMonitorSchema, insertCommentCampaignSchema, llmSettings, keywordMonitors, monitorResults, commentCampaigns, commentLogs, subscriptions, creditTransactions, referralPayouts, errorLogs } from "@shared/schema";
import { generateWithLlm, AVAILABLE_MODELS } from "./llm";
import { getThreadsAuthUrl, exchangeCodeForToken, exchangeForLongLivedToken, getThreadsProfile, publishThreadChain, fetchThreadInsights } from "./threads-api";
import { addSSEClient, notifyPublishSuccess, notifyPublishFailed, notifyEngagementUpdate } from "./notifications";
import { getSchedulerStatus, runScheduledTasks } from "./scheduler";
import { executeCommentCampaign } from "./auto-commenter";
import { searchThreadsByKeyword, getUserThreads, lookupThreadsUser, sortByEngagement, filterViralThreads, importThreadAsTemplate, importMultipleAsTemplate } from "./threads-scraper";
import { getTrends, refreshTrends } from "./trends";
import { repurposeToThread } from "./repurpose";
import { db } from "./db";
import { eq, and, desc, count, sql as dsql, sum } from "drizzle-orm";
import crypto from "crypto";
import { isAuthenticated } from "./replit_integrations/auth";
import { users } from "@shared/schema";

async function isAdmin(req: Request, res: any, next: any) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user.length > 0 && user[0].role === "admin") {
      next();
    } else {
      res.status(403).json({ message: "Admin access required" });
    }
  } catch {
    next(); // allow in dev if DB not ready
  }
}

function getUserId(req: Request): string {
  return (req as any).user?.claims?.sub || "";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── Legal Pages ──
  app.get("/privacy", (_req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>MetaMill - Политика конфиденциальности</title>
<style>body{font-family:Inter,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#e0e0e0;background:#000}
h1{color:#9b59b6}h2{color:#b07ed8;margin-top:28px}a{color:#9b59b6}</style></head>
<body><h1>Политика конфиденциальности MetaMill</h1>
<p>Дата вступления в силу: 16 февраля 2026</p>
<h2>1. Какие данные мы собираем</h2>
<p>MetaMill собирает данные, необходимые для работы с Threads API: идентификатор аккаунта Threads, токен доступа OAuth, публичный профиль пользователя. Мы не собираем пароли и не храним личную переписку.</p>
<h2>2. Как мы используем данные</h2>
<p>Данные используются исключительно для публикации контента в Threads от имени пользователя, генерации контента с помощью AI и управления расписанием публикаций.</p>
<h2>3. Хранение данных</h2>
<p>Данные хранятся в защищённой базе данных PostgreSQL. Токены доступа шифруются. Данные удаляются по запросу пользователя.</p>
<h2>4. Передача данных третьим лицам</h2>
<p>Мы не продаём и не передаём персональные данные третьим лицам, за исключением поставщиков AI-сервисов (OpenRouter, OpenAI и др.) для генерации контента. Контент передаётся без привязки к личности пользователя.</p>
<h2>5. Удаление данных</h2>
<p>Пользователь может запросить удаление всех своих данных, отключив аккаунт в приложении или связавшись с нами. Данные будут удалены в течение 30 дней.</p>
<h2>6. Контакты</h2>
<p>По вопросам конфиденциальности: ultaultimatum@gmail.com</p>
</body></html>`);
  });

  app.get("/terms", (_req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>MetaMill - Пользовательское соглашение</title>
<style>body{font-family:Inter,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#e0e0e0;background:#000}
h1{color:#9b59b6}h2{color:#b07ed8;margin-top:28px}a{color:#9b59b6}</style></head>
<body><h1>Пользовательское соглашение MetaMill</h1>
<p>Дата вступления в силу: 16 февраля 2026</p>
<h2>1. Описание сервиса</h2>
<p>MetaMill — платформа автоматизации контента для Threads.net. Сервис предоставляет инструменты AI-генерации, планирования и публикации контента.</p>
<h2>2. Использование</h2>
<p>Пользователь несёт ответственность за контент, публикуемый через MetaMill. Запрещено использование для спама, разжигания ненависти или нарушения правил Threads.</p>
<h2>3. Ограничение ответственности</h2>
<p>Сервис предоставляется «как есть». Мы не гарантируем бесперебойную работу Threads API и не несём ответственности за действия Meta в отношении аккаунтов пользователей.</p>
</body></html>`);
  });

  app.get("/data-deletion", (_req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>MetaMill - Удаление данных</title>
<style>body{font-family:Inter,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#e0e0e0;background:#000}
h1{color:#9b59b6}h2{color:#b07ed8;margin-top:28px}a{color:#9b59b6}</style></head>
<body><h1>Инструкции по удалению данных</h1>
<p>Для удаления ваших данных из MetaMill:</p>
<ol>
<li>Откройте MetaMill и перейдите в раздел «Аккаунты»</li>
<li>Отключите ваш аккаунт Threads</li>
<li>Все связанные данные будут удалены автоматически</li>
</ol>
<p>Или отправьте запрос на удаление на: ultaultimatum@gmail.com</p>
<p>Данные будут удалены в течение 30 дней с момента запроса.</p>
</body></html>`);
  });

  // ── Accounts ──
  app.get("/api/accounts", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const data = await storage.getAccounts(userId);
    res.json(data);
  });

  app.post("/api/accounts", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const parsed = insertAccountSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const account = await storage.createAccount(parsed.data);
    res.status(201).json(account);
  });

  app.delete("/api/accounts/:id", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    await storage.deleteAccount(parseInt(req.params.id as string), userId);
    res.status(204).send();
  });

  app.put("/api/accounts/:id", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const id = parseInt(req.params.id as string);
    const updated = await storage.updateAccount(id, req.body, userId);
    if (!updated) return res.status(404).json({ message: "Account not found" });
    res.json(updated);
  });

  app.post("/api/accounts/:id/refresh-token", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id as string);
      const allAccounts = await storage.getAccounts(userId);
      const account = allAccounts.find(a => a.id === id);
      if (!account) return res.status(404).json({ message: "Аккаунт не найден" });
      if (!account.accessToken) return res.status(400).json({ message: "У аккаунта нет токена" });

      const { accessToken: newToken, expiresIn } = await exchangeForLongLivedToken(account.accessToken);
      await storage.updateAccount(id, {
        accessToken: newToken,
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        status: "active",
      }, userId);

      res.json({ success: true, expiresIn });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Templates ──
  app.get("/api/templates", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const data = await storage.getTemplates(userId);
    res.json(data);
  });

  app.post("/api/templates", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const parsed = insertTemplateSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const template = await storage.createTemplate(parsed.data);
    res.status(201).json(template);
  });

  app.delete("/api/templates/:id", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    await storage.deleteTemplate(parseInt(req.params.id as string), userId);
    res.status(204).send();
  });

  app.post("/api/templates/starter-presets", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const presets = [
      {
        title: "Экспертный разбор",
        description: "Глубокий анализ темы с инсайтами",
        branches: 5,
        style: "educational",
        content: JSON.stringify([
          "Большинство людей неправильно понимают [тему]. Давайте разберёмся 🧵",
          "Первое, что нужно знать: [ключевой факт]. Это меняет всё восприятие.",
          "Но вот что действительно важно: [инсайт]. Исследования показывают...",
          "Как это применить на практике? [конкретные шаги]",
          "Сохраняйте тред и делитесь с теми, кому это полезно. Подписывайтесь для больше разборов."
        ]),
        status: "draft",
        userId,
      },
      {
        title: "История/Кейс",
        description: "Формат storytelling с выводом",
        branches: 5,
        style: "storytelling",
        content: JSON.stringify([
          "В 2024 году [персонаж] принял решение, которое изменило всё. Вот что произошло:",
          "Начало было обычным: [контекст ситуации]. Ничего не предвещало...",
          "Но потом произошло [поворотный момент]. И вот здесь начинается самое интересное.",
          "Результат? [итог истории]. Цифры говорят сами за себя.",
          "Главный вывод: [мораль/урок]. Запомните это."
        ]),
        status: "draft",
        userId,
      },
      {
        title: "Топ-лист",
        description: "Список советов или фактов",
        branches: 5,
        style: "casual",
        content: JSON.stringify([
          "5 вещей, которые я узнал о [теме] за последний год:",
          "1. [Первый пункт]. Это кажется очевидным, но 90% людей это игнорируют.",
          "2-3. [Второй и третий пункты]. Эти два связаны между собой...",
          "4. [Четвёртый пункт]. Самый недооценённый совет в списке.",
          "5. [Пятый пункт]. Сохраните этот тред — пригодится. Какой пункт для вас самый полезный?"
        ]),
        status: "draft",
        userId,
      },
      {
        title: "Разрушение мифов",
        description: "Формат 'миф vs реальность'",
        branches: 4,
        style: "professional",
        content: JSON.stringify([
          "3 мифа о [теме], в которые до сих пор верят. Пора это исправить:",
          "Миф 1: «[распространённое заблуждение]». Реальность: [факт с доказательством].",
          "Миф 2: «[ещё одно заблуждение]». На самом деле: [правда].",
          "Миф 3: «[третье заблуждение]». Данные говорят обратное: [статистика]. Какие мифы знаете вы?"
        ]),
        status: "draft",
        userId,
      },
      {
        title: "Пошаговая инструкция",
        description: "Практический гайд с действиями",
        branches: 5,
        style: "educational",
        content: JSON.stringify([
          "Как [достичь цели] за 30 минут. Пошаговая инструкция:",
          "Шаг 1: [первое действие]. Это занимает 5 минут. Важно: [нюанс].",
          "Шаг 2: [второе действие]. Здесь большинство допускают ошибку — [типичная ошибка].",
          "Шаг 3: [третье действие]. Профессиональный лайфхак: [совет].",
          "Готово! Теперь вы знаете как [результат]. Сохраните и попробуйте сегодня."
        ]),
        status: "draft",
        userId,
      },
    ];

    const created = [];
    for (const preset of presets) {
      const template = await storage.createTemplate(preset as any);
      created.push(template);
    }
    res.status(201).json(created);
  });

  // ── Posts ──
  app.get("/api/posts", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const data = await storage.getPosts(userId);
    res.json(data);
  });

  app.post("/api/posts", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const parsed = insertPostSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const post = await storage.createPost(parsed.data);
    res.status(201).json(post);
  });

  // ── Scheduled Jobs ──
  app.get("/api/scheduled-jobs", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const data = await storage.getScheduledJobs(userId);
    res.json(data);
  });

  app.post("/api/scheduled-jobs", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const parsed = insertScheduledJobSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const job = await storage.createScheduledJob(parsed.data);
    res.status(201).json(job);
  });

  app.delete("/api/scheduled-jobs/:id", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    await storage.deleteScheduledJob(parseInt(req.params.id as string), userId);
    res.status(204).send();
  });

  app.get("/api/scheduler/status", isAuthenticated, (_req, res) => {
    res.json(getSchedulerStatus());
  });

  app.post("/api/scheduled-jobs/:id/run-now", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const id = parseInt(req.params.id as string);
    const job = await storage.getScheduledJob(id, userId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    await storage.updateScheduledJob(id, {
      status: "pending",
      scheduledAt: new Date(),
      nextRunAt: new Date(),
    }, userId);
    res.json({ message: "Задача поставлена в очередь" });
  });

  app.post("/api/scheduled-jobs/:id/pause", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const id = parseInt(req.params.id as string);
    const job = await storage.getScheduledJob(id, userId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    await storage.updateScheduledJob(id, { status: "paused" }, userId);
    res.json({ message: "Задача приостановлена" });
  });

  app.post("/api/scheduled-jobs/:id/resume", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const id = parseInt(req.params.id as string);
    const job = await storage.getScheduledJob(id, userId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    await storage.updateScheduledJob(id, {
      status: job.isRecurring ? "recurring" : "pending",
      nextRunAt: job.nextRunAt || job.scheduledAt || new Date(),
    }, userId);
    res.json({ message: "Задача возобновлена" });
  });

  // ── Cron for Vercel ──
  app.get("/api/cron", async (req, res) => {
    // Vercel Cron automatically adds this header
    // Or you can manual curl with: -H "Authorization: Bearer <CRON_SECRET>"
    const authHeader = req.headers['authorization'];
    const expectedSecret = process.env.CRON_SECRET;

    // Allow valid CRON_SECRET or Vercel's internal cron signature if you advanced fitlering
    // For simplicity, we check if CRON_SECRET matches (if set)
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      await runScheduledTasks();
      res.json({ success: true, message: "Scheduled tasks executed" });
    } catch (error: any) {
      console.error("Cron execution failed:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ── LLM Settings ──
  app.get("/api/llm-settings", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const data = await storage.getLlmSettings(userId);
    res.json(data);
  });

  app.get("/api/llm-models", isAuthenticated, async (_req, res) => {
    res.json(AVAILABLE_MODELS);
  });

  app.post("/api/llm-settings", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const parsed = insertLlmSettingSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const setting = await storage.createLlmSetting(parsed.data);
    res.status(201).json(setting);
  });

  app.put("/api/llm-settings/:id", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const id = parseInt(req.params.id as string);
    const partial = insertLlmSettingSchema.partial().safeParse(req.body);
    if (!partial.success) return res.status(400).json({ message: partial.error.message });
    const updated = await storage.updateLlmSetting(id, partial.data, userId);
    if (!updated) return res.status(404).json({ message: "Setting not found" });
    res.json(updated);
  });

  app.delete("/api/llm-settings/:id", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    await storage.deleteLlmSetting(parseInt(req.params.id as string), userId);
    res.status(204).send();
  });

  app.post("/api/llm-settings/:id/set-default", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const id = parseInt(req.params.id as string);
    await db.update(llmSettings).set({ isDefault: false }).where(
      and(eq(llmSettings.isDefault, true), eq(llmSettings.userId, userId))
    );
    const updated = await storage.updateLlmSetting(id, { isDefault: true }, userId);
    if (!updated) return res.status(404).json({ message: "Setting not found" });
    res.json(updated);
  });

  // ── User Niche ──
  app.get("/api/user-niche", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const [niche] = await db.select().from(llmSettings).where(
      and(eq(llmSettings.userId, userId), eq(llmSettings.provider, "user_niche"))
    );
    res.json({ niche: niche?.apiKey || "" });
  });

  app.post("/api/user-niche", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const { niche } = req.body;
    const [existing] = await db.select().from(llmSettings).where(
      and(eq(llmSettings.userId, userId), eq(llmSettings.provider, "user_niche"))
    );
    if (existing) {
      await db.update(llmSettings).set({ apiKey: niche || "" }).where(eq(llmSettings.id, existing.id));
    } else {
      await db.insert(llmSettings).values({
        userId,
        provider: "user_niche",
        modelId: "niche",
        displayName: "Тема/Ниша пользователя",
        apiKey: niche || "",
        isDefault: false,
        isActive: true,
      });
    }
    res.json({ niche: niche || "" });
  });

  // ── AI Generation ──
  app.post("/api/generate", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { topic, reference, style, branches, directives, provider, modelId, templateId } = req.body;
      if (!topic) return res.status(400).json({ message: "Topic is required" });

      let llmSetting: { provider: string; modelId: string; apiKey?: string | null; baseUrl?: string | null } | null = null;

      if (provider && modelId) {
        const allSettings = await storage.getLlmSettings(userId);
        const match = allSettings.find(s => s.provider === provider && s.modelId === modelId);
        llmSetting = {
          provider,
          modelId,
          apiKey: match?.apiKey || null,
          baseUrl: match?.baseUrl || null,
        };
      } else {
        const defaultSetting = await storage.getDefaultLlmSetting(userId);
        if (defaultSetting) {
          llmSetting = defaultSetting;
        } else {
          const allSettings = await storage.getLlmSettings(userId);
          const firstActive = allSettings.find(s => s.isActive && s.provider !== "firecrawl" && s.provider !== "user_niche");
          if (firstActive) {
            llmSetting = firstActive;
          }
        }
      }

      if (!llmSetting) {
        return res.status(400).json({ message: "LLM провайдер не настроен. Добавьте провайдер со своим API ключом в разделе Настройки." });
      }

      let referenceContent = "";
      if (templateId) {
        const parsedTemplateId = parseInt(String(templateId), 10);
        if (isNaN(parsedTemplateId)) return res.status(400).json({ message: "Invalid templateId" });
        const template = await storage.getTemplate(parsedTemplateId, userId);
        if (template?.content) {
          try {
            const parsed = JSON.parse(template.content);
            const posts = Array.isArray(parsed) ? parsed : [parsed];
            referenceContent = `\n\nHere is a reference thread to match the style of:\n${posts.map((p: string, i: number) => `[Post ${i + 1}] ${p}`).join("\n")}\n\nIMPORTANT: Match the tone, structure, and style of the reference thread above, but create NEW original content about the given topic.`;
          } catch {
            referenceContent = `\n\nReference style: ${template.content}`;
          }
        }
      }

      const [nicheRow] = await db.select().from(llmSettings).where(
        and(eq(llmSettings.userId, userId), eq(llmSettings.provider, "user_niche"))
      );
      const userNiche = nicheRow?.apiKey || "";

      const systemPrompt = `You are MetaMill, an AI content generator for Threads (social media platform by Meta).
Generate a thread chain with exactly ${branches || 5} posts.
Each post should be under 500 characters.
${userNiche ? `IMPORTANT: The user's niche/topic is: "${userNiche}". All content MUST be relevant to this niche.` : ""}
${style ? `Tone/style: ${style}` : ""}
${reference ? `Match the style of this reference: "${reference}"` : ""}
${directives ? `Additional directives: ${directives}` : ""}
${referenceContent}

Return ONLY a valid JSON object in this exact format:
{"branches": ["post 1 text", "post 2 text", ...]}

The first post should be a hook that grabs attention.
Each subsequent post should build on the previous one.
The last post should be a strong call to action or conclusion.
Write in Russian language.`;

      const content = await generateWithLlm(llmSetting, {
        systemPrompt,
        userPrompt: `Generate a thread about: ${topic}`,
        jsonMode: true,
        maxTokens: 4096,
      });

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = { branches: [content] };
      }

      if (!parsed.branches || !Array.isArray(parsed.branches)) {
        parsed = { branches: [content] };
      }

      res.json(parsed);
    } catch (error: any) {
      console.error("AI generation error:", error);
      res.status(500).json({ message: error.message || "AI generation failed" });
    }
  });

  // ── Carousel Generation ──
  app.post("/api/generate-carousel", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { topic, numSlides, ctaKeyword, provider, modelId } = req.body;
      if (!topic) return res.status(400).json({ message: "Тема обязательна" });
      const slideCount = Math.max(3, Math.min(10, numSlides || 5));

      let llmSetting: { provider: string; modelId: string; apiKey?: string | null; baseUrl?: string | null } | null = null;

      if (provider && modelId) {
        const allSettings = await storage.getLlmSettings(userId);
        const match = allSettings.find(s => s.provider === provider && s.modelId === modelId);
        llmSetting = {
          provider,
          modelId,
          apiKey: match?.apiKey || null,
          baseUrl: match?.baseUrl || null,
        };
      } else {
        const defaultSetting = await storage.getDefaultLlmSetting(userId);
        if (defaultSetting) {
          llmSetting = defaultSetting;
        } else {
          const allSettings = await storage.getLlmSettings(userId);
          const firstActive = allSettings.find(s => s.isActive && s.provider !== "firecrawl" && s.provider !== "user_niche");
          if (firstActive) {
            llmSetting = firstActive;
          }
        }
      }

      if (!llmSetting) {
        return res.status(400).json({ message: "LLM провайдер не настроен. Добавьте провайдер со своим API ключом в разделе Настройки." });
      }

      const [nicheRow] = await db.select().from(llmSettings).where(
        and(eq(llmSettings.userId, userId), eq(llmSettings.provider, "user_niche"))
      );
      const userNiche = nicheRow?.apiKey || "";

      const systemPrompt = `You are a carousel content generator for Threads/Instagram. Generate content in Russian.
Return a JSON object with this EXACT structure:
{
  "first_page_title": "Hook title (max 75 chars, use CAPS for 1-2 power words)",
  "content_pages": [
    {
      "title": "Numbered header (max 7 words)",
      "intro_paragraph": "Short intro (max 15 words)",
      "points": ["paragraph 1", "paragraph 2"],
      "blockquote_text": "Result/consequence (max 15 words)"
    }
  ],
  "call_to_action_page": {
    "title": "CTA title",
    "description": "Value proposition (max 10 words)"
  }
}
Generate exactly ${slideCount} content_pages.`;

      const userPrompt = `Topic: ${topic}
CTA keyword: ${ctaKeyword || "ПОДПИШИСЬ"}
${userNiche ? `User niche: ${userNiche}` : ""}
Generate a viral carousel about this topic. Make it engaging and actionable.`;

      const content = await generateWithLlm(llmSetting, {
        systemPrompt,
        userPrompt,
        jsonMode: true,
        maxTokens: 4096,
      });

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        return res.status(500).json({ message: "Не удалось разобрать ответ AI. Попробуйте ещё раз." });
      }

      if (!parsed.first_page_title || !Array.isArray(parsed.content_pages) || !parsed.call_to_action_page) {
        return res.status(500).json({ message: "AI вернул некорректную структуру. Попробуйте ещё раз." });
      }

      res.json(parsed);
    } catch (error: any) {
      console.error("Carousel generation error:", error);
      res.status(500).json({ message: error.message || "Ошибка генерации карусели" });
    }
  });

  // ── Threads OAuth ──
  const pendingOAuthStates = new Map<string, { userId: string; createdAt: number }>();

  setInterval(() => {
    const now = Date.now();
    const keys: string[] = [];
    pendingOAuthStates.forEach((val, key) => {
      if (now - val.createdAt > 600000) keys.push(key);
    });
    keys.forEach(k => pendingOAuthStates.delete(k));
  }, 60000);

  function createOAuthState(userId: string): string {
    const nonce = crypto.randomBytes(16).toString("hex");
    const timestamp = Date.now().toString();
    const secret = process.env.SESSION_SECRET || "metamill-oauth-secret";
    const payload = `${timestamp}:${nonce}`;
    const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
    const state = Buffer.from(`${payload}:${hmac}`).toString("base64url");
    pendingOAuthStates.set(state, { userId, createdAt: Date.now() });
    return state;
  }

  function consumeOAuthState(state: string): { valid: boolean; userId: string } {
    try {
      const decoded = Buffer.from(state, "base64url").toString();
      const parts = decoded.split(":");
      if (parts.length < 3) return { valid: false, userId: "" };
      const [timestamp, _nonce, hmac] = [parts[0], parts[1], parts[2]];
      if (!timestamp || !hmac) return { valid: false, userId: "" };
      const secret = process.env.SESSION_SECRET || "metamill-oauth-secret";
      const expected = crypto.createHmac("sha256", secret).update(`${timestamp}:${parts[1]}`).digest("hex").slice(0, 16);
      if (hmac !== expected) return { valid: false, userId: "" };
      const age = Date.now() - parseInt(timestamp);
      if (age > 600000) return { valid: false, userId: "" };

      const pending = pendingOAuthStates.get(state);
      if (!pending) return { valid: false, userId: "" };
      pendingOAuthStates.delete(state);

      return { valid: true, userId: pending.userId };
    } catch {
      return { valid: false, userId: "" };
    }
  }

  app.post("/api/auth/threads/deauthorize", (req, res) => {
    console.log("[threads] Deauthorize callback received:", req.body);
    res.json({ success: true });
  });

  app.post("/api/auth/threads/delete", (req, res) => {
    console.log("[threads] Data deletion request received:", req.body);
    const confirmationCode = crypto.randomBytes(8).toString("hex");
    const host = process.env.REPLIT_DEPLOYMENT_URL || process.env.REPLIT_DEV_DOMAIN || "localhost:5000";
    res.json({
      url: `https://${host}/api/auth/threads/delete-status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  });

  app.get("/api/auth/threads/delete-status", (req, res) => {
    res.json({ status: "complete" });
  });

  app.get("/api/auth/threads", isAuthenticated, (req, res) => {
    try {
      const userId = getUserId(req);
      const state = createOAuthState(userId);
      const authUrl = getThreadsAuthUrl(state);
      res.json({ url: authUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/auth/threads/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query;
      console.log("OAuth callback received:", { code: code ? "present" : "missing", state: state ? "present" : "missing", error });
      if (error) {
        return res.redirect("/accounts?auth_error=" + encodeURIComponent(String(error)));
      }
      if (!code || !state) {
        return res.redirect("/accounts?auth_error=missing_params");
      }
      const stateResult = consumeOAuthState(String(state));
      if (!stateResult.valid) {
        console.log("OAuth state verification failed");
        return res.redirect("/accounts?auth_error=invalid_state_try_again");
      }

      const userId = stateResult.userId || getUserId(req);
      if (!userId) {
        return res.redirect("/accounts?auth_error=session_expired_login_again");
      }

      console.log("Exchanging code for token...");
      const { accessToken: shortToken, userId: threadsUserId } = await exchangeCodeForToken(String(code));
      console.log("Got short token, exchanging for long-lived...");
      const { accessToken: longToken, expiresIn } = await exchangeForLongLivedToken(shortToken);
      console.log("Got long-lived token, fetching profile...");
      const profile = await getThreadsProfile(longToken, threadsUserId);
      console.log("Profile fetched:", profile.username, "threadsUserId:", profile.threadsUserId);

      const resolvedThreadsUserId = profile.threadsUserId || threadsUserId;

      const allAccounts = await storage.getAccounts(userId);
      const existing = allAccounts.find(
        (a) => a.threadsUserId === resolvedThreadsUserId || a.threadsUserId === threadsUserId
      );

      if (existing) {
        await storage.updateAccount(existing.id, {
          accessToken: longToken,
          threadsUserId: resolvedThreadsUserId,
          username: profile.username,
          avatarUrl: profile.profilePictureUrl || existing.avatarUrl,
          tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
          status: "active",
        }, userId);
        console.log("Updated existing account:", existing.id);
      } else {
        const newAccount = await storage.createAccount({
          userId,
          username: profile.username,
          platform: "threads",
          accessToken: longToken,
          threadsUserId: resolvedThreadsUserId,
          avatarUrl: profile.profilePictureUrl,
          tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
          status: "active",
        });
        console.log("Created new account:", newAccount.id);
      }

      res.redirect("/accounts?auth_success=true");
    } catch (error: any) {
      console.error("OAuth callback error:", error);
      res.redirect("/accounts?auth_error=" + encodeURIComponent(error.message));
    }
  });

  app.get("/api/auth/threads/status", (_req, res) => {
    const hasCredentials = !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
    res.json({ configured: hasCredentials });
  });

  // ── Publish (Threads API + DB save) ──
  app.post("/api/publish", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { accountId, branches } = req.body;
      if (!accountId || !branches) return res.status(400).json({ message: "accountId and branches required" });
      if (!Array.isArray(branches) || branches.length === 0 || branches.length > 25) {
        return res.status(400).json({ message: "branches must be an array of 1-25 strings" });
      }
      if (!branches.every((b: any) => typeof b === "string" && b.length > 0 && b.length <= 500)) {
        return res.status(400).json({ message: "Each branch must be a non-empty string under 500 characters" });
      }

      const account = await storage.getAccount(accountId, userId);
      if (!account) return res.status(404).json({ message: "Account not found" });

      if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
        return res.status(401).json({ message: "Токен OAuth истёк. Переподключите аккаунт через Threads." });
      }

      if (!account.accessToken || !account.threadsUserId) {
        const createdPosts = [];
        for (let i = 0; i < branches.length; i++) {
          const post = await storage.createPost({
            userId,
            accountId,
            content: branches[i],
            threadPosition: i,
            status: "draft",
          });
          createdPosts.push(post);
        }
        return res.json({
          posts: createdPosts,
          warning: "Аккаунт не подключён через OAuth. Посты сохранены как черновики.",
        });
      }

      const { mediaIds, errors } = await publishThreadChain(
        account.accessToken,
        account.threadsUserId,
        branches
      );

      const createdPosts = [];
      // ... existing code ... note: keeping context minimal
      // Since replace_file_content requires exact match, I'll append routes at the end of the file instead of inserting mid-file if possible
      // But standard practice is grouping. I will add them before end of function.

      for (let i = 0; i < branches.length; i++) {
        const post = await storage.createPost({
          userId,
          accountId,
          content: branches[i],
          threadPosition: i,
          threadsMediaId: mediaIds[i] || null,
          parentPostId: i > 0 ? mediaIds[i - 1] || null : null,
          status: mediaIds[i] ? "published" : "failed",
          publishedAt: mediaIds[i] ? new Date() : null,
        });
        createdPosts.push(post);
      }

      const totalBranches = branches.length;
      const failedCount = totalBranches - mediaIds.length;

      if (mediaIds.length > 0 && failedCount === 0) {
        notifyPublishSuccess(userId, mediaIds.length, account.username);
      } else if (mediaIds.length > 0 && failedCount > 0) {
        notifyPublishFailed(userId, `Частично: ${mediaIds.length}/${totalBranches} веток. ${errors.join("; ")}`, account.username);
      } else {
        notifyPublishFailed(userId, errors.join("; ") || "Все ветки не удалось опубликовать", account.username);
      }

      res.json({
        posts: createdPosts,
        published: mediaIds.length,
        total: totalBranches,
        failed: failedCount,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("Publish error:", error);
      const userId = getUserId(req);
      notifyPublishFailed(userId, error.message || "Publishing failed", "");
      res.status(500).json({ message: error.message || "Publishing failed" });
    }
  });

  // ── Research / Scraper ──
  async function getThreadsAccessToken(userId: string): Promise<string | null> {
    const userAccounts = await storage.getAccounts(userId);
    const connectedAccount = userAccounts.find(a => a.accessToken && a.threadsUserId);
    if (connectedAccount?.accessToken) return connectedAccount.accessToken;
    return process.env.THREADS_USER_TOKEN || null;
  }

  app.post("/api/research/search", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { query, limit } = req.body;
      if (!query) return res.status(400).json({ message: "query is required" });

      const token = await getThreadsAccessToken(userId);
      if (!token) {
        return res.status(400).json({ message: "Нет токена Threads API. Подключите аккаунт через OAuth." });
      }

      const threads = await searchThreadsByKeyword(token, query, limit || 25);
      const sorted = sortByEngagement(threads);
      res.json({ threads: sorted, total: sorted.length });
    } catch (error: any) {
      console.error("Search error:", error);
      res.status(500).json({ message: error.message || "Search failed" });
    }
  });

  app.post("/api/research/user-threads", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      let { userId: threadUserId, limit } = req.body;
      if (!threadUserId) return res.status(400).json({ message: "userId is required" });

      const urlMatch = String(threadUserId).match(/threads\.(?:net|com)\/@?([^\/\?\s]+)/);
      if (urlMatch) {
        threadUserId = urlMatch[1];
      }
      threadUserId = String(threadUserId).replace(/^@/, "").trim();

      const token = await getThreadsAccessToken(userId);
      if (!token) {
        return res.status(400).json({ message: "Нет токена Threads API. Подключите аккаунт через OAuth." });
      }

      let resolvedId: string;
      if (threadUserId.toLowerCase() === "me") {
        resolvedId = "me";
      } else {
        const userAccounts = await storage.getAccounts(userId);
        const matchedAccount = userAccounts.find(
          a => a.accessToken && a.threadsUserId && a.username?.toLowerCase() === threadUserId.toLowerCase()
        );

        if (matchedAccount) {
          resolvedId = matchedAccount.threadsUserId!;
        } else if (/^\d+$/.test(threadUserId)) {
          resolvedId = threadUserId;
        } else {
          return res.status(400).json({
            message: `Имя "@${threadUserId}" нельзя использовать напрямую. Threads API позволяет загружать треды только подключённого аккаунта. Используйте "me" или подключите аккаунт через OAuth. Для чужих аккаунтов используйте «Ручной импорт».`
          });
        }
      }

      const threads = await getUserThreads(token, resolvedId, limit || 50);
      const sorted = sortByEngagement(threads);
      res.json({ threads: sorted, total: sorted.length });
    } catch (error: any) {
      console.error("User threads error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch threads" });
    }
  });

  app.post("/api/research/user-lookup", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { userId: lookupUserId } = req.body;
      if (!lookupUserId) return res.status(400).json({ message: "userId is required" });

      const token = await getThreadsAccessToken(userId);
      if (!token) {
        return res.status(400).json({ message: "Нет токена Threads API." });
      }

      const profile = await lookupThreadsUser(token, lookupUserId);
      res.json(profile);
    } catch (error: any) {
      console.error("User lookup error:", error);
      res.status(500).json({ message: error.message || "User lookup failed" });
    }
  });

  app.post("/api/research/import-thread", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { text, username, likeCount, timestamp, accountId } = req.body;
      if (!text || typeof text !== "string") return res.status(400).json({ message: "text is required" });

      const template = await importThreadAsTemplate(
        { id: "", text, username: username || "unknown", timestamp: timestamp || new Date().toISOString(), like_count: likeCount || 0 },
        accountId,
        userId
      );
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/research/import-bundle", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { threads, title, accountId } = req.body;
      if (!threads || !Array.isArray(threads) || threads.length === 0) {
        return res.status(400).json({ message: "threads array is required" });
      }
      if (!title) return res.status(400).json({ message: "title is required" });

      const template = await importMultipleAsTemplate(threads, title, accountId, userId);
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/research/import-manual", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { branches, title, style, sourceUsername, accountId } = req.body;
      if (!branches || !Array.isArray(branches) || branches.length === 0 || !branches.every((b: any) => typeof b === "string")) {
        return res.status(400).json({ message: "branches must be an array of strings" });
      }
      if (!title || typeof title !== "string") return res.status(400).json({ message: "title is required" });

      const cleanBranches = branches.filter((b: string) => b.trim().length > 0);
      if (cleanBranches.length === 0) return res.status(400).json({ message: "At least one non-empty branch is required" });

      const template = await storage.createTemplate({
        userId,
        title,
        description: sourceUsername ? `Импорт стиля от @${sourceUsername}` : "Ручной импорт треда",
        branches: cleanBranches.length,
        content: JSON.stringify(cleanBranches),
        style: style || "reference",
        accountId: accountId || null,
        status: "active",
      });
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Meta API Config (for wizard) ──
  app.get("/api/meta/config", isAuthenticated, (_req, res) => {
    const hasAppId = !!process.env.META_APP_ID;
    const hasAppSecret = !!process.env.META_APP_SECRET;
    let redirectUri = "";
    if (process.env.THREADS_REDIRECT_URI) {
      redirectUri = process.env.THREADS_REDIRECT_URI;
    } else if (process.env.REPLIT_DEPLOYMENT_URL) {
      redirectUri = `https://${process.env.REPLIT_DEPLOYMENT_URL}/api/auth/threads/callback`;
    } else if (process.env.REPLIT_DEV_DOMAIN) {
      redirectUri = `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/threads/callback`;
    }
    res.json({
      hasAppId,
      hasAppSecret,
      redirectUri,
      configured: hasAppId && hasAppSecret,
    });
  });

  // ── Trends ──
  app.get("/api/trends", isAuthenticated, async (_req, res) => {
    try {
      const items = await getTrends(50);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/trends/refresh", isAuthenticated, async (_req, res) => {
    try {
      const count = await refreshTrends();
      res.json({ refreshed: count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Keyword Monitors ──
  app.get("/api/keyword-monitors", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const monitors = await db.select().from(keywordMonitors).where(eq(keywordMonitors.userId, userId)).orderBy(desc(keywordMonitors.createdAt));
    res.json(monitors);
  });

  app.post("/api/keyword-monitors", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const parsed = insertKeywordMonitorSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const [monitor] = await db.insert(keywordMonitors).values(parsed.data).returning();
    res.status(201).json(monitor);
  });

  app.delete("/api/keyword-monitors/:id", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const id = parseInt(req.params.id as string);
    await db.delete(keywordMonitors).where(and(eq(keywordMonitors.id, id), eq(keywordMonitors.userId, userId)));
    await db.delete(monitorResults).where(eq(monitorResults.monitorId, id));
    res.status(204).send();
  });

  app.get("/api/keyword-monitors/:id/results", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const id = parseInt(req.params.id as string);
    const results = await db.select().from(monitorResults).where(
      and(eq(monitorResults.monitorId, id), eq(monitorResults.userId, userId))
    ).orderBy(desc(monitorResults.fetchedAt)).limit(50);
    res.json(results);
  });

  app.post("/api/keyword-monitors/:id/check", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id as string);
      const [monitor] = await db.select().from(keywordMonitors).where(
        and(eq(keywordMonitors.id, id), eq(keywordMonitors.userId, userId))
      );
      if (!monitor) return res.status(404).json({ message: "Monitor not found" });

      const token = await getThreadsAccessToken(userId);
      if (!token) return res.status(400).json({ message: "Нет токена Threads API" });

      const threads = await searchThreadsByKeyword(token, monitor.keyword, 20);
      const sorted = sortByEngagement(threads);

      const newResults = [];
      for (const t of sorted.slice(0, 10)) {
        const [inserted] = await db.insert(monitorResults).values({
          monitorId: id,
          userId,
          threadText: t.text || "",
          author: t.username || null,
          url: t.id ? `https://threads.net/t/${t.id}` : null,
          likeCount: t.like_count || 0,
        }).returning();
        newResults.push(inserted);
      }

      await db.update(keywordMonitors).set({ lastCheckedAt: new Date() }).where(eq(keywordMonitors.id, id));

      res.json({ found: newResults.length, results: newResults });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Thread Extraction (URL scraping, no Threads API) ──
  app.post("/api/research/extract-url", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { url } = req.body;
      if (!url || typeof url !== "string") return res.status(400).json({ message: "URL обязателен" });

      let firecrawlApiKey: string | null = null;
      const allSettings = await storage.getLlmSettings(userId);
      const fcSetting = allSettings.find(s => s.provider === "firecrawl");
      if (fcSetting?.apiKey) firecrawlApiKey = fcSetting.apiKey;

      const { extractThreadFromUrl } = await import("./thread-extractor");
      const extracted = await extractThreadFromUrl(url.trim(), { firecrawlApiKey, userId });
      res.json(extracted);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/research/extract-and-import", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { url, title, accountId } = req.body;
      if (!url || typeof url !== "string") return res.status(400).json({ message: "URL обязателен" });

      let firecrawlApiKey: string | null = null;
      const allSettings = await storage.getLlmSettings(userId);
      const fcSetting = allSettings.find(s => s.provider === "firecrawl");
      if (fcSetting?.apiKey) firecrawlApiKey = fcSetting.apiKey;

      const { extractAndImport } = await import("./thread-extractor");
      const result = await extractAndImport(url.trim(), { firecrawlApiKey, userId, title, accountId });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/research/extract-batch", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { urls } = req.body;
      if (!urls || !Array.isArray(urls) || urls.length === 0) return res.status(400).json({ message: "urls обязателен" });
      if (urls.length > 10) return res.status(400).json({ message: "Максимум 10 URL за раз" });

      let firecrawlApiKey: string | null = null;
      const allSettings = await storage.getLlmSettings(userId);
      const fcSetting = allSettings.find(s => s.provider === "firecrawl");
      if (fcSetting?.apiKey) firecrawlApiKey = fcSetting.apiKey;

      const { extractMultipleUrls } = await import("./thread-extractor");
      const result = await extractMultipleUrls(urls, { firecrawlApiKey, userId });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Content Repurpose ──
  app.post("/api/repurpose", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { url, branches, style, provider, modelId } = req.body;
      if (!url) return res.status(400).json({ message: "URL обязателен" });

      let llmSetting: { provider: string; modelId: string; apiKey?: string | null; baseUrl?: string | null } | null = null;

      if (provider && modelId) {
        const allSettings = await storage.getLlmSettings(userId);
        const match = allSettings.find(s => s.provider === provider && s.modelId === modelId);
        llmSetting = { provider, modelId, apiKey: match?.apiKey || null, baseUrl: match?.baseUrl || null };
      } else {
        const defaultSetting = await storage.getDefaultLlmSetting(userId);
        if (defaultSetting) {
          llmSetting = defaultSetting;
        } else {
          const allSettings = await storage.getLlmSettings(userId);
          const firstActive = allSettings.find(s => s.isActive && s.provider !== "firecrawl" && s.provider !== "user_niche");
          if (firstActive) llmSetting = firstActive;
        }
      }

      if (!llmSetting) {
        return res.status(400).json({ message: "LLM провайдер не настроен. Добавьте провайдер со своим API ключом в разделе Настройки." });
      }

      const [nicheRowR] = await db.select().from(llmSettings).where(
        and(eq(llmSettings.userId, userId), eq(llmSettings.provider, "user_niche"))
      );

      const result = await repurposeToThread(url, {
        branches: branches || 5,
        style,
        ...llmSetting,
        userId,
        userNiche: nicheRowR?.apiKey || "",
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Batch Schedule (from trends) ──
  app.post("/api/batch-schedule", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { trends: trendTopics, accountId, style, branches: branchCount, scheduledAt, intervalMinutes, isRecurring, cronExpression } = req.body;
      if (!trendTopics || !Array.isArray(trendTopics) || trendTopics.length === 0) {
        return res.status(400).json({ message: "trends array is required" });
      }
      if (!accountId) return res.status(400).json({ message: "accountId is required" });

      const account = await storage.getAccount(parseInt(accountId), userId);
      if (!account) return res.status(404).json({ message: "Account not found" });

      const jobs = [];
      const baseTime = scheduledAt ? new Date(scheduledAt).getTime() : Date.now() + 3600000;
      const interval = (intervalMinutes || 60) * 60 * 1000;

      for (let i = 0; i < trendTopics.length; i++) {
        const topic = trendTopics[i];
        const jobTime = new Date(baseTime + i * interval);

        const tmpl = await storage.createTemplate({
          userId,
          title: topic,
          description: "Пакетное планирование из трендов",
          branches: branchCount || 5,
          content: "[]",
          style: style || "casual",
          status: "active",
        });

        const job = await storage.createScheduledJob({
          userId,
          accountId: parseInt(accountId),
          templateId: tmpl.id,
          topic,
          branches: branchCount || 5,
          style: style || "casual",
          scheduledAt: jobTime,
          nextRunAt: jobTime,
          status: isRecurring ? "recurring" : "pending",
          isRecurring: isRecurring || false,
          cronExpression: cronExpression || null,
        });
        jobs.push(job);
      }

      res.json({ created: jobs.length, jobs });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Analytics ──
  app.get("/api/analytics", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const allPosts = await storage.getPosts(userId);
      const allJobs = await storage.getScheduledJobs(userId);
      const allAccounts = await storage.getAccounts(userId);
      const allTemplates = await storage.getTemplates(userId);

      const published = allPosts.filter(p => p.status === "published");
      const failed = allPosts.filter(p => p.status === "failed");
      const drafts = allPosts.filter(p => p.status === "draft");

      const now = new Date();
      const last7days: { date: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const count = published.filter(p => {
          if (!p.publishedAt) return false;
          return new Date(p.publishedAt).toISOString().split("T")[0] === dateStr;
        }).length;
        last7days.push({ date: dateStr, count });
      }

      const last30days: { date: string; count: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const count = published.filter(p => {
          if (!p.publishedAt) return false;
          return new Date(p.publishedAt).toISOString().split("T")[0] === dateStr;
        }).length;
        last30days.push({ date: dateStr, count });
      }

      const accountStats = allAccounts.map(acc => {
        const accPosts = allPosts.filter(p => p.accountId === acc.id);
        return {
          id: acc.id,
          username: acc.username,
          platform: acc.platform,
          totalPosts: accPosts.length,
          published: accPosts.filter(p => p.status === "published").length,
          failed: accPosts.filter(p => p.status === "failed").length,
          likes: accPosts.reduce((s, p) => s + (p.likes || 0), 0),
          replies: accPosts.reduce((s, p) => s + (p.replies || 0), 0),
          reposts: accPosts.reduce((s, p) => s + (p.reposts || 0), 0),
          views: accPosts.reduce((s, p) => s + (p.views || 0), 0),
        };
      });

      const pendingJobs = allJobs.filter(j => j.status === "pending" || j.status === "recurring").length;
      const completedJobs = allJobs.filter(j => j.status === "completed").length;
      const failedJobs = allJobs.filter(j => j.status === "failed").length;

      const publishedToday = published.filter(p => {
        if (!p.publishedAt) return false;
        return new Date(p.publishedAt).toDateString() === now.toDateString();
      }).length;

      const publishedThisWeek = published.filter(p => {
        if (!p.publishedAt) return false;
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return new Date(p.publishedAt) >= weekAgo;
      }).length;

      const totalLikes = allPosts.reduce((s, p) => s + (p.likes || 0), 0);
      const totalReplies = allPosts.reduce((s, p) => s + (p.replies || 0), 0);
      const totalReposts = allPosts.reduce((s, p) => s + (p.reposts || 0), 0);
      const totalViews = allPosts.reduce((s, p) => s + (p.views || 0), 0);

      res.json({
        overview: {
          totalPosts: allPosts.length,
          published: published.length,
          failed: failed.length,
          drafts: drafts.length,
          publishedToday,
          publishedThisWeek,
          totalTemplates: allTemplates.length,
          totalAccounts: allAccounts.length,
          activeJobs: pendingJobs,
          completedJobs,
          failedJobs,
          successRate: allPosts.length > 0 ? Math.round((published.length / allPosts.length) * 100) : 0,
          totalLikes,
          totalReplies,
          totalReposts,
          totalViews,
        },
        daily: last7days,
        monthly: last30days,
        accountStats,
        recentPublished: published.slice(0, 10).map(p => ({
          id: p.id,
          content: p.content.substring(0, 100),
          status: p.status,
          publishedAt: p.publishedAt,
          accountId: p.accountId,
          likes: p.likes || 0,
          replies: p.replies || 0,
          reposts: p.reposts || 0,
          views: p.views || 0,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/notifications/stream", isAuthenticated, (req, res) => {
    const userId = getUserId(req);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write("data: {\"type\":\"connected\"}\n\n");
    addSSEClient(userId, res);
  });

  app.post("/api/engagement/refresh", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const allPosts = await storage.getPosts(userId);
      const publishedPosts = allPosts.filter(p => p.status === "published" && p.threadsMediaId);

      if (publishedPosts.length === 0) {
        return res.json({ updated: 0, message: "Нет опубликованных постов с Media ID" });
      }

      const accountsMap = new Map<number, any>();
      const userAccounts = await storage.getAccounts(userId);
      for (const acc of userAccounts) {
        accountsMap.set(acc.id, acc);
      }

      let updated = 0;
      for (const post of publishedPosts.slice(0, 50)) {
        const account = post.accountId ? accountsMap.get(post.accountId) : null;
        if (!account?.accessToken || !post.threadsMediaId) continue;

        const metrics = await fetchThreadInsights(account.accessToken, post.threadsMediaId);
        await storage.updatePost(post.id, {
          likes: metrics.likes,
          replies: metrics.replies,
          reposts: metrics.reposts,
          quotes: metrics.quotes,
          views: metrics.views,
          engagementUpdatedAt: new Date(),
        }, userId);
        updated++;
        notifyEngagementUpdate(userId, post.id, metrics);

        await new Promise(r => setTimeout(r, 200));
      }

      res.json({ updated, message: `Обновлено метрик: ${updated} постов` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/analytics/export", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const allPosts = await storage.getPosts(userId);
      const allAccounts = await storage.getAccounts(userId);

      const accountNames = new Map<number, string>();
      for (const acc of allAccounts) {
        accountNames.set(acc.id, acc.username);
      }

      const statusLabels: Record<string, string> = {
        published: "Опубликован",
        draft: "Черновик",
        scheduled: "Запланирован",
        failed: "Ошибка",
      };

      const header = "ID,Аккаунт,Статус,Контент,Лайки,Ответы,Репосты,Цитаты,Просмотры,Опубликовано,Создано\n";
      const rows = allPosts.map(p => {
        const accountName = p.accountId ? (accountNames.get(p.accountId) || `#${p.accountId}`) : "";
        const status = statusLabels[p.status] || p.status;
        const content = `"${p.content.replace(/"/g, '""').replace(/\n/g, " ").substring(0, 200)}"`;
        const published = p.publishedAt ? new Date(p.publishedAt).toISOString() : "";
        const created = p.createdAt ? new Date(p.createdAt).toISOString() : "";
        return `${p.id},${accountName},${status},${content},${p.likes || 0},${p.replies || 0},${p.reposts || 0},${p.quotes || 0},${p.views || 0},${published},${created}`;
      }).join("\n");

      const bom = "\uFEFF";
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="metamill-analytics-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(bom + header + rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Auto-Comment Campaigns ──
  app.get("/api/comment-campaigns", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const data = await storage.getCommentCampaigns(userId);
    res.json(data);
  });

  app.post("/api/comment-campaigns", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const parsed = insertCommentCampaignSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const campaign = await storage.createCommentCampaign(parsed.data);
    res.status(201).json(campaign);
  });

  app.put("/api/comment-campaigns/:id", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const id = parseInt(req.params.id as string);
    const allowedFields = ["name", "targetKeywords", "commentStyle", "commentStyles", "maxCommentsPerRun", "minDelaySeconds", "maxDelaySeconds", "accountId", "isActive", "intervalMinutes", "nextRunAt"];
    const sanitized: Record<string, any> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) sanitized[key] = req.body[key];
    }
    const updated = await storage.updateCommentCampaign(id, sanitized, userId);
    if (!updated) return res.status(404).json({ message: "Campaign not found" });
    res.json(updated);
  });

  app.delete("/api/comment-campaigns/:id", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    await storage.deleteCommentCampaign(parseInt(req.params.id as string), userId);
    res.status(204).send();
  });

  app.post("/api/comment-campaigns/:id/toggle", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const id = parseInt(req.params.id as string);
    const campaign = await storage.getCommentCampaign(id, userId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    const updated = await storage.updateCommentCampaign(id, { isActive: !campaign.isActive } as any, userId);
    res.json(updated);
  });

  app.post("/api/comment-campaigns/:id/run", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id as string);
      const campaign = await storage.getCommentCampaign(id, userId);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });

      const account = await storage.getAccount(campaign.accountId, userId);
      if (!account) return res.status(400).json({ message: "Аккаунт не найден" });

      let llmSetting: any = null;
      const defaultSetting = await storage.getDefaultLlmSetting(userId);
      if (defaultSetting) {
        llmSetting = defaultSetting;
      } else {
        const allSettings = await storage.getLlmSettings(userId);
        const firstActive = allSettings.find(s => s.isActive && s.provider !== "firecrawl" && s.provider !== "user_niche");
        if (firstActive) {
          llmSetting = firstActive;
        }
      }

      if (!llmSetting) {
        return res.status(400).json({ message: "LLM провайдер не настроен. Добавьте провайдер в настройках." });
      }

      const result = await executeCommentCampaign(campaign, account, llmSetting);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/comment-campaigns/:id/logs", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const id = parseInt(req.params.id as string);
    const data = await storage.getCommentLogs(id, userId);
    res.json(data);
  });

  app.get("/api/comment-logs", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const data = await storage.getAllCommentLogs(userId);
    res.json(data);
  });

  app.post("/api/upload-carousel-images", isAuthenticated, async (req, res) => {
    try {
      const { images } = req.body;
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ message: "Нет изображений" });
      }

      const uploadDir = path.join(process.cwd(), "uploads", "carousel");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const urls: string[] = [];
      const timestamp = Date.now();

      for (let i = 0; i < images.length; i++) {
        const base64Data = images[i].replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const filename = `carousel_${timestamp}_${i}.png`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, buffer);

        let host = "";
        if (process.env.REPLIT_DEPLOYMENT_URL) {
          host = process.env.REPLIT_DEPLOYMENT_URL;
          if (!host.startsWith("https://")) host = `https://${host}`;
        } else if (process.env.REPLIT_DEV_DOMAIN) {
          host = `https://${process.env.REPLIT_DEV_DOMAIN}`;
        } else {
          host = "http://localhost:5000";
        }
        urls.push(`${host}/uploads/carousel/${filename}`);
      }

      res.json({ urls });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/publish-instagram-carousel", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { accountId, imageUrls, caption } = req.body;

      if (!accountId || !imageUrls || !Array.isArray(imageUrls) || imageUrls.length < 2) {
        return res.status(400).json({ message: "Нужен аккаунт и минимум 2 изображения" });
      }
      if (imageUrls.length > 10) {
        return res.status(400).json({ message: "Максимум 10 изображений в карусели" });
      }

      const account = await storage.getAccount(accountId, userId);
      if (!account) return res.status(404).json({ message: "Аккаунт не найден" });
      if (!account.accessToken) return res.status(400).json({ message: "Аккаунт не подключён к Instagram API" });

      const GRAPH_API = "https://graph.threads.net/v1.0";

      const containerIds: string[] = [];
      for (const imageUrl of imageUrls) {
        const createRes = await fetch(`${GRAPH_API}/${account.threadsUserId}/threads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: imageUrl,
            media_type: "IMAGE",
            is_carousel_item: true,
            access_token: account.accessToken,
          }),
        });
        const createData = await createRes.json();
        if (createData.id) {
          containerIds.push(createData.id);
        } else {
          throw new Error(createData.error?.message || `Ошибка создания контейнера для изображения`);
        }
      }

      const carouselRes = await fetch(`${GRAPH_API}/${account.threadsUserId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          children: containerIds.join(","),
          text: caption || "",
          access_token: account.accessToken,
        }),
      });
      const carouselData = await carouselRes.json();
      if (!carouselData.id) {
        throw new Error(carouselData.error?.message || "Ошибка создания карусели");
      }

      await new Promise(r => setTimeout(r, 3000));

      const publishRes = await fetch(`${GRAPH_API}/${account.threadsUserId}/threads_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: carouselData.id,
          access_token: account.accessToken,
        }),
      });
      const publishData = await publishRes.json();

      if (publishData.id) {
        res.json({ success: true, mediaId: publishData.id });
      } else {
        throw new Error(publishData.error?.message || "Ошибка публикации карусели");
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ══════════════════════════════════════════════
  // ── Subscriptions / Pricing API ──
  // ══════════════════════════════════════════════

  const PLANS: Record<string, { credits: number; price: number; refPercent: number }> = {
    basic: { credits: 200, price: 0, refPercent: 10 },
    pro: { credits: 1000, price: 29, refPercent: 20 },
    extra: { credits: 3000, price: 99, refPercent: 30 },
  };

  // Get current subscription
  app.get("/api/subscription", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const sub = await db.select().from(subscriptions).where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))).orderBy(desc(subscriptions.startedAt)).limit(1);
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      res.json({
        subscription: sub[0] || null,
        balance: user[0]?.balance || 0,
        plan: sub[0]?.plan || "basic",
        credits: sub[0] ? sub[0].credits - sub[0].creditsUsed : 0,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Subscribe to a plan
  app.post("/api/subscribe", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { plan } = req.body;
      if (!PLANS[plan]) return res.status(400).json({ message: "Invalid plan" });
      const planInfo = PLANS[plan];

      // Deactivate old subscription
      await db.update(subscriptions).set({ status: "expired" }).where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")));

      // Create new subscription
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      const [newSub] = await db.insert(subscriptions).values({
        userId, plan, credits: planInfo.credits, creditsUsed: 0, status: "active", expiresAt,
      }).returning();

      // Add credits to user balance
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const oldBalance = user[0]?.balance || 0;
      const newBalance = oldBalance + planInfo.credits;
      await db.update(users).set({ balance: newBalance }).where(eq(users.id, userId));

      // Log transaction
      await db.insert(creditTransactions).values({
        userId, amount: planInfo.credits, type: "purchase",
        description: `Подписка ${plan} — ${planInfo.credits} кредитов`,
        balanceBefore: oldBalance, balanceAfter: newBalance,
      });

      // Referral bonus to referrer
      if (user[0]?.referredBy) {
        const bonusCredits = Math.floor(planInfo.credits * planInfo.refPercent / 100);
        if (bonusCredits > 0) {
          const referrer = await db.select().from(users).where(eq(users.referralCode, user[0].referredBy)).limit(1);
          if (referrer[0]) {
            const refOldBalance = referrer[0].balance || 0;
            const refNewBalance = refOldBalance + bonusCredits;
            await db.update(users).set({ balance: refNewBalance }).where(eq(users.id, referrer[0].id));
            await db.insert(creditTransactions).values({
              userId: referrer[0].id, amount: bonusCredits, type: "referral_bonus",
              description: `Реферальный бонус ${planInfo.refPercent}% от ${plan}`,
              balanceBefore: refOldBalance, balanceAfter: refNewBalance,
            });
            await db.insert(referralPayouts).values({
              referrerId: referrer[0].id, referredUserId: userId,
              subscriptionId: newSub.id, amount: bonusCredits, percentage: planInfo.refPercent,
            });
          }
        }
      }

      res.json({ subscription: newSub, balance: newBalance });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Use credits (called during AI generation)
  app.post("/api/credits/use", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { amount = 1, description = "AI генерация" } = req.body;
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user[0]) return res.status(404).json({ message: "User not found" });
      const oldBalance = user[0].balance || 0;
      if (oldBalance < amount) return res.status(402).json({ message: "Недостаточно кредитов", balance: oldBalance });

      const newBalance = oldBalance - amount;
      await db.update(users).set({ balance: newBalance }).where(eq(users.id, userId));

      // Update subscription creditsUsed
      const activeSub = await db.select().from(subscriptions).where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))).limit(1);
      if (activeSub[0]) {
        await db.update(subscriptions).set({ creditsUsed: activeSub[0].creditsUsed + amount }).where(eq(subscriptions.id, activeSub[0].id));
      }

      await db.insert(creditTransactions).values({
        userId, amount: -amount, type: "usage", description,
        balanceBefore: oldBalance, balanceAfter: newBalance,
      });

      res.json({ balance: newBalance, used: amount });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ══════════════════════════════════════════════
  // ── Partner / Referral API ──
  // ══════════════════════════════════════════════

  app.post("/api/referrals/create", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const code = "REF-" + crypto.randomBytes(4).toString("hex").toUpperCase();
      await db.update(users).set({ referralCode: code }).where(eq(users.id, userId));
      res.json({ code });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/partners/stats", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user[0]) return res.status(404).json({ message: "User not found" });

      // Count referrals
      const referralCode = user[0].referralCode;
      let signups = 0;
      let totalEarnings = 0;
      if (referralCode) {
        const refs = await db.select().from(users).where(eq(users.referredBy, referralCode));
        signups = refs.length;
        const payouts = await db.select().from(referralPayouts).where(eq(referralPayouts.referrerId, userId));
        totalEarnings = payouts.reduce((sum, p) => sum + p.amount, 0);
      }

      res.json({
        referralCode: referralCode || null,
        signups,
        earnings: totalEarnings,
        balance: user[0].balance || 0,
        clicks: signups * 3, // estimate
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/partners/referrals", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user[0]?.referralCode) return res.json({ referrals: [] });

      const refs = await db.select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.referredBy, user[0].referralCode)).orderBy(desc(users.createdAt));

      const payouts = await db.select().from(referralPayouts).where(eq(referralPayouts.referrerId, userId)).orderBy(desc(referralPayouts.createdAt));

      res.json({ referrals: refs, payouts });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ══════════════════════════════════════════════
  // ── Admin API ──
  // ══════════════════════════════════════════════

  app.get("/api/admin/stats", isAdmin, async (_req, res) => {
    try {
      const [userCount] = await db.select({ value: count() }).from(users);
      const [subCount] = await db.select({ value: count() }).from(subscriptions).where(eq(subscriptions.status, "active"));
      const allSubs = await db.select({ plan: subscriptions.plan }).from(subscriptions).where(eq(subscriptions.status, "active"));
      const revenue = allSubs.reduce((sum, s) => sum + (PLANS[s.plan]?.price || 0), 0);
      const [errCount] = await db.select({ value: count() }).from(errorLogs);
      const recentErrors = await db.select().from(errorLogs).orderBy(desc(errorLogs.createdAt)).limit(10);

      res.json({
        totalUsers: userCount.value,
        activeSubscriptions: subCount.value,
        totalRevenue: revenue,
        systemHealth: errCount.value > 50 ? "degraded" : "healthy",
        errorCount: errCount.value,
        recentErrors,
      });
    } catch (e: any) {
      res.json({
        totalUsers: 0, activeSubscriptions: 0, totalRevenue: 0,
        systemHealth: "unknown", errorCount: 0, recentErrors: [],
      });
    }
  });

  app.get("/api/admin/users", isAdmin, async (_req, res) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        balance: users.balance,
        referralCode: users.referralCode,
        referredBy: users.referredBy,
        createdAt: users.createdAt,
      }).from(users).orderBy(desc(users.createdAt)).limit(100);

      // Get active subscription for each user
      const result = await Promise.all(allUsers.map(async (u) => {
        const sub = await db.select({ plan: subscriptions.plan, credits: subscriptions.credits, creditsUsed: subscriptions.creditsUsed }).from(subscriptions).where(and(eq(subscriptions.userId, u.id), eq(subscriptions.status, "active"))).limit(1);
        return { ...u, subscription: sub[0] || null };
      }));

      res.json({ users: result });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/errors", isAdmin, async (_req, res) => {
    try {
      const errors = await db.select().from(errorLogs).orderBy(desc(errorLogs.createdAt)).limit(50);
      res.json({ errors });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ══════════════════════════════════════════════
  // ── Telegram Client API ──
  // ══════════════════════════════════════════════

  const TELEGRAM_API_URL = process.env.TELEGRAM_API_URL || "http://localhost:8001";

  app.get("/api/telegram/status", isAuthenticated, async (req, res) => {
    try {
      const response = await fetch(`${TELEGRAM_API_URL}/status`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: "Telegram service unavailable: " + error.message });
    }
  });

  app.post("/api/telegram/configure", isAuthenticated, async (req, res) => {
    try {
      const { api_id, api_hash, phone } = req.body;
      if (!api_id || !api_hash || !phone) {
        return res.status(400).json({ message: "api_id, api_hash, phone required" });
      }
      const response = await fetch(`${TELEGRAM_API_URL}/configure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_id, api_hash, phone }),
      });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/telegram/send-code", isAuthenticated, async (req, res) => {
    try {
      const response = await fetch(`${TELEGRAM_API_URL}/send-code`, { method: "POST" });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/telegram/sign-in", isAuthenticated, async (req, res) => {
    try {
      const { code, password } = req.body;
      const response = await fetch(`${TELEGRAM_API_URL}/sign-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, password }),
      });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/telegram/send-message", isAuthenticated, async (req, res) => {
    try {
      const { receiver, message, parse_mode } = req.body;
      if (!receiver || !message) {
        return res.status(400).json({ message: "receiver and message required" });
      }
      const response = await fetch(`${TELEGRAM_API_URL}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver, message, parse_mode: parse_mode || "html" }),
      });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/telegram/send-to-channel", isAuthenticated, async (req, res) => {
    try {
      const { channel, message, parse_mode } = req.body;
      if (!channel || !message) {
        return res.status(400).json({ message: "channel and message required" });
      }
      const response = await fetch(`${TELEGRAM_API_URL}/channel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, message, parse_mode: parse_mode || "html" }),
      });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/telegram/get-dialogs", isAuthenticated, async (req, res) => {
    try {
      const { limit } = req.body;
      const response = await fetch(`${TELEGRAM_API_URL}/dialogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: limit || 50 }),
      });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/telegram/get-history", isAuthenticated, async (req, res) => {
    try {
      const { entity, limit } = req.body;
      if (!entity) return res.status(400).json({ message: "entity required" });
      const response = await fetch(`${TELEGRAM_API_URL}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, limit: limit || 100 }),
      });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/telegram/join-channel", isAuthenticated, async (req, res) => {
    try {
      const { channel_link } = req.body;
      if (!channel_link) return res.status(400).json({ message: "channel_link required" });
      const response = await fetch(`${TELEGRAM_API_URL}/join-channel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_link }),
      });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/telegram/disconnect", isAuthenticated, async (req, res) => {
    try {
      const response = await fetch(`${TELEGRAM_API_URL}/disconnect`, { method: "POST" });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}

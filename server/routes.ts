import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAccountSchema, insertTemplateSchema, insertPostSchema, insertScheduledJobSchema, insertLlmSettingSchema, llmSettings } from "@shared/schema";
import { generateWithLlm, AVAILABLE_MODELS } from "./llm";
import { getThreadsAuthUrl, exchangeCodeForToken, exchangeForLongLivedToken, getThreadsProfile, publishThreadChain } from "./threads-api";
import { getSchedulerStatus } from "./scheduler";
import { searchThreadsByKeyword, getUserThreads, lookupThreadsUser, sortByEngagement, filterViralThreads, importThreadAsTemplate, importMultipleAsTemplate } from "./threads-scraper";
import { db } from "./db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

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
  app.get("/api/accounts", async (_req, res) => {
    const data = await storage.getAccounts();
    res.json(data);
  });

  app.post("/api/accounts", async (req, res) => {
    const parsed = insertAccountSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const account = await storage.createAccount(parsed.data);
    res.status(201).json(account);
  });

  app.delete("/api/accounts/:id", async (req, res) => {
    await storage.deleteAccount(parseInt(req.params.id));
    res.status(204).send();
  });

  app.put("/api/accounts/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const updated = await storage.updateAccount(id, req.body);
    if (!updated) return res.status(404).json({ message: "Account not found" });
    res.json(updated);
  });

  // ── Templates ──
  app.get("/api/templates", async (_req, res) => {
    const data = await storage.getTemplates();
    res.json(data);
  });

  app.post("/api/templates", async (req, res) => {
    const parsed = insertTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const template = await storage.createTemplate(parsed.data);
    res.status(201).json(template);
  });

  app.delete("/api/templates/:id", async (req, res) => {
    await storage.deleteTemplate(parseInt(req.params.id));
    res.status(204).send();
  });

  // ── Posts ──
  app.get("/api/posts", async (_req, res) => {
    const data = await storage.getPosts();
    res.json(data);
  });

  app.post("/api/posts", async (req, res) => {
    const parsed = insertPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const post = await storage.createPost(parsed.data);
    res.status(201).json(post);
  });

  // ── Scheduled Jobs ──
  app.get("/api/scheduled-jobs", async (_req, res) => {
    const data = await storage.getScheduledJobs();
    res.json(data);
  });

  app.post("/api/scheduled-jobs", async (req, res) => {
    const parsed = insertScheduledJobSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const job = await storage.createScheduledJob(parsed.data);
    res.status(201).json(job);
  });

  app.delete("/api/scheduled-jobs/:id", async (req, res) => {
    await storage.deleteScheduledJob(parseInt(req.params.id));
    res.status(204).send();
  });

  app.get("/api/scheduler/status", (_req, res) => {
    res.json(getSchedulerStatus());
  });

  app.post("/api/scheduled-jobs/:id/run-now", async (req, res) => {
    const id = parseInt(req.params.id);
    const job = await storage.getScheduledJob(id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    await storage.updateScheduledJob(id, {
      status: "pending",
      scheduledAt: new Date(),
      nextRunAt: new Date(),
    });
    res.json({ message: "Задача поставлена в очередь" });
  });

  app.post("/api/scheduled-jobs/:id/pause", async (req, res) => {
    const id = parseInt(req.params.id);
    const job = await storage.getScheduledJob(id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    await storage.updateScheduledJob(id, { status: "paused" });
    res.json({ message: "Задача приостановлена" });
  });

  app.post("/api/scheduled-jobs/:id/resume", async (req, res) => {
    const id = parseInt(req.params.id);
    const job = await storage.getScheduledJob(id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    await storage.updateScheduledJob(id, {
      status: job.isRecurring ? "recurring" : "pending",
      nextRunAt: job.nextRunAt || job.scheduledAt || new Date(),
    });
    res.json({ message: "Задача возобновлена" });
  });

  // ── LLM Settings ──
  app.get("/api/llm-settings", async (_req, res) => {
    const data = await storage.getLlmSettings();
    res.json(data);
  });

  app.get("/api/llm-models", async (_req, res) => {
    res.json(AVAILABLE_MODELS);
  });

  app.post("/api/llm-settings", async (req, res) => {
    const parsed = insertLlmSettingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const setting = await storage.createLlmSetting(parsed.data);
    res.status(201).json(setting);
  });

  app.put("/api/llm-settings/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const partial = insertLlmSettingSchema.partial().safeParse(req.body);
    if (!partial.success) return res.status(400).json({ message: partial.error.message });
    const updated = await storage.updateLlmSetting(id, partial.data);
    if (!updated) return res.status(404).json({ message: "Setting not found" });
    res.json(updated);
  });

  app.delete("/api/llm-settings/:id", async (req, res) => {
    await storage.deleteLlmSetting(parseInt(req.params.id));
    res.status(204).send();
  });

  app.post("/api/llm-settings/:id/set-default", async (req, res) => {
    const id = parseInt(req.params.id);
    await db.update(llmSettings).set({ isDefault: false }).where(eq(llmSettings.isDefault, true));
    const updated = await storage.updateLlmSetting(id, { isDefault: true });
    if (!updated) return res.status(404).json({ message: "Setting not found" });
    res.json(updated);
  });

  // ── AI Generation ──
  app.post("/api/generate", async (req, res) => {
    try {
      const { topic, reference, style, branches, directives, provider, modelId, templateId } = req.body;
      if (!topic) return res.status(400).json({ message: "Topic is required" });

      let llmSetting: { provider: string; modelId: string; apiKey?: string | null } = {
        provider: "openrouter",
        modelId: "meta-llama/llama-3.3-70b-instruct",
      };

      if (provider && modelId) {
        const allSettings = await storage.getLlmSettings();
        const match = allSettings.find(s => s.provider === provider && s.modelId === modelId);
        llmSetting = {
          provider,
          modelId,
          apiKey: match?.apiKey || null,
        };
      } else {
        const defaultSetting = await storage.getDefaultLlmSetting();
        if (defaultSetting) {
          llmSetting = defaultSetting;
        }
      }

      let referenceContent = "";
      if (templateId) {
        const parsedTemplateId = parseInt(String(templateId), 10);
        if (isNaN(parsedTemplateId)) return res.status(400).json({ message: "Invalid templateId" });
        const template = await storage.getTemplate(parsedTemplateId);
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

      const systemPrompt = `You are MetaMill, an AI content generator for Threads (social media platform by Meta).
Generate a thread chain with exactly ${branches || 5} posts.
Each post should be under 500 characters.
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

  // ── Threads OAuth ──
  function createOAuthState(): string {
    const timestamp = Date.now().toString();
    const secret = process.env.SESSION_SECRET || "metamill-oauth-secret";
    const hmac = crypto.createHmac("sha256", secret).update(timestamp).digest("hex").slice(0, 16);
    return Buffer.from(`${timestamp}:${hmac}`).toString("base64url");
  }

  function verifyOAuthState(state: string): boolean {
    try {
      const decoded = Buffer.from(state, "base64url").toString();
      const [timestamp, hmac] = decoded.split(":");
      if (!timestamp || !hmac) return false;
      const secret = process.env.SESSION_SECRET || "metamill-oauth-secret";
      const expected = crypto.createHmac("sha256", secret).update(timestamp).digest("hex").slice(0, 16);
      if (hmac !== expected) return false;
      const age = Date.now() - parseInt(timestamp);
      return age < 600000;
    } catch {
      return false;
    }
  }

  app.post("/api/auth/threads/deauthorize", (req, res) => {
    console.log("[threads] Deauthorize callback received:", req.body);
    res.json({ success: true });
  });

  app.post("/api/auth/threads/delete", (req, res) => {
    console.log("[threads] Data deletion request received:", req.body);
    const confirmationCode = crypto.randomBytes(8).toString("hex");
    res.json({
      url: `https://${process.env.REPLIT_DEV_DOMAIN || "localhost:5000"}/api/auth/threads/delete-status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  });

  app.get("/api/auth/threads/delete-status", (req, res) => {
    res.json({ status: "complete" });
  });

  app.get("/api/auth/threads", (_req, res) => {
    try {
      const state = createOAuthState();
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
      if (!verifyOAuthState(String(state))) {
        console.log("OAuth state verification failed");
        return res.redirect("/accounts?auth_error=invalid_state_try_again");
      }

      console.log("Exchanging code for token...");
      const { accessToken: shortToken, userId } = await exchangeCodeForToken(String(code));
      console.log("Got short token, exchanging for long-lived...");
      const { accessToken: longToken, expiresIn } = await exchangeForLongLivedToken(shortToken);
      console.log("Got long-lived token, fetching profile...");
      const profile = await getThreadsProfile(longToken, userId);
      console.log("Profile fetched:", profile.username);

      const allAccounts = await storage.getAccounts();
      const existing = allAccounts.find(
        (a) => a.threadsUserId === userId
      );

      if (existing) {
        await storage.updateAccount(existing.id, {
          accessToken: longToken,
          threadsUserId: userId,
          username: profile.username,
          avatarUrl: profile.profilePictureUrl || existing.avatarUrl,
          tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
          status: "active",
        });
        console.log("Updated existing account:", existing.id);
      } else {
        const newAccount = await storage.createAccount({
          username: profile.username,
          platform: "threads",
          accessToken: longToken,
          threadsUserId: userId,
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
  app.post("/api/publish", async (req, res) => {
    try {
      const { accountId, branches } = req.body;
      if (!accountId || !branches) return res.status(400).json({ message: "accountId and branches required" });
      if (!Array.isArray(branches) || branches.length === 0 || branches.length > 25) {
        return res.status(400).json({ message: "branches must be an array of 1-25 strings" });
      }
      if (!branches.every((b: any) => typeof b === "string" && b.length > 0 && b.length <= 500)) {
        return res.status(400).json({ message: "Each branch must be a non-empty string under 500 characters" });
      }

      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ message: "Account not found" });

      if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
        return res.status(401).json({ message: "Токен OAuth истёк. Переподключите аккаунт через Threads." });
      }

      if (!account.accessToken || !account.threadsUserId) {
        const createdPosts = [];
        for (let i = 0; i < branches.length; i++) {
          const post = await storage.createPost({
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
      for (let i = 0; i < branches.length; i++) {
        const post = await storage.createPost({
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

      res.json({
        posts: createdPosts,
        published: mediaIds.length,
        failed: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("Publish error:", error);
      res.status(500).json({ message: error.message || "Publishing failed" });
    }
  });

  // ── Research / Scraper ──
  async function getThreadsAccessToken(): Promise<string | null> {
    const accounts = await storage.getAccounts();
    const connectedAccount = accounts.find(a => a.accessToken && a.threadsUserId);
    if (connectedAccount?.accessToken) return connectedAccount.accessToken;
    return process.env.THREADS_USER_TOKEN || null;
  }

  app.post("/api/research/search", async (req, res) => {
    try {
      const { query, limit } = req.body;
      if (!query) return res.status(400).json({ message: "query is required" });

      const token = await getThreadsAccessToken();
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

  app.post("/api/research/user-threads", async (req, res) => {
    try {
      const { userId, limit } = req.body;
      if (!userId) return res.status(400).json({ message: "userId is required" });

      const token = await getThreadsAccessToken();
      if (!token) {
        return res.status(400).json({ message: "Нет токена Threads API. Подключите аккаунт через OAuth." });
      }

      const threads = await getUserThreads(token, userId, limit || 50);
      const sorted = sortByEngagement(threads);
      res.json({ threads: sorted, total: sorted.length });
    } catch (error: any) {
      console.error("User threads error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch threads" });
    }
  });

  app.post("/api/research/user-lookup", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "userId is required" });

      const token = await getThreadsAccessToken();
      if (!token) {
        return res.status(400).json({ message: "Нет токена Threads API." });
      }

      const profile = await lookupThreadsUser(token, userId);
      res.json(profile);
    } catch (error: any) {
      console.error("User lookup error:", error);
      res.status(500).json({ message: error.message || "User lookup failed" });
    }
  });

  app.post("/api/research/import-thread", async (req, res) => {
    try {
      const { text, username, likeCount, timestamp, accountId } = req.body;
      if (!text || typeof text !== "string") return res.status(400).json({ message: "text is required" });

      const template = await importThreadAsTemplate(
        { id: "", text, username: username || "unknown", timestamp: timestamp || new Date().toISOString(), like_count: likeCount || 0 },
        accountId
      );
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/research/import-bundle", async (req, res) => {
    try {
      const { threads, title, accountId } = req.body;
      if (!threads || !Array.isArray(threads) || threads.length === 0) {
        return res.status(400).json({ message: "threads array is required" });
      }
      if (!title) return res.status(400).json({ message: "title is required" });

      const template = await importMultipleAsTemplate(threads, title, accountId);
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/research/import-manual", async (req, res) => {
    try {
      const { branches, title, style, sourceUsername, accountId } = req.body;
      if (!branches || !Array.isArray(branches) || branches.length === 0 || !branches.every((b: any) => typeof b === "string")) {
        return res.status(400).json({ message: "branches must be an array of strings" });
      }
      if (!title || typeof title !== "string") return res.status(400).json({ message: "title is required" });

      const cleanBranches = branches.filter((b: string) => b.trim().length > 0);
      if (cleanBranches.length === 0) return res.status(400).json({ message: "At least one non-empty branch is required" });

      const template = await storage.createTemplate({
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

  return httpServer;
}

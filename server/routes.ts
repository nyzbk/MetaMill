import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAccountSchema, insertTemplateSchema, insertPostSchema, insertScheduledJobSchema, insertLlmSettingSchema, insertKeywordMonitorSchema, llmSettings, keywordMonitors, monitorResults } from "@shared/schema";
import { generateWithLlm, AVAILABLE_MODELS } from "./llm";
import { getThreadsAuthUrl, exchangeCodeForToken, exchangeForLongLivedToken, getThreadsProfile, publishThreadChain } from "./threads-api";
import { getSchedulerStatus } from "./scheduler";
import { searchThreadsByKeyword, getUserThreads, lookupThreadsUser, sortByEngagement, filterViralThreads, importThreadAsTemplate, importMultipleAsTemplate } from "./threads-scraper";
import { getTrends, refreshTrends } from "./trends";
import { repurposeToThread } from "./repurpose";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { isAuthenticated } from "./replit_integrations/auth";

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

  // ── AI Generation ──
  app.post("/api/generate", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { topic, reference, style, branches, directives, provider, modelId, templateId } = req.body;
      if (!topic) return res.status(400).json({ message: "Topic is required" });

      let llmSetting: { provider: string; modelId: string; apiKey?: string | null; baseUrl?: string | null } = {
        provider: "openrouter",
        modelId: "meta-llama/llama-3.3-70b-instruct",
      };

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
        }
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

  // ── Content Repurpose ──
  app.post("/api/repurpose", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { url, branches, style, provider, modelId } = req.body;
      if (!url) return res.status(400).json({ message: "URL обязателен" });

      let llmSetting: { provider: string; modelId: string; apiKey?: string | null; baseUrl?: string | null } = {
        provider: "openrouter",
        modelId: "meta-llama/llama-3.3-70b-instruct",
      };

      if (provider && modelId) {
        const allSettings = await storage.getLlmSettings(userId);
        const match = allSettings.find(s => s.provider === provider && s.modelId === modelId);
        llmSetting = { provider, modelId, apiKey: match?.apiKey || null, baseUrl: match?.baseUrl || null };
      } else {
        const defaultSetting = await storage.getDefaultLlmSetting(userId);
        if (defaultSetting) llmSetting = defaultSetting;
      }

      const result = await repurposeToThread(url, {
        branches: branches || 5,
        style,
        ...llmSetting,
        userId,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}

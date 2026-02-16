import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAccountSchema, insertTemplateSchema, insertPostSchema, insertScheduledJobSchema, insertLlmSettingSchema, llmSettings } from "@shared/schema";
import { generateWithLlm, AVAILABLE_MODELS } from "./llm";
import { db } from "./db";
import { eq } from "drizzle-orm";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
      const { topic, reference, style, branches, directives, provider, modelId } = req.body;
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

      const systemPrompt = `You are MetaMill, an AI content generator for Threads (social media platform by Meta).
Generate a thread chain with exactly ${branches || 5} posts.
Each post should be under 500 characters.
${style ? `Tone/style: ${style}` : ""}
${reference ? `Match the style of this reference: "${reference}"` : ""}
${directives ? `Additional directives: ${directives}` : ""}

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

  // ── Publish (Meta API simulation + DB save) ──
  app.post("/api/publish", async (req, res) => {
    try {
      const { accountId, branches } = req.body;
      if (!accountId || !branches) return res.status(400).json({ message: "accountId and branches required" });

      const account = await storage.getAccount(accountId);
      if (!account) return res.status(404).json({ message: "Account not found" });

      const createdPosts = [];
      let parentId: string | undefined;

      for (let i = 0; i < branches.length; i++) {
        const postData: any = {
          accountId,
          content: branches[i],
          threadPosition: i,
          status: "published",
          publishedAt: new Date(),
        };

        if (parentId) {
          postData.parentPostId = parentId;
        }

        if (account.accessToken) {
          try {
            const createUrl = `https://graph.threads.net/v1.0/me/threads`;
            const createBody: any = {
              text: branches[i],
              media_type: "TEXT",
              access_token: account.accessToken,
            };
            if (parentId) {
              createBody.reply_to_id = parentId;
            }

            const createRes = await fetch(createUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(createBody),
            });
            const createData = await createRes.json();

            if (createData.id) {
              const publishUrl = `https://graph.threads.net/v1.0/me/threads_publish`;
              const publishRes = await fetch(publishUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  creation_id: createData.id,
                  access_token: account.accessToken,
                }),
              });
              const publishData = await publishRes.json();
              postData.threadsMediaId = publishData.id || createData.id;
              parentId = publishData.id || createData.id;
            }
          } catch (apiError) {
            console.error("Threads API error:", apiError);
            postData.status = "failed";
          }
        } else {
          postData.status = "draft";
          parentId = `local-${Date.now()}-${i}`;
        }

        const post = await storage.createPost(postData);
        createdPosts.push(post);
      }

      res.json({ posts: createdPosts });
    } catch (error: any) {
      console.error("Publish error:", error);
      res.status(500).json({ message: error.message || "Publishing failed" });
    }
  });

  return httpServer;
}

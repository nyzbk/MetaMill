import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAccountSchema, insertTemplateSchema, insertPostSchema, insertScheduledJobSchema } from "@shared/schema";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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

  // ── AI Generation ──
  app.post("/api/generate", async (req, res) => {
    try {
      const { topic, reference, style, branches, directives } = req.body;
      if (!topic) return res.status(400).json({ message: "Topic is required" });

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

      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a thread about: ${topic}` },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 4096,
      });

      const content = response.choices[0]?.message?.content || "{}";
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

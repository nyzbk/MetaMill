import { storage } from "./storage";
import { generateWithLlm } from "./llm";
import { publishThreadChain, fetchThreadInsights } from "./threads-api";
import { notifyPublishSuccess, notifyPublishFailed } from "./notifications";
import { db } from "./db";
import { llmSettings, commentCampaigns } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { ScheduledJob } from "@shared/schema";
import { executeCommentCampaign } from "./auto-commenter";

const POLL_INTERVAL = 30_000;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

export function startScheduler() {
  console.log("[scheduler] Background scheduler started (polling every 30s)");
  schedulerTimer = setInterval(() => {
    processDueJobs();
    processCommentCampaigns();
  }, POLL_INTERVAL);
  setTimeout(processDueJobs, 5000);
  setTimeout(processCommentCampaigns, 10000);
}

export function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

async function processDueJobs() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const dueJobs = await storage.getDueJobs();
    if (dueJobs.length === 0) {
      isProcessing = false;
      return;
    }

    console.log(`[scheduler] Found ${dueJobs.length} due job(s)`);

    for (const job of dueJobs) {
      const claimed = await storage.claimJob(job.id);
      if (!claimed) {
        continue;
      }
      try {
        await executeJob(claimed);
      } catch (err: any) {
        console.error(`[scheduler] Job ${claimed.id} failed:`, err.message);
        await storage.updateJobInternal(claimed.id, {
          status: claimed.isRecurring ? "recurring" : "failed",
          lastRunAt: new Date(),
          lastError: err.message,
          runCount: (claimed.runCount || 0) + 1,
        });
      }
    }
  } catch (err: any) {
    console.error("[scheduler] Error polling jobs:", err.message);
  } finally {
    isProcessing = false;
  }
}

async function executeJob(job: ScheduledJob) {
  console.log(`[scheduler] Executing job ${job.id}: "${job.topic || 'template-based'}"`);

  await storage.updateJobInternal(job.id, { status: "running" });

  const account = await storage.getAccountById(job.accountId);
  if (!account) {
    throw new Error(`Аккаунт #${job.accountId} не найден`);
  }

  if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
    throw new Error(`Токен OAuth аккаунта @${account.username} истёк`);
  }

  let branches: string[];
  const branchCount = job.branches || 5;

  if (job.templateId) {
    const template = await storage.getTemplateById(job.templateId);
    if (!template) throw new Error(`Шаблон #${job.templateId} не найден`);

    try {
      const parsed = JSON.parse(template.content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        branches = parsed.map((b: any) => typeof b === "string" ? b : b.text || String(b));
      } else {
        branches = await generateContent(job, branchCount);
      }
    } catch {
      branches = await generateContent(job, branchCount);
    }
  } else {
    branches = await generateContent(job, branchCount);
  }

  if (!branches || branches.length === 0) {
    throw new Error("Не удалось сгенерировать контент");
  }

  if (account.accessToken && account.threadsUserId) {
    const { mediaIds, errors } = await publishThreadChain(
      account.accessToken,
      account.threadsUserId,
      branches
    );

    for (let i = 0; i < branches.length; i++) {
      await storage.createPost({
        userId: job.userId,
        accountId: job.accountId,
        templateId: job.templateId,
        content: branches[i],
        threadPosition: i,
        threadsMediaId: mediaIds[i] || null,
        parentPostId: i > 0 ? mediaIds[i - 1] || null : null,
        status: mediaIds[i] ? "published" : "failed",
        publishedAt: mediaIds[i] ? new Date() : null,
      });
    }

    if (errors.length > 0) {
      console.warn(`[scheduler] Job ${job.id}: ${errors.length} publish error(s)`);
      if (job.userId) notifyPublishFailed(job.userId, errors.join("; "), account.username);
    }

    const successCount = mediaIds.filter(Boolean).length;
    console.log(`[scheduler] Job ${job.id}: published ${successCount}/${branches.length} posts`);
    if (job.userId && successCount > 0) {
      notifyPublishSuccess(job.userId, successCount, account.username);
      setTimeout(async () => {
        try {
          for (let i = 0; i < mediaIds.length; i++) {
            if (!mediaIds[i]) continue;
            const metrics = await fetchThreadInsights(account.accessToken!, mediaIds[i]);
            const allPosts = await storage.getPosts(job.userId!);
            const post = allPosts.find(p => p.threadsMediaId === mediaIds[i]);
            if (post) {
              await storage.updatePost(post.id, {
                likes: metrics.likes,
                replies: metrics.replies,
                reposts: metrics.reposts,
                quotes: metrics.quotes,
                views: metrics.views,
                engagementUpdatedAt: new Date(),
              }, job.userId!);
            }
          }
        } catch (err: any) {
          console.warn(`[scheduler] Engagement fetch after publish failed:`, err.message);
        }
      }, 30000);
    }
  } else {
    for (let i = 0; i < branches.length; i++) {
      await storage.createPost({
        userId: job.userId,
        accountId: job.accountId,
        templateId: job.templateId,
        content: branches[i],
        threadPosition: i,
        status: "draft",
      });
    }
    console.log(`[scheduler] Job ${job.id}: saved ${branches.length} drafts (no OAuth token)`);
  }

  if (job.isRecurring) {
    const intervalMs = parseCronToMs(job.cronExpression || "every_24h");
    const baseTime = job.nextRunAt || job.scheduledAt || new Date();
    let nextRun = new Date(new Date(baseTime).getTime() + intervalMs);
    if (nextRun <= new Date()) {
      nextRun = new Date(Date.now() + intervalMs);
    }

    await storage.updateJobInternal(job.id, {
      status: "recurring",
      lastRunAt: new Date(),
      nextRunAt: nextRun,
      lastError: null,
      runCount: (job.runCount || 0) + 1,
    });
    console.log(`[scheduler] Job ${job.id}: recurring, next run at ${nextRun.toISOString()}`);
  } else {
    await storage.updateJobInternal(job.id, {
      status: "completed",
      lastRunAt: new Date(),
      nextRunAt: null,
      lastError: null,
      runCount: (job.runCount || 0) + 1,
    });
  }
}

async function generateContent(job: ScheduledJob, branchCount: number): Promise<string[]> {
  const topic = job.topic || "интересный контент для Threads";

  let llmSetting: { provider: string; modelId: string; apiKey?: string | null } | null = null;

  if (job.provider && job.modelId) {
    const allSettings = await storage.getLlmSettings(job.userId || "");
    const match = allSettings.find(s => s.provider === job.provider && s.modelId === job.modelId);
    llmSetting = {
      provider: job.provider,
      modelId: job.modelId,
      apiKey: match?.apiKey || null,
    };
  } else {
    const defaultSetting = await storage.getDefaultLlmSetting(job.userId || "");
    if (defaultSetting) {
      llmSetting = defaultSetting;
    } else {
      const allSettings = await storage.getLlmSettings(job.userId || "");
      const firstActive = allSettings.find(s => s.isActive && s.provider !== "firecrawl" && s.provider !== "user_niche");
      if (firstActive) {
        llmSetting = firstActive;
      }
    }
  }

  if (!llmSetting) {
    throw new Error("LLM провайдер не настроен. Добавьте провайдер со своим API ключом в разделе Настройки.");
  }

  const [nicheRow] = await db.select().from(llmSettings).where(
    and(eq(llmSettings.userId, job.userId || ""), eq(llmSettings.provider, "user_niche"))
  );
  const userNiche = nicheRow?.apiKey || "";

  const systemPrompt = `You are MetaMill, an AI content generator for Threads (social media platform by Meta).
Generate a thread chain with exactly ${branchCount} posts.
Each post should be under 500 characters.
${userNiche ? `IMPORTANT: The user's niche/topic is: "${userNiche}". All content MUST be relevant to this niche.` : ""}
${job.style ? `Tone/style: ${job.style}` : ""}

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
    return [content];
  }

  if (parsed.branches && Array.isArray(parsed.branches)) {
    return parsed.branches;
  }

  return [content];
}

function parseCronToMs(expr: string): number {
  const intervals: Record<string, number> = {
    "every_1h": 60 * 60 * 1000,
    "every_2h": 2 * 60 * 60 * 1000,
    "every_4h": 4 * 60 * 60 * 1000,
    "every_6h": 6 * 60 * 60 * 1000,
    "every_8h": 8 * 60 * 60 * 1000,
    "every_12h": 12 * 60 * 60 * 1000,
    "every_24h": 24 * 60 * 60 * 1000,
    "every_48h": 48 * 60 * 60 * 1000,
    "every_week": 7 * 24 * 60 * 60 * 1000,
  };
  return intervals[expr] || 24 * 60 * 60 * 1000;
}

async function processCommentCampaigns() {
  try {
    const dueCampaigns = await storage.getDueCommentCampaigns();
    if (dueCampaigns.length === 0) return;

    console.log(`[scheduler] Found ${dueCampaigns.length} due comment campaign(s)`);

    for (const campaign of dueCampaigns) {
      try {
        const account = await storage.getAccountById(campaign.accountId);
        if (!account) {
          console.warn(`[scheduler] Comment campaign ${campaign.id}: account #${campaign.accountId} not found`);
          continue;
        }

        let llmSetting: any = null;
        const defaultSetting = await storage.getDefaultLlmSetting(campaign.userId);
        if (defaultSetting) {
          llmSetting = defaultSetting;
        } else {
          const allSettings = await storage.getLlmSettings(campaign.userId);
          const firstActive = allSettings.find(s => s.isActive && s.provider !== "firecrawl" && s.provider !== "user_niche");
          if (firstActive) {
            llmSetting = firstActive;
          }
        }

        if (!llmSetting) {
          console.warn(`[scheduler] Comment campaign ${campaign.id}: no LLM provider configured`);
          continue;
        }

        const result = await executeCommentCampaign(campaign, account, llmSetting);
        console.log(`[scheduler] Comment campaign ${campaign.id}: ${result.success} published, ${result.failed} failed`);

        const intervalMs = (campaign.intervalMinutes || 60) * 60 * 1000;
        const nextRun = new Date(Date.now() + intervalMs);
        await storage.updateCommentCampaign(campaign.id, {
          nextRunAt: nextRun,
        } as any, campaign.userId);
        console.log(`[scheduler] Comment campaign ${campaign.id}: next run at ${nextRun.toISOString()}`);
      } catch (err: any) {
        console.error(`[scheduler] Comment campaign ${campaign.id} failed:`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[scheduler] Error processing comment campaigns:", err.message);
  }
}

export function getSchedulerStatus() {
  return {
    running: schedulerTimer !== null,
    processing: isProcessing,
    pollIntervalMs: POLL_INTERVAL,
  };
}

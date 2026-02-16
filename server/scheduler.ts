import { storage } from "./storage";
import { generateWithLlm } from "./llm";
import { publishThreadChain } from "./threads-api";
import type { ScheduledJob } from "@shared/schema";

const POLL_INTERVAL = 30_000;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

export function startScheduler() {
  console.log("[scheduler] Background scheduler started (polling every 30s)");
  schedulerTimer = setInterval(processDueJobs, POLL_INTERVAL);
  setTimeout(processDueJobs, 5000);
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
        await storage.updateScheduledJob(claimed.id, {
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

  await storage.updateScheduledJob(job.id, { status: "running" });

  const account = await storage.getAccount(job.accountId);
  if (!account) {
    throw new Error(`Аккаунт #${job.accountId} не найден`);
  }

  if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
    throw new Error(`Токен OAuth аккаунта @${account.username} истёк`);
  }

  let branches: string[];
  const branchCount = job.branches || 5;

  if (job.templateId) {
    const template = await storage.getTemplate(job.templateId);
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
    }

    console.log(`[scheduler] Job ${job.id}: published ${mediaIds.filter(Boolean).length}/${branches.length} posts`);
  } else {
    for (let i = 0; i < branches.length; i++) {
      await storage.createPost({
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

    await storage.updateScheduledJob(job.id, {
      status: "recurring",
      lastRunAt: new Date(),
      nextRunAt: nextRun,
      lastError: null,
      runCount: (job.runCount || 0) + 1,
    });
    console.log(`[scheduler] Job ${job.id}: recurring, next run at ${nextRun.toISOString()}`);
  } else {
    await storage.updateScheduledJob(job.id, {
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

  let llmSetting: { provider: string; modelId: string; apiKey?: string | null } = {
    provider: "openrouter",
    modelId: "meta-llama/llama-3.3-70b-instruct",
  };

  if (job.provider && job.modelId) {
    const allSettings = await storage.getLlmSettings();
    const match = allSettings.find(s => s.provider === job.provider && s.modelId === job.modelId);
    llmSetting = {
      provider: job.provider,
      modelId: job.modelId,
      apiKey: match?.apiKey || null,
    };
  } else {
    const defaultSetting = await storage.getDefaultLlmSetting();
    if (defaultSetting) {
      llmSetting = defaultSetting;
    }
  }

  const systemPrompt = `You are MetaMill, an AI content generator for Threads (social media platform by Meta).
Generate a thread chain with exactly ${branchCount} posts.
Each post should be under 500 characters.
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

export function getSchedulerStatus() {
  return {
    running: schedulerTimer !== null,
    processing: isProcessing,
    pollIntervalMs: POLL_INTERVAL,
  };
}

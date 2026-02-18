import { storage } from "./storage";
import { generateWithLlm } from "./llm";
import { db } from "./db";
import { llmSettings } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { CommentCampaign, Account, LlmSetting } from "@shared/schema";

const THREADS_API_URL = "https://graph.threads.net/v1.0";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function executeCommentCampaign(
  campaign: CommentCampaign,
  account: Account,
  llmSetting: LlmSetting
): Promise<{ success: number; failed: number; logs: string[] }> {
  const logs: string[] = [];
  let success = 0;
  let failed = 0;

  if (!account.accessToken) {
    throw new Error("Аккаунт не подключён к Threads API");
  }

  const keywords = campaign.targetKeywords.split(",").map(k => k.trim()).filter(Boolean);
  if (keywords.length === 0) {
    throw new Error("Не указаны ключевые слова");
  }

  const [nicheRow] = await db.select().from(llmSettings).where(
    and(eq(llmSettings.userId, campaign.userId), eq(llmSettings.provider, "user_niche"))
  );
  const userNiche = nicheRow?.apiKey || "";

  const keyword = keywords[Math.floor(Math.random() * keywords.length)];
  logs.push(`Поиск по: "${keyword}"`);

  let threads: { id: string; text: string; username?: string }[] = [];
  try {
    const searchUrl = `${THREADS_API_URL}/threads/search?q=${encodeURIComponent(keyword)}&fields=id,text,username&access_token=${account.accessToken}&limit=20`;
    const res = await fetch(searchUrl);
    const data = await res.json();
    if (data.data && Array.isArray(data.data)) {
      threads = data.data.filter((t: any) => t.text && t.id);
    }
  } catch (e: any) {
    logs.push(`Ошибка поиска: ${e.message}`);
  }

  if (threads.length === 0) {
    logs.push("Поиск не дал результатов. Кампания завершена.");
    return { success, failed, logs };
  }

  const targets = threads.slice(0, campaign.maxCommentsPerRun);
  logs.push(`Найдено ${threads.length} тредов, комментируем ${targets.length}`);

  const styleMap: Record<string, string> = {
    helpful: "полезный и экспертный, добавляющий ценность к обсуждению",
    witty: "остроумный и ироничный, но уважительный",
    supportive: "поддерживающий и мотивирующий",
    question: "задающий уточняющий вопрос для вовлечения в диалог",
    expert: "экспертный с конкретными данными и фактами",
  };

  for (let i = 0; i < targets.length; i++) {
    const thread = targets[i];

    if (i > 0) {
      const delay = randomDelay(campaign.minDelaySeconds * 1000, campaign.maxDelaySeconds * 1000);
      logs.push(`Ожидание ${Math.round(delay / 1000)}с...`);
      await sleep(delay);
    }

    try {
      const commentText = await generateWithLlm(llmSetting, {
        systemPrompt: `Ты — автор комментариев в Threads. Пиши комментарии на русском языке.
Стиль: ${styleMap[campaign.commentStyle] || styleMap.helpful}.
${userNiche ? `Ниша автора: ${userNiche}.` : ""}
Правила:
- Комментарий должен быть КОРОТКИМ: 1-3 предложения (max 200 символов)
- Выглядеть как живой комментарий реального человека
- НЕ использовать хештеги
- НЕ использовать эмодзи
- Добавлять реальную ценность к обсуждению
- Быть релевантным контексту треда`,
        userPrompt: `Напиши один комментарий к этому треду:\n\n"${thread.text.substring(0, 300)}"`,
        maxTokens: 150,
      });

      const cleanComment = commentText.replace(/^["']|["']$/g, "").trim();

      const createBody: any = {
        text: cleanComment,
        media_type: "TEXT",
        reply_to_id: thread.id,
        access_token: account.accessToken,
      };

      const createRes = await fetch(`${THREADS_API_URL}/me/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBody),
      });

      const createData = await createRes.json();
      if (createData.id) {
        const publishRes = await fetch(`${THREADS_API_URL}/me/threads_publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: createData.id,
            access_token: account.accessToken,
          }),
        });
        const publishData = await publishRes.json();

        if (publishData.id) {
          await storage.createCommentLog({
            campaignId: campaign.id,
            userId: campaign.userId,
            targetThreadId: thread.id,
            targetThreadText: thread.text.substring(0, 500),
            commentText: cleanComment,
            status: "published",
            threadsMediaId: publishData.id,
          });
          success++;
          logs.push(`Комментарий опубликован к "${thread.text.substring(0, 50)}..."`);
        } else {
          throw new Error(publishData.error?.message || "Ошибка публикации");
        }
      } else {
        throw new Error(createData.error?.message || "Ошибка создания");
      }
    } catch (e: any) {
      failed++;
      logs.push(`Ошибка: ${e.message}`);
      await storage.createCommentLog({
        campaignId: campaign.id,
        userId: campaign.userId,
        targetThreadId: thread.id,
        targetThreadText: thread.text?.substring(0, 500) || "",
        commentText: "",
        status: "failed",
        error: e.message,
      });
    }
  }

  await storage.updateCommentCampaign(campaign.id, {
    lastRunAt: new Date(),
    totalComments: (campaign.totalComments || 0) + success,
  } as any, campaign.userId);

  return { success, failed, logs };
}

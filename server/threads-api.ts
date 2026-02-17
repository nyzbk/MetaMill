import { storage } from "./storage";

const THREADS_AUTH_URL = "https://threads.net/oauth/authorize";
const THREADS_TOKEN_URL = "https://graph.threads.net/oauth/access_token";
const THREADS_API_URL = "https://graph.threads.net/v1.0";

function getAppId(): string {
  const id = process.env.META_APP_ID;
  if (!id) throw new Error("META_APP_ID not configured");
  return id;
}

function getAppSecret(): string {
  const secret = process.env.META_APP_SECRET;
  if (!secret) throw new Error("META_APP_SECRET not configured");
  return secret;
}

function getRedirectUri(): string {
  if (process.env.THREADS_REDIRECT_URI) {
    return process.env.THREADS_REDIRECT_URI;
  }
  let host: string;
  if (process.env.REPLIT_DEPLOYMENT_URL) {
    host = process.env.REPLIT_DEPLOYMENT_URL;
    if (!host.startsWith("https://")) {
      host = `https://${host}`;
    }
  } else if (process.env.REPLIT_DEV_DOMAIN) {
    host = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  } else {
    host = "http://localhost:5000";
  }
  const uri = `${host}/api/auth/threads/callback`;
  return uri;
}

async function safeFetchJson(res: Response, context: string): Promise<any> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`${context}: пустой ответ от API (HTTP ${res.status})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${context}: неожиданный ответ от API (HTTP ${res.status}): ${text.substring(0, 200)}`);
  }
}

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!process.env.META_APP_ID) errors.push("META_APP_ID не настроен");
  if (!process.env.META_APP_SECRET) errors.push("META_APP_SECRET не настроен");
  const uri = getRedirectUri();
  console.log("[threads-api] Redirect URI:", uri);
  return { valid: errors.length === 0, errors };
}

export function getThreadsAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getAppId(),
    redirect_uri: getRedirectUri(),
    scope: "threads_basic,threads_content_publish,threads_manage_replies,threads_read_replies",
    response_type: "code",
    state,
  });
  return `${THREADS_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  userId: string;
}> {
  const params = new URLSearchParams({
    client_id: getAppId(),
    client_secret: getAppSecret(),
    grant_type: "authorization_code",
    redirect_uri: getRedirectUri(),
    code,
  });

  const res = await fetch(THREADS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await safeFetchJson(res, "Обмен кода на токен");
  if (data.error) {
    const msg = data.error_message || data.error?.message || data.error;
    throw new Error(`Ошибка получения токена: ${msg}`);
  }

  if (!data.access_token || !data.user_id) {
    throw new Error(`Ответ API не содержит access_token или user_id`);
  }

  return {
    accessToken: data.access_token,
    userId: String(data.user_id),
  };
}

export async function exchangeForLongLivedToken(shortToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const params = new URLSearchParams({
    grant_type: "th_exchange_token",
    client_secret: getAppSecret(),
    access_token: shortToken,
  });

  const longLivedTokenUrl = "https://graph.threads.net/access_token";
  const res = await fetch(`${longLivedTokenUrl}?${params.toString()}`);
  const data = await safeFetchJson(res, "Обмен на долгосрочный токен");

  if (data.error) {
    const msg = data.error?.message || data.error_message || data.error;
    console.error("[threads-api] Long-lived token error:", JSON.stringify(data));
    throw new Error(`Ошибка долгосрочного токена: ${msg}`);
  }

  if (!data.access_token) {
    throw new Error("Ответ API не содержит access_token");
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 5184000,
  };
}

export async function getThreadsProfile(accessToken: string, userId: string): Promise<{
  username: string;
  profilePictureUrl?: string;
  threadsUserId: string;
}> {
  const meRes = await fetch(
    `${THREADS_API_URL}/me?fields=id,username,threads_profile_picture_url&access_token=${accessToken}`
  );
  const meData = await safeFetchJson(meRes, "Получение профиля через /me");

  if (!meData.error) {
    return {
      username: meData.username || meData.id || userId,
      profilePictureUrl: meData.threads_profile_picture_url,
      threadsUserId: meData.id ? String(meData.id) : userId,
    };
  }

  console.log("[threads-api] /me failed, trying /${userId}:", meData.error);
  const res = await fetch(
    `${THREADS_API_URL}/${userId}?fields=username,threads_profile_picture_url&access_token=${accessToken}`
  );
  const data = await safeFetchJson(res, "Получение профиля");

  if (data.error) {
    throw new Error(`Ошибка профиля: ${data.error?.message || data.error}`);
  }

  return {
    username: data.username || data.id,
    profilePictureUrl: data.threads_profile_picture_url,
    threadsUserId: data.id ? String(data.id) : userId,
  };
}

export async function fetchThreadInsights(
  accessToken: string,
  mediaId: string
): Promise<{ likes: number; replies: number; reposts: number; quotes: number; views: number }> {
  const metrics = "likes,replies,reposts,quotes,views";
  try {
    const res = await fetch(
      `${THREADS_API_URL}/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`
    );
    const data = await safeFetchJson(res, "Получение метрик");
    if (data.error || !data.data) {
      return { likes: 0, replies: 0, reposts: 0, quotes: 0, views: 0 };
    }
    const result: Record<string, number> = { likes: 0, replies: 0, reposts: 0, quotes: 0, views: 0 };
    for (const item of data.data) {
      const name = item.name as string;
      if (name in result) {
        result[name] = item.values?.[0]?.value ?? 0;
      }
    }
    return result as { likes: number; replies: number; reposts: number; quotes: number; views: number };
  } catch (err: any) {
    console.warn(`[threads-api] Failed to fetch insights for ${mediaId}:`, err.message);
    return { likes: 0, replies: 0, reposts: 0, quotes: 0, views: 0 };
  }
}

async function waitForContainerReady(
  containerId: string,
  accessToken: string,
  maxAttempts: number = 10
): Promise<{ ready: boolean; status: string; error?: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(
        `${THREADS_API_URL}/${containerId}?fields=status,error_message&access_token=${accessToken}`
      );
      const data = await safeFetchJson(res, `Проверка статуса контейнера ${containerId}`);

      if (data.error) {
        return { ready: false, status: "ERROR", error: data.error.message || data.error };
      }

      const status = data.status || "UNKNOWN";
      console.log(`[threads-api] Container ${containerId} status: ${status} (attempt ${attempt + 1}/${maxAttempts})`);

      if (status === "FINISHED") {
        return { ready: true, status };
      }

      if (status === "ERROR" || status === "EXPIRED") {
        return { ready: false, status, error: data.error_message || `Контейнер в статусе ${status}` };
      }

      await new Promise((r) => setTimeout(r, 2000));
    } catch (err: any) {
      console.warn(`[threads-api] Status check failed for ${containerId}:`, err.message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return { ready: false, status: "TIMEOUT", error: "Контейнер не готов после ожидания" };
}

async function createContainer(
  accessToken: string,
  text: string,
  replyToId: string | undefined,
  postIndex: number,
  maxRetries: number = 2
): Promise<{ containerId: string | null; error: string | null }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const createBody: Record<string, string> = {
        text,
        media_type: "TEXT",
        access_token: accessToken,
      };
      if (replyToId) {
        createBody.reply_to_id = replyToId;
      }

      const createRes = await fetch(`${THREADS_API_URL}/me/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBody),
      });
      const createData = await safeFetchJson(createRes, `Создание поста ${postIndex + 1}`);

      if (createData.error) {
        const msg = createData.error.message || createData.error;
        if (attempt < maxRetries) {
          console.warn(`[threads-api] Post ${postIndex + 1} create failed (attempt ${attempt + 1}), retrying: ${msg}`);
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        return { containerId: null, error: `Создание: ${msg}` };
      }

      if (!createData.id) {
        if (attempt < maxRetries) {
          console.warn(`[threads-api] Post ${postIndex + 1} no container ID (attempt ${attempt + 1}), retrying`);
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        return { containerId: null, error: "API не вернул ID контейнера" };
      }

      return { containerId: createData.id, error: null };
    } catch (err: any) {
      if (attempt < maxRetries) {
        console.warn(`[threads-api] Post ${postIndex + 1} create exception (attempt ${attempt + 1}): ${err.message}`);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      return { containerId: null, error: err.message };
    }
  }
  return { containerId: null, error: "Неизвестная ошибка при создании" };
}

async function publishContainer(
  accessToken: string,
  containerId: string,
  postIndex: number,
  maxRetries: number = 2
): Promise<{ mediaId: string | null; error: string | null }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const publishRes = await fetch(`${THREADS_API_URL}/me/threads_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      });
      const publishData = await safeFetchJson(publishRes, `Публикация поста ${postIndex + 1}`);

      if (publishData.error) {
        const msg = publishData.error.message || publishData.error;
        if (attempt < maxRetries) {
          console.warn(`[threads-api] Post ${postIndex + 1} publish failed (attempt ${attempt + 1}), retrying: ${msg}`);
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        return { mediaId: null, error: `Публикация: ${msg}` };
      }

      const mediaId = publishData.id || containerId;
      console.log(`[threads-api] Post ${postIndex + 1} published successfully: ${mediaId}`);
      return { mediaId, error: null };
    } catch (err: any) {
      if (attempt < maxRetries) {
        console.warn(`[threads-api] Post ${postIndex + 1} publish exception (attempt ${attempt + 1}): ${err.message}`);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      return { mediaId: null, error: err.message };
    }
  }
  return { mediaId: null, error: "Неизвестная ошибка при публикации" };
}

async function publishSinglePost(
  accessToken: string,
  text: string,
  replyToId: string | undefined,
  postIndex: number
): Promise<{ mediaId: string | null; error: string | null }> {
  const { containerId, error: createError } = await createContainer(accessToken, text, replyToId, postIndex);
  if (!containerId) {
    return { mediaId: null, error: createError };
  }

  const containerStatus = await waitForContainerReady(containerId, accessToken);
  if (!containerStatus.ready) {
    return { mediaId: null, error: `Контейнер не готов: ${containerStatus.error}` };
  }

  return await publishContainer(accessToken, containerId, postIndex);
}

export async function publishThreadChain(
  accessToken: string,
  userId: string,
  posts: string[]
): Promise<{ mediaIds: string[]; errors: string[] }> {
  const mediaIds: string[] = [];
  const errors: string[] = [];
  let previousMediaId: string | undefined;

  for (let i = 0; i < posts.length; i++) {
    const result = await publishSinglePost(accessToken, posts[i], previousMediaId, i);

    if (result.mediaId) {
      mediaIds.push(result.mediaId);
      previousMediaId = result.mediaId;
    } else {
      const errorMsg = `Пост ${i + 1}/${posts.length}: ${result.error}`;
      errors.push(errorMsg);
      console.error(`[threads-api] ${errorMsg}`);

      if (i === 0) {
        errors.push("Публикация остановлена: первый пост цепочки не удалось опубликовать");
        break;
      }
    }

    if (i < posts.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`[threads-api] Chain result: ${mediaIds.length} published, ${errors.length} errors`);
  return { mediaIds, errors };
}

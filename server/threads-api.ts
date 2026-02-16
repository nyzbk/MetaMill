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
}> {
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
  };
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
    try {
      const createBody: Record<string, string> = {
        text: posts[i],
        media_type: "TEXT",
        access_token: accessToken,
      };

      if (previousMediaId) {
        createBody.reply_to_id = previousMediaId;
      }

      const createRes = await fetch(`${THREADS_API_URL}/me/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBody),
      });
      const createData = await safeFetchJson(createRes, `Создание поста ${i + 1}`);

      if (createData.error) {
        errors.push(`Пост ${i + 1}: ${createData.error.message || createData.error}`);
        continue;
      }

      if (!createData.id) {
        errors.push(`Пост ${i + 1}: API не вернул ID контейнера`);
        continue;
      }

      const publishRes = await fetch(`${THREADS_API_URL}/me/threads_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: createData.id,
          access_token: accessToken,
        }),
      });
      const publishData = await safeFetchJson(publishRes, `Публикация поста ${i + 1}`);

      if (publishData.error) {
        errors.push(`Пост ${i + 1}: ${publishData.error.message || publishData.error}`);
        continue;
      }

      const mediaId = publishData.id || createData.id;
      mediaIds.push(mediaId);
      previousMediaId = mediaId;

      if (i < posts.length - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (err: any) {
      errors.push(`Пост ${i + 1}: ${err.message}`);
    }
  }

  return { mediaIds, errors };
}

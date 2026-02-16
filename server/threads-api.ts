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
  const host = process.env.REPLIT_DEPLOYMENT_URL
    ? process.env.REPLIT_DEPLOYMENT_URL
    : process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:5000";
  return `${host}/api/auth/threads/callback`;
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

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error_message || data.error?.message || "Token exchange failed");
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

  const res = await fetch(`${THREADS_TOKEN_URL}?${params.toString()}`);
  const data = await res.json();

  if (data.error) {
    throw new Error(data.error_message || "Long-lived token exchange failed");
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
  const data = await res.json();

  if (data.error) {
    throw new Error(data.error?.message || "Failed to fetch profile");
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
      const createData = await createRes.json();

      if (createData.error) {
        errors.push(`Post ${i + 1}: ${createData.error.message}`);
        continue;
      }

      if (!createData.id) {
        errors.push(`Post ${i + 1}: No container ID returned`);
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
      const publishData = await publishRes.json();

      if (publishData.error) {
        errors.push(`Post ${i + 1}: ${publishData.error.message}`);
        continue;
      }

      const mediaId = publishData.id || createData.id;
      mediaIds.push(mediaId);
      previousMediaId = mediaId;

      if (i < posts.length - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (err: any) {
      errors.push(`Post ${i + 1}: ${err.message}`);
    }
  }

  return { mediaIds, errors };
}

import { storage } from "./storage";

const THREADS_API_URL = "https://graph.threads.net/v1.0";

interface ThreadPost {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  like_count?: number;
  reply_count?: number;
  views?: number;
  media_type?: string;
  media_url?: string;
}

interface ThreadsSearchResult {
  data: ThreadPost[];
  paging?: {
    cursors?: { before: string; after: string };
    next?: string;
  };
}

export async function searchThreadsByKeyword(
  accessToken: string,
  query: string,
  limit: number = 25
): Promise<ThreadPost[]> {
  const url = `${THREADS_API_URL}/keyword_search?q=${encodeURIComponent(query)}&fields=id,text,username,like_count,reply_count,timestamp,media_type&limit=${limit}&access_token=${accessToken}`;
  const res = await fetch(url);
  const data: ThreadsSearchResult = await res.json();
  if ((data as any).error) {
    throw new Error((data as any).error.message || "Search failed");
  }
  return data.data || [];
}

export async function getUserThreads(
  accessToken: string,
  userId: string,
  limit: number = 50
): Promise<ThreadPost[]> {
  const url = `${THREADS_API_URL}/${userId}/threads?fields=id,text,username,like_count,reply_count,timestamp,media_type&limit=${limit}&access_token=${accessToken}`;
  const res = await fetch(url);
  const data: ThreadsSearchResult = await res.json();
  if ((data as any).error) {
    throw new Error((data as any).error.message || "Failed to fetch user threads");
  }
  return data.data || [];
}

export async function lookupThreadsUser(
  accessToken: string,
  userId: string
): Promise<{ id: string; username: string; biography?: string; is_verified?: boolean; profile_picture_url?: string }> {
  const url = `${THREADS_API_URL}/${userId}?fields=id,username,threads_biography,is_verified,threads_profile_picture_url&access_token=${accessToken}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || "User lookup failed");
  }
  return {
    id: data.id,
    username: data.username,
    biography: data.threads_biography,
    is_verified: data.is_verified,
    profile_picture_url: data.threads_profile_picture_url,
  };
}

export function sortByEngagement(threads: ThreadPost[]): ThreadPost[] {
  return [...threads].sort((a, b) => {
    const scoreA = (a.like_count || 0) + (a.reply_count || 0) * 3;
    const scoreB = (b.like_count || 0) + (b.reply_count || 0) * 3;
    return scoreB - scoreA;
  });
}

export function filterViralThreads(threads: ThreadPost[], minLikes: number = 50): ThreadPost[] {
  return threads.filter(t => (t.like_count || 0) >= minLikes && t.text && t.text.length > 30);
}

export async function importThreadAsTemplate(
  thread: ThreadPost,
  accountId?: number
): Promise<any> {
  const title = thread.text.substring(0, 60) + (thread.text.length > 60 ? "..." : "");
  const template = await storage.createTemplate({
    title: `[Импорт] ${title}`,
    description: `Импортировано от @${thread.username} | ${thread.like_count || 0} лайков | ${new Date(thread.timestamp).toLocaleDateString("ru-RU")}`,
    branches: 1,
    content: JSON.stringify([thread.text]),
    style: "reference",
    accountId: accountId || null,
    status: "active",
  });
  return template;
}

export async function importMultipleAsTemplate(
  threads: ThreadPost[],
  templateTitle: string,
  accountId?: number
): Promise<any> {
  const texts = threads.map(t => t.text).filter(Boolean);
  if (texts.length === 0) throw new Error("Нет текстового контента для импорта");

  const totalLikes = threads.reduce((sum, t) => sum + (t.like_count || 0), 0);
  const template = await storage.createTemplate({
    title: templateTitle,
    description: `${texts.length} постов | ${totalLikes} лайков | от @${threads[0]?.username || "unknown"}`,
    branches: texts.length,
    content: JSON.stringify(texts),
    style: "reference",
    accountId: accountId || null,
    status: "active",
  });
  return template;
}

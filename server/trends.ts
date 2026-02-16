import { db } from "./db";
import { trendItems, type InsertTrendItem } from "@shared/schema";
import { desc, sql } from "drizzle-orm";

const TREND_SOURCES = [
  { name: "HackerNews", url: "https://hacker-news.firebaseio.com/v0/topstories.json" },
  { name: "ProductHunt", url: "https://www.producthunt.com/feed" },
];

export async function fetchHackerNewsTrends(): Promise<InsertTrendItem[]> {
  try {
    const res = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
    const ids: number[] = await res.json();
    const top = ids.slice(0, 20);

    const items: InsertTrendItem[] = [];
    const batchSize = 5;
    for (let i = 0; i < top.length; i += batchSize) {
      const batch = top.slice(i, i + batchSize);
      const details = await Promise.all(
        batch.map(async (id) => {
          try {
            const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
            return await r.json();
          } catch { return null; }
        })
      );
      for (const d of details) {
        if (d && d.title) {
          items.push({
            title: d.title,
            url: d.url || `https://news.ycombinator.com/item?id=${d.id}`,
            source: "HackerNews",
            description: d.text?.substring(0, 300) || null,
            score: d.score || 0,
            category: d.type || "story",
          });
        }
      }
    }
    return items;
  } catch (err) {
    console.error("[trends] HackerNews fetch error:", err);
    return [];
  }
}

export async function fetchRedditTrends(subreddit = "technology"): Promise<InsertTrendItem[]> {
  try {
    const res = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=15`, {
      headers: { "User-Agent": "MetaMill/1.0" },
    });
    const data = await res.json();
    const posts = data?.data?.children || [];

    return posts
      .filter((p: any) => !p.data.stickied)
      .map((p: any) => ({
        title: p.data.title,
        url: `https://reddit.com${p.data.permalink}`,
        source: `Reddit r/${subreddit}`,
        description: (p.data.selftext || "").substring(0, 300) || null,
        score: p.data.score || 0,
        category: p.data.link_flair_text || "general",
      }));
  } catch (err) {
    console.error("[trends] Reddit fetch error:", err);
    return [];
  }
}

export async function fetchRssTrends(feedUrl: string, sourceName: string): Promise<InsertTrendItem[]> {
  try {
    const res = await fetch(feedUrl);
    const text = await res.text();
    const items: InsertTrendItem[] = [];

    const titleMatches = text.match(/<title[^>]*>([^<]+)<\/title>/g) || [];
    const linkMatches = text.match(/<link[^>]*>([^<]+)<\/link>/g) || [];

    for (let i = 1; i < Math.min(titleMatches.length, 15); i++) {
      const title = titleMatches[i]?.replace(/<[^>]+>/g, "").trim();
      const link = linkMatches[i]?.replace(/<[^>]+>/g, "").trim();
      if (title) {
        items.push({
          title,
          url: link || null,
          source: sourceName,
          description: null,
          score: 0,
          category: "news",
        });
      }
    }
    return items;
  } catch (err) {
    console.error(`[trends] RSS fetch error (${sourceName}):`, err);
    return [];
  }
}

export async function refreshTrends(): Promise<number> {
  const allItems: InsertTrendItem[] = [];

  const [hn, reddit, techcrunch] = await Promise.all([
    fetchHackerNewsTrends(),
    fetchRedditTrends("technology"),
    fetchRssTrends("https://techcrunch.com/feed/", "TechCrunch"),
  ]);

  allItems.push(...hn, ...reddit, ...techcrunch);

  if (allItems.length === 0) return 0;

  await db.delete(trendItems).where(sql`true`);
  await db.insert(trendItems).values(allItems);

  console.log(`[trends] Refreshed ${allItems.length} trend items`);
  return allItems.length;
}

export async function getTrends(limit = 50) {
  return db.select().from(trendItems).orderBy(desc(trendItems.score)).limit(limit);
}

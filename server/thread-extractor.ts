import { storage } from "./storage";

interface ExtractedThread {
  username: string;
  posts: string[];
  source: string;
  engagement?: { likes?: number; replies?: number };
}

function isThreadsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "www.threads.net" || u.hostname === "threads.net" ||
      u.hostname === "www.threads.com" || u.hostname === "threads.com"
    );
  } catch {
    return false;
  }
}

function extractUsernameFromUrl(url: string): string {
  const match = url.match(/threads\.(?:net|com)\/@([^/\?]+)/);
  return match ? match[1] : "unknown";
}

function extractMetaTags(html: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const metaRegex = /<meta\s+(?:property|name)=["']([^"']+)["']\s+content=["']([^"']*?)["']\s*\/?>/gi;
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    tags[match[1]] = match[2];
  }
  const metaRegex2 = /<meta\s+content=["']([^"']*?)["']\s+(?:property|name)=["']([^"']+)["']\s*\/?>/gi;
  while ((match = metaRegex2.exec(html)) !== null) {
    tags[match[2]] = match[1];
  }
  return tags;
}

function extractJsonLd(html: string): any[] {
  const results: any[] = [];
  const regex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      results.push(JSON.parse(match[1]));
    } catch {}
  }
  return results;
}

function extractEmbeddedJson(html: string): string[] {
  const texts: string[] = [];
  const scriptRegex = /<script\s+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const jsonStr = JSON.stringify(data);
      const textMatches = jsonStr.match(/"text"\s*:\s*"([^"]{10,500})"/g);
      if (textMatches) {
        for (const tm of textMatches) {
          const val = tm.match(/"text"\s*:\s*"([^"]+)"/);
          if (val && val[1]) {
            const decoded = val[1]
              .replace(/\\n/g, "\n")
              .replace(/\\"/g, '"')
              .replace(/\\u[\dA-Fa-f]{4}/g, (m) => String.fromCharCode(parseInt(m.slice(2), 16)));
            if (decoded.length > 15 && !decoded.startsWith("http") && !decoded.includes("<") && !decoded.match(/^[{}\[\]]/)) {
              texts.push(decoded);
            }
          }
        }
      }
    } catch {}
  }
  return texts;
}

function cleanThreadText(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function deduplicateTexts(texts: string[]): string[] {
  const seen = new Set<string>();
  return texts.filter(t => {
    const normalized = t.toLowerCase().trim().substring(0, 100);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function parseHtmlToThread(html: string, username: string, sourceUrl: string): ExtractedThread {
  const posts: string[] = [];

  const metaTags = extractMetaTags(html);
  const ogDescription = metaTags["og:description"] || metaTags["description"] || "";
  const ogTitle = metaTags["og:title"] || "";

  if (ogDescription && ogDescription.length > 15) {
    const cleaned = cleanThreadText(ogDescription);
    const withoutPrefix = cleaned.replace(/^@\w+\s+on\s+Threads:?\s*/i, "").replace(/^@\w+:\s*/i, "");
    if (withoutPrefix.length > 10) {
      posts.push(withoutPrefix);
    }
  }

  const jsonLd = extractJsonLd(html);
  for (const ld of jsonLd) {
    if (ld.text && typeof ld.text === "string" && ld.text.length > 10) {
      posts.push(cleanThreadText(ld.text));
    }
    if (ld.articleBody && typeof ld.articleBody === "string") {
      posts.push(cleanThreadText(ld.articleBody));
    }
  }

  const embeddedTexts = extractEmbeddedJson(html);
  for (const t of embeddedTexts) {
    posts.push(t);
  }

  const dedupedPosts = deduplicateTexts(posts);

  if (dedupedPosts.length === 0) {
    if (ogTitle && ogTitle.length > 10) {
      dedupedPosts.push(cleanThreadText(ogTitle));
    }
  }

  if (dedupedPosts.length === 0) {
    throw new Error(
      "Не удалось извлечь текст треда. Threads.net использует динамическую загрузку контента. " +
      "Попробуйте: (1) Firecrawl с API ключом, (2) скопируйте текст вручную через 'Ручной импорт'."
    );
  }

  return {
    username,
    posts: dedupedPosts,
    source: sourceUrl,
  };
}

async function scrapeThreadsUrl(url: string): Promise<ExtractedThread> {
  const username = extractUsernameFromUrl(url);

  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
    "Cache-Control": "no-cache",
  };

  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15000),
    redirect: "manual",
  });

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (location) {
      const redirectUrl = new URL(location, url);
      const allowed = ["www.threads.net", "threads.net", "www.threads.com", "threads.com"];
      if (!allowed.includes(redirectUrl.hostname)) {
        throw new Error("Перенаправление на запрещённый домен");
      }
      const redirectRes = await fetch(redirectUrl.toString(), {
        headers,
        signal: AbortSignal.timeout(15000),
        redirect: "manual",
      });
      if (!redirectRes.ok) {
        throw new Error(`Не удалось загрузить страницу после перенаправления: HTTP ${redirectRes.status}`);
      }
      const html = await redirectRes.text();
      return parseHtmlToThread(html, username, url);
    }
  }

  if (!res.ok) {
    throw new Error(`Не удалось загрузить страницу: HTTP ${res.status}`);
  }

  const html = await res.text();
  return parseHtmlToThread(html, username, url);
}

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<ExtractedThread> {
  const username = extractUsernameFromUrl(url);

  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      waitFor: 3000,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Firecrawl API ошибка (HTTP ${res.status}): ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  const markdown = data?.data?.markdown || "";

  if (!markdown || markdown.length < 20) {
    throw new Error("Firecrawl не смог извлечь контент с этой страницы");
  }

  const posts = parseMarkdownToPosts(markdown, username);

  if (posts.length === 0) {
    posts.push(markdown.substring(0, 500));
  }

  return {
    username,
    posts: deduplicateTexts(posts),
    source: url,
  };
}

function parseMarkdownToPosts(markdown: string, username: string): string[] {
  const posts: string[] = [];
  const lines = markdown.split("\n");

  let currentPost = "";
  const skipPatterns = [
    /^#{1,6}\s/,
    /^\[.*\]\(.*\)$/,
    /^!\[/,
    /^---$/,
    /^likes?$/i,
    /^repl(y|ies)$/i,
    /^share$/i,
    /^follow$/i,
    /^log in/i,
    /^sign up/i,
    /^\d+\s*(likes?|repl|views?|shares?)/i,
    /^@\w+$/,
    /^\d{1,2}[hmdw]$/,
    /^verified/i,
    /^more$/i,
    /^threads$/i,
    /^home$/i,
    /^search$/i,
    /^activity$/i,
    /^profile$/i,
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentPost.length > 15) {
        posts.push(currentPost.trim());
        currentPost = "";
      }
      continue;
    }

    if (skipPatterns.some(p => p.test(trimmed))) continue;
    if (trimmed.length < 5) continue;

    if (currentPost) currentPost += "\n";
    currentPost += trimmed;
  }

  if (currentPost.length > 15) {
    posts.push(currentPost.trim());
  }

  return posts.filter(p => p.length > 15 && p.length < 2000);
}

export async function extractThreadFromUrl(
  url: string,
  options: {
    firecrawlApiKey?: string | null;
    userId: string;
  }
): Promise<ExtractedThread> {
  if (!isThreadsUrl(url)) {
    throw new Error("URL должен быть ссылкой на Threads (например, https://www.threads.com/@user/post/xxxxx)");
  }

  if (options.firecrawlApiKey) {
    console.log("[extractor] Using Firecrawl for:", url);
    try {
      return await scrapeWithFirecrawl(url, options.firecrawlApiKey);
    } catch (err: any) {
      console.log("[extractor] Firecrawl failed, falling back to direct scrape:", err.message);
    }
  }

  console.log("[extractor] Using direct HTML scrape for:", url);
  return await scrapeThreadsUrl(url);
}

export async function extractAndImport(
  url: string,
  options: {
    firecrawlApiKey?: string | null;
    userId: string;
    title?: string;
    accountId?: number | null;
  }
): Promise<any> {
  const extracted = await extractThreadFromUrl(url, options);

  const title = options.title || `[Извлечено] @${extracted.username}`;
  const template = await storage.createTemplate({
    userId: options.userId,
    title,
    description: `Извлечено из ${extracted.source} | @${extracted.username} | ${extracted.posts.length} пост(ов)`,
    branches: extracted.posts.length,
    content: JSON.stringify(extracted.posts),
    style: "reference",
    accountId: options.accountId || null,
    status: "active",
  });

  return { template, extracted };
}

export async function extractMultipleUrls(
  urls: string[],
  options: {
    firecrawlApiKey?: string | null;
    userId: string;
  }
): Promise<{ results: ExtractedThread[]; errors: { url: string; error: string }[] }> {
  const results: ExtractedThread[] = [];
  const errors: { url: string; error: string }[] = [];

  for (const url of urls) {
    try {
      const result = await extractThreadFromUrl(url.trim(), options);
      results.push(result);
      await new Promise(r => setTimeout(r, 1500));
    } catch (err: any) {
      errors.push({ url, error: err.message });
    }
  }

  return { results, errors };
}

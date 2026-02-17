import { generateWithLlm } from "./llm";
import { storage } from "./storage";

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isSafeUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();
    const blockedPatterns = ["localhost", "127.0.0.1", "0.0.0.0", "169.254.", "10.", "192.168.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31."];
    for (const p of blockedPatterns) {
      if (hostname.startsWith(p) || hostname === p) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function extractTextFromHtml(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");

  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return text.substring(0, 8000);
}

export async function fetchAndExtractContent(url: string): Promise<{ title: string; text: string; source: string }> {
  if (!isValidUrl(url)) throw new Error("Некорректный URL");
  if (!isSafeUrl(url)) throw new Error("Доступ к внутренним адресам запрещён");

  const isReddit = url.includes("reddit.com");
  if (isReddit) {
    return fetchRedditContent(url);
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MetaMill/1.0)",
      "Accept": "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Ошибка загрузки: HTTP ${res.status}`);

  const html = await res.text();
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;
  const text = extractTextFromHtml(html);

  if (text.length < 50) throw new Error("Не удалось извлечь достаточно текста со страницы");

  return { title, text, source: new URL(url).hostname };
}

async function fetchRedditContent(url: string): Promise<{ title: string; text: string; source: string }> {
  const jsonUrl = url.endsWith(".json") ? url : url.replace(/\/?$/, ".json");
  const res = await fetch(jsonUrl, {
    headers: { "User-Agent": "MetaMill/1.0" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Reddit API error: HTTP ${res.status}`);
  const data = await res.json();

  const postData = Array.isArray(data) ? data[0]?.data?.children?.[0]?.data : data?.data?.children?.[0]?.data;
  if (!postData) throw new Error("Не удалось разобрать пост Reddit");

  const title = postData.title || "Reddit Post";
  let text = postData.selftext || "";

  if (Array.isArray(data) && data[1]?.data?.children) {
    const comments = data[1].data.children
      .filter((c: any) => c.kind === "t1" && c.data.body)
      .slice(0, 10)
      .map((c: any) => c.data.body)
      .join("\n\n");
    text += "\n\nТоп комментарии:\n" + comments;
  }

  return { title, text: text.substring(0, 8000), source: "Reddit" };
}

export async function repurposeToThread(
  url: string,
  options: {
    branches?: number;
    style?: string;
    provider?: string;
    modelId?: string;
    apiKey?: string | null;
    baseUrl?: string | null;
    userId: string;
    userNiche?: string;
  }
): Promise<{ title: string; branches: string[]; source: string }> {
  const { title, text, source } = await fetchAndExtractContent(url);

  const branchCount = options.branches || 5;
  const llmSetting = {
    provider: options.provider || "openrouter",
    modelId: options.modelId || "meta-llama/llama-3.3-70b-instruct",
    apiKey: options.apiKey || null,
    baseUrl: options.baseUrl || null,
  };

  const systemPrompt = `You are MetaMill, an AI content repurposing engine.
Your task: take the source material below and transform it into an engaging Threads thread chain.
Generate exactly ${branchCount} posts, each under 500 characters.
${options.userNiche ? `IMPORTANT: The user's niche/topic is: "${options.userNiche}". Adapt the content to be relevant to this niche.` : ""}
${options.style ? `Style: ${options.style}` : "Style: casual, engaging"}

Rules:
- First post: attention-grabbing hook
- Middle posts: key insights from the source
- Last post: call to action or conclusion
- Write in Russian language
- Return ONLY a JSON object: {"branches": ["post1", "post2", ...]}
- Do NOT copy text verbatim — rephrase and adapt for Threads audience`;

  const content = await generateWithLlm(llmSetting, {
    systemPrompt,
    userPrompt: `Source: "${title}"\n\n${text}`,
    jsonMode: llmSetting.provider !== "anthropic" && llmSetting.provider !== "ollama",
    maxTokens: 4096,
  });

  let branches: string[];
  try {
    const parsed = JSON.parse(content);
    branches = parsed.branches || [content];
  } catch {
    branches = [content];
  }

  return { title, branches, source };
}

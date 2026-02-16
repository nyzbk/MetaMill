import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  username: text("username").notNull(),
  platform: text("platform").notNull().default("threads"),
  avatarUrl: text("avatar_url"),
  accessToken: text("access_token"),
  threadsUserId: text("threads_user_id"),
  tokenExpiresAt: timestamp("token_expires_at"),
  status: text("status").notNull().default("active"),
  followers: integer("followers").default(0),
  postsCount: integer("posts_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAccountSchema = createInsertSchema(accounts).omit({
  id: true,
  createdAt: true,
});

export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  title: text("title").notNull(),
  description: text("description"),
  branches: integer("branches").notNull().default(1),
  content: text("content").notNull().default("[]"),
  style: text("style").default("casual"),
  accountId: integer("account_id"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
});

export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templates.$inferSelect;

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  accountId: integer("account_id"),
  templateId: integer("template_id"),
  content: text("content").notNull(),
  threadPosition: integer("thread_position").default(0),
  parentPostId: text("parent_post_id"),
  threadsMediaId: text("threads_media_id"),
  status: text("status").notNull().default("draft"),
  publishedAt: timestamp("published_at"),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  createdAt: true,
});

export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof posts.$inferSelect;

export const scheduledJobs = pgTable("scheduled_jobs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  accountId: integer("account_id").notNull(),
  templateId: integer("template_id"),
  cronExpression: text("cron_expression"),
  scheduledAt: timestamp("scheduled_at"),
  status: text("status").notNull().default("pending"),
  isRecurring: boolean("is_recurring").default(false),
  topic: text("topic"),
  style: text("style"),
  branches: integer("branches").default(5),
  provider: text("provider"),
  modelId: text("model_id"),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  lastError: text("last_error"),
  runCount: integer("run_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertScheduledJobSchema = createInsertSchema(scheduledJobs).omit({
  id: true,
  createdAt: true,
});

export type InsertScheduledJob = z.infer<typeof insertScheduledJobSchema>;
export type ScheduledJob = typeof scheduledJobs.$inferSelect;

export const llmSettings = pgTable("llm_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  provider: text("provider").notNull(),
  modelId: text("model_id").notNull(),
  displayName: text("display_name").notNull(),
  apiKey: text("api_key"),
  baseUrl: text("base_url"),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const trendItems = pgTable("trend_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url"),
  source: text("source").notNull(),
  description: text("description"),
  score: integer("score").default(0),
  category: text("category"),
  fetchedAt: timestamp("fetched_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTrendItemSchema = createInsertSchema(trendItems).omit({
  id: true,
  fetchedAt: true,
});
export type InsertTrendItem = z.infer<typeof insertTrendItemSchema>;
export type TrendItem = typeof trendItems.$inferSelect;

export const keywordMonitors = pgTable("keyword_monitors", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  keyword: text("keyword").notNull(),
  platform: text("platform").notNull().default("threads"),
  isActive: boolean("is_active").default(true).notNull(),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertKeywordMonitorSchema = createInsertSchema(keywordMonitors).omit({
  id: true,
  createdAt: true,
  lastCheckedAt: true,
});
export type InsertKeywordMonitor = z.infer<typeof insertKeywordMonitorSchema>;
export type KeywordMonitor = typeof keywordMonitors.$inferSelect;

export const monitorResults = pgTable("monitor_results", {
  id: serial("id").primaryKey(),
  monitorId: integer("monitor_id").notNull(),
  userId: text("user_id").notNull(),
  threadText: text("thread_text").notNull(),
  author: text("author"),
  url: text("url"),
  likeCount: integer("like_count").default(0),
  fetchedAt: timestamp("fetched_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertMonitorResultSchema = createInsertSchema(monitorResults).omit({
  id: true,
  fetchedAt: true,
});
export type InsertMonitorResult = z.infer<typeof insertMonitorResultSchema>;
export type MonitorResult = typeof monitorResults.$inferSelect;

export const insertLlmSettingSchema = createInsertSchema(llmSettings).omit({
  id: true,
  createdAt: true,
});

export type InsertLlmSetting = z.infer<typeof insertLlmSettingSchema>;
export type LlmSetting = typeof llmSettings.$inferSelect;

export { conversations, messages } from "./models/chat";

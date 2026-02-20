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
  likes: integer("likes").default(0),
  replies: integer("replies").default(0),
  reposts: integer("reposts").default(0),
  quotes: integer("quotes").default(0),
  views: integer("views").default(0),
  engagementUpdatedAt: timestamp("engagement_updated_at"),
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

export const commentCampaigns = pgTable("comment_campaigns", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  accountId: integer("account_id").notNull(),
  name: text("name").notNull(),
  targetKeywords: text("target_keywords").notNull(),
  commentStyle: text("comment_style").notNull().default("helpful"),
  commentStyles: text("comment_styles"),
  maxCommentsPerRun: integer("max_comments_per_run").notNull().default(3),
  minDelaySeconds: integer("min_delay_seconds").notNull().default(30),
  maxDelaySeconds: integer("max_delay_seconds").notNull().default(120),
  intervalMinutes: integer("interval_minutes").default(0),
  nextRunAt: timestamp("next_run_at"),
  isActive: boolean("is_active").default(true).notNull(),
  lastRunAt: timestamp("last_run_at"),
  totalComments: integer("total_comments").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCommentCampaignSchema = createInsertSchema(commentCampaigns).omit({
  id: true,
  createdAt: true,
  lastRunAt: true,
  totalComments: true,
});
export type InsertCommentCampaign = z.infer<typeof insertCommentCampaignSchema>;
export type CommentCampaign = typeof commentCampaigns.$inferSelect;

export const commentLogs = pgTable("comment_logs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  userId: text("user_id").notNull(),
  targetThreadId: text("target_thread_id"),
  targetThreadText: text("target_thread_text"),
  commentText: text("comment_text").notNull(),
  commentStyle: text("comment_style"),
  status: text("status").notNull().default("pending"),
  threadsMediaId: text("threads_media_id"),
  error: text("error"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCommentLogSchema = createInsertSchema(commentLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertCommentLog = z.infer<typeof insertCommentLogSchema>;
export type CommentLog = typeof commentLogs.$inferSelect;

// ── Subscriptions / Pricing ──
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  plan: text("plan").notNull().default("basic"), // basic, pro, extra
  credits: integer("credits").notNull().default(200),
  creditsUsed: integer("credits_used").notNull().default(0),
  status: text("status").notNull().default("active"), // active, expired, cancelled
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  expiresAt: timestamp("expires_at"),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  startedAt: true,
});
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

// ── Credit Transactions ──
export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: integer("amount").notNull(), // positive = add, negative = deduct
  type: text("type").notNull(), // purchase, usage, referral_bonus, signup_bonus
  description: text("description"),
  balanceBefore: integer("balance_before").notNull().default(0),
  balanceAfter: integer("balance_after").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;

// ── Referral Payouts ──
export const referralPayouts = pgTable("referral_payouts", {
  id: serial("id").primaryKey(),
  referrerId: text("referrer_id").notNull(),
  referredUserId: text("referred_user_id").notNull(),
  subscriptionId: integer("subscription_id"),
  amount: integer("amount").notNull(), // in credits
  percentage: integer("percentage").notNull().default(30),
  status: text("status").notNull().default("pending"), // pending, paid
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertReferralPayoutSchema = createInsertSchema(referralPayouts).omit({
  id: true,
  createdAt: true,
});
export type InsertReferralPayout = z.infer<typeof insertReferralPayoutSchema>;
export type ReferralPayout = typeof referralPayouts.$inferSelect;

// ── Error Logs (for admin panel) ──
export const errorLogs = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  endpoint: text("endpoint"),
  errorMessage: text("error_message").notNull(),
  stackTrace: text("stack_trace"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertErrorLogSchema = createInsertSchema(errorLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;
export type ErrorLog = typeof errorLogs.$inferSelect;

export { conversations, messages } from "./models/chat";

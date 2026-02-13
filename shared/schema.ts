import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  platform: text("platform").notNull().default("threads"),
  avatarUrl: text("avatar_url"),
  accessToken: text("access_token"),
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
  accountId: integer("account_id").notNull(),
  templateId: integer("template_id"),
  cronExpression: text("cron_expression"),
  scheduledAt: timestamp("scheduled_at"),
  status: text("status").notNull().default("pending"),
  isRecurring: boolean("is_recurring").default(false),
  topic: text("topic"),
  style: text("style"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertScheduledJobSchema = createInsertSchema(scheduledJobs).omit({
  id: true,
  createdAt: true,
});

export type InsertScheduledJob = z.infer<typeof insertScheduledJobSchema>;
export type ScheduledJob = typeof scheduledJobs.$inferSelect;

export { conversations, messages } from "./models/chat";

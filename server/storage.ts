import { db } from "./db";
import { eq, desc, and, lte, or, isNull } from "drizzle-orm";
import {
  accounts, templates, posts, scheduledJobs, llmSettings,
  type Account, type InsertAccount,
  type Template, type InsertTemplate,
  type Post, type InsertPost,
  type ScheduledJob, type InsertScheduledJob,
  type LlmSetting, type InsertLlmSetting,
} from "@shared/schema";

export interface IStorage {
  getAccounts(userId: string): Promise<Account[]>;
  getAccount(id: number, userId: string): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  deleteAccount(id: number, userId: string): Promise<void>;
  updateAccount(id: number, data: Partial<InsertAccount>, userId: string): Promise<Account | undefined>;

  getTemplates(userId: string): Promise<Template[]>;
  getTemplate(id: number, userId: string): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  deleteTemplate(id: number, userId: string): Promise<void>;

  getPosts(userId: string): Promise<Post[]>;
  getPost(id: number, userId: string): Promise<Post | undefined>;
  createPost(post: InsertPost): Promise<Post>;
  updatePost(id: number, data: Partial<InsertPost>, userId: string): Promise<Post | undefined>;
  deletePost(id: number, userId: string): Promise<void>;

  getScheduledJobs(userId: string): Promise<ScheduledJob[]>;
  getScheduledJob(id: number, userId: string): Promise<ScheduledJob | undefined>;
  createScheduledJob(job: InsertScheduledJob): Promise<ScheduledJob>;
  updateScheduledJob(id: number, data: Partial<InsertScheduledJob>, userId: string): Promise<ScheduledJob | undefined>;
  deleteScheduledJob(id: number, userId: string): Promise<void>;

  getLlmSettings(userId: string): Promise<LlmSetting[]>;
  getLlmSetting(id: number, userId: string): Promise<LlmSetting | undefined>;
  getDefaultLlmSetting(userId: string): Promise<LlmSetting | undefined>;
  createLlmSetting(setting: InsertLlmSetting): Promise<LlmSetting>;
  updateLlmSetting(id: number, data: Partial<InsertLlmSetting>, userId: string): Promise<LlmSetting | undefined>;
  deleteLlmSetting(id: number, userId: string): Promise<void>;

  getAccountById(id: number): Promise<Account | undefined>;
  getTemplateById(id: number): Promise<Template | undefined>;
  getDueJobs(): Promise<ScheduledJob[]>;
  claimJob(id: number): Promise<ScheduledJob | undefined>;
  updateJobInternal(id: number, data: Partial<InsertScheduledJob>): Promise<ScheduledJob | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getAccounts(userId: string) {
    return db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(desc(accounts.createdAt));
  }
  async getAccount(id: number, userId: string) {
    const [a] = await db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
    return a;
  }
  async createAccount(data: InsertAccount) {
    const [a] = await db.insert(accounts).values(data).returning();
    return a;
  }
  async deleteAccount(id: number, userId: string) {
    await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  }
  async updateAccount(id: number, data: Partial<InsertAccount>, userId: string) {
    const [a] = await db.update(accounts).set(data).where(and(eq(accounts.id, id), eq(accounts.userId, userId))).returning();
    return a;
  }

  async getTemplates(userId: string) {
    return db.select().from(templates).where(eq(templates.userId, userId)).orderBy(desc(templates.createdAt));
  }
  async getTemplate(id: number, userId: string) {
    const [t] = await db.select().from(templates).where(and(eq(templates.id, id), eq(templates.userId, userId)));
    return t;
  }
  async createTemplate(data: InsertTemplate) {
    const [t] = await db.insert(templates).values(data).returning();
    return t;
  }
  async deleteTemplate(id: number, userId: string) {
    await db.delete(templates).where(and(eq(templates.id, id), eq(templates.userId, userId)));
  }

  async getPosts(userId: string) {
    return db.select().from(posts).where(eq(posts.userId, userId)).orderBy(desc(posts.createdAt));
  }
  async getPost(id: number, userId: string) {
    const [p] = await db.select().from(posts).where(and(eq(posts.id, id), eq(posts.userId, userId)));
    return p;
  }
  async createPost(data: InsertPost) {
    const [p] = await db.insert(posts).values(data).returning();
    return p;
  }
  async updatePost(id: number, data: Partial<InsertPost>, userId: string) {
    const [p] = await db.update(posts).set(data).where(and(eq(posts.id, id), eq(posts.userId, userId))).returning();
    return p;
  }
  async deletePost(id: number, userId: string) {
    await db.delete(posts).where(and(eq(posts.id, id), eq(posts.userId, userId)));
  }

  async getScheduledJobs(userId: string) {
    return db.select().from(scheduledJobs).where(eq(scheduledJobs.userId, userId)).orderBy(desc(scheduledJobs.createdAt));
  }
  async getScheduledJob(id: number, userId: string) {
    const [j] = await db.select().from(scheduledJobs).where(and(eq(scheduledJobs.id, id), eq(scheduledJobs.userId, userId)));
    return j;
  }
  async createScheduledJob(data: InsertScheduledJob) {
    const [j] = await db.insert(scheduledJobs).values(data).returning();
    return j;
  }
  async updateScheduledJob(id: number, data: Partial<InsertScheduledJob>, userId: string) {
    const [j] = await db.update(scheduledJobs).set(data).where(and(eq(scheduledJobs.id, id), eq(scheduledJobs.userId, userId))).returning();
    return j;
  }
  async deleteScheduledJob(id: number, userId: string) {
    await db.delete(scheduledJobs).where(and(eq(scheduledJobs.id, id), eq(scheduledJobs.userId, userId)));
  }

  async getLlmSettings(userId: string) {
    return db.select().from(llmSettings).where(eq(llmSettings.userId, userId)).orderBy(desc(llmSettings.createdAt));
  }
  async getLlmSetting(id: number, userId: string) {
    const [s] = await db.select().from(llmSettings).where(and(eq(llmSettings.id, id), eq(llmSettings.userId, userId)));
    return s;
  }
  async getDefaultLlmSetting(userId: string) {
    const [s] = await db.select().from(llmSettings).where(
      and(eq(llmSettings.isDefault, true), eq(llmSettings.userId, userId))
    );
    return s;
  }
  async createLlmSetting(data: InsertLlmSetting) {
    const [s] = await db.insert(llmSettings).values(data).returning();
    return s;
  }
  async updateLlmSetting(id: number, data: Partial<InsertLlmSetting>, userId: string) {
    const [s] = await db.update(llmSettings).set(data).where(and(eq(llmSettings.id, id), eq(llmSettings.userId, userId))).returning();
    return s;
  }
  async deleteLlmSetting(id: number, userId: string) {
    await db.delete(llmSettings).where(and(eq(llmSettings.id, id), eq(llmSettings.userId, userId)));
  }

  async getAccountById(id: number) {
    const [a] = await db.select().from(accounts).where(eq(accounts.id, id));
    return a;
  }
  async getTemplateById(id: number) {
    const [t] = await db.select().from(templates).where(eq(templates.id, id));
    return t;
  }

  async getDueJobs() {
    const now = new Date();
    return db.select().from(scheduledJobs).where(
      and(
        or(eq(scheduledJobs.status, "pending"), eq(scheduledJobs.status, "recurring")),
        or(
          and(
            lte(scheduledJobs.scheduledAt, now),
            isNull(scheduledJobs.nextRunAt)
          ),
          and(
            lte(scheduledJobs.nextRunAt, now),
          )
        )
      )
    );
  }

  async claimJob(id: number) {
    const [claimed] = await db.update(scheduledJobs)
      .set({ status: "running" })
      .where(
        and(
          eq(scheduledJobs.id, id),
          or(eq(scheduledJobs.status, "pending"), eq(scheduledJobs.status, "recurring"))
        )
      )
      .returning();
    return claimed;
  }

  async updateJobInternal(id: number, data: Partial<InsertScheduledJob>) {
    const [j] = await db.update(scheduledJobs).set(data).where(eq(scheduledJobs.id, id)).returning();
    return j;
  }
}

export const storage = new DatabaseStorage();

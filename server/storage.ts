import { db } from "./db";
import { eq, desc, and, lte, or, isNull } from "drizzle-orm";
import {
  users, accounts, templates, posts, scheduledJobs, llmSettings,
  type User, type InsertUser,
  type Account, type InsertAccount,
  type Template, type InsertTemplate,
  type Post, type InsertPost,
  type ScheduledJob, type InsertScheduledJob,
  type LlmSetting, type InsertLlmSetting,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getAccounts(): Promise<Account[]>;
  getAccount(id: number): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  deleteAccount(id: number): Promise<void>;

  getTemplates(): Promise<Template[]>;
  getTemplate(id: number): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  deleteTemplate(id: number): Promise<void>;

  getPosts(): Promise<Post[]>;
  getPost(id: number): Promise<Post | undefined>;
  createPost(post: InsertPost): Promise<Post>;
  updatePost(id: number, data: Partial<InsertPost>): Promise<Post | undefined>;

  getScheduledJobs(): Promise<ScheduledJob[]>;
  getScheduledJob(id: number): Promise<ScheduledJob | undefined>;
  createScheduledJob(job: InsertScheduledJob): Promise<ScheduledJob>;
  updateScheduledJob(id: number, data: Partial<InsertScheduledJob>): Promise<ScheduledJob | undefined>;
  deleteScheduledJob(id: number): Promise<void>;

  getLlmSettings(): Promise<LlmSetting[]>;
  getLlmSetting(id: number): Promise<LlmSetting | undefined>;
  getDefaultLlmSetting(): Promise<LlmSetting | undefined>;
  createLlmSetting(setting: InsertLlmSetting): Promise<LlmSetting>;
  updateLlmSetting(id: number, data: Partial<InsertLlmSetting>): Promise<LlmSetting | undefined>;
  deleteLlmSetting(id: number): Promise<void>;

  updateAccount(id: number, data: Partial<InsertAccount>): Promise<Account | undefined>;
  getDueJobs(): Promise<ScheduledJob[]>;
  claimJob(id: number): Promise<ScheduledJob | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username: string) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async createUser(data: InsertUser) {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async getAccounts() {
    return db.select().from(accounts).orderBy(desc(accounts.createdAt));
  }
  async getAccount(id: number) {
    const [a] = await db.select().from(accounts).where(eq(accounts.id, id));
    return a;
  }
  async createAccount(data: InsertAccount) {
    const [a] = await db.insert(accounts).values(data).returning();
    return a;
  }
  async deleteAccount(id: number) {
    await db.delete(accounts).where(eq(accounts.id, id));
  }

  async getTemplates() {
    return db.select().from(templates).orderBy(desc(templates.createdAt));
  }
  async getTemplate(id: number) {
    const [t] = await db.select().from(templates).where(eq(templates.id, id));
    return t;
  }
  async createTemplate(data: InsertTemplate) {
    const [t] = await db.insert(templates).values(data).returning();
    return t;
  }
  async deleteTemplate(id: number) {
    await db.delete(templates).where(eq(templates.id, id));
  }

  async getPosts() {
    return db.select().from(posts).orderBy(desc(posts.createdAt));
  }
  async getPost(id: number) {
    const [p] = await db.select().from(posts).where(eq(posts.id, id));
    return p;
  }
  async createPost(data: InsertPost) {
    const [p] = await db.insert(posts).values(data).returning();
    return p;
  }
  async updatePost(id: number, data: Partial<InsertPost>) {
    const [p] = await db.update(posts).set(data).where(eq(posts.id, id)).returning();
    return p;
  }

  async getScheduledJobs() {
    return db.select().from(scheduledJobs).orderBy(desc(scheduledJobs.createdAt));
  }
  async getScheduledJob(id: number) {
    const [j] = await db.select().from(scheduledJobs).where(eq(scheduledJobs.id, id));
    return j;
  }
  async createScheduledJob(data: InsertScheduledJob) {
    const [j] = await db.insert(scheduledJobs).values(data).returning();
    return j;
  }
  async updateScheduledJob(id: number, data: Partial<InsertScheduledJob>) {
    const [j] = await db.update(scheduledJobs).set(data).where(eq(scheduledJobs.id, id)).returning();
    return j;
  }
  async deleteScheduledJob(id: number) {
    await db.delete(scheduledJobs).where(eq(scheduledJobs.id, id));
  }

  async getLlmSettings() {
    return db.select().from(llmSettings).orderBy(desc(llmSettings.createdAt));
  }
  async getLlmSetting(id: number) {
    const [s] = await db.select().from(llmSettings).where(eq(llmSettings.id, id));
    return s;
  }
  async getDefaultLlmSetting() {
    const [s] = await db.select().from(llmSettings).where(eq(llmSettings.isDefault, true));
    return s;
  }
  async createLlmSetting(data: InsertLlmSetting) {
    const [s] = await db.insert(llmSettings).values(data).returning();
    return s;
  }
  async updateLlmSetting(id: number, data: Partial<InsertLlmSetting>) {
    const [s] = await db.update(llmSettings).set(data).where(eq(llmSettings.id, id)).returning();
    return s;
  }
  async deleteLlmSetting(id: number) {
    await db.delete(llmSettings).where(eq(llmSettings.id, id));
  }

  async updateAccount(id: number, data: Partial<InsertAccount>) {
    const [a] = await db.update(accounts).set(data).where(eq(accounts.id, id)).returning();
    return a;
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
}

export const storage = new DatabaseStorage();

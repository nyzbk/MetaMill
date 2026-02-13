import { db } from "./db";
import { accounts, templates, posts, scheduledJobs } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existingAccounts = await db.select().from(accounts);
  if (existingAccounts.length > 0) return;

  console.log("Seeding database...");

  const [acc1, acc2, acc3] = await db.insert(accounts).values([
    {
      username: "alex_tech",
      platform: "threads",
      status: "active",
      followers: 12400,
      postsCount: 342,
    },
    {
      username: "thread_news",
      platform: "threads",
      status: "active",
      followers: 8750,
      postsCount: 189,
    },
    {
      username: "future_ai",
      platform: "instagram",
      status: "active",
      followers: 23100,
      postsCount: 567,
    },
  ]).returning();

  const [tpl1, tpl2, tpl3] = await db.insert(templates).values([
    {
      title: "Запуск продукта Q3",
      description: "Анонсы AI-продуктов и релизы фич",
      branches: 5,
      content: JSON.stringify([
        "Мы только что выпустили кое-что большое. После 6 месяцев работы наш AI-движок контента запущен.",
        "Что он делает? Берёт ваши сырые идеи и превращает их в готовые к публикации цепочки тредов. Никакого страха чистого листа.",
        "Секретный ингредиент: копирование стиля. Скормите ему референс треда, который вам нравится, и он воспроизведёт именно этот вайб.",
        "Ранние тестеры увидели 3x больше вовлечения на тредах, созданных с MetaMill, по сравнению с написанными вручную.",
        "Готовы попробовать? Ссылка в био. Первые 100 пользователей получают безлимитную генерацию на месяц.",
      ]),
      style: "expert",
      accountId: acc1.id,
      status: "active",
    },
    {
      title: "Еженедельный тех-дайджест",
      description: "Еженедельный обзор IT-индустрии",
      branches: 4,
      content: JSON.stringify([
        "Тех-дайджест недели: 5 вещей, которые вы пропустили на этой неделе в AI и стартапах.",
        "OpenAI выпустил новую модель с нативными способностями рассуждения. Бенчмарки сумасшедшие.",
        "Ландшафт финансирования стартапов резко изменился. Сид-раунды выросли на 40% по сравнению с прошлым кварталом.",
        "Домашнее задание: попробуйте построить что-нибудь с AI в эти выходные. Даже маленький эксперимент учит больше, чем 10 статей.",
      ]),
      style: "casual",
      accountId: acc2.id,
      status: "active",
    },
    {
      title: "AI Тренды 2026",
      description: "Глубокий анализ прогнозов развития AI",
      branches: 8,
      content: JSON.stringify([
        "AI в 2026: прогнозный тред на основе 200+ часов исследований.",
        "Прогноз 1: Агенты заменят 30% SaaS-дашбордов. Зачем кликать по кнопкам, когда агент может это сделать?",
        "Прогноз 2: Генерация кода достигнет человеческого уровня для стандартных веб-приложений. Разрыв уже быстро сокращается.",
        "Прогноз 3: AI-контент станет нормой, а не исключением. Появятся маркеры подлинности.",
        "Прогноз 4: Голосовые интерфейсы наконец заработают. Проблема задержки почти решена.",
        "Прогноз 5: Корпоративное внедрение AI удвоится. Не из-за хайпа, а потому что ROI теперь доказуем.",
        "Главный риск? Чрезмерная зависимость без понимания. Лидировать будут те, кто понимает фундамент.",
        "Сохраните этот тред. Мы вернёмся к нему в декабре и посмотрим, сколько прогнозов сбылось.",
      ]),
      style: "expert",
      accountId: acc3.id,
      status: "draft",
    },
  ]).returning();

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const twoDaysAgo = new Date(now.getTime() - 172800000);

  await db.insert(posts).values([
    { accountId: acc1.id, templateId: tpl1.id, content: "Мы только что выпустили кое-что большое. После 6 месяцев работы наш AI-движок контента запущен.", threadPosition: 0, status: "published", publishedAt: twoDaysAgo },
    { accountId: acc1.id, templateId: tpl1.id, content: "Что он делает? Берёт ваши сырые идеи и превращает их в готовые к публикации цепочки тредов.", threadPosition: 1, status: "published", publishedAt: twoDaysAgo },
    { accountId: acc2.id, templateId: tpl2.id, content: "Тех-дайджест недели: 5 вещей, которые вы пропустили на этой неделе.", threadPosition: 0, status: "published", publishedAt: yesterday },
    { accountId: acc2.id, content: "Быстрый обзор последних бенчмарков AI-моделей. Производительность становится пугающе хорошей.", threadPosition: 0, status: "published", publishedAt: now },
    { accountId: acc3.id, content: "Черновик: вводная секция AI Тренды 2026. Требует финальной проверки.", threadPosition: 0, status: "draft" },
    { accountId: acc1.id, content: "Запланированный пост о нашем предстоящем релизе фич на следующей неделе.", threadPosition: 0, status: "scheduled", scheduledAt: new Date(now.getTime() + 86400000) },
  ]);

  await db.insert(scheduledJobs).values([
    {
      accountId: acc1.id,
      templateId: tpl1.id,
      scheduledAt: new Date(now.getTime() + 3600000),
      status: "pending",
      isRecurring: false,
      style: "expert",
    },
    {
      accountId: acc2.id,
      topic: "Еженедельный обзор AI-новостей",
      scheduledAt: new Date(now.getTime() + 86400000),
      status: "pending",
      isRecurring: true,
      style: "casual",
    },
    {
      accountId: acc3.id,
      topic: "Глубокий разбор эволюции архитектуры трансформеров",
      scheduledAt: new Date(now.getTime() + 172800000),
      status: "pending",
      isRecurring: false,
      style: "expert",
    },
  ]);

  console.log("Database seeded successfully.");
}

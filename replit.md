# MetaMill - Content Factory for Threads

## Overview
MetaMill is an industrial AI-powered content automation platform for Threads.net and Instagram. It automates the full content lifecycle: AI generation, template management, scheduling, and publishing via Meta API.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui, dark-only theme
- **Backend**: Express.js REST API
- **Database**: PostgreSQL (Neon) via Drizzle ORM
- **AI**: OpenAI (via Replit AI Integrations) for thread content generation
- **Design**: Dark futuristic theme (black #000000 background, purple accent hsl(263,70%,50%), Inter + JetBrains Mono fonts)

## Project Structure
- `shared/schema.ts` - All Drizzle table definitions (users, accounts, templates, posts, scheduled_jobs, conversations, messages)
- `server/routes.ts` - All API routes (CRUD + AI generation + publishing)
- `server/storage.ts` - Database storage layer (IStorage interface + DatabaseStorage)
- `server/seed.ts` - Seed data (3 accounts, 3 templates, 6 posts, 3 scheduled jobs)
- `server/db.ts` - Database connection pool
- `client/src/App.tsx` - Main app with sidebar layout, all routes
- `client/src/components/app-sidebar.tsx` - Navigation sidebar
- `client/src/pages/` - Dashboard, Accounts, Templates, Generator, Scheduler, ThreadTest

## Key Features
1. Multi-account management (Threads & Instagram)
2. N-branch thread chain templates with style matching
3. AI content generation using OpenAI (gpt-5-mini)
4. Thread preview/test tool
5. Auto-posting scheduler with recurring jobs
6. Publishing to Threads via Meta API (requires user access tokens)

## API Endpoints
- GET/POST/DELETE `/api/accounts`
- GET/POST/DELETE `/api/templates`
- GET/POST `/api/posts`
- GET/POST/DELETE `/api/scheduled-jobs`
- POST `/api/generate` - AI thread generation
- POST `/api/publish` - Publish thread chain to Threads

## User Preferences
- Interface language: English (content generation in Russian)
- Dark mode only, no light mode toggle
- Purple accent color throughout

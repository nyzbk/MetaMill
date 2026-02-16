# MetaMill - Content Factory for Threads

## Overview
MetaMill is an industrial AI-powered content automation platform for Threads.net and Instagram. It automates the full content lifecycle: AI generation using multiple LLM providers, template management, scheduling, and publishing via Meta API.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui, dark-only theme
- **Backend**: Express.js REST API
- **Database**: PostgreSQL (Neon) via Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect) — Google/GitHub/email login, session storage in PostgreSQL, per-user data isolation
- **AI**: Multi-LLM system — OpenRouter (via Replit AI Integrations) for open-source models + custom API keys for paid providers (GPT, Claude, Gemini, Grok)
- **Scheduler**: Background polling service (30s interval) for automated content generation & publishing
- **Design**: Dark futuristic theme (black #000000 background, purple accent hsl(263,70%,50%), Inter + JetBrains Mono fonts)

## Project Structure
- `shared/schema.ts` - All Drizzle table definitions (re-exports auth users/sessions, accounts, templates, posts, scheduled_jobs, llm_settings, conversations, messages). All data tables have `userId` column for per-user isolation
- `shared/models/auth.ts` - Auth schema (users, sessions tables) — mandatory for Replit Auth
- `server/replit_integrations/auth/` - Auth module (setupAuth, isAuthenticated middleware, authStorage, registerAuthRoutes)
- `server/routes.ts` - All API routes (CRUD + AI generation + OAuth + publishing + scheduler control). All routes protected with isAuthenticated middleware
- `server/storage.ts` - Database storage layer (IStorage interface + DatabaseStorage). All queries scoped by userId
- `client/src/hooks/use-auth.ts` - React hook for authentication state (useAuth)
- `client/src/pages/landing.tsx` - Landing page for unauthenticated users
- `server/llm.ts` - Multi-LLM provider system (OpenRouter, OpenAI, Anthropic, Google, xAI) with 11 pre-configured models
- `server/threads-api.ts` - Threads OAuth flow + thread chain publishing via Meta API
- `server/scheduler.ts` - Background scheduler: polls for due jobs, generates content via AI, publishes to Threads, handles recurring jobs
- `server/seed.ts` - Seed data (3 accounts, 3 templates, 6 posts, 3 scheduled jobs)
- `server/db.ts` - Database connection pool
- `client/src/App.tsx` - Main app with sidebar layout, all routes
- `client/src/components/app-sidebar.tsx` - Navigation sidebar
- `server/threads-scraper.ts` - Research system: keyword search, user thread fetching, engagement sorting, viral filtering, import-to-template
- `client/src/pages/` - Dashboard, Accounts, Templates, Generator, Scheduler, Settings, ThreadTest, Research

## Key Features
0. Multi-user authentication via Replit Auth (OpenID Connect) with per-user data isolation
1. Multi-account management (Threads & Instagram) with OAuth connection
2. N-branch thread chain templates with style matching
3. AI content generation with 11 LLM models across 6 providers
4. Thread preview/test tool
5. Background auto-posting scheduler with recurring jobs (pause/resume/run-now)
6. Publishing to Threads via Meta API (/me/threads endpoints)
7. LLM settings page for provider/model management with API keys
8. Research/scraping system: keyword search, user thread fetching, manual import, bundle import, engagement metrics
9. Style-matching generation via templateId reference (imported viral threads as style guides)

## Auth Routes (Replit Auth)
- GET `/api/login` - Begin OIDC login flow
- GET `/api/callback` - OIDC callback handler
- GET `/api/logout` - Logout and redirect
- GET `/api/auth/user` - Get current authenticated user

## API Endpoints (all require authentication)
- GET/POST/PUT/DELETE `/api/accounts`
- GET/POST/DELETE `/api/templates`
- GET/POST `/api/posts`
- GET/POST/DELETE `/api/scheduled-jobs`
- POST `/api/scheduled-jobs/:id/run-now` - Queue immediate execution
- POST `/api/scheduled-jobs/:id/pause` - Pause a job
- POST `/api/scheduled-jobs/:id/resume` - Resume a paused job
- GET `/api/scheduler/status` - Background scheduler status
- POST `/api/generate` - AI thread generation with model selection
- POST `/api/publish` - Publish thread chain to Threads (validates branches, token expiry)
- GET `/api/auth/threads` - Generate Threads OAuth URL
- GET `/api/auth/threads/callback` - OAuth callback handler
- GET `/api/auth/threads/status` - Check if Meta credentials are configured
- GET/POST/PUT/DELETE `/api/llm-settings` - LLM provider management
- POST `/api/llm-settings/:id/set-default` - Set default LLM model
- GET `/api/llm-models` - List available LLM models
- POST `/api/research/search` - Keyword search via Threads API
- POST `/api/research/user-threads` - Fetch user's threads by ID
- POST `/api/research/user-lookup` - Lookup Threads user profile
- POST `/api/research/import-thread` - Import single thread as template
- POST `/api/research/import-bundle` - Import multiple threads as one template
- POST `/api/research/import-manual` - Manual thread import (paste content)

## Security Notes
- Multi-user data isolation: all CRUD operations scoped by userId (from req.user.claims.sub)
- All API routes protected with isAuthenticated middleware (returns 401 if not logged in)
- Delete/update operations verify userId ownership to prevent IDOR attacks
- OAuth account linking uses threadsUserId (not username) to prevent account takeover
- Publish endpoint validates: branches array (1-25 strings, each ≤500 chars), token expiry
- Scheduler uses atomic job claiming to prevent double execution
- OAuth state validation with 10-minute expiry using HMAC signing (survives server restarts)

## User Preferences
- Interface language: Russian (UI labels), content generation in Russian
- Dark mode only, no light mode toggle
- Purple accent color throughout

# lmk — Development Plan

> **Developer intelligence & action system** · CLI + mobile companion + backend  
> *Last updated: April 2026 · Target: end of week (5-day sprint)*

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Tech Stack](#2-tech-stack)
3. [Repository Structure](#3-repository-structure)
4. [Phase-by-Phase Build Plan](#4-phase-by-phase-build-plan)
5. [Component Deep Dives](#5-component-deep-dives)
6. [Data Flow](#6-data-flow)
7. [API Design](#7-api-design)
8. [Personalization Engine](#8-personalization-engine)
9. [Open Questions & Decisions](#9-open-questions--decisions)

---

## 1. System Architecture Overview

```
┌─────────────┐        ┌──────────────────┐        ┌───────────────────┐
│  CLI (lmk)  │ ──────▶│  Backend API     │ ──────▶│  lmk.dev (web/   │
│  Node.js    │        │  FastAPI + Python │        │  mobile app)      │
└─────────────┘        └──────────────────┘        └───────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   Data Ingestion    │
                    │  (pipelines/cron)   │
                    └─────────────────────┘
                               │
              ┌────────────────┼────────────────┐
          RSS/APIs       Anthropic SDK        VC/Startup
        (Hacker News,   (claude-sonnet-4      feeds
        arXiv, GitHub)   summarization)
```

Three independently deployable units:

| Unit | Primary Role | Users See |
|------|-------------|-----------|
| **CLI** | Fetch, filter, display intelligence | Terminal output |
| **Backend** | Ingest data, generate plans, store state | N/A (API only) |
| **lmk.dev** | Track plans, chatbot feedback | Web/mobile UI |

---

## 2. Tech Stack

### CLI
| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | **Node.js** (TypeScript) | Rich ecosystem for CLI tooling |
| CLI framework | **Commander.js** | Clean flag/argument parsing |
| Formatting | **chalk** + **ora** | Color, spinners, visual output |
| HTTP client | **axios** or **ky** | Backend API calls |
| Auth/config | **conf** (XDG-compliant) | Persist user token + prefs locally |
| Packaging | **pkg** or **oclif** | Distribute as single binary |

### Backend API
| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | **Python 3.12** + **FastAPI** | Async-native, excellent Anthropic SDK support, fast to write |
| Database | **Supabase** (Postgres) | Managed Postgres + auth + auto-generated REST + dashboard |
| ORM | **SQLAlchemy 2.0** (async) or **Supabase Python client** | Type-safe queries; Supabase client handles simple CRUD |
| Queue | **Supabase Edge Functions** + **pg_cron** | Cron jobs via Supabase — no Redis needed |
| LLM calls | **Anthropic Python SDK** (`anthropic`) | ✅ Locked in — `claude-sonnet-4-20250514` for all LLM calls |
| Auth | **Supabase Auth** (built-in) | JWT + magic link out of the box, no extra service |
| Hosting | **Railway** or **Render** (FastAPI) + **Supabase cloud** | Simple Python deploys; Supabase handles DB/auth |

### Data Ingestion
| Source Type | Tool |
|-------------|------|
| RSS/Atom feeds | **feedparser** (Python) |
| Hacker News | **Algolia HN API** (official, free) |
| arXiv papers | arXiv REST API |
| GitHub trending | GitHub REST API |
| VC/funding | RSS from Axios Pro Rata + TechCrunch funding tag |
| Twitter/X signals | Twitter API v2 (filtered stream) |

### Mobile/Web App (lmk.dev)
| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js 15** (App Router) | Web + future mobile via Expo share |
| Mobile | **Expo** (React Native) | Code share with Next.js via shared packages |
| Styling | **Tailwind CSS** + **shadcn/ui** | Fast, composable UI |
| State | **Zustand** + **React Query (TanStack)** | Local state + server sync |
| Auth | **Supabase Auth** | Matches backend — single auth layer, no extra service |
| Hosting | **Vercel** | First-class Next.js deployment |

---

## 3. Repository Structure

Use a **monorepo** — CLI and web share a `types/` package; backend is a standalone Python service (separate language means no shared package boundary with JS, but the API contract is the bridge).

```
lmk/
├── apps/
│   ├── cli/              # lmk CLI (Node.js / TypeScript)
│   │   └── src/
│   ├── web/              # lmk.dev (Next.js)
│   │   └── src/
│   └── api/              # Backend REST API (FastAPI / Python)
│       ├── main.py
│       ├── routers/      # insights.py, plans.py, feedback.py
│       ├── services/     # llm.py, ingestion.py, personalization.py
│       ├── models.py     # SQLAlchemy / Pydantic models
│       └── requirements.txt
├── packages/
│   └── types/            # Shared TS types for CLI ↔ web (Plan, Insight, etc.)
├── pipelines/
│   └── ingest.py         # Standalone ingestion script (run via cron/pg_cron)
├── turbo.json            # JS monorepo tooling (cli + web only)
└── README.md
```

---

## 4. Phase-by-Phase Build Plan

> ⚡ **5-day sprint** — scope is tight. Ship the core loop first; personalization is a stretch goal for Day 5.

---

### Day 1 — Foundation & Skeleton
*Goal: All three apps scaffold, CLI → API roundtrip working with mock data.*

**Morning — Backend (FastAPI + Supabase)**
- [ ] Create Supabase project, grab `DATABASE_URL` + anon/service keys
- [ ] Scaffold `apps/api/` with FastAPI, set up Pydantic models + `.env`
- [ ] Define and run Supabase migrations for `insights`, `plans`, `plan_tasks` tables
- [ ] Stub `GET /insights` returning hardcoded JSON
- [ ] Install Anthropic SDK: `pip install anthropic`

**Afternoon — CLI + Repo**
- [ ] Init monorepo, scaffold `apps/cli/` with Commander.js + chalk
- [ ] Wire `lmk --llm` to call `GET /insights` and print formatted mock output
- [ ] Set up `.env` handling across all apps, confirm local e2e works

**Milestone:** `lmk --llm` prints formatted mock data from local FastAPI server.

---

### Day 2 — Data Ingestion
*Goal: Real content flowing in from at least 2 sources, classified and stored.*

- [ ] Build `pipelines/ingest.py` — standalone script, runs per source
- [ ] Add **HN Algolia** adapter (`/search_by_date?tags=story&hitsPerPage=30`)
- [ ] Add **RSS adapter** using `feedparser` (TechCrunch AI, Axios Pro Rata)
- [ ] Deduplication check against `insights.source_url`
- [ ] **Summarization**: call `claude-sonnet-4-20250514` per item → one-liner summary
- [ ] **Classification**: LLM call → tag each item `llm / defi / quant / general`
- [ ] **Signal scoring**: LLM call → score 0.0–1.0 against high-signal rubric
- [ ] Store results in Supabase `insights` table
- [ ] Update `GET /insights?category=llm` to query real rows
- [ ] Set up `pg_cron` in Supabase to run ingest every 60 min (or cron on Railway)

**Milestone:** `lmk --llm` returns real, live, summarized insights.

---

### Day 3 — Action Layer + CLI Polish
*Goal: `--action` generates and saves plans; CLI output is production-quality.*

- [ ] Add `plans` + `plan_tasks` to Supabase schema (if not already done Day 1)
- [ ] Build plan generation prompt + `POST /plans` endpoint in FastAPI
- [ ] LLM call: top N insights → structured Build/Learn/Explore JSON
- [ ] Parse + insert plan + tasks into Supabase
- [ ] Return `plan_id` + `lmk.dev/plans/{id}` URL to CLI
- [ ] Wire `--action` flag in CLI — display plan sections with emoji formatting
- [ ] Polish CLI: loading spinners (`ora`), error handling, `lmk --help`
- [ ] Handle multi-flag behavior: separate plans per category

**Milestone:** `lmk --llm --action` prints a full Build/Learn/Explore plan and saves it.

---

### Day 4 — lmk.dev Web App
*Goal: Users can view, navigate, and check off plans in the browser.*

- [ ] Scaffold `apps/web/` with Next.js 15 App Router + Tailwind + shadcn/ui
- [ ] Set up **Supabase Auth** (magic link or GitHub OAuth — pick one)
- [ ] Build **Plan List** page (`/plans`) — fetches all user plans from API
- [ ] Build **Plan Detail** page (`/plans/[id]`) — expandable Build/Learn/Explore
- [ ] Add **completion toggles**: task-level + plan-level `PATCH` calls to API
- [ ] Wire `PATCH /plans/:id` and `PATCH /plans/:id/tasks/:taskId` in FastAPI
- [ ] Deploy to Vercel; confirm deep-link from CLI resolves correctly

**Milestone:** Opening `lmk.dev/plans/abc123` shows the saved plan with working checkboxes.

---

### Day 5 — Personalization + Distribution *(stretch)*
*Goal: Chatbot feedback influences CLI output; CLI is installable.*

**Personalization**
- [ ] Add chatbot text input to lmk.dev (no visible AI response — input only)
- [ ] Build `POST /feedback` endpoint + `user_feedback` table in Supabase
- [ ] Build interest extraction: LLM → topic weights → upsert `user_profiles.interests`
- [ ] Modify `GET /insights` ranking: `final_score = signal_score * 0.6 + interest_match * 0.4`

**Distribution**
- [ ] Add `lmk auth login` command — prompts for API key, saves via `conf`
- [ ] Publish to npm: `npm publish` → `npm install -g lmk`
- [ ] Write `README.md` with 60-second install + usage guide

**Milestone:** `npm install -g lmk && lmk --llm` works. Chatbot input shifts next run's output.

---

## 5. Component Deep Dives

### 5.1 Database Schema (Supabase / Postgres)

Define these as SQL migrations in Supabase dashboard or via `supabase/migrations/`:

```sql
-- insights: raw ingested + processed items
create table insights (
  id uuid primary key default gen_random_uuid(),
  source_url text unique not null,
  source_name text not null,       -- "Hacker News", "TechCrunch RSS", etc.
  raw_title text not null,
  summary text,                    -- LLM-generated one-liner
  categories text[] not null,      -- e.g. ARRAY['llm', 'general']
  signal_score float default 0.0,  -- 0.0–1.0
  published_at timestamptz,
  ingested_at timestamptz default now()
);

-- plans: generated action plans per user
create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  categories text[] not null,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- plan_tasks: individual Build/Learn/Explore tasks
create table plan_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  type text check (type in ('build', 'learn', 'explore')),
  title text not null,
  description text,
  source_insight_id uuid references insights(id),
  completed_at timestamptz
);

-- user_profiles: personalization state
create table user_profiles (
  user_id text primary key,
  interests jsonb default '{}',    -- { "prediction_markets": 0.9, "rag": 0.6 }
  updated_at timestamptz default now()
);

-- user_feedback: raw chatbot input for interest extraction
create table user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  raw_text text not null,
  processed boolean default false,
  created_at timestamptz default now()
);
```

### 5.2 CLI Output Format

Each `lmk` run prints two sections, gated by flags:

```
── Intelligence ──────────────────────────────────────

🧠  OpenAI releases multimodal API with lower latency
    → Real-time agent pipelines now viable at scale
    source: techcrunch.com/... 

🚀  Contextual AI raises $80M Series C
    → Signals strong VC appetite for enterprise RAG infra
    source: reuters.com/...

── Action Plan ───────────────────────────────────────  (--action only)

🛠  Build   Implement a minimal RAG pipeline using Claude claude-sonnet-4-20250514
📚  Learn   Read: "Vector DB Indexing Explained" (8 min)
🔍  Explore Analyze 3 new LLM infra startups from this week

    Saved → lmk.dev/plans/abc123
```

### 5.3 LLM Prompts (Key Ones)

**Summarization prompt** (per insight):
```
Summarize this article in exactly one sentence (max 20 words).
Focus on the technical or market impact. No filler phrases.
Article: {text}
```

**Classification prompt** (per insight):
```
Classify this article into one or more of: llm, defi, quant, general.
Return a JSON array. Only return the array, no other text.
Article: {text}
```

**Plan generation prompt** (per CLI run):
```
Given these recent insights: {insights}
Generate a structured action plan with exactly:
- 1–2 Build tasks (hands-on implementation)
- 1–2 Learn tasks (targeted reading/study)
- 1–2 Explore tasks (adjacent companies, trends, systems)
Return JSON matching the PlanTask schema.
```

**Interest extraction prompt** (chatbot feedback):
```
Extract developer interest topics from this message.
Return a JSON object: { "topic_slug": relevance_score (0.0–1.0) }
No topics outside: llm, defi, quant, prediction_markets, rag, 
infra, security, frontend, devtools, general_engineering.
Message: {text}
```

---

## 6. Data Flow

### Intelligence Flow (every CLI run)
```
lmk --llm
  → GET /insights?category=llm&userId=X
    → Query DB: insights WHERE "llm" = ANY(categories)
              weighted by user_profiles.interests
    → Return top 10 by signal_score
  → CLI formats + prints
```

### Ingestion Flow (cron, every 60 min via pg_cron or Railway cron)
```
pipelines/ingest.py fires
  → Fetch from source (HN Algolia, feedparser RSS, etc.)
  → Deduplicate against existing source_urls
  → Anthropic SDK: summarize + classify + score each item
  → Insert into Supabase insights table
```

### Action Plan Flow (`--action`)
```
lmk --llm --action
  → Fetch insights (same as above)
  → POST /plans { category: "llm", insights: [...] }
    → LLM: generate Build/Learn/Explore tasks
    → Insert plan + tasks into DB
    → Return plan ID
  → CLI prints plan + deep-link URL
```

### Personalization Flow (async)
```
User types in lmk.dev chatbot
  → POST /feedback { text: "..." }
    → Store UserFeedback row
  → Cron job (every 15 min) processes unprocessed feedback
    → LLM: extract interest topics
    → UPSERT user_profiles.interests (weighted merge)
  → Next CLI run: insights re-ranked by updated interests
```

---

## 7. API Design

Base URL: `https://api.lmk.dev/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/insights` | Fetch insights (`?category=llm&limit=10`) |
| `POST` | `/plans` | Generate + store a new action plan |
| `GET` | `/plans` | List user's saved plans |
| `GET` | `/plans/:id` | Get single plan with tasks |
| `PATCH` | `/plans/:id` | Mark plan complete |
| `PATCH` | `/plans/:id/tasks/:taskId` | Mark task complete |
| `POST` | `/feedback` | Submit chatbot text for personalization |
| `GET` | `/me` | Get user profile + interests |

All endpoints require `Authorization: Bearer <token>` header.

---

## 8. Personalization Engine

### Interest Profile Structure
```json
{
  "llm_inference": 0.9,
  "prediction_markets": 0.85,
  "rag": 0.7,
  "defi_primitives": 0.4,
  "devtools": 0.6
}
```

### Ranking Formula
When serving insights, apply a weighted score:

```
final_score = signal_score * 0.6 + interest_match * 0.4
```

Where `interest_match` = max overlap between insight categories and user interest weights.

### Decay
Interest weights decay slightly each week if no reinforcing signal is received (multiply by 0.95 weekly), preventing stale interests from dominating forever.

---

## 9. Open Questions & Decisions

| # | Question | Options | Decision |
|---|----------|---------|----------|
| 1 | **VC data source** | Crunchbase API ($$$), Dealroom, web scraping | ✅ RSS from Axios Pro Rata + TechCrunch funding tag for v1 |
| 2 | **CLI auth UX** | OAuth browser flow, API key paste, magic link | ✅ API key paste for v1 — simplest, ships fastest |
| 3 | **Mobile app** | React Native (Expo) vs PWA | ✅ Web-first (Next.js PWA); native Expo only if needed post-launch |
| 4 | **LLM provider** | Anthropic vs OpenAI | ✅ **Locked: Anthropic SDK**, `claude-sonnet-4-20250514` for all calls |
| 5 | **Database** | Supabase vs self-hosted Postgres | ✅ **Locked: Supabase** — managed Postgres + auth + dashboard, no ops overhead |
| 6 | **Backend language** | Python/FastAPI vs Node/Fastify | ✅ **Locked: Python + FastAPI** — native Anthropic SDK, faster to write LLM logic |
| 7 | **Ingestion frequency** | Real-time, 30min, 1hr | ✅ 1hr for v1 (sufficient, low API cost) |
| 8 | **Multi-flag plan grouping** | Single merged plan vs separate plans | ✅ Separate plans per category (per spec) |

---

## Appendix: Environment Variables

```bash
# API (FastAPI — apps/api/.env)
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...       # server-side only, never expose
ANTHROPIC_API_KEY=sk-ant-...

# CLI (stored via `conf` — ~/.config/lmk)
LMK_API_URL=https://api.lmk.dev/v1
LMK_USER_TOKEN=...

# Web (apps/web/.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=https://api.lmk.dev/v1
```

---

*This document should be treated as a living spec — update phases and decisions as the build progresses.*

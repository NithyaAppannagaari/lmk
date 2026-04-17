# lmk — Development Plan (V1)

> **CLI-only developer intelligence tool with RAG-powered personalization**
> *Last updated: April 2026 · Scope: CLI + backend only. No web app. No task planning.*

---

## System Architecture

```
lmk CLI (Node.js)
    │  Authorization: Bearer <api_key>
    ▼
FastAPI Backend (apps/api/)
    ├── POST /v1/auth/register      → create user, return api_key
    ├── GET  /v1/feed               → RAG-powered personalized feed
    └── POST /v1/preferences        → store --chat input, update interest embedding

    ▼
RAG Pipeline (in-process, Python)
    ├── Category filter             → hard filter by --llm / --defi / --quant / --general
    ├── Signal threshold            → signal_score >= 0.5
    ├── Cosine similarity scoring   → rank by user interest embedding
    └── Anthropic SDK               → summarization during ingestion only

    ▼
Supabase (Postgres + pgvector)
    ├── insights                    → embedded news items
    ├── users                       → api_key + interest_embedding per user
    ├── user_preferences            → raw --chat inputs + embeddings
    └── query_log                   → per-request audit trail

    ▼
Ingestion Cron (apps/pipelines/ingest.py, every 60 min)
    ├── Hacker News Algolia API
    ├── RSS: TechCrunch AI, Axios Pro Rata, The Defiant, CoinDesk, The Block
    └── Each item: classify → summarize → score → embed → store
```

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| CLI | Node.js + Commander.js + chalk + ora + conf |
| Backend | Python 3.9+ + FastAPI |
| Database + vectors | Supabase (Postgres + pgvector) |
| Embeddings | `sentence-transformers` — `all-MiniLM-L6-v2` (384d, free, in-process) |
| LLM | Anthropic `claude-opus-4-6` (ingestion only — classify, summarize, score) |
| Auth | Static API key via `secrets.token_urlsafe(32)` |
| Ingestion | `feedparser` + `trafilatura` + HN Algolia API |

No OpenAI. No web app. No mobile app. No task planning system.

---

## Data Model

```sql
-- Enable pgvector
create extension if not exists vector;

-- Users (one row per CLI user)
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  api_key text unique not null,
  interest_embedding vector(384),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- User preferences (raw --chat history, used to recompute interest_embedding)
create table user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  raw_text text not null,
  embedding vector(384) not null,
  created_at timestamptz default now()
);

-- Ingested news items
create table insights (
  id uuid primary key default gen_random_uuid(),
  source_url text unique not null,
  source_name text not null,
  raw_title text not null,
  summary text,
  categories text[] not null,
  signal_score float default 0.0,
  embedding vector(384),
  published_at timestamptz,
  ingested_at timestamptz default now()
);

-- Query audit log
create table query_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  categories text[],
  result_count int,
  created_at timestamptz default now()
);

-- Indexes
create index on insights using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on user_preferences using ivfflat (embedding vector_cosine_ops) with (lists = 10);
```

Drop `plans`, `plan_tasks`, `user_feedback` if they exist.

---

## RAG Design

**Ingestion (every 60 min):**
```
raw item (title + url)
  → deduplicate by source_url
  → classify(title)          → categories[]          [claude-opus-4-6]
  → summarize(title, chunks) → summary               [claude-opus-4-6]
  → score(title, chunks)     → signal_score 0.0–1.0  [claude-opus-4-6]
  → embed(title + summary)   → vector(384)           [all-MiniLM-L6-v2, local]
  → insert into insights
```

**Retrieval (per `lmk` run):**
```
GET /feed?categories=llm,defi
  → filter: signal_score >= 0.5, ingested_at > 48h ago
  → filter: categories overlaps ['llm','defi']  (OR, not AND)
  → fetch up to 50 candidates
  → if user.interest_embedding exists:
      rag_score = 0.5 * signal_score + 0.5 * cosine_sim(item_vec, user_vec)
    else:
      rag_score = signal_score
  → sort by rag_score desc, return top 15
```

**Personalization (`lmk --chat`):**
```
user inputs: "polymarket, prediction markets infra, market making"
  → embed(text) → vector(384)
  → insert into user_preferences
  → recompute users.interest_embedding:
      weights = [0.9^0, 0.9^1, ..., 0.9^9]  (recency decay)
      interest_embedding = weighted_avg(last 10 embeddings)
  → next lmk run uses updated interest_embedding
```

---

## CLI Design

```bash
lmk auth login        # register with email → save api_key to ~/.config/lmk
lmk                   # all categories
lmk --llm             # LLM/AI news
lmk --defi --quant    # union of both
lmk --chat            # one-shot preference input (no conversational loop)
```

**Example output (`lmk --llm`):**
```
🧠 LLM  ──────────────────────────────────────────

  • OpenAI releases o3-mini with 40% lower latency than o3
    Targets agentic workloads; competitive with Sonnet on coding benchmarks.
    techcrunch.com

  • Mistral drops Codestral 2 — Apache 2.0, 22B params
    Outperforms DeepSeek-Coder-V2 on HumanEval. Self-hostable.
    github.com

  ────────────────────────────────────────────────
  3 items · personalized · 4m ago
```

**`lmk --chat` flow:**
```
What do you want to learn about?
> polymarket, prediction markets infra, market making

✔ Got it. Your next lmk run will reflect this.
```

---

## Authentication

- Static API key: `secrets.token_urlsafe(32)` generated on register
- Stored client-side via `conf` at `~/.config/lmk/config.json`
- Sent as `Authorization: Bearer <key>` on every request
- `POST /v1/auth/register` is idempotent — returns existing key if email already registered
- All endpoints require valid key; 401 → "Run `lmk auth login`"

---

## V1 Implementation Status

### Done
- [x] FastAPI skeleton + Supabase connection
- [x] Ingestion pipeline (HN + RSS, classify/summarize/score via Claude)
- [x] `sentence-transformers` embeddings service (all-MiniLM-L6-v2, 384d, free)
- [x] Embedding step in `ingest.py`
- [x] `POST /v1/auth/register` + `lmk auth login`
- [x] Auth middleware (Bearer key, FastAPI Depends)
- [x] `GET /v1/feed` — category filter + signal threshold + RAG cosine scoring
- [x] `POST /v1/preferences` — embed, store, recompute interest_embedding
- [x] CLI: `lmk [--llm|--defi|--quant|--general]` wired to `/feed`
- [x] CLI: `lmk --chat` wired to `/preferences`
- [x] CLI: bullet output format with personalized badge

### To Do
- [ ] Run DB migrations in Supabase (see Data Model above)
- [ ] `pip install -r requirements.txt` to get sentence-transformers + numpy
- [ ] Test: `lmk auth login` → `lmk --chat` → `lmk --llm`
- [ ] Deploy API to Railway; configure env vars
- [ ] Set up ingestion cron (Railway cron or Supabase pg_cron)

### Intentionally Out of Scope
- Web app / mobile app
- Task planning (Build / Learn / Explore)
- Rate limiting
- Query expansion / learned reranking
- Email digest
- Multi-device session management

---

## Environment Variables

```bash
# apps/api/.env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=sk-ant-...

# CLI — stored automatically by lmk auth login
# ~/.config/lmk/config.json
# { "apiUrl": "http://localhost:8000/v1", "apiKey": "..." }
```

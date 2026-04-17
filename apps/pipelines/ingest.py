import os
import sys
import json
import httpx
import feedparser
import trafilatura
from anthropic import Anthropic
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(dotenv_path="/Users/nithya/lmk/apps/api/.env")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))
from services.embeddings import embed

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"]
)

claude_model = "claude-opus-4-6"
anthropic = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

MAX_PER_CATEGORY = 4
CATEGORIES = ["llm", "defi", "quant", "general"]

# ── Sources ───────────────────────────────────────────

HN_URL = "https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=30"

RSS_FEEDS = [
    # LLM / AI
    {"name": "TechCrunch AI", "url": "https://techcrunch.com/category/artificial-intelligence/feed/"},
    {"name": "Axios Pro Rata", "url": "https://api.axios.com/feed/"},
    # DeFi
    {"name": "The Defiant", "url": "https://thedefiant.io/feed"},
    {"name": "DL News", "url": "https://dlnews.com/arc/outboundfeeds/rss/"},
    {"name": "CoinDesk", "url": "https://www.coindesk.com/arc/outboundfeeds/rss/"},
    {"name": "The Block", "url": "https://www.theblock.co/rss.xml"},
    # Quant / Prediction Markets
    {"name": "Polymarket Oracle", "url": "https://news.polymarket.com/feed"},
    {"name": "CryptoPanic", "url": "https://cryptopanic.com/news/rss/?kind=news&filter=hot"},
]


# ── Fetchers ──────────────────────────────────────────

def fetch_hn():
    items = []
    with httpx.Client() as client:
        res = client.get(HN_URL)
        for hit in res.json().get("hits", []):
            url = hit.get("url")
            title = hit.get("title")
            if url and title:
                items.append({
                    "source_name": "Hacker News",
                    "source_url": url,
                    "raw_title": title,
                    "published_at": hit.get("created_at"),
                })
    return items


def fetch_rss():
    items = []
    for feed in RSS_FEEDS:
        parsed = feedparser.parse(feed["url"])
        for entry in parsed.entries[:10]:
            url = entry.get("link")
            title = entry.get("title")
            if url and title:
                items.append({
                    "source_name": feed["name"],
                    "source_url": url,
                    "raw_title": title,
                    "published_at": entry.get("published", None),
                })
    return items


# ── Deduplication ─────────────────────────────────────

def get_existing_urls():
    res = supabase.table("insights").select("source_url").execute()
    return {row["source_url"] for row in res.data}


# ── Article Content ───────────────────────────────────

def fetch_article_content(url: str) -> str:
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return ""
        text = trafilatura.extract(downloaded, include_comments=False, include_tables=False)
        return text or ""
    except Exception:
        return ""


def chunk_text(text: str, max_chunk_chars: int = 1500) -> list[str]:
    """Split text into paragraph-based chunks, each under max_chunk_chars."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks, current, current_len = [], [], 0
    for para in paragraphs:
        if current_len + len(para) > max_chunk_chars and current:
            chunks.append("\n\n".join(current))
            current, current_len = [], 0
        current.append(para)
        current_len += len(para)
    if current:
        chunks.append("\n\n".join(current))
    return chunks


# ── LLM Calls ─────────────────────────────────────────

def classify(title: str) -> list[str]:
    """Classify by title only — cheap, used for pre-filtering."""
    res = anthropic.messages.create(
        model=claude_model,
        max_tokens=50,
        messages=[{
            "role": "user",
            "content": f"""Classify this article into one or more of these categories based on its title.
Return a JSON array only, no other text. Use only these exact values: ["llm", "defi", "quant", "general"]

Categories:
- "llm": Frontier AI labs, model releases, AI tooling, inference infrastructure, RAG, agents, AI startups and funding
- "defi": DeFi protocols, on-chain finance, blockchain infrastructure, crypto startups and venture activity. NOT trading systems or prediction markets.
- "quant": Prediction markets (Polymarket, Kalshi), algorithmic trading systems, market microstructure, quant research, trading infrastructure and tooling, hedge fund activity. NOT general crypto or DeFi — only classify as quant if it has a direct trading/markets angle.
- "general": Developer tooling, language/runtime releases, open-source projects, engineering practices, infra patterns, platform engineering — must have direct relevance to software developers. NOT general tech news or non-developer startups.

An article can belong to multiple categories if relevant.

Article title: {title}"""
        }]
    )
    try:
        return json.loads(res.content[0].text.strip())
    except Exception:
        return ["general"]


def select_relevant_chunks(chunks: list[str], max_chunks: int = 3) -> list[str]:
    """Use Claude to pick chunks with concrete new findings, discarding fluff."""
    if not chunks:
        return chunks

    numbered = "\n\n".join(f"[{i}] {chunk}" for i, chunk in enumerate(chunks))
    res = anthropic.messages.create(
        model=claude_model,
        max_tokens=50,
        messages=[{
            "role": "user",
            "content": f"""You are filtering chunks from a news article.

Return ONLY a JSON array of chunk indices (e.g. [0, 2]) for chunks that contain:
- Novel findings, data points, benchmarks, or results
- Concrete announcements (funding amounts, product specs, launches)
- Primary technical content or architectural details

Exclude chunks that are:
- Author bios, bylines, or contributor notes
- "Related articles", navigation, or site boilerplate
- Newsletter CTAs, subscription prompts
- Generic background or widely-known context
- Opinion or commentary without new information

Select at most {max_chunks} indices. Return only the JSON array, nothing else.

Chunks:
{numbered}"""
        }]
    )
    try:
        indices = json.loads(res.content[0].text.strip())
        return [chunks[i] for i in indices if isinstance(i, int) and i < len(chunks)]
    except Exception:
        return chunks[:max_chunks]


def summarize(title: str, chunks: list[str]) -> str:
    """Summarize using only the most relevant chunks."""
    content = "\n\n".join(chunks) if chunks else ""
    context = f"Title: {title}\n\nContent:\n{content}" if content else f"Title: {title}"
    res = anthropic.messages.create(
        model=claude_model,
        max_tokens=100,
        messages=[{
            "role": "user",
            "content": f"Summarize this article in exactly one sentence (max 20 words). Focus on technical or market impact. No filler phrases.\n\n{context}"
        }]
    )
    return res.content[0].text.strip()


def score(title: str, chunks: list[str]) -> float:
    """Score signal quality using only the most relevant chunks."""
    content = "\n\n".join(chunks) if chunks else ""
    context = f"Title: {title}\n\nContent:\n{content}" if content else f"Title: {title}"
    res = anthropic.messages.create(
        model=claude_model,
        max_tokens=10,
        messages=[{
            "role": "user",
            "content": f"""Score this article's signal quality from 0.0 to 1.0 for a developer intelligence feed.
High score (0.8+): novel technical architecture, significant funding, meaningful market shift.
Low score (0.2-): generic announcements, no technical depth, marketing fluff.
Return a single float only, nothing else.

{context}"""
        }]
    )
    try:
        return float(res.content[0].text.strip())
    except Exception:
        return 0.5


# ── Selection ─────────────────────────────────────────

def select_top_per_category(classified_items: list[dict]) -> list[dict]:
    """Pick up to MAX_PER_CATEGORY items per category, deduped by URL."""
    by_category: dict[str, list] = {cat: [] for cat in CATEGORIES}
    for item in classified_items:
        for cat in item["categories"]:
            if cat in by_category and len(by_category[cat]) < MAX_PER_CATEGORY:
                by_category[cat].append(item)

    seen, selected = set(), []
    for items in by_category.values():
        for item in items:
            if item["source_url"] not in seen:
                seen.add(item["source_url"])
                selected.append(item)
    return selected


# ── Process + Store ───────────────────────────────────

def process_item(item: dict) -> dict:
    title = item["raw_title"]
    print(f"  Fetching content: {title[:60]}...")

    content = fetch_article_content(item["source_url"])
    all_chunks = chunk_text(content) if content else []
    chunks = select_relevant_chunks(all_chunks) if all_chunks else []

    print(f"  Processing ({len(chunks)}/{len(all_chunks)} chunks): {title[:50]}...")
    summary = summarize(title, chunks)
    signal_score = score(title, chunks)

    # Embed title + summary for RAG retrieval
    embedding = embed(f"{title}. {summary}")

    return {
        **item,
        "summary": summary,
        "signal_score": signal_score,
        "embedding": embedding,
    }


def store_items(items: list[dict]):
    if not items:
        return
    supabase.table("insights").insert(items).execute()
    print(f"  ✅ Stored {len(items)} new insights")


# ── Main ──────────────────────────────────────────────

def main():
    print("🔍 Fetching from sources...")
    raw_items = fetch_hn() + fetch_rss()
    print(f"   Found {len(raw_items)} raw items")

    print("🔎 Deduplicating...")
    existing_urls = get_existing_urls()
    new_items = [i for i in raw_items if i["source_url"] not in existing_urls]
    print(f"   {len(new_items)} new items after dedup")

    if not new_items:
        print("   Nothing new to process, exiting.")
        return

    print("🏷  Classifying by title...")
    classified = []
    for item in new_items:
        try:
            item["categories"] = classify(item["raw_title"])
            classified.append(item)
        except Exception as e:
            print(f"  ⚠️  Skipped classify for {item['source_url']}: {e}")

    print(f"🎯 Selecting top {MAX_PER_CATEGORY} per category...")
    selected = select_top_per_category(classified)
    print(f"   {len(selected)} articles selected for full processing")

    print("🧠 Fetching content + processing with Claude...")
    processed = []
    for item in selected:
        try:
            processed.append(process_item(item))
        except Exception as e:
            print(f"  ⚠️  Skipped {item['source_url']}: {e}")

    print("💾 Storing to Supabase...")
    store_items(processed)

    print(f"\n✅ Done — {len(processed)} insights ingested.")


if __name__ == "__main__":
    main()

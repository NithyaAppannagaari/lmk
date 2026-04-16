import os
import asyncio
import httpx
import feedparser
from anthropic import Anthropic
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime, timezone
from pathlib import Path

load_dotenv(dotenv_path="/Users/nithya/lmk/apps/api/.env")
print(os.environ.get("SUPABASE_URL", "NOT FOUND"))

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"]
)

claude_model = "claude-opus-4-6"

anthropic = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

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
        hits = res.json().get("hits", [])
        for hit in hits:
            url = hit.get("url")
            title = hit.get("title")
            if not url or not title:
                continue
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
        for entry in parsed.entries[:10]:  # cap at 10 per feed
            url = entry.get("link")
            title = entry.get("title")
            if not url or not title:
                continue
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

# ── LLM Calls ─────────────────────────────────────────

def summarize(title):
    res = anthropic.messages.create(
        model=claude_model,
        max_tokens=100,
        messages=[{
            "role": "user",
            "content": f"Summarize this in exactly one sentence (max 20 words). Focus on technical or market impact. No filler phrases.\n\nArticle title: {title}"
        }]
    )
    return res.content[0].text.strip()

def classify(title):
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
                    - "general": Broader engineering topics, system design, developer tooling, platform infrastructure, general tech startups

                    An article can belong to multiple categories if relevant (e.g. an AI trading system is both "llm" and "quant").

                    Article title: {title}"""
        }]
    )
    import json
    try:
        return json.loads(res.content[0].text.strip())
    except Exception:
        return ["general"]

def score(title):
    res = anthropic.messages.create(
        model=claude_model,
        max_tokens=10,
        messages=[{
            "role": "user",
            "content": f"""Score this article's signal quality from 0.0 to 1.0 for a developer intelligence feed.
                High score (0.8+): novel technical architecture, significant funding, meaningful market shift.
                Low score (0.2-): generic announcements, no technical depth, marketing fluff.
                Return a single float only, nothing else.

                Article title: {title}"""
        }]
    )
    try:
        return float(res.content[0].text.strip())
    except Exception:
        return 0.5

# ── Process + Store ───────────────────────────────────

def process_item(item):
    title = item["raw_title"]
    print(f"  Processing: {title[:60]}...")

    summary = summarize(title)
    categories = classify(title)
    signal_score = score(title)

    return {
        **item,
        "summary": summary,
        "categories": categories,
        "signal_score": signal_score,
    }

def store_items(items):
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
    
    print("🧠 Processing with Claude...")
    processed = []
    for item in new_items:
        try:
            processed.append(process_item(item))
        except Exception as e:
            print(f"  ⚠️  Skipped {item['source_url']}: {e}")

    print("💾 Storing to Supabase...")
    store_items(processed)

    print(f"\n✅ Done — {len(processed)} insights ingested.")

if __name__ == "__main__":
    main()
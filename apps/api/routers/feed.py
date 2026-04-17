import json
import numpy as np
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from auth import get_user
from db import supabase

router = APIRouter()

FEED_LIMIT = 15
SIGNAL_THRESHOLD = 0.5
MAX_AGE_HOURS = 48


def parse_vec(v):
    if v is None:
        return None
    if isinstance(v, list):
        return np.array(v, dtype=float)
    if isinstance(v, str):
        try:
            return np.array(json.loads(v), dtype=float)
        except Exception:
            return None
    return None


def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


@router.get("/feed")
def get_feed(categories: str = None, user=Depends(get_user)):
    category_list = [c.strip() for c in categories.split(",")] if categories else []
    since = (datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)).isoformat()

    query = (
        supabase.table("insights")
        .select("id, raw_title, summary, categories, signal_score, source_url, source_name, ingested_at, embedding")
        .gte("signal_score", SIGNAL_THRESHOLD)
        .gte("ingested_at", since)
        .order("signal_score", desc=True)
        .limit(50)
    )

    if category_list:
        query = query.overlaps("categories", category_list)

    res = query.execute()
    items = res.data

    user_vec = parse_vec(user.get("interest_embedding"))

    for item in items:
        item_vec = parse_vec(item.pop("embedding", None))
        if user_vec is not None and item_vec is not None:
            sim = cosine_sim(user_vec, item_vec)
            item["rag_score"] = 0.5 * item["signal_score"] + 0.5 * sim
        else:
            item["rag_score"] = item["signal_score"]

    items.sort(key=lambda x: x["rag_score"], reverse=True)

    supabase.table("query_log").insert({
        "user_id": user["id"],
        "categories": category_list or None,
        "result_count": min(len(items), FEED_LIMIT),
    }).execute()

    return {
        "items": items[:FEED_LIMIT],
        "personalized": user_vec is not None,
        "ingested_at": items[0]["ingested_at"] if items else None,
    }

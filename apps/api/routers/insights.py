import os
from fastapi import APIRouter
from anthropic import Anthropic
from db import supabase

router = APIRouter()

anthropic = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

def synthesize_digest(summaries: list[str]) -> str:
    joined = "\n".join(f"- {s}" for s in summaries)
    res = anthropic.messages.create(
        model="claude-opus-4-6",
        max_tokens=300,
        messages=[{
            "role": "user",
            "content": f"""Write a 2-3 sentence synthesis of the key themes and signals across these news summaries.
Be specific about what's notable — don't use filler phrases like "the landscape is evolving".

Summaries:
{joined}"""
        }]
    )
    return res.content[0].text.strip()

@router.get("/insights")
def get_insights(category: str = None, limit: int = 10):
    query = supabase.table("insights").select("*").order("signal_score", desc=True).limit(limit)

    if category:
        query = query.contains("categories", [category])

    res = query.execute()
    return res.data

@router.post("/digest")
def get_digest(body: dict):
    summaries = body.get("summaries", [])
    if not summaries:
        return {"digest": None}
    return {"digest": synthesize_digest(summaries)}
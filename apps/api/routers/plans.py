import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from anthropic import Anthropic
from db import supabase

router = APIRouter()
anthropic = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

MIN_SIGNAL_SCORE = 0.5
APP_URL = os.environ.get("LMK_APP_URL", "http://localhost:3000")


class PlanRequest(BaseModel):
    category: str = "general"
    user_id: str = "anonymous"
    insights: list[dict] = []


def generate_plan_tasks(insights: list[dict], category: str) -> list[dict]:
    insights_text = "\n".join(
        f"- {i.get('raw_title', '')}: {i.get('summary', '')}"
        for i in insights[:10]
    )

    response = anthropic.messages.create(
        model="claude-opus-4-6",
        max_tokens=600,
        messages=[{
            "role": "user",
            "content": f"""Given these recent {category} insights:
{insights_text}

Generate exactly 3 action items — one of each type:
- Build: something to make or implement
- Learn: something to read or study
- Explore: a company, trend, or tool to look into

Return ONLY a JSON array with exactly 3 items:
[
  {{"type": "build", "title": "...", "description": "..."}},
  {{"type": "learn", "title": "...", "description": "..."}},
  {{"type": "explore", "title": "...", "description": "..."}}
]

Use plain, direct language. Titles: max 8 words. Descriptions: max 12 words. No jargon."""
        }]
    )

    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = "\n".join(text.split("\n")[1:])
        if text.endswith("```"):
            text = text[: text.rfind("```")]
    return json.loads(text.strip())


@router.get("/plans/{plan_id}/tasks/{task_id}/detail")
def get_task_detail(plan_id: str, task_id: str):
    plan_res = (
        supabase.table("plans")
        .select("categories")
        .eq("id", plan_id)
        .single()
        .execute()
    )
    if not plan_res.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    task_res = (
        supabase.table("plan_tasks")
        .select("*")
        .eq("id", task_id)
        .eq("plan_id", plan_id)
        .single()
        .execute()
    )
    if not task_res.data:
        raise HTTPException(status_code=404, detail="Task not found")

    task = task_res.data
    category = (plan_res.data.get("categories") or ["general"])[0]

    response = anthropic.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": f"""You are helping a developer act on this {category} task:

Type: {task["type"]}
Title: {task["title"]}
Summary: {task["description"]}

Generate a detailed, step-by-step guide. Each step must be concrete and immediately actionable.

Rules for resources:
- Only include URLs you are certain exist (official docs, GitHub repos, arXiv papers, well-known tools)
- Prefer: docs.python.org, react.dev, nextjs.org, fastapi.tiangolo.com, pytorch.org, huggingface.co, arxiv.org, github.com repos with 1000+ stars
- Do NOT invent URLs. If unsure, omit the resource for that step.

Return ONLY valid JSON matching this exact schema:
{{
  "overview": "2-3 sentences: what this is, why it matters right now, what you will have by the end",
  "steps": [
    {{
      "title": "Short action title",
      "content": "3-5 sentences of specific, concrete instruction. Be direct. No filler.",
      "code": "optional short code snippet (null if not applicable)",
      "resource": {{
        "title": "Resource name",
        "url": "https://exact-real-url.com/path",
        "type": "docs|repo|article|paper"
      }}
    }}
  ],
  "resources": [
    {{
      "title": "Resource name",
      "url": "https://exact-real-url.com/path",
      "type": "docs|repo|article|paper",
      "why": "One sentence: what you get from this"
    }}
  ]
}}

Generate 4-6 steps. Resources section: 3-5 total links."""
        }]
    )

    text = response.content[0].text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    return json.loads(text.strip())


@router.get("/plans")
def list_plans(user_id: str = "anonymous"):
    res = (
        supabase.table("plans")
        .select("*, plan_tasks(*)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data


@router.get("/plans/{plan_id}")
def get_plan(plan_id: str):
    res = (
        supabase.table("plans")
        .select("*, plan_tasks(*)")
        .eq("id", plan_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Plan not found")
    return res.data


@router.patch("/plans/{plan_id}")
def complete_plan(plan_id: str):
    from datetime import datetime, timezone
    res = (
        supabase.table("plans")
        .update({"completed_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", plan_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Plan not found")
    return res.data[0]


@router.patch("/plans/{plan_id}/tasks/{task_id}")
def complete_task(plan_id: str, task_id: str):
    from datetime import datetime, timezone
    res = (
        supabase.table("plan_tasks")
        .update({"completed_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", task_id)
        .eq("plan_id", plan_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return res.data[0]


@router.post("/plans")
def create_plan(body: PlanRequest):
    insights = body.insights
    if not insights:
        query = (
            supabase.table("insights")
            .select("*")
            .gte("signal_score", MIN_SIGNAL_SCORE)
            .order("signal_score", desc=True)
            .limit(10)
        )
        if body.category != "general":
            query = query.contains("categories", [body.category])
        res = query.execute()
        insights = res.data

    if not insights:
        raise HTTPException(status_code=404, detail=f"No high-signal insights found for category: {body.category}")

    tasks = generate_plan_tasks(insights, body.category)

    plan_res = supabase.table("plans").insert({
        "user_id": body.user_id,
        "categories": [body.category],
    }).execute()

    plan_id = plan_res.data[0]["id"]

    task_rows = [
        {
            "plan_id": plan_id,
            "type": t["type"],
            "title": t["title"],
            "description": t.get("description", ""),
        }
        for t in tasks
    ]
    if task_rows:
        supabase.table("plan_tasks").insert(task_rows).execute()

    return {
        "plan_id": plan_id,
        "url": f"{APP_URL}/plans/{plan_id}",
        "tasks": tasks,
    }

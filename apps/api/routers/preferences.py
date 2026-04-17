import numpy as np
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from auth import get_user
from db import supabase
from services.embeddings import embed

router = APIRouter()


class PreferenceRequest(BaseModel):
    text: str


@router.post("/preferences")
def store_preference(body: PreferenceRequest, user=Depends(get_user)):
    embedding = embed(body.text)

    supabase.table("user_preferences").insert({
        "user_id": user["id"],
        "raw_text": body.text,
        "embedding": embedding,
    }).execute()

    # Recompute interest embedding: exponentially weighted avg of last 10
    prefs = (
        supabase.table("user_preferences")
        .select("embedding")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    raw_vecs = []
    for p in prefs.data:
        v = p.get("embedding")
        if isinstance(v, list):
            raw_vecs.append(v)
        elif isinstance(v, str):
            import json
            try:
                raw_vecs.append(json.loads(v))
            except Exception:
                pass

    if raw_vecs:
        weights = np.array([0.9 ** i for i in range(len(raw_vecs))])
        vecs = np.array(raw_vecs, dtype=float)
        interest_vec = np.average(vecs, axis=0, weights=weights).tolist()
        supabase.table("users").update({
            "interest_embedding": interest_vec
        }).eq("id", user["id"]).execute()

    return {"status": "ok"}

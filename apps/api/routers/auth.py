import secrets
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from db import supabase
from auth import get_user

router = APIRouter()


class RegisterRequest(BaseModel):
    email: str


@router.post("/auth/register")
def register(body: RegisterRequest):
    existing = supabase.table("users").select("api_key").eq("email", body.email).execute()
    if existing.data:
        return {"api_key": existing.data[0]["api_key"]}

    api_key = secrets.token_urlsafe(32)
    supabase.table("users").insert({
        "email": body.email,
        "api_key": api_key,
    }).execute()
    return {"api_key": api_key}


@router.get("/auth/me")
def whoami(user=Depends(get_user)):
    return {"email": user["email"]}

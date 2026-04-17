from fastapi import Header, HTTPException
from db import supabase


def get_user(authorization: str = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Run `lmk auth login` to authenticate.")
    key = authorization[7:].strip()
    res = supabase.table("users").select("*").eq("api_key", key).execute()
    if not res.data:
        raise HTTPException(status_code=401, detail="Invalid API key.")
    return res.data[0]

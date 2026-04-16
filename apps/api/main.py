from fastapi import FastAPI
from routers import insights

app = FastAPI(title="lmk API")

app.include_router(insights.router, prefix="/v1")

@app.get("/")
def root():
    return {"status": "lmk api is running"}
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, feed, preferences

app = FastAPI(title="lmk API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/v1")
app.include_router(feed.router, prefix="/v1")
app.include_router(preferences.router, prefix="/v1")


@app.get("/")
def root():
    return {"status": "lmk api is running"}

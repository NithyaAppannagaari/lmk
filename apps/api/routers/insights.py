from fastapi import APIRouter
from db import supabase

router = APIRouter()

MOCK_INSIGHTS = [
    {
        "id": "1",
        "source_url": "https://techcrunch.com/example",
        "source_name": "TechCrunch",
        "raw_title": "OpenAI releases new multimodal API",
        "summary": "OpenAI's new API enables real-time multimodal agent pipelines at lower cost.",
        "categories": ["llm"],
        "signal_score": 0.92,
    },
    {
        "id": "2",
        "source_url": "https://axios.com/example",
        "source_name": "Axios Pro Rata",
        "raw_title": "Contextual AI raises $80M Series C",
        "summary": "Enterprise RAG startup secures $80M, signaling strong VC appetite for retrieval infra.",
        "categories": ["llm", "general"],
        "signal_score": 0.85,
    },
]

@router.get("/insights")
def get_insights(category: str = None):
    query = supabase.table("insights").select("*").order("signal_score", desc=True)
    
    if category:
        query = query.contains("categories", [category])
    
    res = query.execute()
    return res.data
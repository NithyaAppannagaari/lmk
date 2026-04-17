from fastembed import TextEmbedding

_model = None

def get_model() -> TextEmbedding:
    global _model
    if _model is None:
        _model = TextEmbedding("BAAI/bge-small-en-v1.5")
    return _model

def embed(text: str) -> list[float]:
    results = list(get_model().embed([text]))
    return results[0].tolist()

EMBEDDING_DIM = 384


"""
LLM access layer using local Ollama.
"""

from functools import lru_cache
from langchain_ollama import ChatOllama


@lru_cache
def get_llm(temperature: float = 0.0) -> ChatOllama:
    """Return a cached local Ollama model."""
    return ChatOllama(
        model="qwen2.5:7b",
        temperature=temperature,
    )

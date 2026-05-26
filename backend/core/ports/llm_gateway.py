from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator


@dataclass
class AgentStep:
    """Résultat normalisé d'une étape de l'agentic loop — indépendant du fournisseur LLM."""
    stop_reason: str          # "end_turn" | "tool_use"
    text: str                 # contenu textuel de cette étape
    tool_calls: list[dict]    # [{"id": str, "name": str, "input": dict}]
    assistant_message: dict   # message assistant en format Anthropic (prêt à append aux messages)


class LLMGateway(ABC):
    """Interface abstraite pour tout LLM — logique métier indépendante du fournisseur."""

    @abstractmethod
    async def generate(self, system: str, user: str, max_tokens: int = 1024) -> str:
        """Génère une réponse complète."""

    @abstractmethod
    async def stream(self, system: str, user: str, max_tokens: int = 1024) -> AsyncIterator[str]:
        """Génère une réponse en streaming (token par token)."""

    @abstractmethod
    async def extract(self, prompt: str, text: str, max_tokens: int = 512) -> str:
        """Extrait des informations structurées d'un texte."""

    @abstractmethod
    async def classify(self, text: str, categories: list[str], default: str | None = None) -> str:
        """Classifie un texte parmi des catégories données."""

    @abstractmethod
    def count_tokens(self, text: str) -> int:
        """Estime le nombre de tokens d'un texte."""

    @abstractmethod
    async def agentic_step(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict],
        max_tokens: int = 1500,
    ) -> AgentStep:
        """
        Une itération de l'agentic loop (tool use).
        - messages : format Anthropic (format canonique interne)
        - tools    : format Anthropic (input_schema)
        Retourne un AgentStep normalisé ; l'adapter gère la conversion vers son API.
        """

    async def agentic_stream(
        self,
        system: str,
        messages: list[dict],
        tools: list[dict],
        max_tokens: int = 1000,
    ) -> AsyncIterator[dict]:
        """
        Streams an agentic step. Yields dicts:
          {"type": "token",      "content": str}                               — text token (real-time)
          {"type": "tool_calls", "calls": [...], "assistant_message": dict, "text": str}
          {"type": "end",        "text": str}                                  — final text, no tools
        Default implementation uses agentic_step (fake streaming char-by-char).
        Override in adapters that support real streaming.
        """
        step = await self.agentic_step(system, messages, tools, max_tokens)
        if step.tool_calls:
            yield {"type": "tool_calls", "calls": step.tool_calls,
                   "assistant_message": step.assistant_message, "text": step.text}
        else:
            for ch in step.text:
                yield {"type": "token", "content": ch}
            yield {"type": "end", "text": step.text}

"""
Script de test qualité RAG — 20 questions représentatives.
Lance : python scripts/test_rag_quality.py

Vérifie que le RAG retrouve des réponses pertinentes.
Score cible : ≥ 15/20 questions avec sources trouvées.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

TEST_QUESTIONS = [
    "Quelles sont nos procédures de déploiement serveur ?",
    "Quels ingénieurs ont de l'expérience en virtualisation ?",
    "Avons-nous déjà livré un projet réseau pour une banque ?",
    "Quelle est notre méthodologie de gestion de projet ?",
    "Quels sont nos certifications techniques disponibles ?",
    "Avons-nous des références dans le secteur télécoms ?",
    "Quelle est la procédure de recette d'un projet ?",
    "Quels ingénieurs maîtrisent Python et le machine learning ?",
    "Comment gérons-nous la sécurité réseau dans nos projets ?",
    "Avons-nous réalisé des migrations de datacenter ?",
]


async def main():
    from config.settings import settings
    from adapters.embeddings.openai_embed_adapter import OpenAIEmbedAdapter
    from adapters.vector_store.chromadb_adapter import ChromaDBAdapter
    from adapters.sparse_search.bm25_adapter import BM25Adapter
    from adapters.llm.claude_haiku_adapter import ClaudeHaikuAdapter
    from core.services.rag_engine import RAGEngine

    rag = RAGEngine(
        vector_store=ChromaDBAdapter(),
        sparse_search=BM25Adapter(),
        embedder=OpenAIEmbedAdapter(),
        llm=ClaudeHaikuAdapter(),
        top_k=settings.retrieval_top_k,
        rerank_top_k=settings.rerank_top_k,
    )

    passed = 0
    for i, question in enumerate(TEST_QUESTIONS, 1):
        sources = await rag.search(question)
        status = "✓" if sources else "✗"
        if sources:
            passed += 1
        print(f"{status} Q{i:02d}: {question[:60]}")
        if sources:
            print(f"     → {sources[0].filename} (score: {sources[0].relevance_score:.2f})")
        else:
            print("     → Aucune source trouvée")

    print(f"\nScore : {passed}/{len(TEST_QUESTIONS)}")
    print("✓ GO" if passed >= 15 else "✗ Améliorer le corpus avant de continuer")


if __name__ == "__main__":
    asyncio.run(main())

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL, getBackendToken } from "@/lib/backend";
import { resolvePrecomputed } from "@/lib/fixtures/copilot";
import { getCurrentRole } from "@/lib/session";

/**
 * Sales IA — route serveur branchée sur le VRAI chat backend (uc02) :
 * POST /v1/chat/query (SSE). On accumule le stream côté serveur et on renvoie
 * la réponse complète — l'effet machine à écrire est rendu côté client.
 * La clé API / le JWT ne transitent jamais côté navigateur.
 *
 * Repli si le backend est injoignable : réponses pré-calculées (fixtures),
 * sinon message d'indisponibilité explicite.
 */

/** Cookie de session chat — permet la mémoire de conversation côté backend. */
const SESSION_COOKIE = "np_copilot_session";

/** Markdown-lite → HTML sûr pour les bulles (gras + sauts de ligne). */
function toHtml(text: string): string {
  return (
    text
      // Blocs ```chart {...}``` émis par uc02 pour son ancienne UI — le rail
      // n'affiche pas de graphiques, on les retire du texte.
      .replace(/```chart[\s\S]*?(```|$)/g, "")
      .replace(/```[\w-]*\n?([\s\S]*?)(```|$)/g, "$1")
      .trim()
      .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^#{2,4} (.+)$/gm, "<b>$1</b>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/\n/g, "<br>")
  );
}

/** Lit le flux SSE du backend et concatène les événements `token` jusqu'à `done`. */
async function readSseAnswer(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let answer = "";
  outer: for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const line = raw.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      try {
        const evt = JSON.parse(line.slice(6)) as { type: string; content?: string };
        if (evt.type === "token" && evt.content) answer += evt.content;
        else if (evt.type === "done") break outer;
      } catch {
        // événement non-JSON — ignoré
      }
    }
  }
  return answer.trim();
}

export async function POST(request: Request) {
  const role = await getCurrentRole();
  if (!role) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  let question = "";
  try {
    const body = (await request.json()) as { question?: string };
    question = (body.question ?? "").toString();
  } catch {
    return NextResponse.json({ error: "requête invalide" }, { status: 400 });
  }
  if (!question.trim()) {
    return NextResponse.json({ error: "question vide" }, { status: 400 });
  }

  const store = await cookies();
  let sessionId = store.get(SESSION_COOKIE)?.value ?? "";
  const newSession = !sessionId;
  if (newSession) sessionId = `copilot-${crypto.randomUUID()}`;

  try {
    const token = await getBackendToken();
    if (!token) throw new Error("session backend absente");

    const form = new FormData();
    form.set("text", question);
    form.set("session_id", sessionId);

    const res = await fetch(`${BACKEND_URL}/v1/chat/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: "no-store",
      // Le pipeline chat (RAG + outils CRM) peut prendre plusieurs dizaines de secondes.
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok || !res.body) throw new Error(`backend ${res.status}`);

    const answer = await readSseAnswer(res.body);
    if (!answer) throw new Error("réponse vide");

    const response = NextResponse.json({ answer: toHtml(answer), source: "backend" });
    if (newSession) {
      response.cookies.set(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }
    return response;
  } catch {
    const precomputed = resolvePrecomputed(question);
    return NextResponse.json(
      precomputed
        ? { answer: precomputed, source: "precomputed" }
        : {
            answer:
              "Sales IA est momentanément indisponible (backend injoignable). Réessayez dans un instant.",
            source: "unavailable",
          },
    );
  }
}

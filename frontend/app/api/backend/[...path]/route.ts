import type { NextRequest } from "next/server";
import { BACKEND_URL, getBackendToken } from "@/lib/backend";

/**
 * Proxy authentifié navigateur → FastAPI pour le module Avant-vente.
 * Le JWT vit dans le cookie httpOnly np_token et est injecté ICI, côté
 * serveur — il ne transite jamais côté client. Le backend applique ensuite
 * ses propres permissions (matrice module × rôle sur /v1/presales/*).
 *
 * Périmètre volontairement restreint : presales + lecture/upload GED
 * (fichiers nécessaires au workflow AO). Tout autre chemin → 404.
 */
const ALLOWED = [/^presales(\/|$)/, /^ged(\/|$)/];

/** Le pipeline de scoring peut durer plusieurs minutes (heartbeat streamé). */
const PROXY_TIMEOUT_MS = 600_000;

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  const joined = path.join("/");
  if (!ALLOWED.some((re) => re.test(joined))) {
    return Response.json({ detail: "chemin non autorisé" }, { status: 404 });
  }

  const token = await getBackendToken();
  if (!token) {
    return Response.json({ detail: "non authentifié" }, { status: 401 });
  }

  const url = `${BACKEND_URL}/v1/${joined}${request.nextUrl.search}`;
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      // Requis par undici pour envoyer un body en stream
      // @ts-expect-error duplex absent des types fetch standards
      duplex: "half",
    });
  } catch {
    return Response.json(
      { detail: "backend injoignable — vérifiez que le serveur est démarré" },
      { status: 502 },
    );
  }

  // Réponse re-streamée telle quelle (JSON, heartbeat scoring, .docx binaires)
  const respHeaders = new Headers();
  for (const h of ["content-type", "content-disposition", "cache-control"]) {
    const v = upstream.headers.get(h);
    if (v) respHeaders.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as PUT,
  proxy as DELETE,
};

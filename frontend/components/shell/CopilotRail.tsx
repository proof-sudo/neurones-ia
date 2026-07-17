"use client";

import { useEffect, useRef, useState } from "react";
import type { Role } from "@/lib/types";
import { getSuggestedQuestions, suggestionLabel } from "@/lib/fixtures/copilot";
import { Modal } from "@/components/ui/Modal";

type Turn = {
  q: string;
  time: string;
  answer: string;
  pending?: boolean;
  animate?: boolean;
};

/** Effet machine à écrire du mockup : texte brut par pas de 3 caractères
 *  toutes les 12 ms, puis bascule sur le HTML complet. */
function Typewriter({
  html,
  animate,
  onDone,
  onGrow,
}: {
  html: string;
  animate: boolean;
  onDone: () => void;
  onGrow: () => void;
}) {
  const plain = html.replace(/<[^>]+>/g, "");
  const [n, setN] = useState(animate ? 0 : plain.length);
  const doneRef = useRef(onDone);
  const growRef = useRef(onGrow);
  useEffect(() => {
    doneRef.current = onDone;
    growRef.current = onGrow;
  });

  useEffect(() => {
    if (!animate) return;
    let i = 0;
    const id = setInterval(() => {
      i += 3;
      if (i >= plain.length) {
        clearInterval(id);
        setN(plain.length);
        doneRef.current();
      } else {
        setN(i);
      }
      growRef.current();
    }, 12);
    return () => clearInterval(id);
  }, [animate, plain.length]);

  if (animate && n < plain.length) {
    return (
      <>
        {plain.slice(0, n)}
        <span className="ml-0.5 inline-block h-3 w-1.5 animate-[blink_1s_steps(1)_infinite] bg-ai align-middle" />
      </>
    );
  }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Fil de conversation (blocs Vous / Sales IA) — partagé rail + modal agrandi. */
function ChatLog({
  turns,
  onTyped,
  logRef,
  className,
}: {
  turns: Turn[];
  onTyped: (index: number) => void;
  logRef: React.RefObject<HTMLDivElement | null>;
  className: string;
}) {
  const scrollBottom = () => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  };
  return (
    <div ref={logRef} className={className}>
      {turns.map((turn, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="self-end px-0.5 font-mono text-[9.5px] uppercase tracking-[0.05em] text-muted">
            Vous · {turn.time}
          </div>
          <div className="max-w-[92%] self-end rounded-[10px_10px_2px_10px] bg-[#DEDED7] px-[11px] py-[9px] text-[12.5px] leading-[1.5] text-text">
            {turn.q}
          </div>
          <div className="self-start px-0.5 font-mono text-[9.5px] uppercase tracking-[0.05em] text-muted">
            Sales IA
          </div>
          <div className="max-w-[92%] self-start rounded-[10px_10px_10px_2px] border border-[#FF6A0044] bg-ai-dim px-[11px] py-[9px] text-[12.5px] leading-[1.5]">
            <span className="mb-[3px] block font-mono text-[10px] tracking-[0.06em] text-ai">
              ◆ sales ia
            </span>
            {turn.pending ? (
              "…"
            ) : (
              <Typewriter
                html={turn.answer}
                animate={!!turn.animate}
                onDone={() => {
                  onTyped(i);
                  scrollBottom();
                }}
                onGrow={scrollBottom}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CopilotRail({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [modalInput, setModalInput] = useState("");
  const [busy, setBusy] = useState(false);
  const railLogRef = useRef<HTMLDivElement>(null);
  const modalLogRef = useRef<HTMLDivElement>(null);

  const suggestions = getSuggestedQuestions(role);

  function markTyped(index: number) {
    setTurns((t) =>
      t.map((turn, i) => (i === index ? { ...turn, animate: false } : turn)),
    );
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setModalInput("");
    setBusy(true);
    const time = new Date().toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setTurns((t) => [...t, { q, time, answer: "", pending: true }]);

    let answer = "Sales IA est momentanément indisponible.";
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = (await res.json()) as { answer: string };
      answer = data.answer;
    } catch {
      // réponse d'indisponibilité par défaut
    } finally {
      setTurns((t) =>
        t.map((turn, i) =>
          i === t.length - 1
            ? { ...turn, answer, pending: false, animate: true }
            : turn,
        ),
      );
      setBusy(false);
      requestAnimationFrame(() => {
        railLogRef.current?.scrollTo({ top: railLogRef.current.scrollHeight });
        modalLogRef.current?.scrollTo({ top: modalLogRef.current.scrollHeight });
      });
    }
  }

  const expandBtn =
    "flex h-[26px] w-[26px] shrink-0 cursor-pointer items-center justify-center rounded-[7px] border border-line bg-panel text-[13px] text-muted hover:border-ai hover:text-text";

  return (
    <>
      {/* FAB flottant (port .chat-fab du mockup) */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Ouvrir Sales IA"
        className="fixed bottom-6 right-6 z-[80] flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-ai text-[22px] text-white shadow-[0_6px_20px_rgba(255,106,0,0.35)] transition hover:brightness-108"
      >
        💬
      </button>

      {open && (
        <aside className="fixed bottom-[90px] right-6 z-[79] flex max-h-[75vh] w-[380px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-white to-panel px-[18px] pb-4 pt-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
          {/* head */}
          <div className="mb-1 flex items-center gap-2.5">
            <span className="animate-pulse-orb h-2.5 w-2.5 rounded-full bg-ai shadow-[0_0_0_4px_var(--color-ai-dim)]" />
            <h2 className="flex-1 text-[15.5px] font-semibold">Sales IA</h2>
            <button
              onClick={() => {
                setOpen(false);
                setModalOpen(true);
              }}
              title="Agrandir la conversation"
              className={expandBtn}
            >
              ⤢
            </button>
            <button onClick={() => setOpen(false)} title="Fermer" className={expandBtn}>
              ✕
            </button>
          </div>
          <p className="mb-[18px] mt-1 text-[11.5px] leading-relaxed text-muted">
            Interroge le pipeline, les clients et les prévisions en langage naturel.
          </p>

          {/* chat */}
          <div className="flex min-h-0 flex-1 flex-col border-t border-line pt-4">
            <div className="my-3 flex flex-wrap gap-1.5">
              {suggestions.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="cursor-pointer rounded-[20px] border border-line bg-panel px-2.5 py-1.5 text-[11px] text-muted transition hover:border-ai hover:text-text"
                >
                  {suggestionLabel(q)}
                </button>
              ))}
            </div>

            <ChatLog
              turns={turns}
              onTyped={markTyped}
              logRef={railLogRef}
              className="flex max-h-[280px] flex-1 flex-col gap-3 overflow-y-auto pr-0.5"
            />

            <div className="mt-1.5 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask(input)}
                placeholder="Poser une question à Sales IA…"
                className="flex-1 rounded-[10px] border border-line bg-panel px-3 py-2.5 text-[12.5px] focus:border-ai focus:outline-none"
              />
              <button
                onClick={() => ask(input)}
                disabled={busy}
                className="cursor-pointer rounded-[10px] bg-ai px-3.5 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                →
              </button>
            </div>
            <div className="mt-3.5 font-mono text-[10px] leading-relaxed text-muted">
              Sales IA répond uniquement à partir des données déjà chargées dans
              l&apos;outil (pipeline, clients, leads, appels d&apos;offres,
              performances...) — aucune information n&apos;est récupérée depuis
              l&apos;extérieur. Vérification recommandée avant décision finale.
            </div>
          </div>
        </aside>
      )}

      {/* Modal conversation agrandie (port .copilot-modal-panel du mockup) */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        className="flex max-h-[82vh] max-w-[920px] flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <div>
            <div className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-ai">
              ● Sales IA
            </div>
            <h2 className="text-[17px] font-semibold">Conversation complète</h2>
          </div>
          <button
            onClick={() => setModalOpen(false)}
            className="cursor-pointer rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[13px] text-muted hover:border-ai hover:text-text"
          >
            Fermer ✕
          </button>
        </div>
        <ChatLog
          turns={turns}
          onTyped={markTyped}
          logRef={modalLogRef}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5"
        />
        <div className="flex gap-2 border-t border-line px-6 py-4">
          <input
            value={modalInput}
            onChange={(e) => setModalInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(modalInput)}
            placeholder="Poser une question à Sales IA…"
            className="flex-1 rounded-[10px] border border-line bg-panel-2 px-3.5 py-[11px] text-[13px] focus:border-ai focus:outline-none"
          />
          <button
            onClick={() => ask(modalInput)}
            disabled={busy}
            className="cursor-pointer rounded-[10px] bg-ai px-[18px] text-[13.5px] font-semibold text-white disabled:opacity-50"
          >
            Envoyer
          </button>
        </div>
      </Modal>
    </>
  );
}

"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Send, Bot, User, FileText, Loader2, AlertTriangle,
  Plus, Paperclip, X, Sparkles, MessageSquare, Square,
  History, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { streamChat, fetchChatSessions, fetchSessionHistory, deleteChatSession, type Source, type ChatSession } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  intent?: string;
  streaming?: boolean;
  thinking?: boolean;
  thinkingLabel?: string;
  error?: boolean;
  attachments?: string[];
}

const intentLabel: Record<string, { label: string; color: string }> = {
  rag:      { label: "Documents GED",  color: "bg-slate-100 text-slate-600 border border-slate-200" },
  local_db: { label: "Données Odoo",   color: "bg-slate-100 text-slate-600 border border-slate-200" },
  hybrid:   { label: "GED + Odoo",     color: "bg-slate-100 text-slate-600 border border-slate-200" },
};

const SUGGESTIONS = [
  { text: "Historique des ventes pour VERSUS BANK", icon: "📊" },
  { text: "Ingénieurs avec expérience en virtualisation", icon: "👤" },
  { text: "Historique du client ORANGE CÔTE D'IVOIRE", icon: "📋" },
  { text: "Nos références dans le secteur bancaire", icon: "🏦" },
];

const THINKING_STEPS = [
  "Analyse de la question…",
  "Consultation de la base Odoo…",
  "Recherche documentaire…",
  "Rédaction de la réponse…",
];

function ThinkingIndicator({ label }: { label?: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (label) return;
    const id = setInterval(() => setStep((s) => (s + 1) % THINKING_STEPS.length), 1800);
    return () => clearInterval(id);
  }, [label]);
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-1 items-end">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce"
            style={{ animationDelay: `${i * 140}ms` }}
          />
        ))}
      </div>
      <span key={label ?? step} className="text-xs text-slate-400 animate-in fade-in duration-300">
        {label ?? THINKING_STEPS[step]}
      </span>
    </div>
  );
}

const mdComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-base font-bold text-slate-900 mt-4 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-sm font-bold text-slate-800 mt-3 mb-1.5 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-semibold text-slate-700 mt-2 mb-1 first:mt-0">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-slate-900">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-slate-600">{children}</em>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-2 space-y-1 pl-4">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-2 space-y-1 pl-5 list-decimal">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="relative pl-1 leading-relaxed before:absolute before:-left-3 before:top-[0.45em] before:w-1.5 before:h-1.5 before:rounded-full before:bg-slate-300 [ol_&]:before:hidden [ol_&]:list-item">
      {children}
    </li>
  ),
  code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) =>
    inline ? (
      <code className="bg-slate-100 text-[#0a2a43] text-[0.82em] font-mono px-1.5 py-0.5 rounded">
        {children}
      </code>
    ) : (
      <code className="block bg-slate-900 text-slate-100 text-xs font-mono p-3 rounded-lg overflow-x-auto my-2">
        {children}
      </code>
    ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-slate-900">{children}</pre>
  ),
  hr: () => <hr className="my-3 border-slate-200" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-slate-50 border-b border-slate-200">{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody className="divide-y divide-slate-100">{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => <tr>{children}</tr>,
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-3 py-2 text-left font-semibold text-slate-700">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-3 py-2 text-slate-600">{children}</td>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-slate-300 pl-3 my-2 text-slate-500 italic">
      {children}
    </blockquote>
  ),
};

function AssistantContent({ content, streaming }: { content: string; streaming?: boolean }) {
  return (
    <div className="text-sm text-slate-800 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as never}>
        {content}
      </ReactMarkdown>
      {streaming && (
        <span className="inline-block w-1.5 h-4 bg-[#0a2a43] ml-0.5 animate-pulse rounded-sm align-middle" />
      )}
    </div>
  );
}

function generateSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "pdf" ? "📄" : ext === "txt" ? "📝" : "📋";
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionKey = useMemo(() => {
    if (typeof window === "undefined") return "neurones_session_id";
    try {
      const raw = localStorage.getItem("neurones_user");
      const uid = raw ? (JSON.parse(raw) as { id: number }).id : 0;
      return `neurones_session_${uid}`;
    } catch { return "neurones_session_id"; }
  }, []);

  // État initial stable (identique serveur/client) → évite le hydration mismatch.
  // L'ID réel est résolu côté client uniquement, dans le useEffect ci-dessous.
  const [sessionId, setSessionId] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Résolution de l'ID de session — localStorage n'existe pas au rendu serveur,
  // donc on lit/génère exclusivement après le montage (strict useEffect).
  useEffect(() => {
    let id = localStorage.getItem(sessionKey);
    if (!id) {
      id = generateSessionId();
      localStorage.setItem(sessionKey, id);
    }
    setSessionId(id);
  }, [sessionKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }, [input]);

  useEffect(() => {
    if (!sessionId) return;
    const saved = localStorage.getItem(`neurones_chat_${sessionId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      } catch { /* ignore */ }
    }
  }, [sessionId]);

  // Debounce à 500ms — évite 100+ writes/s pendant le streaming
  useEffect(() => {
    if (!sessionId) return;
    const completed = messages.filter((m) => !m.streaming && !m.thinking);
    if (completed.length === 0) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(`neurones_chat_${sessionId}`, JSON.stringify(completed));
      } catch { /* quota exceeded */ }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [messages, sessionId]);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    setSessionsError(null);
    try {
      const data = await fetchChatSessions(40);
      setSessions(data);
      if (data.length === 0) setSessionsError("0 sessions retournées par l'API");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("loadSessions error:", msg);
      setSessionsError(msg);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    if (showHistory) loadSessions();
  }, [showHistory, loadSessions]);

  const newConversation = useCallback(() => {
    const id = generateSessionId();
    localStorage.setItem(sessionKey, id);
    setSessionId(id);
    setMessages([]);
    setAttachedFiles([]);
    if (showHistory) loadSessions();
  }, [sessionKey, showHistory, loadSessions]);

  const resumeSession = useCallback(async (sid: string) => {
    if (sid === sessionId) { setShowHistory(false); return; }
    try {
      const history = await fetchSessionHistory(sid);
      const msgs: Message[] = history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      localStorage.setItem(sessionKey, sid);
      setSessionId(sid);
      setMessages(msgs);
      setShowHistory(false);
    } catch { /* ignore */ }
  }, [sessionId, sessionKey]);

  const handleDeleteSession = useCallback(async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteChatSession(sid);
      setSessions((prev) => prev.filter((s) => s.session_id !== sid));
      if (sid === sessionId) {
        const id = generateSessionId();
        localStorage.setItem(sessionKey, id);
        setSessionId(id);
        setMessages([]);
      }
    } catch { /* ignore */ }
  }, [sessionId, sessionKey]);

  const removeFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() && attachedFiles.length === 0) return;
      if (loading) return;

      const filesToSend = [...attachedFiles];
      setInput("");
      setAttachedFiles([]);
      setLoading(true);

      const history = messages
        .filter((m) => !m.streaming && !m.error)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [
        ...prev,
        { role: "user", content: text, attachments: filesToSend.map((f) => f.name) },
      ]);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", streaming: true, thinking: true },
      ]);

      try {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        for await (const chunk of streamChat(text, history, sessionId, filesToSend, controller.signal)) {
          if (chunk.type === "tool_call") {
            setMessages((prev) => {
              const updated = [...prev];
              const last = { ...updated[updated.length - 1] };
              last.thinkingLabel = chunk.label;
              updated[updated.length - 1] = last;
              return updated;
            });
          } else if (chunk.type === "sources" && chunk.sources) {
            setMessages((prev) => {
              const updated = [...prev];
              const last = { ...updated[updated.length - 1] };
              last.sources = chunk.sources;
              updated[updated.length - 1] = last;
              return updated;
            });
          } else if (chunk.type === "token" && chunk.content) {
            setMessages((prev) => {
              const updated = [...prev];
              const last = { ...updated[updated.length - 1] };
              last.content += chunk.content;
              last.thinking = false;
              last.thinkingLabel = undefined;
              updated[updated.length - 1] = last;
              return updated;
            });
          } else if (chunk.type === "done") {
            setMessages((prev) => {
              const updated = [...prev];
              const last = { ...updated[updated.length - 1] };
              last.streaming = false;
              last.thinking = false;
              if (chunk.intent) last.intent = chunk.intent;
              updated[updated.length - 1] = last;
              return updated;
            });
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setMessages((prev) => {
            const updated = [...prev];
            const last = { ...updated[updated.length - 1] };
            last.streaming = false;
            last.thinking = false;
            updated[updated.length - 1] = last;
            return updated;
          });
        } else {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: "Le backend n'est pas disponible. Lancez `uvicorn main:app --reload` dans le dossier `backend/`.",
              streaming: false,
              thinking: false,
              error: true,
            };
            return updated;
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [attachedFiles, loading, messages, sessionId]
  );

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const hasMessages = messages.length > 0;

  const formatSessionDate = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };

  return (
    <div className="flex flex-row h-full relative" style={{ background: "#f7f8fa" }}>

      {/* Overlay mobile pour l'historique */}
      {showHistory && (
        <div
          className="fixed inset-0 z-30 bg-black/40 sm:hidden"
          onClick={() => setShowHistory(false)}
        />
      )}

      {/* ── Sidebar historique ── */}
      {showHistory && (
        <div
          className="fixed sm:relative inset-y-0 left-0 z-40 sm:z-10 w-72 sm:w-64 shrink-0 flex flex-col"
          style={{
            background: "#eef1f5",
            borderRight: "1px solid #ecedf0",
          }}
        >
          <div className="px-4 py-3.5 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid #ecedf0" }}>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Historique</span>
            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
            {loadingSessions ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            ) : sessionsError ? (
              <p className="text-[10px] text-red-400 text-center py-8 px-3 leading-relaxed break-all">
                {sessionsError}
              </p>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8 leading-relaxed">
                Aucune conversation<br />enregistrée
              </p>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => resumeSession(s.session_id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-xl group flex items-start gap-2 transition-all relative",
                    s.session_id === sessionId
                      ? "bg-[#e3eaf1] text-[#0a2a43]"
                      : "hover:bg-white text-slate-600"
                  )}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-50" />
                  <div className="flex-1 min-w-0 pr-5">
                    <p className="text-xs font-medium truncate leading-snug">
                      {s.title || "Conversation"}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {s.turn_count} msg · {formatSessionDate(s.last_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(s.session_id, e)}
                    className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </button>
              ))
            )}
          </div>
          <div className="shrink-0 px-3 py-3" style={{ borderTop: "1px solid #ecedf0" }}>
            <button
              onClick={newConversation}
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-xl text-slate-600 font-medium disabled:opacity-50 transition-colors hover:bg-white"
              style={{ border: "1px solid #ecedf0" }}
            >
              <Plus className="w-3.5 h-3.5" />
              Nouvelle conversation
            </button>
          </div>
        </div>
      )}

      {/* ── Zone principale ── */}
      <div className="flex flex-col flex-1 min-w-0">
      {/* Header */}
      <div
        className="shrink-0 px-4 md:px-6 py-3.5 flex items-center justify-between"
        style={{
          background: "#f7f8fa",
          borderBottom: "1px solid #ecedf0",
        }}
      >
        <div className="flex items-center gap-2.5">
          <MessageSquare className="w-5 h-5 text-[#0a2a43] shrink-0" strokeWidth={1.75} />
          <div>
            <h1 className="text-sm font-semibold text-slate-900 leading-none">Connaissance interne</h1>
            <p className="hidden sm:block text-xs text-slate-400 mt-0.5 font-medium">GED · Odoo · Analyse de documents</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors",
              showHistory
                ? "bg-[#e3eaf1] text-[#0a2a43] border border-[#cdd9e4]"
                : "text-slate-600 hover:bg-white"
            )}
            style={showHistory ? {} : { border: "1px solid #ecedf0" }}
            title="Historique des conversations"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Historique</span>
          </button>
          <button
            onClick={newConversation}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-slate-600 font-medium disabled:opacity-50 transition-colors hover:bg-white"
            style={{ border: "1px solid #ecedf0" }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nouvelle</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full px-4 sm:px-6 py-8 sm:py-12 text-center">
            <Sparkles className="w-9 h-9 text-[#0a2a43] mb-5" strokeWidth={1.5} />
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Comment puis-je vous aider ?</h2>
            <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-8">
              Posez une question sur vos données, ou joignez un document PDF / Word pour l&apos;analyser.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => send(s.text)}
                  className="flex items-start gap-3 text-left text-sm text-slate-600 rounded-xl px-4 py-3.5 transition-all duration-150 group hover:-translate-y-0.5"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #ecedf0",
                    boxShadow: "none",
                  }}
                >
                  <span className="text-lg shrink-0 leading-none">{s.icon}</span>
                  <span className="text-slate-700 leading-snug text-xs font-medium">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                    msg.role === "user"
                      ? "bg-[#0a2a43]"
                      : "bg-white border border-slate-200",
                    msg.thinking && "ring-2 ring-slate-200 ring-offset-1"
                  )}
                >
                  {msg.role === "user"
                    ? <User className="w-4 h-4 text-white" strokeWidth={1.75} />
                    : <Bot className="w-4 h-4 text-[#0a2a43]" strokeWidth={1.75} />
                  }
                </div>

                <div className={cn("flex flex-col gap-2 max-w-[82%]", msg.role === "user" ? "items-end" : "items-start")}>
                  {/* Bubble */}
                  <div
                    className={cn("rounded-xl px-4 py-3", msg.role === "user" ? "rounded-tr-sm" : "rounded-tl-sm")}
                    style={
                      msg.role === "user"
                        ? { background: "#0a2a43" }
                        : msg.error
                        ? { background: "#fdeceb", border: "1px solid #f3c7c2" }
                        : {
                            background: "#ffffff",
                            border: "1px solid #ecedf0",
                            boxShadow: "none",
                          }
                    }
                  >
                    {msg.role === "user" ? (
                      <div className="text-white">
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {msg.attachments.map((name, j) => (
                              <span key={j} className="flex items-center gap-1 bg-white/10 text-white/80 text-xs px-2 py-0.5 rounded-md">
                                <span>{fileIcon(name)}</span>
                                <span className="max-w-[140px] truncate">{name}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        {msg.content && (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        )}
                      </div>
                    ) : msg.thinking ? (
                      <ThinkingIndicator label={msg.thinkingLabel} />
                    ) : msg.error ? (
                      <p className="text-sm text-red-600 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        {msg.content}
                      </p>
                    ) : (
                      <AssistantContent content={msg.content} streaming={msg.streaming} />
                    )}
                  </div>

                  {/* Intent badge */}
                  {msg.intent && !msg.streaming && (
                    <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full", intentLabel[msg.intent]?.color ?? "bg-slate-100 text-slate-600")}>
                      {intentLabel[msg.intent]?.label ?? msg.intent}
                    </span>
                  )}

                  {/* Sources — affichées uniquement si pertinence ≥ 40% */}
                  {msg.sources && msg.sources.filter(s => s.relevance_score >= 0.40).length > 0 && !msg.streaming && (
                    <div className="flex flex-col gap-1.5 w-full">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-0.5">Sources</p>
                      {msg.sources.filter(s => s.relevance_score >= 0.40).map((src, j) => (
                        <div
                          key={j}
                          className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
                          style={{
                            background: "#ffffff",
                            border: "1px solid #ecedf0",
                          }}
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-700 truncate">{src.filename}</p>
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{src.excerpt}</p>
                          </div>
                          <span className="text-[11px] font-bold text-[#0a2a43] shrink-0 bg-[#e3eaf1] px-1.5 py-0.5 rounded-full border border-[#cdd9e4]">
                            {Math.round(src.relevance_score * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div
        className="shrink-0 px-3 sm:px-6 py-3 sm:py-4"
        style={{
          background: "#f7f8fa",
          borderTop: "1px solid #ecedf0",
        }}
      >
        <div className="max-w-3xl mx-auto">
          {/* File chips */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {attachedFiles.map((f, i) => (
                <span key={i} className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-600 text-xs px-2.5 py-1 rounded-lg">
                  <FileText className="w-3 h-3 shrink-0" />
                  <span className="max-w-[160px] truncate font-medium">{f.name}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400">{(f.size / 1024).toFixed(0)} Ko</span>
                  <button onClick={() => removeFile(i)} className="ml-0.5 text-slate-400 hover:text-slate-700 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input box */}
          <div
            className="flex items-end gap-2 px-3 py-2.5 rounded-xl focus-within:ring-2 focus-within:ring-[#0a2a43]/25 transition-all"
            style={{
              background: "#ffffff",
              border: "1px solid #ecedf0",
              boxShadow: "none",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files || []);
                setAttachedFiles((prev) => [...prev, ...picked].slice(0, 3));
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || attachedFiles.length >= 3}
              title="Joindre un document"
              className={cn(
                "p-1.5 rounded-lg transition-colors shrink-0 mb-0.5",
                attachedFiles.length > 0
                  ? "text-[#0a2a43] bg-slate-100"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              )}
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={
                attachedFiles.length > 0
                  ? "Décrivez ce que vous souhaitez faire…"
                  : "Posez votre question… (Entrée pour envoyer)"
              }
              className="flex-1 bg-transparent resize-none text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none min-h-[24px] max-h-32 leading-relaxed py-0.5"
              rows={1}
              disabled={loading}
            />

            <button
              onClick={() => loading ? abortRef.current?.abort() : send(input)}
              disabled={!loading && !input.trim() && attachedFiles.length === 0}
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all mb-0.5 hover:brightness-95"
              style={{ background: "#f26a21" }}
              title={loading ? "Arrêter" : "Envoyer"}
            >
              {loading
                ? <Square className="w-3.5 h-3.5 text-white" />
                : <Send className="w-3.5 h-3.5 text-white" />
              }
            </button>
          </div>

          {attachedFiles.length > 0 && (
            <p className="text-xs text-slate-400 text-center mt-2">
              {attachedFiles.length} fichier{attachedFiles.length > 1 ? "s" : ""} joint{attachedFiles.length > 1 ? "s" : ""} — analysé par l&apos;IA
            </p>
          )}
        </div>
      </div>
      </div>{/* end zone principale */}
    </div>
  );
}

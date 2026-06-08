"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  BriefcaseBusiness,
  Code2,
  Compass,
  FileText,
  Globe2,
  History,
  Hotel,
  Loader2,
  Menu,
  Mic,
  Moon,
  PanelLeft,
  Plane,
  Plus,
  Search,
  Send,
  Sparkles,
  Sun,
  Upload,
  User,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Mode = "document" | "hotel" | "travel" | "resume" | "coding" | "research";

type Message = {
  role: "user" | "assistant";
  content: string;
  confidence?: number;
  sources?: Source[];
};

type Source = {
  chunk_id: string;
  document_id: string;
  source_type: "pdf" | "url" | "json";
  knowledge_type: "document" | "hotel" | "travel";
  title: string;
  page_number: number | null;
  url: string | null;
  similarity: number;
  rerank_score: number;
  confidence: number;
  preview: string;
};

type DocumentInfo = {
  document_id: string;
  source_type: "pdf" | "url" | "json";
  knowledge_type: "document" | "hotel" | "travel";
  title: string;
  filename?: string;
  url?: string;
  chunk_count: number;
  created_at: string;
};

type ChatSession = {
  id: string;
  title: string;
  mode: Mode;
  messages: Message[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

const modeOptions: Array<{
  id: Mode;
  label: string;
  description: string;
  icon: typeof Bot;
  prompt: string;
}> = [
  {
    id: "document",
    label: "Document Assistant",
    description: "Grounded answers from PDFs and URLs",
    icon: FileText,
    prompt: "Ask about your uploaded knowledge base",
  },
  {
    id: "hotel",
    label: "Hotel Finder",
    description: "RAG hotels from indexed sources",
    icon: Hotel,
    prompt: "Find hotels from my uploaded data",
  },
  {
    id: "travel",
    label: "Travel Planner",
    description: "RAG itineraries from travel sources",
    icon: Plane,
    prompt: "Plan a trip from my indexed guide",
  },
  {
    id: "resume",
    label: "Resume Assistant",
    description: "RAG edits from resume and JD",
    icon: BriefcaseBusiness,
    prompt: "Improve my resume using uploaded context",
  },
  {
    id: "coding",
    label: "Coding Assistant",
    description: "RAG help from code and docs",
    icon: Code2,
    prompt: "Explain this error from indexed docs",
  },
  {
    id: "research",
    label: "Research Assistant",
    description: "RAG notes from source material",
    icon: Search,
    prompt: "Summarize my indexed sources",
  },
];

function createSession(mode: Mode = "document"): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    mode,
    messages: [
      {
        role: "assistant",
        content: "Choose a mode, add PDFs or URLs, then ask. Every mode answers from indexed knowledge with sources.",
      },
    ],
  };
}

export default function Home() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [url, setUrl] = useState("");
  const [jsonTitle, setJsonTitle] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState("Ready");
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [preview, setPreview] = useState<DocumentInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([createSession()]);
  const [activeSessionId, setActiveSessionId] = useState(() => sessions[0].id);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions],
  );
  const activeMode = modeOptions.find((mode) => mode.id === activeSession.mode) ?? modeOptions[0];
  const ActiveIcon = activeMode.icon;
  const activeKnowledgeType = activeSession.mode === "hotel" || activeSession.mode === "travel" ? activeSession.mode : "document";

  function updateSession(updater: (session: ChatSession) => ChatSession) {
    setSessions((current) => current.map((session) => (session.id === activeSessionId ? updater(session) : session)));
  }

  function setMode(mode: Mode) {
    updateSession((session) => ({ ...session, mode }));
  }

  function startNewChat(mode: Mode = activeSession.mode) {
    const next = createSession(mode);
    setSessions((current) => [next, ...current]);
    setActiveSessionId(next.id);
    setSidebarOpen(false);
  }

  async function refreshDocuments() {
    const response = await fetch(`${API_URL}/documents`);
    if (response.ok) {
      setDocuments(await response.json());
    }
  }

  useEffect(() => {
    refreshDocuments().catch(() => undefined);
  }, []);

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("knowledge_type", activeKnowledgeType);
    setBusy(true);
    setStatus(`Indexing ${file.name} as ${activeKnowledgeType}...`);

    try {
      const response = await fetch(`${API_URL}/upload`, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Upload failed");
      setStatus(data.duplicate ? "Already indexed" : `Indexed ${data.chunks_added} chunks`);
      await refreshDocuments();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function ingestUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setStatus("Indexing website...");

    try {
      const response = await fetch(`${API_URL}/ingest-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, knowledge_type: activeKnowledgeType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "URL ingestion failed");
      setUrl("");
      setStatus(data.duplicate ? "Already indexed" : `Indexed ${data.chunks_added} chunks`);
      await refreshDocuments();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "URL ingestion failed");
    } finally {
      setBusy(false);
    }
  }

  async function ingestJson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!jsonText.trim() || (activeKnowledgeType !== "hotel" && activeKnowledgeType !== "travel")) return;
    setBusy(true);
    setStatus(`Indexing ${activeKnowledgeType} JSON...`);

    try {
      const parsed = JSON.parse(jsonText);
      const records = Array.isArray(parsed) ? parsed : [parsed];
      const response = await fetch(`${API_URL}/ingest-json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: jsonTitle.trim() || `${activeMode.label} JSON`,
          knowledge_type: activeKnowledgeType,
          records,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "JSON ingestion failed");
      setJsonText("");
      setJsonTitle("");
      setStatus(data.duplicate ? "Already indexed" : `Indexed ${data.chunks_added} JSON chunks`);
      await refreshDocuments();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "JSON ingestion failed");
    } finally {
      setBusy(false);
    }
  }

  function confidenceTone(confidence?: number) {
    if (!confidence) return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
    if (confidence >= 75) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
    if (confidence >= 45) return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
    return "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  }

  async function ask(event?: FormEvent<HTMLFormElement>, override?: string) {
    event?.preventDefault();
    const clean = (override ?? question).trim();
    if (!clean || busy) return;

    setQuestion("");
    setBusy(true);
    setStatus(`${activeMode.label} thinking...`);

    updateSession((session) => ({
      ...session,
      title: session.title === "New chat" ? clean.slice(0, 42) : session.title,
      messages: [
        ...session.messages,
        { role: "user", content: clean },
        { role: "assistant", content: "", sources: [], confidence: 0 },
      ],
    }));

    try {
      const response = await fetch(`${API_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: clean, top_k: 8, mode: activeSession.mode }),
      });
      if (!response.ok || !response.body) {
        const error = await response.json().catch(() => ({ detail: "Query failed" }));
        throw new Error(error.detail);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const eventData = JSON.parse(line);
          updateSession((session) => {
            const messages = [...session.messages];
            const last = messages[messages.length - 1];
            if (eventData.type === "metadata") {
              messages[messages.length - 1] = {
                ...last,
                confidence: eventData.confidence,
                sources: eventData.sources,
              };
            }
            if (eventData.type === "token") {
              messages[messages.length - 1] = { ...last, content: `${last.content}${eventData.text}` };
            }
            return { ...session, messages };
          });
        }
      }
      setStatus("Ready");
    } catch (error) {
      updateSession((session) => {
        const messages = [...session.messages];
        messages[messages.length - 1] = {
          role: "assistant",
          content: error instanceof Error ? error.message : "Query failed",
        };
        return { ...session, messages };
      });
      setStatus("Query failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-[#0f172a] dark:text-slate-50">
        <div className="flex min-h-screen">
          <aside
            className={`fixed inset-y-0 left-0 z-40 w-80 border-r border-slate-200 bg-white/90 backdrop-blur-xl transition-transform dark:border-slate-800 dark:bg-slate-950/90 lg:static lg:translate-x-0 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div className="font-semibold">InsightGPT</div>
                    <div className="text-xs text-slate-500">AI Assistant Platform</div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
                  <X size={18} />
                </Button>
              </div>

              <div className="space-y-4 p-4">
                <Button className="w-full" onClick={() => startNewChat()}>
                  <Plus size={17} />
                  New Chat
                </Button>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Compass size={14} />
                    Assistants
                  </div>
                  {modeOptions.map((mode) => {
                    const Icon = mode.icon;
                    const selected = activeSession.mode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setMode(mode.id)}
                        className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
                          selected
                            ? "border-indigo-500 bg-indigo-50 text-indigo-950 dark:bg-indigo-500/15 dark:text-white"
                            : "border-transparent hover:border-slate-200 hover:bg-slate-100 dark:hover:border-slate-800 dark:hover:bg-slate-900"
                        }`}
                      >
                        <Icon className={selected ? "text-indigo-500" : "text-slate-500"} size={18} />
                        <span>
                          <span className="block text-sm font-semibold">{mode.label}</span>
                          <span className="block text-xs text-slate-500">{mode.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <History size={14} />
                  Chat History
                </div>
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => {
                        setActiveSessionId(session.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                        activeSessionId === session.id
                          ? "bg-slate-900 text-white dark:bg-slate-800"
                          : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
                      }`}
                    >
                      <span className="block truncate">{session.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center justify-between rounded-lg bg-slate-100 p-3 dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800">
                      <User size={17} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Local User</div>
                      <div className="text-xs text-slate-500">Developer mode</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setDarkMode((value) => !value)} aria-label="Toggle theme">
                    {darkMode ? <Sun size={17} /> : <Moon size={17} />}
                  </Button>
                </div>
              </div>
            </div>
          </aside>

          {sidebarOpen && <button className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close overlay" />}

          <section className="min-w-0 flex-1">
            <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/75 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
              <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
                    <Menu size={19} />
                  </Button>
                  <Button variant="ghost" size="icon" className="hidden lg:inline-flex" aria-label="Sidebar">
                    <PanelLeft size={19} />
                  </Button>
                  <div>
                    <div className="flex items-center gap-2 font-semibold">
                      <ActiveIcon size={18} className="text-indigo-500" />
                      {activeMode.label}
                    </div>
                    <div className="text-xs text-slate-500">{activeMode.description}</div>
                  </div>
                </div>
                <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
                  {status}
                </Badge>
              </div>
            </header>

            <div className="mx-auto grid max-w-7xl gap-4 p-4 xl:grid-cols-[320px_1fr_320px]">
              <section className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-4 flex items-center gap-2 font-semibold">
                    <Upload size={18} />
                    Knowledge
                  </div>
                  <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    Indexing as <span className="font-semibold uppercase text-indigo-600 dark:text-indigo-300">{activeKnowledgeType}</span> knowledge.
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) uploadFile(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      const file = event.dataTransfer.files?.[0];
                      if (file) uploadFile(file);
                    }}
                    className={`flex min-h-32 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 text-sm transition ${
                      dragging
                        ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-500/15"
                        : "border-slate-300 bg-slate-50 hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-950"
                    }`}
                  >
                    <FileText size={28} className="text-indigo-500" />
                    <span className="text-center font-medium">Drag PDF here or click to choose</span>
                  </button>

                  <form onSubmit={ingestUrl} className="mt-4 space-y-3">
                    <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/article" />
                    <Button disabled={busy || !url.trim()} className="w-full" type="submit">
                      <Globe2 size={17} />
                      Ingest URL
                    </Button>
                  </form>

                  {(activeKnowledgeType === "hotel" || activeKnowledgeType === "travel") && (
                    <form onSubmit={ingestJson} className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                      <Input
                        value={jsonTitle}
                        onChange={(event) => setJsonTitle(event.target.value)}
                        placeholder={`${activeMode.label} JSON title`}
                      />
                      <Textarea
                        value={jsonText}
                        onChange={(event) => setJsonText(event.target.value)}
                        placeholder={
                          activeKnowledgeType === "hotel"
                            ? '[{"name":"Sea View Inn","destination":"Goa","price":4200,"rating":4.4,"amenities":["wifi","pool"]}]'
                            : '[{"title":"Goa beaches","destination":"Goa","day":"Day 1","tips":"Visit Calangute early"}]'
                        }
                        className="min-h-28 font-mono text-xs"
                      />
                      <Button disabled={busy || !jsonText.trim()} className="w-full" type="submit">
                        <FileText size={17} />
                        Ingest JSON
                      </Button>
                    </form>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold">Documents</h2>
                    <Badge>{documents.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {documents.length === 0 && <p className="text-sm text-slate-500">No indexed documents yet.</p>}
                    {documents.map((doc) => (
                      <button
                        key={doc.document_id}
                        type="button"
                        onClick={() => setPreview(doc)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left text-sm hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-950"
                      >
                        <div className="line-clamp-1 font-medium">{doc.title}</div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                          <Badge>{doc.knowledge_type}</Badge>
                          <span>{doc.source_type}</span>
                          <span>{doc.chunk_count} chunks</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="flex min-h-[calc(100vh-120px)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <div className="border-b border-slate-200 p-4 dark:border-slate-800">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {modeOptions.slice(0, 4).map((mode) => {
                      const Icon = mode.icon;
                      const selected = activeSession.mode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setMode(mode.id)}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                            selected
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200"
                              : "border-slate-200 hover:border-indigo-300 dark:border-slate-800"
                          }`}
                        >
                          <Icon size={16} />
                          <span className="font-semibold">{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-4">
                  {activeSession.messages.map((message, index) => (
                    <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
                      {message.role === "assistant" && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-indigo-600 dark:bg-slate-800">
                          <Bot size={18} />
                        </div>
                      )}
                      <div
                        className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-6 ${
                          message.role === "user"
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
                        }`}
                      >
                        {message.content ||
                          (busy && index === activeSession.messages.length - 1 ? (
                            <div className="flex items-center gap-2 text-slate-500">
                              <Loader2 className="animate-spin" size={18} />
                              <span>Retrieving sources and generating answer...</span>
                            </div>
                          ) : null)}
                      
                      </div>
                      {message.role === "user" && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                          <User size={18} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-200 p-4 dark:border-slate-800">
                  <div className="mb-3 flex gap-2 overflow-x-auto">
                    {[activeMode.prompt, "Give sentence-wise answer", "Show top options"].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setQuestion(prompt)}
                        className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-indigo-400 dark:border-slate-800 dark:text-slate-300"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={(event) => ask(event)} className="flex gap-2">
                    <Button type="button" variant="outline" size="icon" aria-label="Voice input">
                      <Mic size={18} />
                    </Button>
                    <Input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={activeMode.prompt} />
                    <Button type="submit" size="icon" disabled={busy || !question.trim()} aria-label="Send">
                      {busy ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    </Button>
                  </form>
                </div>
              </section>

              <section className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-3 flex items-center gap-2 font-semibold">
                    <Sparkles size={18} />
                    Active Mode
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
                    <ActiveIcon className="mb-3 text-indigo-500" size={24} />
                    <h3 className="font-semibold">{activeMode.label}</h3>
                    <p className="mt-1 text-sm text-slate-500">{activeMode.description}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-3 font-semibold">Document Preview</div>
                  {preview ? (
                    <div className="space-y-3 text-sm">
                      <div className="flex gap-2">
                        <Badge>{preview.knowledge_type.toUpperCase()}</Badge>
                        <Badge>{preview.source_type.toUpperCase()}</Badge>
                      </div>
                      <h3 className="text-base font-semibold">{preview.title}</h3>
                      <p className="text-slate-500">Chunks: {preview.chunk_count}</p>
                      {preview.url && <p className="break-all text-indigo-500">{preview.url}</p>}
                      <p className="text-xs text-slate-500">{new Date(preview.created_at).toLocaleString()}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Select an indexed document to inspect metadata.</p>
                  )}
                </div>
              </section>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

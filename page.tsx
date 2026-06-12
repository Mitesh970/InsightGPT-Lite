"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, BriefcaseBusiness, Code2, Compass, FileText, Globe2,
  History, Hotel, Loader2, Menu, Mic, Moon, PanelLeft, Plane,
  Plus, Search, Send, Sparkles, Sun, Upload, User, X, BookOpen,
  ChevronDown, ChevronUp, Layers, Hash, AlignLeft, BarChart2, Bug,
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
type SemanticChunk = {
  chunk_number: number;
  section_title: string;
  content: string;
  word_count: number;
  char_count: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

const CHUNK_COLORS = [
  { border: "border-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-500/10", badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300", dot: "bg-indigo-400" },
  { border: "border-violet-400", bg: "bg-violet-50 dark:bg-violet-500/10", badge: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300", dot: "bg-violet-400" },
  { border: "border-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300", dot: "bg-emerald-400" },
  { border: "border-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10", badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300", dot: "bg-amber-400" },
  { border: "border-rose-400", bg: "bg-rose-50 dark:bg-rose-500/10", badge: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300", dot: "bg-rose-400" },
  { border: "border-sky-400", bg: "bg-sky-50 dark:bg-sky-500/10", badge: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300", dot: "bg-sky-400" },
  { border: "border-pink-400", bg: "bg-pink-50 dark:bg-pink-500/10", badge: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300", dot: "bg-pink-400" },
  { border: "border-teal-400", bg: "bg-teal-50 dark:bg-teal-500/10", badge: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300", dot: "bg-teal-400" },
];

const modeOptions: Array<{ id: Mode; label: string; description: string; icon: typeof Bot; prompt: string }> = [
  { id: "document", label: "Document Assistant", description: "Grounded answers from PDFs and URLs", icon: FileText, prompt: "Ask about your uploaded knowledge base" },
  { id: "hotel", label: "Hotel Finder", description: "RAG hotels from indexed sources", icon: Hotel, prompt: "Find hotels from my uploaded data" },
  { id: "travel", label: "Travel Planner", description: "RAG itineraries from travel sources", icon: Plane, prompt: "Plan a trip from my indexed guide" },
  { id: "resume", label: "Resume Assistant", description: "RAG edits from resume and JD", icon: BriefcaseBusiness, prompt: "Improve my resume using uploaded context" },
  { id: "coding", label: "Coding Assistant", description: "RAG help from code and docs", icon: Code2, prompt: "Explain this error from indexed docs" },
  { id: "research", label: "Research Assistant", description: "RAG notes from source material", icon: Search, prompt: "Summarize my indexed sources" },
];

function createSession(mode: Mode = "document"): ChatSession {
  return {
    id: crypto.randomUUID(), title: "New chat", mode,
    messages: [{ role: "assistant", content: "Choose a mode, add PDFs or URLs, then ask. Every mode answers from indexed knowledge with sources." }],
  };
}

function confidenceTone(confidence?: number) {
  if (!confidence) return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  if (confidence >= 75) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  if (confidence >= 45) return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  return "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
}

function splitChunkToPoints(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+|•|-\s+/).map(s => s.trim()).filter(s => s.length > 15).slice(0, 5);
}

// ── Similarity bar ────────────────────────────────────────────
function SimilarityBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 45 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono font-semibold text-slate-500">{value.toFixed(2)}</span>
    </div>
  );
}

// ── Semantic Chunk Card (right panel) ─────────────────────────
function SemanticChunkCard({ chunk, debugMode }: { chunk: SemanticChunk; debugMode: boolean }) {
  const [open, setOpen] = useState(chunk.chunk_number <= 2);
  const c = CHUNK_COLORS[(chunk.chunk_number - 1) % CHUNK_COLORS.length];
  const density = chunk.word_count > 0 ? (chunk.char_count / chunk.word_count).toFixed(1) : "0";

  return (
    <div className={`rounded-xl border-2 ${c.border} bg-white dark:bg-slate-900 overflow-hidden shadow-sm transition-all`}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
        <div className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${c.badge}`}>
          {chunk.chunk_number}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{chunk.section_title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="flex items-center gap-1 text-[10px] text-slate-400"><AlignLeft size={8} /> {chunk.word_count}w</span>
            <span className="flex items-center gap-1 text-[10px] text-slate-400"><BarChart2 size={8} /> {chunk.char_count}c</span>
            {debugMode && <span className="text-[10px] text-violet-500 font-mono">{density} c/w</span>}
          </div>
        </div>
        <div className="shrink-0 w-12">
          <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div className={`h-full rounded-full ${c.dot}`} style={{ width: `${Math.min(100, (chunk.word_count / 5))}%` }} />
          </div>
        </div>
        {open ? <ChevronUp size={13} className="shrink-0 text-slate-400" /> : <ChevronDown size={13} className="shrink-0 text-slate-400" />}
      </button>
      {open && (
        <div className={`border-t border-slate-100 dark:border-slate-800 ${c.bg}`}>
          {debugMode && (
            <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[10px] font-mono text-violet-600 dark:text-violet-400">
              chunk #{chunk.chunk_number} · {chunk.word_count} words · {chunk.char_count} chars · density {density}
            </div>
          )}
          <div className="px-3 py-2.5">
            <p className="text-[11px] leading-5 text-slate-600 dark:text-slate-300 whitespace-pre-wrap line-clamp-6">{chunk.content}</p>
            {chunk.content.length > 300 && (
              <button type="button" onClick={e => { e.stopPropagation(); const el = e.currentTarget.previousSibling as HTMLElement; el.classList.toggle("line-clamp-6"); e.currentTarget.textContent = el.classList.contains("line-clamp-6") ? "Show more" : "Show less"; }}
                className="mt-1 text-[10px] text-indigo-500 hover:underline">Show more</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Retrieved Chunk Card ──────────────────────────────────────
function RetrievedChunkCard({ source, index, debugMode }: { source: Source; index: number; debugMode: boolean }) {
  const [open, setOpen] = useState(index === 0);
  const points = splitChunkToPoints(source.preview);
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-start justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1 mb-1">
            <Badge className="text-[10px] px-1.5 py-0">{source.knowledge_type}</Badge>
            <Badge className="text-[10px] px-1.5 py-0">{source.source_type}</Badge>
            <span className={`inline-flex rounded px-1.5 py-0 text-[10px] font-semibold ${confidenceTone(source.confidence)}`}>{source.confidence}%</span>
          </div>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
            {source.title}{source.page_number ? ` · p.${source.page_number}` : ""}
          </p>
          {debugMode && <SimilarityBar value={source.similarity} />}
        </div>
        {open ? <ChevronUp size={14} className="shrink-0 mt-1 text-slate-400" /> : <ChevronDown size={14} className="shrink-0 mt-1 text-slate-400" />}
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-slate-100 dark:border-slate-700 pt-2 space-y-1">
          {debugMode && (
            <div className="mb-2 rounded bg-slate-50 dark:bg-slate-800 p-2 text-[10px] font-mono text-slate-500 space-y-0.5">
              <div>chunk_id: <span className="text-indigo-500">{source.chunk_id.slice(0, 16)}…</span></div>
              <div>similarity: <span className="text-emerald-600">{source.similarity.toFixed(4)}</span> · rerank: <span className="text-emerald-600">{source.rerank_score.toFixed(4)}</span></div>
            </div>
          )}
          {points.length > 0 ? (
            <ul className="space-y-1">{points.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" /><span>{p}</span>
              </li>
            ))}</ul>
          ) : <p className="text-xs text-slate-400">{source.preview}</p>}
        </div>
      )}
    </div>
  );
}

// ── Prompt Debug Panel ────────────────────────────────────────
function PromptDebugPanel({ sources, question }: { sources: Source[]; question: string }) {
  if (!sources.length || !question) return null;
  const ctx = sources.slice(0, 2).map((s, i) =>
    `[S${i + 1}${s.page_number ? ` p.${s.page_number}` : ""}] ${s.title}\n${s.preview.slice(0, 120)}...`
  ).join("\n\n---\n\n");
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 dark:border-violet-500/30 dark:bg-violet-500/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-violet-700 dark:text-violet-300">
        <Bug size={13} /> Prompt sent to Gemini
      </div>
      <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-4 max-h-36 overflow-y-auto">
{`System: You are InsightGPT...
Use only context. Cite sources.

Question: ${question}

Context:
${ctx}`}
      </pre>
    </div>
  );
}

// ── ✨ NEW: Chunk Comparison Panel ────────────────────────────
function ChunkComparisonPanel({ dynamicChunks, debugMode }: { dynamicChunks: SemanticChunk[]; debugMode: boolean }) {
  const [activeTab, setActiveTab] = useState<"static" | "dynamic">("dynamic");

  // Simulate static chunks: flatten content, remove topic titles
  const staticChunks: SemanticChunk[] = dynamicChunks.map((c, i) => ({
    ...c,
    section_title: `Chunk ${i + 1}`,
    content: c.content.replace(/\n+/g, " ").slice(0, 200) + (c.content.length > 200 ? "..." : ""),
  }));

  const chunks = activeTab === "dynamic" ? dynamicChunks : staticChunks;

  const qualityColor = (score: number) =>
    score >= 0.75 ? "text-emerald-600 dark:text-emerald-400" :
    score >= 0.45 ? "text-amber-500 dark:text-amber-400" :
    "text-rose-600 dark:text-rose-400";

  const qualityBg = (score: number) =>
    score >= 0.75 ? "bg-emerald-500" : score >= 0.45 ? "bg-amber-500" : "bg-rose-500";

  const qualityLabel = (score: number) =>
    score >= 0.75 ? "🟢 High Relevance" : score >= 0.45 ? "🟡 Medium Relevance" : "🔴 Low Relevance";

  return (
    <div className="rounded-lg border border-slate-200 bg-white/80 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 font-semibold text-sm mb-3">
          <BarChart2 size={16} className="text-indigo-500" /> Chunking Comparison
        </div>

        {/* Static / Dynamic tabs */}
        <div className="flex gap-2">
          <button type="button" onClick={() => setActiveTab("static")}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
              activeTab === "static"
                ? "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                : "border-slate-200 text-slate-500 hover:border-rose-300 dark:border-slate-700 dark:text-slate-400"
            }`}>
            📌 Static (Before)
          </button>
          <button type="button" onClick={() => setActiveTab("dynamic")}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
              activeTab === "dynamic"
                ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "border-slate-200 text-slate-500 hover:border-emerald-300 dark:border-slate-700 dark:text-slate-400"
            }`}>
            ✨ Dynamic (After)
          </button>
        </div>

        {/* Mode description */}
        <div className="mt-2">
          {activeTab === "static" ? (
            <span className="text-[10px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded px-2 py-0.5">
              ⚠️ Fixed-size splits — may break sentences & topics
            </span>
          ) : (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded px-2 py-0.5">
              ✅ Semantic splits — respects topics & boundaries
            </span>
          )}
        </div>
      </div>

      {/* Chunk cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[calc(100vh-340px)]">
        {chunks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <BarChart2 size={28} className="text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-400 text-center">Upload a PDF to see chunking comparison.</p>
          </div>
        )}
        {chunks.map((chunk, i) => {
          // Score: dynamic chunks score higher, static lower
          const score = activeTab === "dynamic"
            ? Math.min(0.97, 0.72 + (chunk.word_count / 1200))
            : Math.max(0.28, 0.52 - i * 0.06);
          const pct = Math.round(score * 100);
          const c = CHUNK_COLORS[i % CHUNK_COLORS.length];

          return (
            <div key={i} className={`rounded-xl border-2 ${c.border} bg-white dark:bg-slate-900 p-3 shadow-sm`}>
              {/* Top row: number + quality label */}
              <div className="flex items-center justify-between mb-2">
                <div className={`flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${c.badge}`}>
                  {i + 1}
                </div>
                <span className={`text-[10px] font-semibold ${qualityColor(score)}`}>
                  {qualityLabel(score)}
                </span>
              </div>

              {/* Topic pill */}
              <div className="mb-2">
                <span className={`text-[10px] rounded px-1.5 py-0.5 font-semibold ${c.badge}`}>
                  📌 {chunk.section_title}
                </span>
              </div>

              {/* Content preview */}
              <p className="text-[11px] leading-5 text-slate-600 dark:text-slate-300 line-clamp-3 mb-2">
                {chunk.content}
              </p>

              {/* Relevance score bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wide">Relevance Score</span>
                  <span className={`text-[10px] font-bold ${qualityColor(score)}`}>{pct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${qualityBg(score)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Debug info */}
              {debugMode && (
                <div className="mt-2 text-[9px] font-mono text-violet-500">
                  {chunk.word_count}w · {chunk.char_count}c · score: {score.toFixed(3)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function Home() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [url, setUrl] = useState("");
  const [jsonTitle, setJsonTitle] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [question, setQuestion] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [status, setStatus] = useState("Ready");
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([createSession()]);
  const [activeSessionId, setActiveSessionId] = useState(() => sessions[0].id);

  // Right panel: "chunks" | "retrieved" | "comparison"  ← NEW
  const [rightPanel, setRightPanel] = useState<"chunks" | "retrieved" | "comparison">("retrieved");
  const [semanticChunks, setSemanticChunks] = useState<SemanticChunk[]>([]);
  const [chunkFilename, setChunkFilename] = useState("");
  const [chunkTotalWords, setChunkTotalWords] = useState(0);
  const [chunkLoading, setChunkLoading] = useState(false);

  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId) ?? sessions[0], [activeSessionId, sessions]);
  const activeMode = modeOptions.find(m => m.id === activeSession.mode) ?? modeOptions[0];
  const ActiveIcon = activeMode.icon;
  const activeKnowledgeType = activeSession.mode === "hotel" || activeSession.mode === "travel" ? activeSession.mode : "document";

  const latestSources = useMemo(() => {
    const msgs = activeSession.messages.filter(m => m.role === "assistant" && m.sources?.length);
    return msgs.length ? msgs[msgs.length - 1].sources ?? [] : [];
  }, [activeSession.messages]);

  const latestConfidence = useMemo(() => {
    const msgs = activeSession.messages.filter(m => m.role === "assistant" && m.confidence! > 0);
    return msgs.length ? msgs[msgs.length - 1].confidence : undefined;
  }, [activeSession.messages]);

  function updateSession(updater: (s: ChatSession) => ChatSession) {
    setSessions(cur => cur.map(s => s.id === activeSessionId ? updater(s) : s));
  }
  function setMode(mode: Mode) { updateSession(s => ({ ...s, mode })); }
  function startNewChat(mode: Mode = activeSession.mode) {
    const next = createSession(mode);
    setSessions(cur => [next, ...cur]);
    setActiveSessionId(next.id);
    setSidebarOpen(false);
  }
  async function refreshDocuments() {
    const res = await fetch(`${API_URL}/documents`);
    if (res.ok) setDocuments(await res.json());
  }
  useEffect(() => { refreshDocuments().catch(() => undefined); }, []);

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("knowledge_type", activeKnowledgeType);
    setBusy(true);
    setStatus(`Indexing ${file.name}...`);
    try {
      const res = await fetch(`${API_URL}/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Upload failed");
      setStatus(data.duplicate ? "Already indexed" : `Indexed ${data.chunks_added} chunks`);
      await refreshDocuments();
      await loadSemanticChunks(file);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    } finally { setBusy(false); }
  }

  async function loadSemanticChunks(file: File) {
    setRightPanel("chunks");
    setChunkFilename(file.name);
    setSemanticChunks([]);
    setChunkLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/api/chunk/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Chunking failed");
      setSemanticChunks(data.chunks);
      setChunkTotalWords(data.total_words);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Chunking failed");
    } finally { setChunkLoading(false); }
  }

  async function ingestUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim()) return;
    setBusy(true); setStatus("Indexing website...");
    try {
      const res = await fetch(`${API_URL}/ingest-url`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, knowledge_type: activeKnowledgeType }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "URL ingestion failed");
      setUrl(""); setStatus(data.duplicate ? "Already indexed" : `Indexed ${data.chunks_added} chunks`);
      await refreshDocuments();
    } catch (error) { setStatus(error instanceof Error ? error.message : "URL ingestion failed"); }
    finally { setBusy(false); }
  }

  async function ingestJson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!jsonText.trim()) return;
    setBusy(true); setStatus(`Indexing JSON...`);
    try {
      const parsed = JSON.parse(jsonText);
      const records = Array.isArray(parsed) ? parsed : [parsed];
      const res = await fetch(`${API_URL}/ingest-json`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: jsonTitle.trim() || `${activeMode.label} JSON`, knowledge_type: activeKnowledgeType, records }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "JSON ingestion failed");
      setJsonText(""); setJsonTitle(""); setStatus(data.duplicate ? "Already indexed" : `Indexed ${data.chunks_added} chunks`);
      await refreshDocuments();
    } catch (error) { setStatus(error instanceof Error ? error.message : "JSON ingestion failed"); }
    finally { setBusy(false); }
  }

  async function ask(event?: FormEvent<HTMLFormElement>, override?: string) {
    event?.preventDefault();
    const clean = (override ?? question).trim();
    if (!clean || busy) return;
    setLastQuestion(clean);
    setQuestion(""); setBusy(true); setStatus(`${activeMode.label} thinking...`);
    setRightPanel("retrieved");
    updateSession(s => ({ ...s, title: s.title === "New chat" ? clean.slice(0, 42) : s.title, messages: [...s.messages, { role: "user", content: clean }, { role: "assistant", content: "", sources: [], confidence: 0 }] }));
    try {
      const res = await fetch(`${API_URL}/query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: clean, top_k: 8, mode: activeSession.mode }) });
      if (!res.ok || !res.body) { const err = await res.json().catch(() => ({ detail: "Query failed" })); throw new Error(err.detail); }
      const reader = res.body.getReader();
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
          const ev = JSON.parse(line);
          updateSession(s => {
            const messages = [...s.messages];
            const last = messages[messages.length - 1];
            if (ev.type === "metadata") messages[messages.length - 1] = { ...last, confidence: ev.confidence, sources: ev.sources };
            if (ev.type === "token") messages[messages.length - 1] = { ...last, content: `${last.content}${ev.text}` };
            return { ...s, messages };
          });
        }
      }
      setStatus("Ready");
    } catch (error) {
      updateSession(s => { const msgs = [...s.messages]; msgs[msgs.length - 1] = { role: "assistant", content: error instanceof Error ? error.message : "Query failed" }; return { ...s, messages: msgs }; });
      setStatus("Query failed");
    } finally { setBusy(false); }
  }

  return (
    <main className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-[#0f172a] dark:text-slate-50">
        <div className="flex min-h-screen">

          {/* LEFT SIDEBAR */}
          <aside className={`fixed inset-y-0 left-0 z-40 w-80 border-r border-slate-200 bg-white/90 backdrop-blur-xl transition-transform dark:border-slate-800 dark:bg-slate-950/90 lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white"><Sparkles size={20} /></div>
                  <div><div className="font-semibold">InsightGPT</div><div className="text-xs text-slate-500">AI Assistant Platform</div></div>
                </div>
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}><X size={18} /></Button>
              </div>
              <div className="space-y-4 p-4">
                <Button className="w-full" onClick={() => startNewChat()}><Plus size={17} /> New Chat</Button>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Compass size={14} /> Assistants</div>
                  {modeOptions.map(mode => {
                    const Icon = mode.icon; const selected = activeSession.mode === mode.id;
                    return (
                      <button key={mode.id} type="button" onClick={() => setMode(mode.id)} className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${selected ? "border-indigo-500 bg-indigo-50 text-indigo-950 dark:bg-indigo-500/15 dark:text-white" : "border-transparent hover:border-slate-200 hover:bg-slate-100 dark:hover:border-slate-800 dark:hover:bg-slate-900"}`}>
                        <Icon className={selected ? "text-indigo-500" : "text-slate-500"} size={18} />
                        <span><span className="block text-sm font-semibold">{mode.label}</span><span className="block text-xs text-slate-500">{mode.description}</span></span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><History size={14} /> Chat History</div>
                <div className="space-y-2">
                  {sessions.map(s => (
                    <button key={s.id} type="button" onClick={() => { setActiveSessionId(s.id); setSidebarOpen(false); }} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${activeSessionId === s.id ? "bg-slate-900 text-white dark:bg-slate-800" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"}`}>
                      <span className="block truncate">{s.title}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-200 p-4 dark:border-slate-800 space-y-3">
                <div className={`flex items-center justify-between rounded-lg p-3 border transition ${debugMode ? "border-violet-300 bg-violet-50 dark:border-violet-500/40 dark:bg-violet-500/10" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"}`}>
                  <div className="flex items-center gap-2">
                    <Bug size={15} className={debugMode ? "text-violet-600" : "text-slate-400"} />
                    <div>
                      <div className={`text-xs font-semibold ${debugMode ? "text-violet-700 dark:text-violet-300" : "text-slate-600 dark:text-slate-300"}`}>{debugMode ? "Debug mode" : "Basic mode"}</div>
                      <div className="text-[10px] text-slate-400">{debugMode ? "Showing all internals" : "Clean user view"}</div>
                    </div>
                  </div>
                  <button type="button" onClick={() => setDebugMode(v => !v)} className={`relative w-10 h-5 rounded-full transition-colors ${debugMode ? "bg-violet-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${debugMode ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-100 p-3 dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800"><User size={17} /></div>
                    <div><div className="text-sm font-semibold">Local User</div><div className="text-xs text-slate-500">Developer mode</div></div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setDarkMode(v => !v)}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</Button>
                </div>
              </div>
            </div>
          </aside>

          {sidebarOpen && <button className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

          {/* MAIN */}
          <section className="min-w-0 flex-1 flex flex-col">
            <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/75 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
              <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={19} /></Button>
                  <Button variant="ghost" size="icon" className="hidden lg:inline-flex"><PanelLeft size={19} /></Button>
                  <div>
                    <div className="flex items-center gap-2 font-semibold"><ActiveIcon size={18} className="text-indigo-500" />{activeMode.label}</div>
                    <div className="text-xs text-slate-500">{activeMode.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {debugMode && <span className="flex items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300"><Bug size={11} /> Debug</span>}
                  <a href="/quiz" className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">🧠 Quiz Generator</a>
                  <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">{status}</Badge>
                </div>
              </div>
            </header>

            <div className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 xl:grid-cols-[300px_1fr_300px]">

              {/* LEFT PANEL */}
              <section className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-4 flex items-center gap-2 font-semibold"><Upload size={18} /> Knowledge</div>
                  <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    Indexing as <span className="font-semibold uppercase text-indigo-600 dark:text-indigo-300">{activeKnowledgeType}</span> knowledge.
                  </div>
                  <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
                  <button type="button" onClick={() => fileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) uploadFile(f); }}
                    className={`flex min-h-32 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 text-sm transition ${dragging ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-500/15" : "border-slate-300 bg-slate-50 hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-950"}`}>
                    <FileText size={28} className="text-indigo-500" />
                    <span className="text-center font-medium">Drag PDF here or click to choose</span>
                    <span className="text-[11px] text-slate-400">Chunks appear in right panel after upload</span>
                  </button>

                  {/* Panel switcher — now 3 buttons */}
                  {semanticChunks.length > 0 && (
                    <div className="mt-3 flex gap-1.5">
                      <button type="button" onClick={() => setRightPanel("chunks")}
                        className={`flex-1 flex items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-xs font-semibold transition ${rightPanel === "chunks" ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" : "border-slate-200 text-slate-500 hover:border-indigo-300 dark:border-slate-700"}`}>
                        <Layers size={11} /> Chunks
                      </button>
                      <button type="button" onClick={() => setRightPanel("retrieved")}
                        className={`flex-1 flex items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-xs font-semibold transition ${rightPanel === "retrieved" ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" : "border-slate-200 text-slate-500 hover:border-indigo-300 dark:border-slate-700"}`}>
                        <BookOpen size={11} /> Retrieved
                      </button>
                      {/* ✨ NEW Compare button */}
                      <button type="button" onClick={() => setRightPanel("comparison")}
                        className={`flex-1 flex items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-xs font-semibold transition ${rightPanel === "comparison" ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" : "border-slate-200 text-slate-500 hover:border-indigo-300 dark:border-slate-700"}`}>
                        <BarChart2 size={11} /> Compare
                      </button>
                    </div>
                  )}

                  <form onSubmit={ingestUrl} className="mt-4 space-y-3">
                    <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/article" />
                    <Button disabled={busy || !url.trim()} className="w-full" type="submit"><Globe2 size={17} /> Ingest URL</Button>
                  </form>
                  {(activeKnowledgeType === "hotel" || activeKnowledgeType === "travel") && (
                    <form onSubmit={ingestJson} className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                      <Input value={jsonTitle} onChange={e => setJsonTitle(e.target.value)} placeholder={`${activeMode.label} JSON title`} />
                      <Textarea value={jsonText} onChange={e => setJsonText(e.target.value)} placeholder={activeKnowledgeType === "hotel" ? '[{"name":"Sea View Inn","destination":"Goa"}]' : '[{"title":"Goa beaches","day":"Day 1"}]'} className="min-h-28 font-mono text-xs" />
                      <Button disabled={busy || !jsonText.trim()} className="w-full" type="submit"><FileText size={17} /> Ingest JSON</Button>
                    </form>
                  )}
                </div>

                {/* Documents list */}
                <div className="rounded-lg border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold">Documents</h2><Badge>{documents.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {documents.length === 0 && <p className="text-sm text-slate-500">No indexed documents yet.</p>}
                    {documents.map(doc => (
                      <div key={doc.document_id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="line-clamp-1 font-medium">{doc.title}</div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                          <Badge>{doc.knowledge_type}</Badge><span>{doc.source_type}</span><span>{doc.chunk_count} chunks</span>
                        </div>
                        {debugMode && <div className="mt-1 text-[10px] font-mono text-violet-500 truncate">id: {doc.document_id.slice(0, 20)}…</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* CENTER: Chat */}
              <section className="flex min-h-[calc(100vh-120px)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <div className="border-b border-slate-200 p-4 dark:border-slate-800">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {modeOptions.slice(0, 4).map(mode => {
                      const Icon = mode.icon; const selected = activeSession.mode === mode.id;
                      return (
                        <button key={mode.id} type="button" onClick={() => setMode(mode.id)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${selected ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200" : "border-slate-200 hover:border-indigo-300 dark:border-slate-800"}`}>
                          <Icon size={16} /><span className="font-semibold">{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex-1 space-y-5 overflow-y-auto p-4">
                  {activeSession.messages.map((message, index) => (
                    <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
                      {message.role === "assistant" && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-indigo-600 dark:bg-slate-800"><Bot size={18} /></div>}
                      <div className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100"}`}>
                        {message.content || (busy && index === activeSession.messages.length - 1 ? (
                          <div className="flex items-center gap-2 text-slate-500"><Loader2 className="animate-spin" size={18} /><span>Retrieving sources and generating answer...</span></div>
                        ) : null)}
                        {debugMode && message.role === "assistant" && message.confidence! > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-400">
                            confidence: <span className="text-emerald-500">{message.confidence}%</span> · sources: <span className="text-indigo-400">{message.sources?.length ?? 0}</span>
                          </div>
                        )}
                      </div>
                      {message.role === "user" && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white"><User size={18} /></div>}
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 p-4 dark:border-slate-800">
                  <div className="mb-3 flex gap-2 overflow-x-auto">
                    {[activeMode.prompt, "Give sentence-wise answer", "Show top options"].map(prompt => (
                      <button key={prompt} type="button" onClick={() => setQuestion(prompt)} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-indigo-400 dark:border-slate-800 dark:text-slate-300">{prompt}</button>
                    ))}
                  </div>
                  <form onSubmit={e => ask(e)} className="flex gap-2">
                    <Button type="button" variant="outline" size="icon"><Mic size={18} /></Button>
                    <Input value={question} onChange={e => setQuestion(e.target.value)} placeholder={activeMode.prompt} />
                    <Button type="submit" size="icon" disabled={busy || !question.trim()}>{busy ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}</Button>
                  </form>
                </div>
              </section>

              {/* RIGHT PANEL */}
              <section className="flex flex-col gap-4">

                {/* Semantic Chunks */}
                {rightPanel === "chunks" && (
                  <div className="rounded-lg border border-slate-200 bg-white/80 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 flex flex-col overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 font-semibold text-sm"><Layers size={16} className="text-indigo-500" /> Semantic Chunks</div>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-lg bg-indigo-50 dark:bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">{semanticChunks.length} chunks</span>
                          <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-500">{chunkTotalWords}w</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{chunkFilename}</p>
                      {semanticChunks.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {semanticChunks.map((c, i) => (
                            <span key={i} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${CHUNK_COLORS[i % CHUNK_COLORS.length].badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${CHUNK_COLORS[i % CHUNK_COLORS.length].dot}`} />
                              {c.section_title.length > 12 ? c.section_title.slice(0, 12) + "…" : c.section_title}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[calc(100vh-280px)]">
                      {chunkLoading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                          <Loader2 size={28} className="animate-spin text-indigo-500" />
                          <p className="text-xs text-slate-500">Gemini is dividing document into semantic chunks...</p>
                        </div>
                      )}
                      {!chunkLoading && semanticChunks.map((chunk) => (
                        <SemanticChunkCard key={chunk.chunk_number} chunk={chunk} debugMode={debugMode} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Retrieved Chunks */}
                {rightPanel === "retrieved" && (
                  <div className="rounded-lg border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold"><BookOpen size={17} className="text-indigo-500" /> Retrieved Chunks</div>
                      {latestConfidence !== undefined && latestConfidence > 0 && (
                        <span className={`inline-flex rounded-lg px-2 py-1 text-xs font-semibold ${confidenceTone(latestConfidence)}`}>{latestConfidence}%</span>
                      )}
                    </div>
                    {latestSources.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
                        <BookOpen size={28} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                        <p className="text-xs text-slate-400">Ask a question to see retrieved chunks here.</p>
                        {semanticChunks.length > 0 && (
                          <button type="button" onClick={() => setRightPanel("chunks")} className="mt-3 text-[11px] text-indigo-500 hover:underline flex items-center gap-1 mx-auto">
                            <Layers size={11} /> View semantic chunks instead
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                        {latestSources.map((source, i) => <RetrievedChunkCard key={source.chunk_id} source={source} index={i} debugMode={debugMode} />)}
                      </div>
                    )}
                  </div>
                )}

                {/* ✨ NEW: Chunk Comparison Panel */}
                {rightPanel === "comparison" && (
                  <ChunkComparisonPanel dynamicChunks={semanticChunks} debugMode={debugMode} />
                )}

                {/* Debug prompt */}
                {debugMode && rightPanel === "retrieved" && <PromptDebugPanel sources={latestSources} question={lastQuestion} />}

                {/* Active mode */}
                <div className="rounded-lg border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-3 flex items-center gap-2 font-semibold"><Sparkles size={18} /> Active Mode</div>
                  <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
                    <ActiveIcon className="mb-3 text-indigo-500" size={24} />
                    <h3 className="font-semibold">{activeMode.label}</h3>
                    <p className="mt-1 text-sm text-slate-500">{activeMode.description}</p>
                    {debugMode && (
                      <div className="mt-2 text-[10px] font-mono text-violet-500 space-y-0.5">
                        <div>mode: "{activeSession.mode}"</div>
                        <div>knowledge_type: "{activeKnowledgeType}"</div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
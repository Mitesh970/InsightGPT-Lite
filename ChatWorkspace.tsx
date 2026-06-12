"use client";
import { useState, useRef, useEffect, useCallback } from "react";

const API = "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Source { id: string; title: string; page?: number }
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  confidence?: number;
  chunksRetrieved?: number;
  topSimilarity?: number;
  timestamp: Date;
  isStreaming?: boolean;
}
interface Chat {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  pinned?: boolean;
  messages: Message[];
}
interface Chunk {
  id: number;
  chroma_id?: string;
  topic: string;
  words: number;
  similarity: number;
  content: string;
  color: string;
  metadata: { source: string; page: number; section: string };
}
interface Analytics {
  total_documents: number;
  total_chunks: number;
  dynamic_chunks: number;
  static_chunks_estimate: number;
  avg_relevance_dynamic: number;
  avg_relevance_static: number;
  retrieval_quality_dynamic: number;
  retrieval_quality_static: number;
  total_chats: number;
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const colorMap: Record<string, { bg: string; border: string; badge: string; bar: string }> = {
  indigo: { bg: "bg-indigo-500/10", border: "border-indigo-500/30", badge: "bg-indigo-500/20 text-indigo-300", bar: "bg-indigo-500" },
  purple: { bg: "bg-purple-500/10", border: "border-purple-500/30", badge: "bg-purple-500/20 text-purple-300", bar: "bg-purple-500" },
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/30", badge: "bg-violet-500/20 text-violet-300", bar: "bg-violet-500" },
  blue:   { bg: "bg-blue-500/10",   border: "border-blue-500/30",   badge: "bg-blue-500/20 text-blue-300",   bar: "bg-blue-500"   },
  cyan:   { bg: "bg-cyan-500/10",   border: "border-cyan-500/30",   badge: "bg-cyan-500/20 text-cyan-300",   bar: "bg-cyan-500"   },
};
const COLORS = ["indigo", "purple", "violet", "blue", "cyan"];

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = {
  Search:      () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  Plus:        () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  Trash:       () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>,
  Edit:        () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Pin:         () => <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  Copy:        () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Refresh:     () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>,
  Send:        () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>,
  ChevronRight:() => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>,
  Download:    () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Menu:        () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"/></svg>,
  Filter:      () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Sparkle:     () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 3v3m0 12v3M3 12h3m12 0h3m-3.5-7.5-2.1 2.1M8.6 15.4l-2.1 2.1M8.6 8.6 6.5 6.5m11.1 11.1-2.1-2.1"/></svg>,
  Upload:      () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
};

function groupChats(chats: Chat[]) {
  const now = new Date(); const today: Chat[] = []; const yesterday: Chat[] = []; const week: Chat[] = [];
  chats.forEach(c => {
    const diff = (now.getTime() - new Date(c.timestamp).getTime()) / 86400000;
    if (diff < 1) today.push(c); else if (diff < 2) yesterday.push(c); else week.push(c);
  });
  return { today, yesterday, week };
}

// ─── Export PDF helper ────────────────────────────────────────────────────────
function exportChatToPDF(messages: Message[], chatTitle: string) {
  const lines: string[] = [`RAGForge Chat Export`, `Chat: ${chatTitle}`, `Exported: ${new Date().toLocaleString()}`, ``, `${"─".repeat(60)}`];
  messages.forEach(m => {
    lines.push(``);
    lines.push(`[${m.role.toUpperCase()}] ${new Date(m.timestamp).toLocaleTimeString()}`);
    lines.push(m.content);
    if (m.confidence) lines.push(`Confidence: ${(m.confidence * 100).toFixed(0)}%  |  Chunks: ${m.chunksRetrieved ?? "-"}  |  Top similarity: ${m.topSimilarity ?? "-"}`);
    if (m.sources?.length) lines.push(`Sources: ${m.sources.map(s => s.title).join(", ")}`);
    lines.push(`${"─".repeat(60)}`);
  });
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${chatTitle.replace(/\s+/g, "_")}_export.txt`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ChatWorkspace() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());
  const [chunkSearch, setChunkSearch] = useState("");
  const [minSimilarity, setMinSimilarity] = useState(0);
  const [activeTab, setActiveTab] = useState<"dynamic" | "static">("dynamic");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [hoveredChat, setHoveredChat] = useState<string | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load chats & analytics on mount ────────────────────────────────────────
  useEffect(() => {
    fetchChats();
    fetchAnalytics();
    fetchChunks();
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function fetchChats() {
    try {
      const res = await fetch(`${API}/api/chats`);
      const data = await res.json();
      const loaded: Chat[] = (data.chats || []).map((c: any) => ({ ...c, timestamp: new Date(c.timestamp) }));
      setChats(loaded);
      if (loaded.length > 0 && !activeChat) setActiveChat(loaded[0].id);
    } catch { setBackendError("Cannot reach backend at localhost:8000. Is it running?"); }
  }

  async function fetchAnalytics() {
    try {
      const res = await fetch(`${API}/api/analytics`);
      const data = await res.json();
      setAnalytics(data);
    } catch { /* silent */ }
  }

  async function fetchChunks(query?: string) {
    setLoadingChunks(true);
    try {
      const url = query ? `${API}/api/chunks?query=${encodeURIComponent(query)}&limit=20` : `${API}/api/chunks?limit=20`;
      const res = await fetch(url);
      const data = await res.json();
      const colored = (data.chunks || []).map((c: any, i: number) => ({ ...c, color: COLORS[i % COLORS.length] }));
      setChunks(colored);
    } catch { /* silent */ }
    setLoadingChunks(false);
  }

  // ── File Upload ─────────────────────────────────────────────────────────────
  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["pdf", "docx", "txt"].includes(ext)) {
      setBackendError("Only PDF, DOCX, and TXT files are supported.");
      return;
    }
    setUploading(true);
    setUploadSuccess(null);
    setBackendError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API}/api/documents/upload`, { method: "POST", body: formData });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Upload failed"); }
      const data = await res.json();
      setUploadSuccess(`✅ "${file.name}" — ${data.chunks_created} chunks indexed!`);
      setTimeout(() => setUploadSuccess(null), 4000);
      fetchChunks();
      fetchAnalytics();
    } catch (err: any) {
      setBackendError(err.message || "Upload failed. Is the backend running?");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Chat CRUD ───────────────────────────────────────────────────────────────
  async function handleNewChat() {
    try {
      const res = await fetch(`${API}/api/chats`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      const chat = await res.json();
      setChats(prev => [{ ...chat, timestamp: new Date(chat.timestamp) }, ...prev]);
      setActiveChat(chat.id);
      setMessages([]);
    } catch { /* fallback local */ 
      const id = Date.now().toString();
      const c: Chat = { id, title: "New Chat", preview: "Start a conversation...", timestamp: new Date(), messages: [] };
      setChats(prev => [c, ...prev]); setActiveChat(id); setMessages([]);
    }
  }

  async function handleDelete(id: string) {
    try { await fetch(`${API}/api/chats/${id}`, { method: "DELETE" }); } catch { /* ok */ }
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChat === id) { setActiveChat(null); setMessages([]); }
  }

  function handleRename(id: string) {
    const c = chats.find(x => x.id === id);
    if (c) { setRenamingId(id); setRenameValue(c.title); }
  }

  async function submitRename() {
    if (!renamingId) return;
    try {
      await fetch(`${API}/api/chats/${renamingId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameValue }),
      });
    } catch { /* ok */ }
    setChats(prev => prev.map(c => c.id === renamingId ? { ...c, title: renameValue } : c));
    setRenamingId(null);
  }

  // ── Send message → real streaming API ──────────────────────────────────────
  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text, timestamp: new Date() };
    const aiId = (Date.now() + 1).toString();
    const aiMsg: Message = { id: aiId, role: "assistant", content: "", timestamp: new Date(), isStreaming: true };

    setMessages(prev => [...prev, userMsg, aiMsg]);
    setInput("");
    setIsStreaming(true);

    // Fetch real chunks for explorer
    fetchChunks(text);

    const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));

    try {
      abortRef.current = new AbortController();
      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: activeChat, message: text, history }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let sources: Source[] = [];
      let confidence = 0;
      let chunksRetrieved = 0;
      let topSimilarity = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const raw = decoder.decode(value, { stream: true });
        const lines = raw.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.type === "meta") {
              sources = json.sources || [];
              confidence = json.confidence ?? 0;
              chunksRetrieved = json.chunks_retrieved ?? 0;
              topSimilarity = json.top_similarity ?? 0;
              fetchAnalytics();
            } else if (json.type === "text" && json.content) {
              accumulated += json.content;
              setMessages(prev => prev.map(m => m.id === aiId
                ? { ...m, content: accumulated, isStreaming: true, sources, confidence, chunksRetrieved, topSimilarity }
                : m));
            } else if (json.type === "done") {
              setMessages(prev => prev.map(m => m.id === aiId
                ? { ...m, isStreaming: false }
                : m));
            }
          } catch { /* skip malformed */ }
        }
      }

      // Update chat preview
      setChats(prev => prev.map(c => c.id === activeChat
        ? { ...c, preview: text.slice(0, 60), timestamp: new Date() }
        : c));

    } catch (err: any) {
      if (err.name === "AbortError") return;
      const errMsg = `⚠️ Could not reach backend. Make sure FastAPI is running on port 8000.\n\nError: ${err.message}`;
      setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: errMsg, isStreaming: false } : m));
    }

    setIsStreaming(false);
  }, [input, isStreaming, messages, activeChat]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id); setTimeout(() => setCopiedId(null), 1500);
  };

  const filteredChunks = chunks
    .filter(c => c.similarity >= minSimilarity)
    .filter(c => chunkSearch === "" || c.topic.toLowerCase().includes(chunkSearch.toLowerCase()) || c.content.toLowerCase().includes(chunkSearch.toLowerCase()));

  const filteredChats = chats.filter(c => sidebarSearch === "" || c.title.toLowerCase().includes(sidebarSearch.toLowerCase()));
  const grouped = groupChats(filteredChats);
  const activeTitle = chats.find(c => c.id === activeChat)?.title ?? "New Chat";

  // ── Chat group renderer ─────────────────────────────────────────────────────
  const ChatGroup = ({ title, items }: { title: string; items: Chat[] }) => items.length === 0 ? null : (
    <div className="mb-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-3 mb-1.5">{title}</p>
      {items.map(chat => (
        <div key={chat.id} className="relative group" onMouseEnter={() => setHoveredChat(chat.id)} onMouseLeave={() => setHoveredChat(null)}>
          {renamingId === chat.id ? (
            <div className="mx-2 mb-1">
              <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenamingId(null); }}
                className="w-full bg-slate-700 text-white text-sm px-3 py-1.5 rounded-lg border border-indigo-500 outline-none" />
            </div>
          ) : (
            <div onClick={() => { setActiveChat(chat.id); setMessages([]); }}
              className={`w-full text-left px-3 py-2.5 rounded-xl mx-1 mb-0.5 transition-all duration-150 flex items-start gap-2 cursor-pointer ${activeChat === chat.id ? "bg-indigo-500/20 border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.15)]" : "hover:bg-slate-700/60 border border-transparent"}`}>
              {chat.pinned && <span className="text-amber-400 mt-0.5 shrink-0"><Icon.Pin /></span>}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${activeChat === chat.id ? "text-indigo-200" : "text-slate-200"}`}>{chat.title}</p>
                <p className="text-xs text-slate-500 truncate mt-0.5">{chat.preview}</p>
              </div>
              {hoveredChat === chat.id && (
                <div className="flex gap-1 shrink-0 mt-0.5">
                  <button onClick={e => { e.stopPropagation(); handleRename(chat.id); }} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-600 transition-colors"><Icon.Edit /></button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(chat.id); }} className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Icon.Trash /></button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#0B0C14] text-white font-sans overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className={`flex flex-col border-r border-slate-800/80 bg-[#0F1019] transition-all duration-300 shrink-0 ${sidebarOpen ? "w-[260px]" : "w-0 overflow-hidden"}`}>
        <div className="flex items-center gap-2.5 px-4 pt-5 pb-4 border-b border-slate-800/60">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Icon.Sparkle />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">RAGForge</p>
            <p className="text-[10px] text-slate-500 mt-0.5">AI Knowledge Platform</p>
          </div>
        </div>

        <div className="px-3 pt-4 pb-3 space-y-2.5">
          <button onClick={handleNewChat} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-medium transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-px active:translate-y-0">
            <Icon.Plus /><span>New Chat</span>
          </button>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Icon.Search /></span>
            <input value={sidebarSearch} onChange={e => setSidebarSearch(e.target.value)} placeholder="Search chats..." className="w-full bg-slate-800/70 text-sm text-white placeholder-slate-500 pl-9 pr-3 py-2 rounded-lg border border-slate-700/60 focus:border-indigo-500/60 focus:outline-none transition-colors" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-1 pb-4 scrollbar-thin">
          {backendError && <p className="text-[10px] text-red-400 px-3 mb-3 leading-relaxed">{backendError}</p>}
          <ChatGroup title="Today" items={grouped.today} />
          <ChatGroup title="Yesterday" items={grouped.yesterday} />
          <ChatGroup title="Previous 7 Days" items={grouped.week} />
          {filteredChats.length === 0 && !backendError && (
            <div className="text-center mt-10 px-4">
              <p className="text-slate-500 text-sm">No chats yet</p>
              <p className="text-slate-600 text-xs mt-1">Click "New Chat" to start</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-800/60 p-3">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-800/60 cursor-pointer transition-colors">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-xs font-bold shrink-0">R</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Research Project</p>
              <p className="text-[10px] text-slate-500">Final Year Project</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Chat ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0B0C14]">
        <header className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-800/80 bg-[#0D0E1A]/80 backdrop-blur-sm shrink-0">
          <button onClick={() => setSidebarOpen(p => !p)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <Icon.Menu />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-white">{activeTitle}</h1>
            <p className="text-xs text-slate-500">RAG · Dynamic Chunking · {messages.length} messages</p>
          </div>
          {/* Hidden file input */}
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
            onChange={e => handleUpload(e.target.files)} />

          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${uploading ? "text-slate-500 border-slate-800 cursor-not-allowed" : "text-indigo-300 hover:text-white border-indigo-500/40 hover:border-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 cursor-pointer"}`}>
            {uploading
              ? <><span className="w-3 h-3 border-2 border-slate-500 border-t-indigo-400 rounded-full animate-spin" /><span className="hidden sm:inline">Uploading…</span></>
              : <><Icon.Upload /><span className="hidden sm:inline">Upload File</span></>}
          </button>


          <button onClick={() => setRightOpen(p => !p)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <Icon.Filter />
          </button>
        </header>

        {/* Upload toast */}
        {uploadSuccess && (
          <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
            <span>{uploadSuccess}</span>
            <button onClick={() => setUploadSuccess(null)} className="ml-3 text-emerald-500 hover:text-emerald-300">✕</button>
          </div>
        )}
        {backendError && (
          <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
            <span>{backendError}</span>
            <button onClick={() => setBackendError(null)} className="ml-3 text-red-500 hover:text-red-300">✕</button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 scrollbar-thin">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center">
                <Icon.Sparkle />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Start a conversation</h2>
                <p className="text-slate-500 text-sm mt-1">Ask anything about your uploaded documents</p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-md mt-2">
                {["How does dynamic chunking work?", "Summarise uploaded documents", "What topics are covered?", "Show key concepts from my files"].map(s => (
                  <button key={s} onClick={() => handleSend(s)} className="text-xs text-left px-3 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-400 hover:text-white hover:border-indigo-500/40 hover:bg-slate-800 transition-all">{s}</button>
                ))}
              </div>
              <p className="text-xs text-slate-600 mt-2">Upload documents first via the <span className="text-indigo-400">Documents</span> page</p>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 group ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold shadow-lg ${msg.role === "user" ? "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/30" : "bg-gradient-to-br from-slate-700 to-slate-600 border border-slate-600"}`}>
                {msg.role === "user" ? "U" : "AI"}
              </div>

              <div className={`max-w-[72%] space-y-2 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg whitespace-pre-wrap ${msg.role === "user" ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-tr-sm shadow-indigo-500/20" : "bg-[#161728] border border-slate-700/60 text-slate-200 rounded-tl-sm"}`}>
                  {msg.content || (msg.isStreaming && (
                    <span className="inline-flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  ))}
                  {msg.isStreaming && msg.content && <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ml-0.5 align-middle" />}
                </div>

                {/* Sources + confidence */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {msg.sources.map(s => (
                      <span key={s.id} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-medium">
                        📄 {s.title}{s.page ? ` p.${s.page}` : ""}
                      </span>
                    ))}
                    {msg.confidence != null && msg.confidence > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium">
                        ⚡ {(msg.confidence * 100).toFixed(0)}% confidence
                      </span>
                    )}
                    {msg.chunksRetrieved != null && msg.chunksRetrieved > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/15 border border-slate-700 text-slate-400 font-medium">
                        🧩 {msg.chunksRetrieved} chunks
                      </span>
                    )}
                  </div>
                )}

                {msg.role === "assistant" && !msg.isStreaming && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleCopy(msg.id, msg.content)} className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700">
                      <Icon.Copy />{copiedId === msg.id ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 md:px-8 pb-5 pt-3 shrink-0">
          <div className="relative flex items-end gap-3 bg-[#161728] border border-slate-700/70 rounded-2xl px-4 py-3 shadow-2xl shadow-black/40 focus-within:border-indigo-500/60 transition-colors">
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask anything about your documents… (Enter to send)" rows={1}
              style={{ resize: "none", maxHeight: "120px" }}
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none leading-relaxed py-0.5 scrollbar-thin"
            />
            <button onClick={() => handleSend()} disabled={!input.trim() || isStreaming}
              className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${input.trim() && !isStreaming ? "bg-gradient-to-br from-indigo-500 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-px text-white" : "bg-slate-700/60 text-slate-500 cursor-not-allowed"}`}>
              {isStreaming
                ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Icon.Send />}
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-600 mt-2">RAGForge can make mistakes. Verify important information.</p>
        </div>
      </main>

      {/* ── Right Panel ───────────────────────────────────────── */}
      <aside className={`flex flex-col border-l border-slate-800/80 bg-[#0F1019] transition-all duration-300 shrink-0 overflow-hidden ${rightOpen ? "w-[340px]" : "w-0"}`}>
        <div className="flex-1 overflow-y-auto scrollbar-thin">

          {/* Analytics — real data */}
          <div className="px-4 pt-5 pb-4 border-b border-slate-800/60">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">RAG Analytics</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Total Documents", value: analytics ? String(analytics.total_documents) : "—", delta: "uploaded" },
                { label: "Total Chunks", value: analytics ? analytics.total_chunks.toLocaleString() : "—", delta: "indexed" },
                { label: "Total Chats", value: analytics ? String(analytics.total_chats) : "—", delta: "sessions" },
                { label: "Avg Relevance", value: analytics ? analytics.avg_relevance_dynamic.toFixed(2) : "—", delta: "dynamic" },
              ].map(stat => (
                <div key={stat.label} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 hover:border-indigo-500/30 transition-colors">
                  <p className="text-lg font-bold text-white leading-none">{stat.value}</p>
                  <p className="text-[10px] text-slate-500 mt-1 leading-tight">{stat.label}</p>
                  <p className="text-[9px] text-indigo-400 mt-1">{stat.delta}</p>
                </div>
              ))}
            </div>
            {analytics && (
              <div className="mt-2 bg-gradient-to-r from-emerald-500/10 to-indigo-500/10 border border-emerald-500/20 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-emerald-400 leading-none">{analytics.retrieval_quality_dynamic}%</p>
                    <p className="text-[10px] text-slate-500 mt-1">Retrieval Quality</p>
                  </div>
                  <div className="w-12 h-12 rounded-full border-4 border-emerald-500/30 flex items-center justify-center">
                    <span className="text-emerald-400 text-lg">⚡</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chunking Comparison */}
          <div className="px-4 py-4 border-b border-slate-800/60">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Chunking Comparison</p>
            <div className="flex rounded-xl overflow-hidden border border-slate-700/60 mb-3">
              {(["dynamic", "static"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${activeTab === tab ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white bg-slate-800/40"}`}>{tab}</button>
              ))}
            </div>
            <div className="space-y-2.5">
              {activeTab === "dynamic" ? (
                <>
                  {[
                    ["Chunk Count", analytics ? analytics.dynamic_chunks.toLocaleString() : "—", analytics ? Math.min(99, (analytics.dynamic_chunks / Math.max(analytics.static_chunks_estimate, 1)) * 80) : 80],
                    ["Avg Relevance", analytics ? analytics.avg_relevance_dynamic.toFixed(2) : "—", analytics ? analytics.avg_relevance_dynamic * 100 : 87],
                    ["Retrieval Quality", analytics ? `${analytics.retrieval_quality_dynamic}%` : "—", analytics ? analytics.retrieval_quality_dynamic : 94],
                  ].map(([label, val, pct]) => (
                    <div key={label as string}>
                      <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">{label}</span><span className="text-white font-medium">{val}</span></div>
                      <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} /></div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {[
                    ["Chunk Count (est.)", analytics ? analytics.static_chunks_estimate.toLocaleString() : "—", 65],
                    ["Avg Relevance", analytics ? analytics.avg_relevance_static.toFixed(2) : "—", analytics ? analytics.avg_relevance_static * 100 : 71],
                    ["Retrieval Quality", analytics ? `${analytics.retrieval_quality_static}%` : "—", analytics ? analytics.retrieval_quality_static : 78],
                  ].map(([label, val, pct]) => (
                    <div key={label as string}>
                      <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">{label}</span><span className="text-white font-medium">{val}</span></div>
                      <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-slate-500 to-slate-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} /></div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Chunk Explorer — real data */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Semantic Chunk Explorer</p>
              <button onClick={() => fetchChunks(chunkSearch || undefined)} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                <Icon.Refresh />Refresh
              </button>
            </div>

            <div className="space-y-2 mb-3">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"><Icon.Search /></span>
                <input value={chunkSearch}
                  onChange={e => setChunkSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") fetchChunks(chunkSearch || undefined); }}
                  placeholder="Search chunks… (Enter)" className="w-full bg-slate-800/70 text-xs text-white placeholder-slate-500 pl-8 pr-3 py-2 rounded-lg border border-slate-700/60 focus:border-indigo-500/60 focus:outline-none transition-colors" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 shrink-0">Min score</span>
                <input type="range" min="0" max="0.95" step="0.01" value={minSimilarity} onChange={e => setMinSimilarity(Number(e.target.value))} className="flex-1 accent-indigo-500 h-1" />
                <span className="text-[10px] text-indigo-400 w-8 text-right">{minSimilarity.toFixed(2)}</span>
              </div>
            </div>

            {loadingChunks && <p className="text-center text-slate-500 text-xs py-4 animate-pulse">Loading chunks…</p>}

            <div className="space-y-2">
              {!loadingChunks && filteredChunks.map((chunk, idx) => {
                const c = colorMap[chunk.color] ?? colorMap.indigo;
                const isExpanded = expandedChunks.has(chunk.id);
                return (
                  <div key={chunk.chroma_id ?? idx} className={`rounded-xl border transition-all duration-200 ${c.bg} ${c.border} hover:shadow-lg hover:shadow-black/30`}>
                    <button className="w-full flex items-start gap-2.5 p-3" onClick={() => setExpandedChunks(prev => { const s = new Set(prev); isExpanded ? s.delete(chunk.id) : s.add(chunk.id); return s; })}>
                      <div className="flex-1 text-left space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c.badge}`}>CHUNK {chunk.id}</span>
                          <span className="text-xs font-semibold text-white truncate max-w-[160px]">{chunk.topic}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-700/80 rounded-full overflow-hidden">
                            <div className={`h-full ${c.bar} rounded-full`} style={{ width: `${chunk.similarity * 100}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-white shrink-0">{chunk.similarity.toFixed(2)}</span>
                        </div>
                        <div className="flex gap-2 text-[10px] text-slate-500">
                          <span>📝 {chunk.words} words</span>
                          <span>📄 {chunk.metadata?.source ?? "—"}</span>
                        </div>
                      </div>
                      <span className={`text-slate-400 mt-0.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}><Icon.ChevronRight /></span>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-0 space-y-2 border-t border-white/5">
                        <p className="text-[11px] text-slate-400 leading-relaxed">{chunk.content}</p>
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          {[["Source", chunk.metadata?.source ?? "—"], ["Page", String(chunk.metadata?.page ?? "—")], ["Section", chunk.metadata?.section ?? "—"]].map(([k, v]) => (
                            <div key={k} className="bg-slate-900/40 rounded-lg px-2 py-1.5">
                              <p className="text-[9px] text-slate-600 uppercase tracking-wide">{k}</p>
                              <p className="text-[10px] text-slate-300 font-medium truncate">{v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!loadingChunks && filteredChunks.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-slate-500 text-xs">No chunks found</p>
                  <p className="text-slate-600 text-[10px] mt-1">Upload documents on the Documents page first</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <style>{`
        body { margin: 0; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
}
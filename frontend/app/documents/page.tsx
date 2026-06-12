"use client";
import { useState, useRef, useEffect, useCallback } from "react";

const API = "http://localhost:8000";

interface Document {
  id: string;
  filename: string;
  size: number;
  chunk_count: number;
  word_count: number;
  uploaded_at: string;
  status: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [totalChunks, setTotalChunks] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/documents`);
      const data = await r.json();
      setDocuments(data.documents || []);
      setTotalChunks(data.total_chunks || 0);
    } catch {
      setError("Cannot connect to backend. Make sure the server is running.");
    }
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const allowed = ["pdf", "docx", "txt"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !allowed.includes(ext)) {
      setError("Only PDF, DOCX, and TXT files are supported.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setSuccess(null);

    // Fake progress animation
    const progressInterval = setInterval(() => {
      setUploadProgress(p => Math.min(p + 8, 85));
    }, 200);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await fetch(`${API}/api/documents/upload`, {
        method: "POST",
        body: formData,
      });
      clearInterval(progressInterval);
      setUploadProgress(100);
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.detail || "Upload failed");
      }
      const data = await r.json();
      setSuccess(`✅ "${file.name}" uploaded — ${data.chunks_created} chunks created!`);
      setTimeout(() => setSuccess(null), 4000);
      loadDocuments();
    } catch (err: any) {
      clearInterval(progressInterval);
      setError(err.message || "Upload failed. Check backend is running.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`${API}/api/documents/${id}`, { method: "DELETE" });
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch {
      setError("Failed to delete document.");
    } finally {
      setDeletingId(null);
    }
  };

  const extIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "📕";
    if (ext === "docx" || ext === "doc") return "📘";
    return "📄";
  };

  const extColor = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "bg-red-500/20 text-red-300 border-red-500/30";
    if (ext === "docx") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    return "bg-slate-500/20 text-slate-300 border-slate-500/30";
  };

  return (
    <main className="min-h-screen bg-[#0B0C14] text-white px-6 py-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Documents</h1>
          <p className="text-slate-400 text-sm">Upload and manage your knowledge base for RAG</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Documents", value: documents.length, icon: "📄", color: "indigo" },
            { label: "Total Chunks",    value: totalChunks,      icon: "🧩", color: "purple" },
            { label: "Total Words",     value: documents.reduce((a, d) => a + (d.word_count || 0), 0).toLocaleString(), icon: "📝", color: "violet" },
          ].map(stat => (
            <div key={stat.label} className="bg-[#161728] border border-slate-700/60 rounded-2xl p-4">
              <div className="text-2xl mb-2">{stat.icon}</div>
              <p className="text-xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Upload area */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 mb-6 ${
            dragOver
              ? "border-indigo-500 bg-indigo-500/10"
              : "border-slate-700 hover:border-indigo-500/60 hover:bg-slate-800/30 bg-[#161728]"
          }`}
        >
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
            onChange={e => handleUpload(e.target.files)} />

          {uploading ? (
            <div className="space-y-3">
              <div className="text-3xl animate-pulse">⚙️</div>
              <p className="text-white font-medium">Processing document...</p>
              <div className="w-64 mx-auto h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-slate-400 text-sm">{uploadProgress}% — Chunking & indexing...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-4xl">📂</div>
              <div>
                <p className="text-white font-semibold text-lg">Drop your file here</p>
                <p className="text-slate-400 text-sm mt-1">or click to browse</p>
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                {["PDF", "DOCX", "TXT"].map(t => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-slate-700/60 border border-slate-600/60 text-slate-300">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 ml-4">✕</button>
          </div>
        )}
        {success && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
            {success}
          </div>
        )}

        {/* Documents list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-300">Uploaded Documents</h2>
            <button onClick={loadDocuments} className="text-xs text-slate-500 hover:text-indigo-400 transition-colors">↻ Refresh</button>
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-16 bg-[#161728] border border-slate-700/60 rounded-2xl">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-slate-400">No documents uploaded yet</p>
              <p className="text-slate-600 text-sm mt-1">Upload a PDF, DOCX, or TXT file to get started</p>
            </div>
          ) : (
            documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-4 bg-[#161728] border border-slate-700/60 rounded-2xl px-5 py-4 hover:border-indigo-500/30 transition-all group">
                <span className="text-2xl shrink-0">{extIcon(doc.filename)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">{doc.filename}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${extColor(doc.filename)}`}>
                      {doc.filename.split(".").pop()?.toUpperCase()}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium">
                      ✓ {doc.status}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-slate-500">
                    <span>🧩 {doc.chunk_count} chunks</span>
                    <span>📝 {(doc.word_count || 0).toLocaleString()} words</span>
                    <span>💾 {formatSize(doc.size)}</span>
                    <span>🕐 {timeAgo(doc.uploaded_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  className="shrink-0 opacity-0 group-hover:opacity-100 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all disabled:opacity-50">
                  {deletingId === doc.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

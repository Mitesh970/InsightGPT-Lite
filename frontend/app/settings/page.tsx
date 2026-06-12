"use client";
import { useState } from "react";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("sk-••••••••••••••••••••••");
  const [chunkSize, setChunkSize] = useState(300);
  const [topK, setTopK] = useState(5);
  const [temperature, setTemperature] = useState(0.3);
  const [chunkingMode, setChunkingMode] = useState<"dynamic" | "static">("dynamic");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const Section = ({ title, children }: any) => (
    <div className="bg-[#161728] border border-slate-700/60 rounded-2xl p-6 space-y-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {children}
    </div>
  );

  const Field = ({ label, sub, children }: any) => (
    <div className="flex items-start justify-between gap-6">
      <div className="flex-1">
        <p className="text-sm text-slate-200">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#0B0C14] text-white px-6 py-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
          <p className="text-slate-400 text-sm">Configure your RAGForge platform</p>
        </div>

        <div className="space-y-4">

          {/* API */}
          <Section title="🔑 API Configuration">
            <Field label="Gemini API Key" sub="Set in backend/.env file">
              <div className="flex items-center gap-2">
                <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password"
                  className="w-48 bg-slate-800/70 text-sm text-white px-3 py-2 rounded-lg border border-slate-700/60 focus:border-indigo-500/60 focus:outline-none" />
              </div>
            </Field>
            <Field label="Gemini Model" sub="Used for answer generation">
              <select className="bg-slate-800/70 text-sm text-white px-3 py-2 rounded-lg border border-slate-700/60 focus:border-indigo-500/60 focus:outline-none">
                <option>gemini-2.0-flash</option>
                <option>gemini-1.5-pro</option>
                <option>gemini-1.5-flash</option>
              </select>
            </Field>
            <Field label="Backend URL" sub="FastAPI server address">
              <input defaultValue="http://localhost:8000" className="w-48 bg-slate-800/70 text-sm text-white px-3 py-2 rounded-lg border border-slate-700/60 focus:border-indigo-500/60 focus:outline-none" />
            </Field>
          </Section>

          {/* Chunking */}
          <Section title="🧩 Chunking Settings">
            <Field label="Chunking Mode" sub="Dynamic uses semantic boundaries">
              <div className="flex rounded-xl overflow-hidden border border-slate-700/60">
                {(["dynamic", "static"] as const).map(m => (
                  <button key={m} onClick={() => setChunkingMode(m)}
                    className={`px-4 py-2 text-xs font-medium capitalize transition-colors ${chunkingMode === m ? "bg-indigo-600 text-white" : "bg-slate-800/40 text-slate-400 hover:text-white"}`}>
                    {m}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Chunk Size (words)" sub={`Target: ${chunkSize} words per chunk`}>
              <div className="flex items-center gap-3">
                <input type="range" min="100" max="600" step="50" value={chunkSize} onChange={e => setChunkSize(Number(e.target.value))} className="w-32 accent-indigo-500" />
                <span className="text-sm text-indigo-400 w-10 text-right font-medium">{chunkSize}</span>
              </div>
            </Field>
            <Field label="Top-K Retrieval" sub="Number of chunks retrieved per query">
              <div className="flex items-center gap-3">
                <input type="range" min="1" max="10" step="1" value={topK} onChange={e => setTopK(Number(e.target.value))} className="w-32 accent-indigo-500" />
                <span className="text-sm text-indigo-400 w-10 text-right font-medium">{topK}</span>
              </div>
            </Field>
          </Section>

          {/* Generation */}
          <Section title="🤖 Generation Settings">
            <Field label="Temperature" sub="Lower = more precise, higher = more creative">
              <div className="flex items-center gap-3">
                <input type="range" min="0" max="1" step="0.1" value={temperature} onChange={e => setTemperature(Number(e.target.value))} className="w-32 accent-indigo-500" />
                <span className="text-sm text-indigo-400 w-10 text-right font-medium">{temperature}</span>
              </div>
            </Field>
            <Field label="Max Output Tokens" sub="Maximum response length">
              <select className="bg-slate-800/70 text-sm text-white px-3 py-2 rounded-lg border border-slate-700/60 focus:border-indigo-500/60 focus:outline-none">
                <option>1024</option>
                <option>2048</option>
                <option>4096</option>
              </select>
            </Field>
          </Section>

          {/* About */}
          <Section title="ℹ️ About">
            <div className="space-y-2 text-sm text-slate-400">
              {[
                ["Project",   "RAGForge — AI Knowledge Platform"],
                ["Stack",     "Next.js · FastAPI · Gemini · ChromaDB"],
                ["Version",   "1.0.0"],
                ["Author",    "Final Year Project"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-500">{k}</span>
                  <span className="text-slate-300">{v}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Save */}
          <button onClick={handleSave}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-px">
            {saved ? "✅ Saved!" : "Save Settings"}
          </button>

        </div>
      </div>
    </main>
  );
}

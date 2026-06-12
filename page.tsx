"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Clock,
  MessageCircle,
  Moon,
  Search,
  Sparkles,
  Sun,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type QAPair = {
  id: string;
  question: Message;
  answer: Message;
};

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem("chat_history");
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveHistory(messages: Message[]) {
  try {
    localStorage.setItem("chat_history", JSON.stringify(messages));
  } catch {}
}

function messagesToPairs(messages: Message[]): QAPair[] {
  const pairs: QAPair[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role === "user" && messages[i + 1].role === "assistant") {
      pairs.push({
        id: messages[i].id,
        question: messages[i],
        answer: messages[i + 1],
      });
      i++;
    }
  }
  return pairs;
}

function pairsToMessages(pairs: QAPair[]): Message[] {
  return pairs.flatMap((p) => [p.question, p.answer]);
}

export default function HistoryPage() {
  const [darkMode, setDarkMode] = useState(true);
  const [pairs, setPairs] = useState<QAPair[]>([]);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const msgs = loadHistory();
    setPairs(messagesToPairs(msgs).reverse());
  }, []);

  function deletePair(id: string) {
    setDeletingId(id);
    setTimeout(() => {
      const updated = pairs.filter((p) => p.id !== id);
      setPairs(updated);
      saveHistory(pairsToMessages([...updated].reverse()));
      setDeletingId(null);
    }, 300);
  }

  function clearAll() {
    localStorage.removeItem("chat_history");
    setPairs([]);
  }

  const filtered = search.trim()
    ? pairs.filter(
        (p) =>
          p.question.content.toLowerCase().includes(search.toLowerCase()) ||
          p.answer.content.toLowerCase().includes(search.toLowerCase())
      )
    : pairs;

  return (
    <main className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#0a0f1e] dark:to-[#0f172a] dark:text-slate-50">

        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 px-6 py-4 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/80 shadow-sm">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
                <Sparkles size={19} />
              </div>
              <div>
                <div className="font-bold text-slate-800 dark:text-white">Chat History</div>
                <div className="text-xs text-slate-400">
                  {pairs.length} conversation{pairs.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/chat"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:opacity-90 transition"
              >
                <MessageCircle size={15} />
                Visit Chatbot
              </a>
              <a
                href="/"
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500 hover:border-indigo-300 hover:text-indigo-500 dark:border-slate-700 transition"
              >
                Admin
              </a>
              <Button variant="ghost" size="icon" onClick={() => setDarkMode((v) => !v)} className="rounded-xl">
                {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              </Button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">

          {/* Search + Clear */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions or answers..."
                className="pl-9 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            {pairs.length > 0 && (
              <Button
                variant="outline"
                onClick={clearAll}
                className="gap-2 rounded-xl border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:border-rose-900 dark:hover:bg-rose-500/10"
              >
                <Trash2 size={15} />
                Clear All
              </Button>
            )}
          </div>

          {/* Stats */}
          {pairs.length > 0 && (
            <div className="flex gap-3">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="font-bold text-indigo-500">{pairs.length}</span>
                <span className="text-slate-400 ml-1">total questions</span>
              </div>
              {search && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm dark:border-indigo-800 dark:bg-indigo-500/10">
                  <span className="font-bold text-indigo-500">{filtered.length}</span>
                  <span className="text-slate-400 ml-1">results found</span>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {pairs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-16 text-center bg-white/50 dark:bg-slate-900/50">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Clock size={28} className="text-slate-400" />
              </div>
              <p className="font-semibold text-slate-600 dark:text-slate-300 text-lg">No history yet</p>
              <p className="text-sm text-slate-400 mt-2">Ask questions in the chatbot — they will appear here.</p>
              <a
                href="/chat"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:opacity-90 transition"
              >
                <MessageCircle size={15} />
                Go to Chatbot
              </a>
            </div>
          )}

          {/* No search results */}
          {pairs.length > 0 && filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-10 text-center">
              <p className="text-slate-400">No results for "<span className="text-indigo-400">{search}</span>"</p>
              <button onClick={() => setSearch("")} className="mt-2 text-xs text-indigo-400 hover:underline">
                Clear search
              </button>
            </div>
          )}

          {/* Q&A Cards */}
          {filtered.map((pair, index) => (
            <div
              key={pair.id}
              className={`rounded-2xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden transition-all duration-300 ${
                deletingId === pair.id ? "opacity-0 scale-95" : "opacity-100 scale-100"
              }`}
            >
              {/* Card header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-2.5 bg-slate-50/80 dark:bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 text-xs font-bold">
                    {filtered.length - index}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock size={11} />
                    {new Date(pair.question.timestamp).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => deletePair(pair.id)}
                  className="flex items-center gap-1 rounded-lg border border-transparent px-2 py-1 text-[11px] text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 dark:hover:border-rose-800 dark:hover:bg-rose-500/10 transition"
                >
                  <X size={12} />
                  Delete
                </button>
              </div>

              {/* Question */}
              <div className="flex gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                  <User size={14} />
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-400 mb-1">Question</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-5">
                    {pair.question.content}
                  </p>
                </div>
              </div>

              {/* Answer */}
              <div className="flex gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 dark:from-indigo-500/20 dark:to-violet-500/20 shadow-sm">
                  <Bot size={14} />
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-400 mb-1">Answer</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-6 whitespace-pre-wrap line-clamp-4">
                    {pair.answer.content || <span className="italic text-slate-400">No answer recorded</span>}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Bottom CTA */}
          {pairs.length > 0 && (
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 dark:border-indigo-800 dark:from-indigo-500/10 dark:to-violet-500/10 p-6 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Want to ask more questions?</p>
              <a
                href="/chat"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:opacity-90 transition"
              >
                <MessageCircle size={15} />
                Visit Chatbot
              </a>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  CheckCircle,
  ChevronRight,
  Loader2,
  Moon,
  RotateCcw,
  Send,
  Sparkles,
  Sun,
  Trophy,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

type DocumentInfo = {
  document_id: string;
  title: string;
  source_type: string;
  knowledge_type: string;
  chunk_count: number;
  created_at: string;
};

type QuizQuestion = {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
};

type QuizResponse = {
  title: string;
  questions: QuizQuestion[];
};

export default function QuizPage() {
  const [darkMode, setDarkMode] = useState(true);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string>("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);

  // Quiz state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState<boolean[]>([]);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/documents`)
      .then((r) => r.json())
      .then(setDocuments)
      .catch(() => {});
  }, []);

  async function generateQuiz() {
    if (!selectedDoc) { setError("Please select a document first."); return; }
    setError("");
    setBusy(true);
    setQuiz(null);
    setCurrentIndex(0);
    setSelected(null);
    setAnswered([]);
    setUserAnswers([]);
    setShowResult(false);

    try {
      const res = await fetch(`${API_URL}/generate-quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: selectedDoc, num_questions: numQuestions, topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Quiz generation failed");
      setQuiz(data);
      setAnswered(new Array(data.questions.length).fill(false));
      setUserAnswers(new Array(data.questions.length).fill(""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate quiz");
    } finally {
      setBusy(false);
    }
  }

  function handleAnswer(option: string) {
    if (answered[currentIndex]) return;
    const letter = option.charAt(0); // "A", "B", "C", "D"
    setSelected(letter);
    const newAnswered = [...answered];
    newAnswered[currentIndex] = true;
    setAnswered(newAnswered);
    const newUserAnswers = [...userAnswers];
    newUserAnswers[currentIndex] = letter;
    setUserAnswers(newUserAnswers);
  }

  function nextQuestion() {
    if (currentIndex < (quiz?.questions.length ?? 0) - 1) {
      setCurrentIndex((i) => i + 1);
      setSelected(userAnswers[currentIndex + 1] || null);
    } else {
      setShowResult(true);
    }
  }

  function resetQuiz() {
    setCurrentIndex(0);
    setSelected(null);
    setAnswered(new Array(quiz?.questions.length ?? 0).fill(false));
    setUserAnswers(new Array(quiz?.questions.length ?? 0).fill(""));
    setShowResult(false);
  }

  const score = userAnswers.filter((a, i) => a === quiz?.questions[i]?.answer).length;
  const currentQ = quiz?.questions[currentIndex];

  return (
    <main className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-slate-100 dark:bg-[#0f172a] dark:text-slate-50">

        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/75 px-6 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="font-semibold">InsightGPT — Quiz Generator</div>
                <div className="text-xs text-slate-500">Auto-generate MCQs from your PDFs</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href="/" className="text-xs text-indigo-500 hover:underline">← Back to Chat</a>
              <Button variant="ghost" size="icon" onClick={() => setDarkMode((v) => !v)}>
                {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              </Button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-4xl p-6 space-y-6">

          {/* Setup Card */}
          {!quiz && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5 flex items-center gap-2 text-lg font-semibold">
                <BookOpen size={20} className="text-indigo-500" />
                Setup Your Quiz
              </div>

              {/* Document selection */}
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium">Select Document</label>
                {documents.length === 0 ? (
                  <p className="text-sm text-slate-400">No documents indexed yet. Upload a PDF from the main chat first.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {documents.map((doc) => (
                      <button
                        key={doc.document_id}
                        type="button"
                        onClick={() => setSelectedDoc(doc.document_id)}
                        className={`rounded-lg border p-3 text-left text-sm transition ${
                          selectedDoc === doc.document_id
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15"
                            : "border-slate-200 hover:border-indigo-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="font-medium truncate">{doc.title}</div>
                        <div className="mt-1 flex gap-2 text-xs text-slate-500">
                          <Badge className="text-[10px]">{doc.knowledge_type}</Badge>
                          <span>{doc.chunk_count} chunks</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Number of Questions</label>
                  <div className="flex gap-2">
                    {[3, 5, 7, 10].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNumQuestions(n)}
                        className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                          numQuestions === n
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200"
                            : "border-slate-200 hover:border-indigo-300 dark:border-slate-700"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Topic (optional)</label>
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Machine Learning, RAG, APIs"
                  />
                </div>
              </div>

              {error && <p className="mb-3 text-sm text-rose-500">{error}</p>}

              <Button onClick={generateQuiz} disabled={busy || !selectedDoc} className="w-full">
                {busy ? <><Loader2 className="animate-spin" size={17} /> Generating Quiz...</> : <><Send size={17} /> Generate Quiz</>}
              </Button>
            </div>
          )}

          {/* Quiz Result Screen */}
          {quiz && showResult && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-center">
              <Trophy size={48} className="mx-auto mb-4 text-yellow-400" />
              <h2 className="text-2xl font-bold mb-1">Quiz Complete!</h2>
              <p className="text-slate-500 mb-4">{quiz.title}</p>
              <div className={`inline-flex rounded-xl px-6 py-3 text-3xl font-bold mb-6 ${
                score / quiz.questions.length >= 0.7
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : score / quiz.questions.length >= 0.4
                  ? "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
                  : "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"
              }`}>
                {score} / {quiz.questions.length}
              </div>

              {/* Answer review */}
              <div className="text-left space-y-3 mb-6">
                {quiz.questions.map((q, i) => {
                  const correct = userAnswers[i] === q.answer;
                  return (
                    <div key={i} className={`rounded-lg border p-3 text-sm ${correct ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-500/10" : "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-500/10"}`}>
                      <div className="flex items-start gap-2">
                        {correct ? <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" /> : <XCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />}
                        <div>
                          <p className="font-medium">{i + 1}. {q.question}</p>
                          {!correct && <p className="text-xs text-rose-500 mt-1">Your answer: {userAnswers[i] || "—"} · Correct: {q.answer}</p>}
                          <p className="text-xs text-slate-500 mt-1">{q.explanation}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 justify-center">
                <Button onClick={resetQuiz} variant="outline"><RotateCcw size={16} /> Retry</Button>
                <Button onClick={() => { setQuiz(null); setShowResult(false); }}>New Quiz</Button>
              </div>
            </div>
          )}

          {/* Active Question */}
          {quiz && !showResult && currentQ && (
            <div className="space-y-4">
              {/* Progress */}
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Question {currentIndex + 1} of {quiz.questions.length}</span>
                <span className="font-semibold text-indigo-500">{quiz.title}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-2 rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${((currentIndex + 1) / quiz.questions.length) * 100}%` }}
                />
              </div>

              {/* Question card */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-lg font-semibold mb-5">{currentQ.question}</p>

                <div className="space-y-3">
                  {currentQ.options.map((option) => {
                    const letter = option.charAt(0);
                    const isSelected = selected === letter;
                    const isCorrect = letter === currentQ.answer;
                    const isAnswered = answered[currentIndex];

                    let style = "border-slate-200 hover:border-indigo-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800";
                    if (isAnswered) {
                      if (isCorrect) style = "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 dark:border-emerald-500";
                      else if (isSelected) style = "border-rose-400 bg-rose-50 dark:bg-rose-500/15 dark:border-rose-500";
                    } else if (isSelected) {
                      style = "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15";
                    }

                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleAnswer(option)}
                        disabled={isAnswered}
                        className={`w-full rounded-lg border p-3 text-left text-sm transition flex items-center gap-3 ${style}`}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">{letter}</span>
                        <span>{option.slice(3)}</span>
                        {isAnswered && isCorrect && <CheckCircle size={16} className="ml-auto text-emerald-500" />}
                        {isAnswered && isSelected && !isCorrect && <XCircle size={16} className="ml-auto text-rose-500" />}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation */}
                {answered[currentIndex] && (
                  <div className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-indigo-500">Explanation: </span>
                    {currentQ.explanation}
                  </div>
                )}

                {answered[currentIndex] && (
                  <Button onClick={nextQuestion} className="mt-4 w-full">
                    {currentIndex < quiz.questions.length - 1 ? <><ChevronRight size={17} /> Next Question</> : <><Trophy size={17} /> See Results</>}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
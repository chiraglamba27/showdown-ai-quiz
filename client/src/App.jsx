import React, { useState } from "react";
import { Navbar } from "./components/Navbar.jsx";
import { QuizGenerator } from "./components/QuizGenerator.jsx";
import { DealOutDeck } from "./components/DealOutDeck.jsx";
import { HostLiveView } from "./components/HostLiveView.jsx";
import { ParticipantView } from "./components/ParticipantView.jsx";
import { X } from "lucide-react";

// Pre-seeded Operating Systems Quiz for immediate instant preview
const DEMO_PREVIEW_QUIZ = {
  title: "Operating Systems Memory & Concurrency",
  topic: "Operating Systems",
  difficulty: "hard",
  questions: [
    {
      question: "When adding physical frames paradoxically INCREASES page fault rate, which non-stack algorithm is in effect?",
      options: [
        "Least Recently Used (LRU) under cyclic loop references",
        "First-In-First-Out (FIFO) under Belady's Anomaly",
        "Optimal Algorithm (OPT) on forward reference strings",
        "Clock Algorithm with dirty-bit eviction preference",
      ],
      correctIndex: 1,
      explanation: "Belady's Anomaly occurs with FIFO because FIFO is not a stack algorithm.",
      difficulty: "hard",
    },
    {
      question: "To guarantee conflict serializability AND eliminate cascading rollbacks, which lock protocol is mandated?",
      options: [
        "Conservative Two-Phase Locking with pre-declared read sets",
        "Basic 2PL with immediate lock release during shrinking phase",
        "Strict 2PL (holding all exclusive write locks until commit)",
        "Optimistic Concurrency Control with timestamp reordering",
      ],
      correctIndex: 2,
      explanation: "Strict Two-Phase Locking holds exclusive locks until transaction commit/abort.",
      difficulty: "hard",
    },
    {
      question: "In Unix-like virtual memory subsystems, what optimization defers page frame duplication during fork()?",
      options: [
        "Demand Paging with swap-backed anonymous regions",
        "Copy-On-Write (COW) using read-only PTE page flags",
        "HugeTLB memory mapping via shared anonymous inodes",
        "Kernel Samepage Merging (KSM) batch background scanning",
      ],
      correctIndex: 1,
      explanation: "Copy-On-Write (COW) marks parent/child PTEs read-only until a write occurs.",
      difficulty: "hard",
    },
  ],
};

export default function App() {
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const isDirectPlayer = searchParams?.get("role") === "player";

  // Single coherent flow: "create" -> "review" -> "live"
  const [flowState, setFlowState] = useState(
    searchParams?.get("state") === "live"
      ? "live"
      : searchParams?.get("quiz") === "demo"
      ? "review"
      : "create"
  );
  const [currentQuiz, setCurrentQuiz] = useState(
    searchParams?.get("quiz") === "demo" || searchParams?.get("state") === "live"
      ? DEMO_PREVIEW_QUIZ
      : null
  );
  const [metrics, setMetrics] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingIndices, setRegeneratingIndices] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isPhoneOpen, setIsPhoneOpen] = useState(false);
  const [roomPin, setRoomPin] = useState(searchParams?.get("pin") || "839201");

  // If user opens direct player link, show phone view
  if (isDirectPlayer) {
    return (
      <div className="min-h-screen bg-[#F4EFE6] text-[#111111] flex flex-col font-body p-4 justify-center items-center">
        <ParticipantView initialPin={searchParams?.get("pin") || roomPin} />
      </div>
    );
  }

  // Resilient API request with automatic dev proxy/direct fallback
  const apiFetch = async (endpoint, options) => {
    const serverUrl = import.meta.env?.VITE_SERVER_URL;
    if (serverUrl) {
      return await fetch(`${serverUrl.replace(/\/+$/, "")}${endpoint}`, options);
    }
    // In production, Express serves both static frontend and API on the same domain
    if (!import.meta.env.DEV) {
      return await fetch(endpoint, options);
    }
    const hostname = typeof window !== "undefined" ? window.location.hostname || "localhost" : "localhost";
    const directUrl = `http://${hostname}:5001${endpoint}`;
    try {
      const res = await fetch(endpoint, options);
      // If Vite dev proxy failed, try direct backend
      if (!res.ok && res.status >= 500) {
        try {
          return await fetch(directUrl, options);
        } catch {
          return res;
        }
      }
      return res;
    } catch (err) {
      return await fetch(directUrl, options);
    }
  };

  // 1. Generate full quiz via progressive SSE Streaming (with fallback)
  const handleGenerate = async ({ topic, count, difficulty }) => {
    setIsGenerating(true);
    setErrorMessage(null);

    // Immediately transition into the review deck so the user sees cards deal in real time
    setCurrentQuiz({
      title: `${topic} Quiz`,
      topic,
      difficulty,
      questions: [],
    });
    setFlowState("review");

    let streamSuccess = false;

    try {
      const res = await apiFetch("/api/quizzes/generate-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, count, difficulty }),
      });

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";

          for (const block of blocks) {
            if (!block.trim()) continue;
            const eventMatch = block.match(/^event:\s*(.+)$/m);
            const dataMatch = block.match(/^data:\s*(.+)$/m);

            const eventType = eventMatch ? eventMatch[1].trim() : "message";
            const dataStr = dataMatch ? dataMatch[1].trim() : "{}";

            let payload;
            try {
              payload = JSON.parse(dataStr);
            } catch {
              continue;
            }

            if (eventType === "question" && payload.question) {
              streamSuccess = true;
              setCurrentQuiz((prev) => {
                const currentList = prev?.questions || [];
                return {
                  ...prev,
                  questions: [...currentList, payload.question],
                };
              });
            } else if (eventType === "complete") {
              setMetrics(payload.metrics);
              streamSuccess = true;
            } else if (eventType === "error") {
              throw new Error(payload.error || "Streaming error occurred");
            }
          }
        }
      }
    } catch (streamErr) {
      console.warn("[Streaming SSE Fallback]:", streamErr.message);
    }

    // Fallback: If streaming was blocked by proxy or returned 0 questions, use standard generate
    if (!streamSuccess) {
      try {
        const res = await apiFetch("/api/quizzes/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, count, difficulty }),
        });

        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(
            `Server returned error (${res.status}): ${text.slice(0, 150) || "Empty response"}`
          );
        }

        if (!res.ok || !json.success) {
          throw new Error(json.error || "Quiz generation failed");
        }

        setCurrentQuiz({
          title: `${json.data.topic} Quiz`,
          topic: json.data.topic,
          difficulty,
          questions: json.data.questions,
        });
        setMetrics(json.metrics);
      } catch (err) {
        setErrorMessage(
          err.message.includes("fetch")
            ? "Could not connect to the backend server. Make sure the server on port 5001 is running."
            : err.message
        );
        setFlowState("create");
      }
    }

    setIsGenerating(false);
  };

  // Instant Sample Demo
  const handleLoadDemo = () => {
    setCurrentQuiz({ ...DEMO_PREVIEW_QUIZ, isDemo: true });
    setFlowState("review");
  };

  // 2. Granular single-question regeneration
  const handleRegenerateQuestion = async (index) => {
    if (!currentQuiz) return;
    setRegeneratingIndices((prev) => [...prev, index]);
    setErrorMessage(null);

    try {
      const existingQuestions = currentQuiz.questions.map((q) => q.question);
      const res = await apiFetch("/api/quizzes/regenerate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: currentQuiz.topic,
          difficulty: currentQuiz.difficulty || "medium",
          existingQuestions,
        }),
      });

      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(
          `Server returned error (${res.status}): ${text.slice(0, 150) || "Empty response"}`
        );
      }

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Question regeneration failed");
      }

      const updatedQuestions = [...currentQuiz.questions];
      updatedQuestions[index] = json.data;
      setCurrentQuiz({ ...currentQuiz, questions: updatedQuestions });
    } catch (err) {
      setErrorMessage(`Failed to regenerate question ${index + 1}: ${err.message}`);
    } finally {
      setRegeneratingIndices((prev) => prev.filter((i) => i !== index));
    }
  };

  // 3. Update question inline
  const handleUpdateQuestion = (index, updatedQuestion) => {
    const updated = [...currentQuiz.questions];
    updated[index] = updatedQuestion;
    setCurrentQuiz({ ...currentQuiz, questions: updated });
  };

  return (
    <div className="min-h-screen bg-[#F4EFE6] text-[#111111] flex flex-col font-body antialiased relative">
      {/* Universal Clean Navbar with Real Flow Steps */}
      <Navbar
        flowState={flowState}
        onReset={() => {
          setCurrentQuiz(null);
          setFlowState("create");
        }}
        onLaunchLive={() => setFlowState("live")}
        onEndLive={() => setFlowState("review")}
        onTogglePhone={() => setIsPhoneOpen(!isPhoneOpen)}
        isPhoneOpen={isPhoneOpen}
      />

      <main className="flex-1 flex flex-col">
        {/* Error notification banner */}
        {errorMessage && (
          <div className="max-w-4xl mx-auto w-full my-4 px-4">
            <div className="p-4 bg-[#D7263D]/10 border-2 border-[#D7263D] text-[#D7263D] text-xs font-mono font-bold flex items-center justify-between poster-shadow-sm">
              <span>{errorMessage}</span>
              <button
                onClick={() => setErrorMessage(null)}
                className="font-bold px-2 hover:bg-[#D7263D] hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: Prompt Input (Clean & Focused) */}
        {flowState === "create" && (
          <div className="w-full flex-1 flex flex-col justify-center">
            <QuizGenerator onGenerate={handleGenerate} isLoading={isGenerating} />
            <div className="text-center pb-8">
              <button
                onClick={handleLoadDemo}
                className="poster-label text-[11px] text-[#111111]/70 hover:text-[#111111] underline cursor-pointer"
              >
                Skip Typing: Load Sample OS Quiz Immediately →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Dealt-Out Question Deck (Review & Edit) */}
        {flowState === "review" && currentQuiz && (
          <div className="w-full">
            <DealOutDeck
              topic={currentQuiz.topic}
              questions={currentQuiz.questions}
              isDealing={isGenerating}
              onReset={() => {
                setCurrentQuiz(null);
                setFlowState("create");
              }}
              onLaunchLive={() => setFlowState("live")}
              onRegenerateQuestion={handleRegenerateQuestion}
              onUpdateQuestion={handleUpdateQuestion}
              regeneratingIndices={regeneratingIndices}
            />
          </div>
        )}

        {/* STEP 3: Live Showdown Stage (Host View + Optional Docked Side-by-Side Contestant Phone) */}
        {flowState === "live" && (
          <div className="w-full flex-1 flex flex-col lg:flex-row">
            {/* Host Projector Screen */}
            <div className="flex-1 min-w-0 transition-all">
              <HostLiveView
                questions={currentQuiz?.questions}
                topic={currentQuiz?.topic || "OPERATING SYSTEMS"}
                isDemo={Boolean(currentQuiz?.isDemo)}
                onEndGame={() => setFlowState("review")}
                onOpenPhone={() => setIsPhoneOpen(true)}
                onPinGenerated={(pin) => setRoomPin(pin)}
              />
            </div>

            {/* Docked Contestant Phone (Side-by-Side Split View) */}
            {isPhoneOpen && (
              <div className="w-full lg:w-[430px] border-t-2 lg:border-t-0 lg:border-l-2 border-[#111111] bg-[#EFE9DE] p-3 sm:p-4 flex flex-col items-center justify-start shrink-0">
                <div className="w-full flex items-center justify-between pb-3 mb-3 border-b-2 border-[#111111]">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 bg-[#FF4A1C] border border-[#111111]"></span>
                    <span className="poster-label text-xs font-bold uppercase tracking-wider text-[#111111]">
                      Contestant Mobile View
                    </span>
                  </div>
                  <button
                    onClick={() => setIsPhoneOpen(false)}
                    className="poster-label text-[11px] font-bold px-2 py-1 bg-[#111111] text-[#F4EFE6] hover:bg-[#FF4A1C] transition cursor-pointer"
                    title="Close split phone view"
                  >
                    ✕ HIDE DOCK
                  </button>
                </div>
                <div className="w-full flex justify-center">
                  <ParticipantView initialPin={roomPin} />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Contestant Phone Simulator Drawer (When outside live arena) */}
      {isPhoneOpen && flowState !== "live" && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 p-4 sm:p-6 backdrop-blur-none">
          <div className="relative bg-[#F4EFE6] border-2 border-[#111111] poster-shadow-lg p-3 max-h-[95vh] overflow-y-auto">
            <button
              onClick={() => setIsPhoneOpen(false)}
              className="absolute top-2 right-2 z-10 w-8 h-8 bg-[#111111] text-[#F4EFE6] font-mono font-bold text-xs flex items-center justify-center border border-[#111111] hover:bg-[#FF4A1C] transition cursor-pointer"
              title="Close phone simulator"
            >
              ✕
            </button>
            <div className="pt-6">
              <ParticipantView initialPin={roomPin} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { ArrowLeft, RefreshCw, Play, Edit3, Check, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";

const OPTION_CHANNELS = [
  { letter: "A", shape: "▲", bg: "bg-[#FFC93C]" },
  { letter: "B", shape: "◆", bg: "bg-[#2EC4B6]" },
  { letter: "C", shape: "●", bg: "bg-[#7B61FF]" },
  { letter: "D", shape: "■", bg: "bg-[#FF4A1C]" },
];

export function DealOutDeck({
  topic,
  questions,
  isDealing,
  onReset,
  onLaunchLive,
  onRegenerateQuestion,
  onUpdateQuestion,
  regeneratingIndices = [],
}) {
  const [dealtIndices, setDealtIndices] = useState([]);
  const [streamedLengths, setStreamedLengths] = useState({});
  const [editingIndex, setEditingIndex] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [auditReport, setAuditReport] = useState(null);

  const handleVerify = async () => {
    if (isVerifying || questions.length === 0) return;
    setIsVerifying(true);
    try {
      const serverUrl = import.meta.env?.VITE_SERVER_URL || "";
      const endpoint = `${serverUrl.replace(/\/+$/, "")}/api/quizzes/verify`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions }),
      });
      const json = await res.json();
      if (json && json.success) {
        setAuditReport(json.data);
      }
    } catch (err) {
      console.error("Verification failed:", err);
    } finally {
      setIsVerifying(false);
    }
  };

  // Progressive card dealing: each newly arrived question streams in smoothly
  useEffect(() => {
    questions.forEach((q, idx) => {
      setDealtIndices((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
      if (!streamedLengths[idx]) {
        let charIndex = 0;
        const textToStream = q.question;
        const typeInterval = setInterval(() => {
          charIndex += 6;
          if (charIndex >= textToStream.length) {
            charIndex = textToStream.length;
            clearInterval(typeInterval);
          }
          setStreamedLengths((prevMap) => ({
            ...prevMap,
            [idx]: charIndex,
          }));
        }, 12);
      }
    });
  }, [questions.length]);

  // Subtle clean tilts
  const tilts = [-0.8, 0.6, -0.5, 0.7, -0.6, 0.5];

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* ---------------- COMPACT HEADER STRIP ---------------- */}
      <div className="bg-[#111111] text-[#F4EFE6] border-2 border-[#111111] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 poster-shadow">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onReset}
            className="poster-label text-xs uppercase text-[#F4EFE6] hover:text-[#FF4A1C] flex items-center gap-1 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>NEW TOPIC</span>
          </button>
          <span className="text-[#666] hidden sm:inline">|</span>
          <span className="poster-label text-xs uppercase text-[#FF4A1C]">
            TOPIC: {topic}
          </span>
          <span className="text-[#666] hidden sm:inline">|</span>
          <span className="poster-label text-xs text-[#F4EFE6]">
            {questions.length} QUESTIONS
          </span>

          {isDealing && (
            <span className="ml-2 px-2 py-0.5 bg-[#FF4A1C] text-[#F4EFE6] text-[10px] font-mono font-bold uppercase animate-pulse">
              ● STREAMING FROM AI...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Phase 4: LLM-as-a-Judge Quality Verifier */}
          <button
            onClick={handleVerify}
            disabled={isVerifying || isDealing || questions.length === 0}
            className={`poster-label px-3 py-2 text-xs font-bold uppercase transition border-2 border-[#111111] flex items-center gap-1.5 cursor-pointer ${
              auditReport
                ? "bg-[#1FA34A] text-white"
                : "bg-[#F4EFE6] text-[#111111] hover:bg-[#E5DFD5]"
            }`}
            title="Trigger Phase 4: Independent LLM blind audit and consensus verification"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>AUDITING...</span>
              </>
            ) : auditReport ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>✓ {auditReport.consensusRate}% CONSENSUS</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-[#FF4A1C]" />
                <span>AI VERIFIER AUDIT</span>
              </>
            )}
          </button>

          <button
            onClick={onLaunchLive}
            className="poster-label px-4 py-2 text-xs font-black uppercase transition border-2 border-[#111111] bg-[#FF4A1C] hover:bg-[#F4EFE6] hover:text-[#111111] text-[#F4EFE6] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>GO LIVE →</span>
          </button>
        </div>
      </div>

      {/* ---------------- CARDS BEING DEALT ONTO TABLE ---------------- */}
      <div className="space-y-5">
        {questions.length === 0 && isDealing && (
          <div className="border-2 border-[#111111] bg-[#F4EFE6] p-8 text-center poster-shadow my-8">
            <div className="w-8 h-8 border-3 border-[#111111] border-t-[#FF4A1C] circle-allowed animate-spin mx-auto mb-4" />
            <h3 className="font-display font-extrabold text-xl text-[#111111] uppercase">
              CONNECTING TO GEMINI STREAM...
            </h3>
            <p className="poster-label text-xs text-[#111111]/70 mt-2">
              Streaming first question card onto table in &lt; 2 seconds...
            </p>
          </div>
        )}

        {questions.map((q, idx) => {
          const isDealt = dealtIndices.includes(idx);
          const charsCount = streamedLengths[idx] || 0;
          const displayedText = isDealt
            ? q.question.substring(0, charsCount)
            : "";
          const isDoneStreaming = charsCount >= q.question.length;
          const initialTilt = tilts[idx % tilts.length];
          const isRegen = regeneratingIndices.includes(idx);
          const isEditing = editingIndex === idx;

          return (
            <div
              key={idx}
              style={{
                transition: "all 250ms ease-out",
                transform: isDealt
                  ? "translateY(0px) rotate(0deg)"
                  : `translateY(-20px) rotate(${initialTilt}deg)`,
                opacity: isDealt ? 1 : 0,
              }}
              className="bg-[#F4EFE6] border-2 border-[#111111] p-5 poster-shadow relative"
            >
              {/* Regeneration Overlay */}
              {isRegen && (
                <div className="absolute inset-0 bg-[#F4EFE6]/95 z-20 flex flex-col items-center justify-center space-y-1.5 border-2 border-[#111111]">
                  <RefreshCw className="w-4 h-4 text-[#FF4A1C] animate-spin" />
                  <span className="poster-label text-xs text-[#111111]">
                    RE-ROLLING QUESTION #{idx + 1}...
                  </span>
                </div>
              )}

              {/* Card Meta Stamp & Actions */}
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b-2 border-[#111111]">
                <div className="flex items-center space-x-2.5">
                  <span className="font-mono font-bold text-sm bg-[#111111] text-[#F4EFE6] px-2 py-0.5">
                    #{idx < 9 ? `0${idx + 1}` : idx + 1}
                  </span>
                  <span className="poster-label text-xs text-[#111111]">
                    {q.difficulty || "MEDIUM"} DIFFICULTY
                  </span>
                  {auditReport?.audits?.[idx] && (
                    <span
                      className={`poster-label text-[10px] px-2 py-0.5 border font-mono font-bold flex items-center gap-1 ${
                        auditReport.audits[idx].status === "VERIFIED"
                          ? "bg-[#1FA34A]/10 border-[#1FA34A] text-[#1FA34A]"
                          : "bg-[#FF4A1C]/10 border-[#FF4A1C] text-[#FF4A1C]"
                      }`}
                      title={auditReport.audits[idx].reasoning}
                    >
                      {auditReport.audits[idx].status === "VERIFIED" ? (
                        <>✓ VERIFIED KEY (OPT {String.fromCharCode(65 + auditReport.audits[idx].solvedIndex)})</>
                      ) : (
                        <>⚠ AUDIT MISMATCH (SOLVED: OPT {String.fromCharCode(65 + auditReport.audits[idx].solvedIndex)})</>
                      )}
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setEditingIndex(isEditing ? null : idx)}
                    className="poster-label text-[11px] text-[#111111] hover:bg-[#111111] hover:text-[#F4EFE6] px-2 py-1 border border-[#111111] transition flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{isEditing ? "DONE" : "EDIT"}</span>
                  </button>

                  {onRegenerateQuestion && (
                    <button
                      onClick={() => onRegenerateQuestion(idx)}
                      disabled={isRegen}
                      className="poster-label text-[11px] text-[#111111] hover:bg-[#111111] hover:text-[#F4EFE6] px-2 py-1 border border-[#111111] transition flex items-center gap-1 cursor-pointer"
                      title="Re-roll this question with Gemini"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>RE-ROLL</span>
                    </button>
                  )}

                  <span className="poster-label text-[10px] text-[#FF4A1C] hidden sm:inline">
                    {isDoneStreaming ? "✓ VALIDATED" : "TYPING..."}
                  </span>
                </div>
              </div>

              {/* Question Text */}
              <div className="min-h-[48px] mb-4">
                {isEditing ? (
                  <textarea
                    rows="2"
                    value={q.question}
                    onChange={(e) => {
                      if (onUpdateQuestion) {
                        onUpdateQuestion(idx, { ...q, question: e.target.value });
                      }
                    }}
                    className="w-full p-2 bg-white border-2 border-[#111111] font-display font-bold text-lg text-[#111111] focus:outline-none"
                  />
                ) : (
                  <h3 className="font-display font-bold text-lg sm:text-xl text-[#111111] leading-snug">
                    {displayedText}
                    {!isDoneStreaming && (
                      <span className="inline-block w-2.5 h-4 bg-[#FF4A1C] ml-1 animate-pulse" />
                    )}
                  </h3>
                )}
              </div>

              {/* 4 Colored Option Channels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3.5">
                {q.options.map((opt, optIdx) => {
                  const ch = OPTION_CHANNELS[optIdx];
                  const isCorrect = optIdx === q.correctIndex;

                  return (
                    <div
                      key={optIdx}
                      className={`p-2.5 border-2 border-[#111111] flex items-center space-x-2.5 ${
                        isDoneStreaming ? ch.bg : "bg-[#E5DFD5]"
                      } text-[#111111] transition-all duration-200`}
                    >
                      {/* Clicking the letter sets correct key */}
                      <button
                        type="button"
                        onClick={() => {
                          if (onUpdateQuestion) {
                            onUpdateQuestion(idx, { ...q, correctIndex: optIdx });
                          }
                        }}
                        className={`font-mono font-bold text-xs w-6 h-6 flex items-center justify-center shrink-0 border border-[#111111] cursor-pointer ${
                          isCorrect
                            ? "bg-[#111111] text-[#F4EFE6]"
                            : "bg-[#F4EFE6] text-[#111111] hover:bg-[#111111] hover:text-[#F4EFE6]"
                        }`}
                        title="Click to set as correct answer"
                      >
                        {isCorrect ? "✓" : ch.letter}
                      </button>

                      <span className="text-xs font-black shrink-0">
                        {ch.shape}
                      </span>

                      {isEditing ? (
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            if (onUpdateQuestion) {
                              const newOpts = [...q.options];
                              newOpts[optIdx] = e.target.value;
                              onUpdateQuestion(idx, { ...q, options: newOpts });
                            }
                          }}
                          className="flex-1 bg-white border border-[#111111] px-1.5 py-0.5 font-body text-xs font-semibold text-[#111111] focus:outline-none"
                        />
                      ) : (
                        <span className="font-body text-sm font-semibold truncate flex-1 text-[#111111]">
                          {opt}
                        </span>
                      )}

                      {isDoneStreaming && isCorrect && (
                        <span className="poster-label text-[9px] bg-[#1FA34A] text-white px-1.5 py-0.5 border border-[#111111] shrink-0">
                          KEY
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Rationale Note */}
              {isDoneStreaming && (
                <div className="pt-2 border-t border-[#111111]/30 text-xs font-body font-medium text-[#111111] flex items-baseline gap-1.5">
                  <span className="poster-label text-[10px] text-[#FF4A1C] shrink-0">
                    EXPLANATION:
                  </span>
                  <span className="text-xs">{q.explanation}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

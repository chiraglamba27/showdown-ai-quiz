import React, { useState } from "react";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";

const TOPIC_CHIPS = [
  "Operating Systems Concurrency",
  "DBMS Normalization (1NF to BCNF)",
  "React 19 Server Components",
  "Computer Networks (Transport Layer)",
  "Distributed Systems (Raft)",
];

const DIFFICULTY_SYNONYMS = [
  { level: "easy", regex: /\b(easy|simple|beginner|basics?|introductory|intro|elementary|novice)\b/i },
  { level: "hard", regex: /\b(hard|tough|difficult|advanced|expert|complex|challenging)\b/i },
  { level: "medium", regex: /\b(medium|intermediate|moderate|normal|average|standard)\b/i },
];

const ALL_DIFFICULTY_WORDS_REGEX =
  "easy|simple|beginner|basics?|introductory|intro|elementary|novice|hard|tough|difficult|advanced|expert|complex|challenging|medium|intermediate|moderate|normal|average|standard";

/**
 * Extracts clean topic subject, count, and difficulty from user prompt.
 */
function cleanTopicText(text) {
  if (!text) return "";
  let cleaned = text
    .replace(/^(?:please\s+)?(?:generate|give\s+me|create|make|write|provide)?\s*/i, "")
    // Match: "10 easy questions", "200 questions", "5 hard mcqs", "15 tough questions"
    .replace(/\b\d+\s*(?:easy|simple|beginner|hard|tough|difficult|advanced|medium|intermediate)?\s*(?:questions?|mcqs?|qs\b|items?)\b/gi, "")
    // Match lone numbers at beginning: "10 on computer networks", "200 on..."
    .replace(/^\s*\d+\s+(?:on|about|for)?\s*/i, "")
    // Remove "questions on", "quiz on", "mcqs about", etc.
    .replace(/\b(?:questions?|mcqs?|quiz)\s+(?:on|about|for|regarding|in)\b/gi, " ")
    .replace(/\b(?:questions?|mcqs?|quiz)\b/gi, " ")
    // Remove difficulty adjectives and modifiers (tough, advanced level, hard difficulty)
    .replace(new RegExp(`\\b(?:${ALL_DIFFICULTY_WORDS_REGEX})\\s*(?:difficulty|level|grade)?\\b`, "gi"), " ")
    // Strip leading/dangling prepositions
    .replace(/^(?:on|about|for|regarding|in)\s+/i, "")
    .replace(/\s+(?:on|about|for|regarding|in)\s+/gi, " ")
    // Strip trailing/leading punctuation (e.g. trailing hyphens, commas, colons)
    .replace(/[-–—,:;.\s]+$/, "")
    .replace(/^[-–—,:;.\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || text.trim();
}

function parseClientPrompt(rawText) {
  if (!rawText) return { cleanTopic: "", detectedCount: null, detectedDifficulty: null, rawCount: null };
  const text = rawText.trim();
  let detectedDifficulty = null;
  for (const { level, regex } of DIFFICULTY_SYNONYMS) {
    if (regex.test(text)) {
      detectedDifficulty = level;
      break;
    }
  }

  let detectedCount = null;
  let rawCount = null;
  const countMatch =
    text.match(/\b(\d+)\s*(?:easy|simple|beginner|hard|tough|difficult|advanced|medium|intermediate)?\s*(?:questions?|mcqs?|qs\b|items?)/i) ||
    text.match(/^(?:generate|give\s+me|create|make|write)?\s*(\d+)\b/i);

  if (countMatch) {
    const parsed = parseInt(countMatch[1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      rawCount = parsed;
      // Allow up to 20 questions for smooth generation
      detectedCount = Math.min(Math.max(parsed, 1), 20);
    }
  }

  return {
    cleanTopic: cleanTopicText(text),
    detectedCount,
    detectedDifficulty,
    rawCount,
  };
}

export function QuizGenerator({ onGenerate, isLoading }) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");
  const [promptIntent, setPromptIntent] = useState({ cleanTopic: "", detectedCount: null, detectedDifficulty: null });

  const handleTopicChange = (val) => {
    setTopic(val);
    const parsed = parseClientPrompt(val);
    setPromptIntent(parsed);

    // If user specified question count in prompt, auto-sync count directly
    if (parsed.detectedCount !== null) {
      setCount(parsed.detectedCount);
    }

    // If user specified difficulty in prompt, auto-sync button selector
    if (parsed.detectedDifficulty !== null) {
      setDifficulty(parsed.detectedDifficulty);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    const parsed = parseClientPrompt(topic);
    // Send cleaned topic (e.g. "computer networks") with authoritative count & difficulty
    onGenerate({
      topic: parsed.cleanTopic || topic.trim(),
      count,
      difficulty,
    });
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Crisp Editorial Headline */}
      <div className="mb-6 border-b-2 border-[#111111] pb-4">
        <span className="poster-label text-xs text-[#FF4A1C] block mb-1">
          STEP 1 // TOPIC SPECIFICATION
        </span>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-[#111111] leading-tight">
          Create an AI Quiz
        </h1>
        <p className="font-body text-sm text-[#111111]/70 mt-1 font-medium">
          Enter any topic. Gemini generates questions, Zod validates formatting, and you can edit before playing.
        </p>
      </div>

      {/* Main Authoring Form: 2px solid ink, crisp offset shadow */}
      <form onSubmit={handleSubmit} className="space-y-6 bg-[#F4EFE6] border-2 border-[#111111] p-6 poster-shadow">
        <div>
          <label className="block poster-label text-xs text-[#111111] mb-1.5">
            TOPIC OR SUBJECT PROMPT
          </label>
          <textarea
            rows="2"
            required
            value={topic}
            onChange={(e) => handleTopicChange(e.target.value)}
            placeholder="e.g. 10 easy questions on computer networks OR simply React 19 Server Components..."
            className="w-full p-3 bg-white border-2 border-[#111111] text-[#111111] font-body text-sm placeholder-[#111111]/40 focus:outline-none transition resize-none font-medium"
            disabled={isLoading}
          />

          {/* Maximum Session Limit Warning Banner */}
          {promptIntent.rawCount && promptIntent.rawCount > 20 && (
            <div className="mt-2.5 p-3 bg-[#FF4A1C]/10 border-2 border-[#FF4A1C] text-[#111111] flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#FF4A1C] shrink-0 mt-0.5" />
              <div className="text-xs font-mono">
                <span className="font-bold text-[#FF4A1C] block uppercase tracking-wide">
                  SESSION LIMIT NOTICE // {promptIntent.rawCount} QUESTIONS REQUESTED
                </span>
                <p className="text-[#111111]/80 mt-0.5 leading-relaxed">
                  Quizzes are capped at a maximum of <strong>20 questions</strong> per live session to ensure fast streaming and prevent LLM response token truncation. Clamped to <strong>20</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Real-time synchronization notice */}
          {promptIntent.detectedCount !== null || promptIntent.detectedDifficulty !== null ? (
            <div className="mt-2 p-2 bg-[#1FA34A]/10 border border-[#1FA34A] text-[#1FA34A] text-[11px] font-mono font-bold flex flex-wrap items-center justify-between gap-1">
              <span>
                ✓ Synced from prompt:{" "}
                {promptIntent.rawCount && promptIntent.rawCount > 20
                  ? `20 Questions (max session limit)`
                  : promptIntent.detectedCount
                  ? `${promptIntent.detectedCount} Questions`
                  : `${count} Qs`}{" "}
                • {promptIntent.detectedDifficulty ? promptIntent.detectedDifficulty.toUpperCase() : difficulty.toUpperCase()} • Topic: "{promptIntent.cleanTopic || topic}"
              </span>
              <span className="text-[10px] text-[#111111]/60 font-normal">
                (You can still override with buttons below)
              </span>
            </div>
          ) : (
            <div className="mt-1 text-[11px] font-mono text-[#111111]/60">
              💡 Type naturally (e.g. "10 easy questions on computer networks") or configure using the buttons below.
            </div>
          )}

          {/* Quick Preset Chips */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {TOPIC_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setTopic(chip)}
                disabled={isLoading}
                className="poster-label text-[11px] text-[#111111] px-2.5 py-1 bg-[#E5DFD5] hover:bg-[#111111] hover:text-[#F4EFE6] border border-[#111111] transition cursor-pointer"
              >
                + {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Configuration: Volume & Difficulty */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t-2 border-[#111111]">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="poster-label text-xs text-[#111111]">
                QUESTIONS
              </label>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                {promptIntent.rawCount && promptIntent.rawCount > 20 && (
                  <span className="text-[10px] bg-[#FF4A1C] text-white px-1.5 py-0.5 font-bold uppercase tracking-wider">
                    MAX 20
                  </span>
                )}
                <span className="font-mono font-bold text-xs text-[#111111]">
                  {count} Qs
                </span>
              </div>
            </div>
            <div className="flex gap-1.5">
              {(() => {
                const baseOptions = [3, 5, 8, 10, 15];
                const displayOptions = baseOptions.includes(count)
                  ? baseOptions
                  : [...baseOptions, count].sort((a, b) => a - b);
                return displayOptions.map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCount(num)}
                    disabled={isLoading}
                    className={`flex-1 py-1.5 font-mono text-xs font-bold border-2 border-[#111111] transition cursor-pointer ${
                      count === num
                        ? "bg-[#111111] text-[#F4EFE6]"
                        : "bg-[#F4EFE6] text-[#111111] hover:bg-[#E5DFD5]"
                    }`}
                  >
                    {num}
                  </button>
                ));
              })()}
            </div>
          </div>

          <div>
            <label className="block poster-label text-xs text-[#111111] mb-1.5">
              DIFFICULTY
            </label>
            <div className="flex gap-1.5">
              {["easy", "medium", "hard"].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  disabled={isLoading}
                  className={`flex-1 py-1.5 font-mono text-xs font-bold uppercase border-2 border-[#111111] transition cursor-pointer ${
                    difficulty === level
                      ? "bg-[#FF4A1C] text-[#F4EFE6]"
                      : "bg-[#F4EFE6] text-[#111111] hover:bg-[#E5DFD5]"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !topic.trim()}
          className="w-full py-3 bg-[#111111] hover:bg-[#FF4A1C] text-[#F4EFE6] poster-label text-xs font-black uppercase tracking-wider border-2 border-[#111111] poster-shadow-sm transition flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#F4EFE6]" />
              <span>GENERATING QUESTIONS...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>GENERATE QUESTIONS →</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

import React from "react";
import { RefreshCw, Trash2, Check } from "lucide-react";

const OPTION_THEMES = [
  { letter: "A", shape: "▲", bg: "bg-[#FFC93C]" },
  { letter: "B", shape: "◆", bg: "bg-[#2EC4B6]" },
  { letter: "C", shape: "●", bg: "bg-[#7B61FF]" },
  { letter: "D", shape: "■", bg: "bg-[#FF4A1C]" },
];

export function QuestionCard({
  index,
  question,
  onChange,
  onDelete,
  onRegenerate,
  isRegenerating,
}) {
  const handleOptionChange = (optIdx, val) => {
    const newOptions = [...question.options];
    newOptions[optIdx] = val;
    onChange({ ...question, options: newOptions });
  };

  const handleCorrectChange = (optIdx) => {
    onChange({ ...question, correctIndex: optIdx });
  };

  return (
    <div className="bg-[#F4EFE6] border-2 border-[#111111] p-6 sm:p-7 relative poster-shadow">
      {/* Regeneration Overlay */}
      {isRegenerating && (
        <div className="absolute inset-0 bg-[#F4EFE6]/95 z-20 flex flex-col items-center justify-center space-y-2 border-2 border-[#111111]">
          <RefreshCw className="w-5 h-5 text-[#FF4A1C] animate-spin" />
          <span className="poster-label text-xs text-[#111111]">
            Re-drafting Question #{index + 1}...
          </span>
        </div>
      )}

      {/* Card Header: Meta Tagging & Actions */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b-2 border-[#111111]">
        <div className="flex items-center space-x-3">
          <span className="font-mono font-black text-sm text-[#F4EFE6] bg-[#111111] px-2.5 py-0.5 border border-[#111111]">
            0{index + 1}
          </span>
          <span className="poster-label text-xs text-[#111111]">
            {question.difficulty || "MEDIUM"} DIFFICULTY
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => onRegenerate(index)}
            disabled={isRegenerating}
            className="flex items-center space-x-1.5 px-3 py-1.5 poster-label text-xs text-[#111111] hover:bg-[#111111] hover:text-[#F4EFE6] border-2 border-[#111111] transition cursor-pointer"
            title="Regenerate this question with Gemini"
          >
            <RefreshCw className="w-3 h-3" />
            <span>RE-ROLL</span>
          </button>

          <button
            type="button"
            onClick={() => onDelete(index)}
            className="p-1.5 text-[#111111] hover:bg-[#D7263D] hover:text-white border-2 border-[#111111] transition cursor-pointer"
            title="Delete question"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Question Stem Textarea */}
      <div className="mb-5">
        <label className="block poster-label text-[11px] text-[#111111]/70 mb-1">
          QUESTION PROMPT
        </label>
        <textarea
          rows="2"
          value={question.question}
          onChange={(e) => onChange({ ...question, question: e.target.value })}
          className="w-full p-3 bg-[#F4EFE6] border-2 border-[#111111] font-display font-bold text-lg text-[#111111] focus:outline-none focus:bg-white resize-none"
        />
      </div>

      {/* 4 Answer Options */}
      <div className="space-y-2.5 mb-5">
        <label className="block poster-label text-[11px] text-[#111111]/70">
          ANSWER SLOTS (SELECT THE TARGET KEY)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {question.options.map((option, optIdx) => {
            const isCorrect = question.correctIndex === optIdx;
            const theme = OPTION_THEMES[optIdx];

            return (
              <div
                key={optIdx}
                className={`flex items-center border-2 border-[#111111] p-1.5 ${
                  isCorrect ? "bg-[#1FA34A]/20" : "bg-[#F4EFE6]"
                } transition`}
              >
                {/* Radio Key Trigger */}
                <button
                  type="button"
                  onClick={() => handleCorrectChange(optIdx)}
                  className={`w-7 h-7 flex items-center justify-center font-mono font-black text-xs border-2 border-[#111111] cursor-pointer mr-2 shrink-0 ${
                    isCorrect
                      ? "bg-[#111111] text-[#F4EFE6]"
                      : `${theme.bg} text-[#111111] hover:opacity-80`
                  }`}
                  title="Mark as correct answer"
                >
                  {isCorrect ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : theme.shape}
                </button>

                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(optIdx, e.target.value)}
                  className="flex-1 bg-transparent font-body text-sm font-semibold text-[#111111] focus:outline-none px-1"
                />

                {isCorrect && (
                  <span className="poster-label text-[9px] bg-[#1FA34A] text-white px-1.5 py-0.5 border border-[#111111] mr-1">
                    KEY
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Rationale Explanation Input */}
      <div>
        <label className="block poster-label text-[11px] text-[#111111]/70 mb-1">
          EXPLANATION / RATIONALE
        </label>
        <input
          type="text"
          value={question.explanation || ""}
          onChange={(e) => onChange({ ...question, explanation: e.target.value })}
          placeholder="Why this answer is correct..."
          className="w-full p-2.5 bg-[#F4EFE6] border-2 border-[#111111] font-body text-xs font-semibold text-[#111111] focus:outline-none focus:bg-white"
        />
      </div>
    </div>
  );
}

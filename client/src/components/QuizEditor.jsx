import React, { useState } from "react";
import { QuestionCard } from "./QuestionCard.jsx";
import { ArrowLeft, Plus, Check } from "lucide-react";

export function QuizEditor({
  quiz,
  metrics,
  onUpdateQuiz,
  onSaveQuiz,
  onRegenerateQuestion,
  onReset,
  isSaving,
  regeneratingIndices,
  onToggleDeck,
}) {
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleTitleChange = (newTitle) => {
    onUpdateQuiz({ ...quiz, title: newTitle });
  };

  const handleQuestionChange = (index, updatedQuestion) => {
    const newQuestions = [...quiz.questions];
    newQuestions[index] = updatedQuestion;
    onUpdateQuiz({ ...quiz, questions: newQuestions });
  };

  const handleDeleteQuestion = (index) => {
    if (quiz.questions.length <= 1) {
      alert("A quiz must have at least 1 question.");
      return;
    }
    const newQuestions = quiz.questions.filter((_, i) => i !== index);
    onUpdateQuiz({ ...quiz, questions: newQuestions });
  };

  const handleAddQuestion = () => {
    const blankQuestion = {
      question: "Custom question stem...",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctIndex: 0,
      explanation: "Explanation rationale...",
      difficulty: quiz.difficulty || "medium",
    };
    onUpdateQuiz({ ...quiz, questions: [...quiz.questions, blankQuestion] });
  };

  const handleSave = async () => {
    const success = await onSaveQuiz();
    if (success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const pTokens = metrics?.tokens?.promptTokens || 0;
  const cTokens = metrics?.tokens?.completionTokens || 0;
  const estimatedCost = (pTokens / 1_000_000) * 0.1 + (cTokens / 1_000_000) * 0.4;

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-8 px-4">
      {/* Editorial Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-[#111111]">
        <button
          onClick={onReset}
          className="flex items-center space-x-2 poster-label text-xs text-[#111111] hover:text-[#FF4A1C] transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>NEW TOPIC PROMPT</span>
        </button>

        <div className="flex items-center space-x-3">
          {onToggleDeck && (
            <button
              onClick={onToggleDeck}
              className="poster-label px-3.5 py-2 text-xs font-bold uppercase transition border-2 border-[#111111] bg-[#F4EFE6] hover:bg-[#111111] hover:text-[#F4EFE6] text-[#111111] cursor-pointer"
            >
              DEALT DECK VIEW 🎴
            </button>
          )}
          <button
            onClick={handleAddQuestion}
            className="flex items-center space-x-1.5 px-4 py-2 poster-label text-xs text-[#111111] bg-[#F4EFE6] hover:bg-[#E5DFD5] border-2 border-[#111111] transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ADD QUESTION ITEM</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-5 py-2 poster-label text-xs font-bold uppercase transition border-2 border-[#111111] poster-shadow-sm cursor-pointer flex items-center space-x-2 ${
              saveSuccess
                ? "bg-[#1FA34A] text-white"
                : "bg-[#111111] hover:bg-[#FF4A1C] text-[#F4EFE6]"
            }`}
          >
            {saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>SAVED TO ARCHIVE</span>
              </>
            ) : (
              <span>{isSaving ? "SAVING..." : "COMMIT TO DATABASE →"}</span>
            )}
          </button>
        </div>
      </div>

      {/* Editable Title Section */}
      <div className="py-2">
        <span className="poster-label text-xs text-[#FF4A1C] block mb-1">
          PROOF REVIEW • {quiz.questions.length} QUESTIONS
        </span>
        <input
          type="text"
          value={quiz.title || `${quiz.topic} Quiz`}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="w-full text-3xl sm:text-4xl font-display font-extrabold bg-transparent text-[#111111] border-b-2 border-[#111111] focus:outline-none pb-2 transition"
        />
      </div>

      {/* Observability Telemetry Strip */}
      {metrics && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 px-4 bg-[#E5DFD5] border-2 border-[#111111] font-mono text-xs text-[#111111]">
          <div>
            <span className="text-[#111111]/70">LATENCY: </span>
            <strong className="font-bold">{(metrics.latencyMs / 1000).toFixed(2)}s</strong>
          </div>
          <div>
            <span className="text-[#111111]/70">TOKENS: </span>
            <strong className="font-bold">{metrics.tokens?.totalTokens || 0}</strong>
          </div>
          <div>
            <span className="text-[#111111]/70">RETRIES: </span>
            <strong className="font-bold">{metrics.retryCount ?? 0} (Clean)</strong>
          </div>
          <div>
            <span className="text-[#111111]/70">EST. COST: </span>
            <strong className="font-bold">${estimatedCost.toFixed(5)}</strong>
          </div>
        </div>
      )}

      {/* Question Cards List */}
      <div className="space-y-6">
        {quiz.questions.map((q, idx) => (
          <QuestionCard
            key={idx}
            index={idx}
            question={q}
            onChange={(updated) => handleQuestionChange(idx, updated)}
            onDelete={() => handleDeleteQuestion(idx)}
            onRegenerate={() => onRegenerateQuestion(idx)}
            isRegenerating={regeneratingIndices.includes(idx)}
          />
        ))}
      </div>
    </div>
  );
}

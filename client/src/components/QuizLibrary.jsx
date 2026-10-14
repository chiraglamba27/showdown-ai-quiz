import React, { useEffect, useState } from "react";
import { BookOpen, Calendar, Trash2, ArrowRight, Loader2 } from "lucide-react";

export function QuizLibrary({ onSelectQuiz }) {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchQuizzes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/quizzes");
      const json = await res.json();
      if (json.success) {
        setQuizzes(json.data);
      } else {
        setError(json.error || "Failed to load quizzes");
      }
    } catch (err) {
      setError("Cannot reach backend server. Make sure 'npm run server' is active.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Delete this quiz?")) return;

    try {
      const res = await fetch(`/api/quizzes/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setQuizzes((prev) => prev.filter((q) => q._id !== id));
      } else {
        alert(json.error || "Could not delete");
      }
    } catch (err) {
      alert("Failed to delete quiz");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#111111] space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF4A1C]" />
        <span className="poster-label text-xs">Accessing MongoDB Records...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#F4EFE6] border-2 border-[#111111] p-6 poster-shadow">
        <div>
          <span className="poster-label text-[#FF4A1C] block mb-1">
            ARCHIVE VAULT // PERSISTENCE
          </span>
          <h2 className="font-display font-black text-3xl text-[#111111] leading-none">
            Saved Quiz Records
          </h2>
          <p className="font-mono text-xs text-[#111111]/70 mt-1">
            {quizzes.length} {quizzes.length === 1 ? "QUIZ" : "QUIZZES"} INDEXED IN LOCAL MONGODB
          </p>
        </div>
        <button
          onClick={fetchQuizzes}
          className="poster-label text-xs text-[#111111] px-4 py-2 bg-[#F4EFE6] hover:bg-[#111111] hover:text-[#F4EFE6] border-2 border-[#111111] transition cursor-pointer self-start sm:self-auto"
        >
          REFRESH ARCHIVE
        </button>
      </div>

      {error && (
        <div className="p-4 bg-[#D7263D]/10 border-2 border-[#D7263D] text-[#D7263D] font-mono text-xs font-bold">
          {error}
        </div>
      )}

      {quizzes.length === 0 ? (
        <div className="text-center py-16 bg-[#F4EFE6] border-2 border-[#111111] p-8 space-y-4 poster-shadow">
          <BookOpen className="w-10 h-10 text-[#111111] mx-auto stroke-[1.5]" />
          <div>
            <h3 className="font-display font-extrabold text-2xl text-[#111111]">
              The Archive is Blank.
            </h3>
            <p className="font-body text-sm text-[#111111]/70 mt-1">
              Throw a topic into the Studio generator and commit your first deck.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {quizzes.map((q) => (
            <div
              key={q._id}
              onClick={() => onSelectQuiz(q)}
              className="bg-[#F4EFE6] border-2 border-[#111111] p-5 cursor-pointer transition poster-shadow hover:translate-x-0.5 hover:translate-y-0.5 flex flex-col justify-between group"
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-2 pb-2 border-b-2 border-[#111111]">
                  <h3 className="font-display font-bold text-lg text-[#111111] line-clamp-1 group-hover:text-[#FF4A1C] transition">
                    {q.title}
                  </h3>
                  <button
                    onClick={(e) => handleDelete(q._id, e)}
                    className="text-[#111111] hover:bg-[#D7263D] hover:text-white p-1 border border-[#111111] transition"
                    title="Delete record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className="poster-label text-[10px] px-2 py-0.5 bg-[#111111] text-[#F4EFE6]">
                    {q.questions.length} QUESTIONS
                  </span>
                  <span className="poster-label text-[10px] px-2 py-0.5 bg-[#FF4A1C] text-[#F4EFE6]">
                    {q.difficulty || "MEDIUM"}
                  </span>
                </div>

                <p className="font-body text-xs text-[#111111]/80 line-clamp-2 mb-4 font-medium">
                  TOPIC: <strong className="text-[#111111]">{q.topic}</strong>
                </p>
              </div>

              <div className="flex items-center justify-between font-mono text-xs text-[#111111]/70 pt-3 border-t-2 border-[#111111]">
                <div className="flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{new Date(q.createdAt).toLocaleDateString()}</span>
                </div>
                <span className="poster-label text-xs font-bold text-[#111111] group-hover:text-[#FF4A1C] flex items-center gap-1">
                  <span>LOAD DECK</span>
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

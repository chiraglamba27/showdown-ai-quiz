import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Smartphone,
  Trophy,
  RotateCcw,
  ArrowRight,
  Check,
  Users,
  Award,
  Crown,
  Sparkles,
  QrCode,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { socket } from "../socket.js";

const DEMO_QUESTIONS = [
  {
    category: "OPERATING SYSTEMS",
    difficulty: "HARD",
    numeral: "01",
    question:
      "When adding physical memory frames paradoxically INCREASES the page fault rate, which non-stack algorithm is in effect?",
    options: [
      { letter: "A", text: "Least Recently Used (LRU) on cyclic reference loops", shape: "▲" },
      { letter: "B", text: "First-In-First-Out (FIFO) under Belady's Anomaly", shape: "◆" },
      { letter: "C", text: "Optimal Algorithm (OPT) on forward reference strings", shape: "●" },
      { letter: "D", text: "Clock Algorithm with dirty-bit eviction preference", shape: "■" },
    ],
    correctIndex: 1, // B (Diamond)
    initialVotes: [0, 0, 0, 0],
    explanation:
      "Belady's Anomaly occurs with FIFO because it is not a stack algorithm; an n-frame allocation is not guaranteed to be a subset of an (n+1)-frame allocation.",
  },
  {
    category: "DATABASE INTERNALS",
    difficulty: "HARD",
    numeral: "02",
    question:
      "To guarantee conflict serializability AND eliminate cascading rollbacks, which lock protocol is mandated?",
    options: [
      { letter: "A", text: "Conservative Two-Phase Locking with pre-declared read sets", shape: "▲" },
      { letter: "B", text: "Basic 2PL with immediate release during shrinking phase", shape: "◆" },
      { letter: "C", text: "Strict 2PL (holding all exclusive write locks until commit)", shape: "●" },
      { letter: "D", text: "Optimistic Concurrency Control with timestamp reordering", shape: "■" },
    ],
    correctIndex: 2, // C (Circle)
    initialVotes: [0, 0, 0, 0],
    explanation:
      "Strict Two-Phase Locking holds exclusive locks until transaction termination (COMMIT or ABORT), preventing uncommitted dirty reads.",
  },
];

export function HostLiveView({
  questions,
  topic = "OPERATING SYSTEMS",
  onEndGame,
  onOpenPhone,
  onPinGenerated,
  isDemo = false,
}) {
  const formattedQuestions = (questions && questions.length > 0)
    ? questions.map((q, idx) => ({
        category: (q.category || topic).toUpperCase(),
        difficulty: (q.difficulty || "MEDIUM").toUpperCase(),
        numeral: idx < 9 ? `0${idx + 1}` : `${idx + 1}`,
        question: q.question,
        options: [
          { letter: "A", text: q.options[0], shape: "▲" },
          { letter: "B", text: q.options[1], shape: "◆" },
          { letter: "C", text: q.options[2], shape: "●" },
          { letter: "D", text: q.options[3], shape: "■" },
        ],
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      }))
    : DEMO_QUESTIONS;

  const [livePin, setLivePin] = useState("839 201");
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected);
  const [qIndex, setQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [isRunning, setIsRunning] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [finalResults, setFinalResults] = useState(null);
  const [votes, setVotes] = useState([0, 0, 0, 0]);
  const [connectedPlayers, setConnectedPlayers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate QR Code data URL when livePin changes
  useEffect(() => {
    const rawPin = livePin.replace(/\s+/g, "");
    if (!rawPin) return;

    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
    const joinUrl = `${origin}/?role=player&pin=${rawPin}`;

    QRCode.toDataURL(joinUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: "#111111",
        light: "#F4EFE6",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR Code generation error:", err));
  }, [livePin]);

  const activeQ = formattedQuestions[qIndex] || formattedQuestions[0];
  const totalVotes = votes.reduce((sum, v) => sum + v, 0);
  const isLastQuestion = qIndex === formattedQuestions.length - 1;

  // 1. Authoritative Room Registration & Sync over Socket.IO
  useEffect(() => {
    const rawQuestions = formattedQuestions.map((q) => ({
      question: q.question,
      options: q.options.map((o) => o.text),
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      difficulty: q.difficulty,
    }));

    const registerRoom = () => {
      setIsSocketConnected(true);
      socket.emit(
        "host:create-room",
        {
          pin: isDemo ? "839201" : undefined,
          quiz: {
            topic,
            questions: rawQuestions,
            timeLimitSeconds: 15,
          },
        },
        (res) => {
          if (res && res.success) {
            const formattedPin = `${res.pin.slice(0, 3)} ${res.pin.slice(3)}`;
            setLivePin(formattedPin);
            if (onPinGenerated) {
              onPinGenerated(res.pin);
            }
          }
        }
      );
    };

    if (socket.connected) {
      registerRoom();
    } else {
      socket.connect();
    }

    const handleConnect = () => registerRoom();
    const handleDisconnect = () => setIsSocketConnected(false);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    // Socket Event: Player Joined Lobby
    const handlePlayerJoined = ({ players, count }) => {
      setConnectedPlayers(players || []);
    };

    // Socket Event: Player Left
    const handlePlayerLeft = ({ players }) => {
      setConnectedPlayers(players || []);
    };

    // Socket Event: Live Vote Counts Updated
    const handleVotesUpdated = ({ votes: newVotes, allAnswered }) => {
      if (newVotes) {
        setVotes(newVotes);
      }
      if (allAnswered) {
        // All active players have answered; trigger reveal
        handleReveal();
      }
    };

    // Socket Event: Leaderboard Updated
    const handleLeaderboard = ({ leaderboard: lb }) => {
      if (lb) setLeaderboard(lb);
    };

    // Socket Event: Quiz Finished / Grand Finale
    const handleQuizFinished = (finaleData) => {
      setIsGameOver(true);
      setFinalResults(finaleData);
      if (finaleData.leaderboard) setLeaderboard(finaleData.leaderboard);
    };

    socket.on("room:player-joined", handlePlayerJoined);
    socket.on("room:player-left", handlePlayerLeft);
    socket.on("room:votes-updated", handleVotesUpdated);
    socket.on("game:leaderboard-updated", handleLeaderboard);
    socket.on("game:quiz-finished", handleQuizFinished);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("room:player-joined", handlePlayerJoined);
      socket.off("room:player-left", handlePlayerLeft);
      socket.off("room:votes-updated", handleVotesUpdated);
      socket.off("game:leaderboard-updated", handleLeaderboard);
      socket.off("game:quiz-finished", handleQuizFinished);
    };
  }, [topic]);

  // 2. Synchronized Question Countdown
  useEffect(() => {
    let timer = null;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      handleReveal();
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  // 3. Start Question Broadcast
  const handleStartQuestion = (targetIndex = qIndex) => {
    const rawPin = livePin.replace(/\s+/g, "");
    setVotes([0, 0, 0, 0]);
    setTimeLeft(15);
    setIsRunning(true);
    setIsRevealed(false);
    setShowLeaderboard(false);
    setIsGameOver(false);

    socket.emit("host:start-question", { pin: rawPin, qIndex: targetIndex });
  };

  // 4. Reveal Answer Broadcast
  const handleReveal = () => {
    const rawPin = livePin.replace(/\s+/g, "");
    setIsRunning(false);
    setIsRevealed(true);

    socket.emit("host:reveal-answer", { pin: rawPin });
  };

  // 5. Leaderboard Broadcast
  const handleToggleLeaderboard = () => {
    const nextState = !showLeaderboard;
    setShowLeaderboard(nextState);

    if (nextState) {
      const rawPin = livePin.replace(/\s+/g, "");
      socket.emit("host:show-leaderboard", { pin: rawPin }, (res) => {
        if (res && res.success) {
          setLeaderboard(res.leaderboard);
        }
      });
    }
  };

  // 6. Finish Quiz / Show Grand Finale Podium
  const handleFinishQuiz = () => {
    const rawPin = livePin.replace(/\s+/g, "");
    setIsRunning(false);
    setIsRevealed(false);
    setShowLeaderboard(false);

    socket.emit("host:finish-quiz", { pin: rawPin }, (res) => {
      if (res && res.success) {
        setIsGameOver(true);
        setFinalResults(res);
        if (res.leaderboard) setLeaderboard(res.leaderboard);
      }
    });
  };

  // 7. Replay Showdown from Question 1
  const handleReplay = () => {
    setIsGameOver(false);
    setFinalResults(null);
    setQIndex(0);
    handleStartQuestion(0);
  };

  // 8. Next Question Advance
  const handleNextQuestion = () => {
    if (isLastQuestion) {
      handleFinishQuiz();
      return;
    }
    const next = (qIndex + 1) % formattedQuestions.length;
    setQIndex(next);
    handleStartQuestion(next);
  };

  // Simulate local test vote
  const handleSimVote = () => {
    if (isRevealed) return;
    const targetIdx = Math.floor(Math.random() * 4);
    setVotes((prev) => {
      const copy = [...prev];
      copy[targetIdx] += 1;
      return copy;
    });
  };

  const timePercent = (timeLeft / 15) * 100;
  const isUrgent = timeLeft <= 5 && timeLeft > 0;

  const CHANNEL_COLORS = [
    { bg: "bg-[#FFC93C]", bar: "bg-[#FFC93C]" },
    { bg: "bg-[#2EC4B6]", bar: "bg-[#2EC4B6]" },
    { bg: "bg-[#7B61FF]", bar: "bg-[#7B61FF]" },
    { bg: "bg-[#FF4A1C]", bar: "bg-[#FF4A1C]" },
  ];

  // ---------------- GRAND FINALE PODIUM SCREEN ----------------
  if (isGameOver) {
    const podium = finalResults?.podium || [];
    const stats = finalResults?.stats || {
      totalPlayers: connectedPlayers.length,
      winner: leaderboard[0] || null,
      averageScore: 0,
      averageAccuracy: 0,
    };
    const finalLeaderboard = finalResults?.leaderboard || leaderboard;

    return (
      <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
        {/* Top Header */}
        <div className="bg-[#F4EFE6] border-2 border-[#111111] poster-shadow p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="poster-label text-xs text-[#FF4A1C] block mb-1">
              GRAND FINALE // SHOWDOWN RESULTS
            </span>
            <h2 className="font-display font-black text-3xl text-[#111111] leading-tight">
              Champion Podium
            </h2>
            <p className="font-mono text-xs text-[#111111]/70 mt-0.5">
              TOPIC: {finalResults?.topic || topic} • {finalResults?.totalQuestions || formattedQuestions.length} QUESTIONS COMPLETED
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReplay}
              className="poster-label px-4 py-2 border-2 border-[#111111] bg-[#F4EFE6] hover:bg-[#111111] hover:text-[#F4EFE6] text-xs transition cursor-pointer flex items-center gap-1.5 font-bold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>REPLAY SHOWDOWN</span>
            </button>
            {onEndGame && (
              <button
                onClick={onEndGame}
                className="poster-label px-4 py-2 border-2 border-[#111111] bg-[#111111] text-[#F4EFE6] hover:bg-[#FF4A1C] text-xs transition cursor-pointer flex items-center gap-1.5 font-bold"
              >
                <span>CREATE NEW QUIZ →</span>
              </button>
            )}
          </div>
        </div>

        {/* 3-Tier Dramatic Podium */}
        <div className="bg-[#F4EFE6] border-2 border-[#111111] poster-shadow p-6 sm:p-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Trophy className="w-6 h-6 text-[#FF4A1C]" />
            <h3 className="font-display font-black text-xl text-[#111111] uppercase tracking-wide">
              Top 3 Showdown Champions
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end max-w-2xl mx-auto pt-8 pb-4">
            {/* 2nd Place (Left, Mid height, Teal) */}
            <div className="flex flex-col items-center">
              <div className="text-center mb-2">
                <span className="poster-label text-[10px] text-[#2EC4B6] font-black block">2ND PLACE</span>
                <span className="font-display font-black text-sm sm:text-base text-[#111111] truncate max-w-[120px] block">
                  {podium[1]?.player || "—"}
                </span>
                <span className="font-mono text-xs font-bold text-[#111111]/70">
                  {podium[1]?.score || 0} PTS
                </span>
              </div>
              <div className="w-full h-32 sm:h-40 bg-[#2EC4B6] border-2 border-[#111111] poster-shadow-sm flex flex-col items-center justify-center p-2">
                <span className="font-display font-black text-4xl sm:text-5xl text-[#111111]">2</span>
                <span className="poster-label text-[10px] text-[#111111] mt-1 font-black">SILVER</span>
              </div>
            </div>

            {/* 1st Place (Center, Tallest height, Gold) */}
            <div className="flex flex-col items-center -mt-6">
              <div className="text-center mb-2">
                <div className="inline-flex items-center gap-1 bg-[#111111] text-[#FFC93C] px-2 py-0.5 border border-[#111111] mb-1">
                  <Crown className="w-3.5 h-3.5 fill-[#FFC93C]" />
                  <span className="poster-label text-[10px] font-black">CHAMPION</span>
                </div>
                <span className="font-display font-black text-base sm:text-xl text-[#111111] truncate max-w-[140px] block">
                  {podium[0]?.player || "Winner"}
                </span>
                <span className="font-mono text-xs sm:text-sm font-black text-[#FF4A1C]">
                  {podium[0]?.score || 0} PTS
                </span>
              </div>
              <div className="w-full h-44 sm:h-56 bg-[#FFC93C] border-2 border-[#111111] poster-shadow flex flex-col items-center justify-center p-2">
                <span className="font-display font-black text-5xl sm:text-7xl text-[#111111]">1</span>
                <span className="poster-label text-xs text-[#111111] mt-1 font-black">GOLD MEDAL</span>
              </div>
            </div>

            {/* 3rd Place (Right, Shortest height, Purple) */}
            <div className="flex flex-col items-center">
              <div className="text-center mb-2">
                <span className="poster-label text-[10px] text-[#7B61FF] font-black block">3RD PLACE</span>
                <span className="font-display font-black text-sm sm:text-base text-[#111111] truncate max-w-[120px] block">
                  {podium[2]?.player || "—"}
                </span>
                <span className="font-mono text-xs font-bold text-[#111111]/70">
                  {podium[2]?.score || 0} PTS
                </span>
              </div>
              <div className="w-full h-24 sm:h-28 bg-[#7B61FF] border-2 border-[#111111] poster-shadow-sm flex flex-col items-center justify-center p-2">
                <span className="font-display font-black text-3xl sm:text-4xl text-[#111111]">3</span>
                <span className="poster-label text-[10px] text-[#111111] mt-1 font-black">BRONZE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Showdown Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#F4EFE6] border-2 border-[#111111] poster-shadow-sm p-4">
            <span className="poster-label text-[11px] text-[#111111]/70 block">CONTESTANTS</span>
            <span className="font-display font-black text-2xl text-[#111111]">{stats.totalPlayers}</span>
          </div>
          <div className="bg-[#F4EFE6] border-2 border-[#111111] poster-shadow-sm p-4">
            <span className="poster-label text-[11px] text-[#111111]/70 block">WINNING SCORE</span>
            <span className="font-display font-black text-2xl text-[#FF4A1C]">{stats.winner?.score || 0} PTS</span>
          </div>
          <div className="bg-[#F4EFE6] border-2 border-[#111111] poster-shadow-sm p-4">
            <span className="poster-label text-[11px] text-[#111111]/70 block">AVG ACCURACY</span>
            <span className="font-display font-black text-2xl text-[#1FA34A]">{stats.averageAccuracy || 0}%</span>
          </div>
          <div className="bg-[#F4EFE6] border-2 border-[#111111] poster-shadow-sm p-4">
            <span className="poster-label text-[11px] text-[#111111]/70 block">AVG SCORE</span>
            <span className="font-display font-black text-2xl text-[#111111]">{stats.averageScore || 0} PTS</span>
          </div>
        </div>

        {/* Full Final Leaderboard Table */}
        <div className="bg-[#F4EFE6] border-2 border-[#111111] poster-shadow p-6 space-y-4">
          <div className="border-b-2 border-[#111111] pb-3">
            <span className="poster-label text-xs text-[#FF4A1C] block">FINAL SCORECARD</span>
            <h3 className="font-display font-extrabold text-xl text-[#111111]">
              Full Rankings
            </h3>
          </div>

          <div className="divide-y-2 divide-[#111111] border-2 border-[#111111]">
            <div className="grid grid-cols-12 p-3 bg-[#E5DFD5] poster-label text-xs text-[#111111]">
              <span className="col-span-2">RANK</span>
              <span className="col-span-4">CONTESTANT</span>
              <span className="col-span-2 text-center">ACCURACY</span>
              <span className="col-span-2 text-center">MAX STREAK</span>
              <span className="col-span-2 text-right">TOTAL</span>
            </div>

            {finalLeaderboard.map((row, idx) => (
              <div
                key={row.id || idx}
                className={`grid grid-cols-12 p-3 items-center font-mono text-sm font-semibold transition ${
                  idx === 0
                    ? "bg-[#FFC93C]/20 font-bold"
                    : idx === 1
                    ? "bg-[#2EC4B6]/10"
                    : idx === 2
                    ? "bg-[#7B61FF]/10"
                    : "bg-[#F4EFE6] hover:bg-[#E5DFD5]"
                }`}
              >
                <span className="col-span-2 font-black text-[#111111] flex items-center gap-1.5">
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : ""}
                  <span>#{row.rank || idx + 1}</span>
                </span>
                <span className="col-span-4 font-bold text-[#111111] truncate">
                  {row.player || row.nickname}
                </span>
                <span className="col-span-2 text-center font-bold text-[#1FA34A]">
                  {row.accuracy !== undefined ? `${row.accuracy}%` : `${row.correctCount || 0}/${finalResults?.totalQuestions || formattedQuestions.length}`}
                </span>
                <span className="col-span-2 text-center text-xs text-[#FF4A1C] font-bold">
                  {row.maxStreak || row.streak || "0"}x 🔥
                </span>
                <span className="col-span-2 text-right font-black text-[#111111]">
                  {row.score || 0} PTS
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* ---------------- COMPACT STATUS HEADER ---------------- */}
      <div className="bg-[#F4EFE6] border-2 border-[#111111] poster-shadow p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Exit & Question Meta */}
        <div className="flex items-center gap-3">
          {onEndGame && (
            <button
              onClick={onEndGame}
              className="poster-label px-3 py-1.5 border-2 border-[#111111] bg-[#F4EFE6] hover:bg-[#111111] hover:text-[#F4EFE6] text-xs transition cursor-pointer flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>EXIT</span>
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="poster-label text-xs font-bold text-[#FF4A1C]">
                Q{qIndex + 1} OF {formattedQuestions.length}
              </span>
              <span className="text-[#111111]/30">•</span>
              <span className="poster-label text-xs text-[#111111]">
                {activeQ.category}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Live Real Room PIN */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span
            className={`w-2.5 h-2.5 circle-allowed border border-[#111111] ${
              isSocketConnected ? "bg-[#1FA34A]" : "bg-[#D7263D] animate-pulse"
            }`}
            title={isSocketConnected ? "Connected to multiplayer server" : "Connecting to server..."}
          />
          <span className="poster-label text-xs text-[#111111]/70">GAME PIN:</span>
          <span className="font-mono font-black text-base bg-[#111111] text-[#F4EFE6] px-3 py-1 tracking-wider border border-[#111111]">
            {livePin}
          </span>
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="poster-label px-2.5 py-1.5 border-2 border-[#111111] bg-[#F4EFE6] hover:bg-[#111111] hover:text-[#F4EFE6] text-xs transition cursor-pointer flex items-center gap-1.5 shadow-[2px_2px_0px_#111111] active:translate-x-0.5 active:translate-y-0.5"
            title="Scan QR Code to join on phone"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">QR CODE</span>
          </button>
        </div>

        {/* Right: Player count & Actions */}
        <div className="flex items-center gap-2">
          <span className="poster-label text-xs bg-[#E5DFD5] border border-[#111111] px-2.5 py-1 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#111111]" />
            <span>{connectedPlayers.length || totalVotes} PLAYERS</span>
          </span>

          {onOpenPhone && (
            <button
              onClick={onOpenPhone}
              className="poster-label px-3 py-1.5 border-2 border-[#111111] bg-[#111111] text-[#F4EFE6] hover:bg-[#FF4A1C] text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>PHONE</span>
            </button>
          )}

          <button
            onClick={handleToggleLeaderboard}
            className="poster-label px-3 py-1.5 border-2 border-[#111111] bg-[#F4EFE6] hover:bg-[#111111] hover:text-[#F4EFE6] text-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>{showLeaderboard ? "QUESTION" : "SCORES"}</span>
          </button>
        </div>
      </div>

      {/* ---------------- QUESTION VIEW OR LEADERBOARD ---------------- */}
      {!showLeaderboard ? (
        <div className="space-y-6">
          {/* Main Question Stem Box */}
          <div className="bg-[#F4EFE6] border-2 border-[#111111] poster-shadow p-6 sm:p-8 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b-2 border-[#111111]">
              <span className="poster-label text-xs text-[#111111]/70">
                DIFFICULTY: <strong className="text-[#111111]">{activeQ.difficulty}</strong>
              </span>

              {/* Timer Pill */}
              <div className="flex items-center gap-2">
                <span className="poster-label text-xs">TIME:</span>
                <span
                  className={`font-mono font-bold text-sm px-2.5 py-0.5 border border-[#111111] ${
                    isUrgent
                      ? "bg-[#D7263D] text-white animate-pulse"
                      : isRunning
                      ? "bg-[#111111] text-[#F4EFE6]"
                      : "bg-[#E5DFD5] text-[#111111]"
                  }`}
                >
                  {timeLeft}s
                </span>
              </div>
            </div>

            {/* Question Text */}
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-[#111111] leading-snug">
              {activeQ.question}
            </h2>

            {/* Linear Countdown Bar */}
            <div className="w-full h-2 bg-[#E5DFD5] border border-[#111111] overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ease-linear ${
                  isUrgent ? "bg-[#D7263D]" : "bg-[#111111]"
                }`}
                style={{ width: `${isRunning ? timePercent : 100}%` }}
              />
            </div>
          </div>

          {/* 4 Answer Options (2x2 Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activeQ.options.map((opt, idx) => {
              const ch = CHANNEL_COLORS[idx];
              const isCorrect = idx === activeQ.correctIndex;
              const count = votes[idx] || 0;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

              return (
                <div
                  key={idx}
                  className={`border-2 border-[#111111] p-4 flex flex-col justify-between poster-shadow transition ${
                    isRevealed && isCorrect
                      ? "bg-[#1FA34A]/15 border-[#1FA34A]"
                      : isRevealed
                      ? "opacity-60 bg-[#F4EFE6]"
                      : "bg-[#F4EFE6]"
                  }`}
                >
                  <div className="flex items-start space-x-3 mb-3">
                    {/* Shape Letter Badge */}
                    <div
                      className={`w-8 h-8 shrink-0 flex items-center justify-center font-mono font-black text-sm border-2 border-[#111111] ${ch.bg} text-[#111111]`}
                    >
                      {opt.shape}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-mono font-bold text-xs text-[#111111]">
                          {opt.letter}.
                        </span>
                        {isRevealed && isCorrect && (
                          <span className="poster-label text-[10px] bg-[#1FA34A] text-white px-1.5 py-0.2 border border-[#111111]">
                            ✓ CORRECT
                          </span>
                        )}
                      </div>
                      <p className="font-body text-base font-semibold text-[#111111] leading-snug">
                        {opt.text}
                      </p>
                    </div>
                  </div>

                  {/* Vote Count & Bar */}
                  <div className="pt-2 border-t border-[#111111]/20 flex items-center gap-3">
                    <div className="flex-1 h-2 bg-[#E5DFD5] border border-[#111111] overflow-hidden">
                      <div
                        className={`h-full ${ch.bar} transition-all duration-300`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs font-bold text-[#111111] shrink-0">
                      {pct}% ({count})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rationale Explanation (Shown upon timer expiration or reveal) */}
          {isRevealed && (
            <div className="bg-[#F4EFE6] border-2 border-[#111111] p-4 poster-shadow space-y-1">
              <span className="poster-label text-xs text-[#1FA34A] block">
                EXPLANATION & RATIONALE
              </span>
              <p className="font-body text-sm font-medium text-[#111111]">
                {activeQ.explanation}
              </p>
            </div>
          )}

          {/* Host Controls Strip */}
          <div className="bg-[#E5DFD5] border-2 border-[#111111] p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {!isRunning && !isRevealed && (
                <button
                  onClick={() => handleStartQuestion(qIndex)}
                  className="poster-label px-3.5 py-1.5 text-xs bg-[#FF4A1C] text-[#F4EFE6] hover:bg-[#111111] border-2 border-[#111111] transition cursor-pointer font-bold"
                >
                  ▶ START QUESTION
                </button>
              )}

              {isRunning && (
                <button
                  onClick={handleReveal}
                  className="poster-label px-3 py-1.5 text-xs bg-[#F4EFE6] hover:bg-[#111111] hover:text-[#F4EFE6] border border-[#111111] transition cursor-pointer"
                >
                  REVEAL NOW
                </button>
              )}

              <button
                onClick={handleSimVote}
                disabled={isRevealed}
                className="poster-label px-2.5 py-1.5 text-xs bg-[#F4EFE6] hover:bg-[#111111] hover:text-[#F4EFE6] border border-[#111111] transition cursor-pointer disabled:opacity-40"
              >
                + SIM VOTE
              </button>
            </div>

            {isLastQuestion ? (
              <button
                onClick={handleFinishQuiz}
                className="poster-label px-4 py-2 bg-[#FF4A1C] hover:bg-[#111111] text-[#F4EFE6] border-2 border-[#111111] poster-shadow-sm transition cursor-pointer flex items-center gap-1.5 ml-auto font-bold"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>FINALIZE & SHOW PODIUM 🏆</span>
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="poster-label px-4 py-2 bg-[#111111] hover:bg-[#FF4A1C] text-[#F4EFE6] border-2 border-[#111111] transition cursor-pointer flex items-center gap-1.5 ml-auto font-bold"
              >
                <span>NEXT QUESTION</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ---------------- LEADERBOARD TABLE ---------------- */
        <div className="bg-[#F4EFE6] border-2 border-[#111111] poster-shadow p-6 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b-2 border-[#111111]">
            <div>
              <span className="poster-label text-xs text-[#FF4A1C] block">
                LIVE ARENA STANDINGS
              </span>
              <h3 className="font-display font-extrabold text-2xl text-[#111111]">
                Contestant Leaderboard
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleFinishQuiz}
                className="poster-label px-3 py-1.5 border-2 border-[#111111] bg-[#FF4A1C] text-[#F4EFE6] text-xs hover:bg-[#111111] transition cursor-pointer flex items-center gap-1 font-bold"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>FINALIZE PODIUM 🏆</span>
              </button>
              <button
                onClick={() => setShowLeaderboard(false)}
                className="poster-label px-3 py-1.5 border-2 border-[#111111] bg-[#111111] text-[#F4EFE6] text-xs hover:bg-[#FF4A1C] transition cursor-pointer"
              >
                ← BACK TO QUESTION
              </button>
            </div>
          </div>

          <div className="divide-y-2 divide-[#111111] border-2 border-[#111111]">
            <div className="grid grid-cols-12 p-3 bg-[#E5DFD5] poster-label text-xs text-[#111111]">
              <span className="col-span-2">RANK</span>
              <span className="col-span-5">CONTESTANT</span>
              <span className="col-span-2">STREAK</span>
              <span className="col-span-3 text-right">SCORE</span>
            </div>

            {(leaderboard.length > 0 ? leaderboard : connectedPlayers).map((row, idx) => (
              <div
                key={row.id || idx}
                className="grid grid-cols-12 p-3 items-center font-mono text-sm font-semibold bg-[#F4EFE6] hover:bg-[#E5DFD5] transition"
              >
                <span className="col-span-2 font-bold text-[#111111]">
                  {row.rank || `0${idx + 1}`}
                </span>
                <span className="col-span-5 font-bold text-[#111111]">
                  {row.player || row.nickname}
                </span>
                <span className="col-span-2 text-xs text-[#FF4A1C] font-bold">
                  {row.streak || "1x"} 🔥
                </span>
                <span className="col-span-3 text-right font-black text-[#111111]">
                  {row.score || 0} PTS
                </span>
              </div>
            ))}

            {connectedPlayers.length === 0 && leaderboard.length === 0 && (
              <div className="p-6 text-center text-xs font-mono text-[#111111]/60">
                No contestants joined yet. Enter PIN <strong>{livePin}</strong> on phone to enter!
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- QR CODE JOIN MODAL ---------------- */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#111111]/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#F4EFE6] border-4 border-[#111111] poster-shadow p-6 max-w-sm w-full relative space-y-4 text-center">
            {/* Close Button */}
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-3 right-3 p-1.5 border-2 border-[#111111] bg-[#F4EFE6] hover:bg-[#FF4A1C] hover:text-[#F4EFE6] transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="space-y-1">
              <span className="inline-block text-[10px] font-black uppercase tracking-widest bg-[#FF4A1C] text-[#F4EFE6] px-2 py-0.5 border border-[#111111]">
                SCAN TO ENTER
              </span>
              <h3 className="font-display font-black text-xl text-[#111111] uppercase tracking-wide">
                JOIN LIVE ARENA
              </h3>
              <p className="text-xs font-mono text-[#111111]/70">
                Point any phone camera at the code to auto-join this game room.
              </p>
            </div>

            {/* QR Image Display */}
            <div className="bg-white p-3 border-3 border-[#111111] inline-block shadow-[3px_3px_0px_#111111]">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code for Room ${livePin}`}
                  className="w-56 h-56 mx-auto block"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center font-mono text-xs text-[#111111]/50">
                  Generating QR...
                </div>
              )}
            </div>

            {/* PIN Highlight */}
            <div className="bg-[#E5DFD5] border-2 border-[#111111] py-2 px-3 flex items-center justify-between font-mono">
              <span className="text-xs text-[#111111]/70">ROOM PIN:</span>
              <span className="text-lg font-black tracking-widest text-[#111111]">{livePin}</span>
            </div>

            {/* Copy Link Button */}
            <button
              onClick={() => {
                const rawPin = livePin.replace(/\s+/g, "");
                const origin = typeof window !== "undefined" ? window.location.origin : "";
                const joinUrl = `${origin}/?role=player&pin=${rawPin}`;
                navigator.clipboard.writeText(joinUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="w-full py-2.5 px-4 border-2 border-[#111111] bg-[#111111] text-[#F4EFE6] hover:bg-[#FF4A1C] poster-label text-xs tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-[#1FA34A]" />
                  <span>DIRECT LINK COPIED!</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4" />
                  <span>COPY PLAYER INVITE LINK</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { Zap, Check, X, Smartphone, AlertCircle, Loader2, Trophy, Crown, RotateCcw } from "lucide-react";
import { socket } from "../socket.js";

export function ParticipantView({ initialPin = "" }) {
  const [pin, setPin] = useState(initialPin || "");
  const [nickname, setNickname] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);

  // Active game state pushed from server
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [answerResult, setAnswerResult] = useState(null);
  const [revealData, setRevealData] = useState(null);
  const [totalScore, setTotalScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [finalResults, setFinalResults] = useState(null);

  // Keep socket connection live & track status
  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    if (socket.connected) {
      setIsConnected(true);
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, []);

  // Update PIN when prop changes
  useEffect(() => {
    if (initialPin && !isJoined) {
      setPin(initialPin.replace(/\s+/g, ""));
    }
  }, [initialPin, isJoined]);

  // Socket event listeners for contestant
  useEffect(() => {
    // 1. Question started by host
    const handleQuestionStarted = (qData) => {
      setActiveQuestion(qData);
      setSelectedOption(null);
      setIsSubmitted(false);
      setAnswerResult(null);
      setRevealData(null);
      setFinalResults(null);
    };

    // 2. Question revealed by host
    const handleQuestionRevealed = (revData) => {
      setRevealData(revData);
    };

    // 3. Quiz finished / Grand finale
    const handleQuizFinished = (data) => {
      setFinalResults(data);
    };

    // 4. Host ended game
    const handleHostDisconnected = () => {
      alert("The host ended the game session.");
      setIsJoined(false);
      setActiveQuestion(null);
      setFinalResults(null);
    };

    socket.on("game:question-started", handleQuestionStarted);
    socket.on("game:question-revealed", handleQuestionRevealed);
    socket.on("game:quiz-finished", handleQuizFinished);
    socket.on("room:host-disconnected", handleHostDisconnected);

    return () => {
      socket.off("game:question-started", handleQuestionStarted);
      socket.off("game:question-revealed", handleQuestionRevealed);
      socket.off("game:quiz-finished", handleQuizFinished);
      socket.off("room:host-disconnected", handleHostDisconnected);
    };
  }, []);

  const options = [
    { idx: 0, letter: "A", shape: "▲", bg: "bg-[#FFC93C]" },
    { idx: 1, letter: "B", shape: "◆", bg: "bg-[#2EC4B6]" },
    { idx: 2, letter: "C", shape: "●", bg: "bg-[#7B61FF]" },
    { idx: 3, letter: "D", shape: "■", bg: "bg-[#FF4A1C]" },
  ];

  // Join Room
  const handleJoin = (e) => {
    e.preventDefault();
    if (!pin.trim()) {
      setJoinError("Please enter the 6-digit Room PIN.");
      return;
    }
    if (!nickname.trim()) {
      setJoinError("Please enter your nickname / callsign.");
      return;
    }

    setIsJoining(true);
    setJoinError(null);

    const cleanPin = pin.replace(/\D/g, "");

    if (!socket.connected) {
      socket.connect();
    }

    let resolved = false;
    const timeoutTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setIsJoining(false);
        setJoinError("Connection timed out. Server may be offline or starting.");
      }
    }, 5000);

    socket.emit(
      "player:join-room",
      { pin: cleanPin, nickname: nickname.trim() },
      (res) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutTimer);
        setIsJoining(false);

        if (res && res.success) {
          setIsJoined(true);
          setNickname(res.player.nickname);
          if (res.activeQuestion) {
            setActiveQuestion(res.activeQuestion);
          }
        } else {
          setJoinError(
            res?.error ||
              "Room not found. Check the PIN or use Demo Room 839201."
          );
        }
      }
    );
  };

  // Submit Answer
  const handleSelectOption = (idx) => {
    if (isSubmitted || !activeQuestion) return;

    setSelectedOption(idx);
    setIsSubmitted(true);

    const cleanPin = pin.replace(/\D/g, "");

    socket.emit(
      "player:submit-answer",
      { pin: cleanPin, optionIndex: idx },
      (res) => {
        if (res && res.success) {
          setAnswerResult(res);
          if (res.totalScore !== undefined) setTotalScore(res.totalScore);
          if (res.streak !== undefined) setStreak(res.streak);
          if (res.isCorrect) setCorrectCount((prev) => prev + 1);
        }
      }
    );
  };

  const myResult = finalResults?.leaderboard?.find(
    (p) => p.id === socket.id || p.player?.toLowerCase() === nickname?.toLowerCase()
  ) || {
    rank: 1,
    score: totalScore,
    accuracy: Math.round(((correctCount || 0) / (finalResults?.totalQuestions || 1)) * 100),
    correctCount,
    maxStreak: streak,
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4">
      {/* 390px Mobile Viewport Frame */}
      <div className="w-full max-w-[390px] min-h-[620px] bg-[#F4EFE6] border-2 border-[#111111] poster-shadow flex flex-col justify-between overflow-hidden relative">
        {/* Top Status Bar: Ruled Poster Header */}
        <div className="flex items-center justify-between border-b-2 border-[#111111] p-3 bg-[#F4EFE6] text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 circle-allowed border border-[#111111] ${
                isConnected ? "bg-[#1FA34A]" : "bg-[#D7263D] animate-pulse"
              }`}
            />
            <span className="font-mono font-bold uppercase text-[#111111] text-xs truncate max-w-[120px]">
              {nickname || (isConnected ? "ONLINE" : "CONNECTING")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isJoined && (
              <span className="font-mono text-xs font-bold text-[#FF4A1C]">
                {totalScore} PTS
              </span>
            )}
            <span className="font-mono font-bold text-xs bg-[#111111] text-[#F4EFE6] px-2 py-0.5">
              PIN: {pin.replace(/\s+/g, "")}
            </span>
          </div>
        </div>

        {/* ---------------- 1. JOIN SCREEN ---------------- */}
        {!isJoined ? (
          <form onSubmit={handleJoin} className="flex-1 flex flex-col justify-center p-6 space-y-4">
            <div className="border-b-2 border-[#111111] pb-3">
              <span className="poster-label text-xs text-[#FF4A1C] block mb-0.5">
                CONTESTANT GATE
              </span>
              <h2 className="font-display font-extrabold text-2xl text-[#111111] leading-tight">
                Join Showdown
              </h2>
            </div>

            {joinError && (
              <div className="p-2.5 bg-[#D7263D]/10 border-2 border-[#D7263D] text-[#D7263D] text-xs font-mono font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{joinError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block poster-label text-xs text-[#111111] mb-1">
                  6-DIGIT ROOM PIN
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter 6-digit PIN"
                  className="w-full p-2.5 bg-white border-2 border-[#111111] font-mono font-bold text-base text-[#111111] text-center focus:outline-none"
                />
              </div>

              <div>
                <label className="block poster-label text-xs text-[#111111] mb-1">
                  CALLSIGN / NICKNAME
                </label>
                <input
                  type="text"
                  required
                  maxLength={15}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. ankit_dev"
                  className="w-full p-2.5 bg-white border-2 border-[#111111] font-mono font-bold text-sm text-[#111111] text-center focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isJoining}
                className="w-full py-3 bg-[#111111] hover:bg-[#FF4A1C] text-[#F4EFE6] poster-label text-xs font-black uppercase tracking-wider border-2 border-[#111111] poster-shadow-sm transition cursor-pointer flex items-center justify-center gap-2"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#F4EFE6]" />
                    <span>CONNECTING...</span>
                  </>
                ) : (
                  <span>ENTER ARENA →</span>
                )}
              </button>
            </div>
          </form>
        ) : finalResults ? (
          /* ---------------- 6. CONTESTANT FINAL RESULTS SCREEN ---------------- */
          <div className="flex-1 flex flex-col justify-between p-4 space-y-3 overflow-y-auto">
            <div className="text-center space-y-3">
              {/* Personal Placement Card */}
              {myResult.rank === 1 ? (
                <div className="bg-[#FFC93C] border-2 border-[#111111] poster-shadow-sm p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Crown className="w-5 h-5 text-[#111111] fill-[#111111]" />
                    <span className="poster-label text-xs font-black text-[#111111]">1ST PLACE CHAMPION</span>
                  </div>
                  <h2 className="font-display font-black text-2xl text-[#111111]">
                    YOU WON! 🏆
                  </h2>
                  <p className="font-mono text-xs font-bold text-[#111111]/80 mt-1">
                    Top of the Arena Leaderboard
                  </p>
                </div>
              ) : myResult.rank === 2 ? (
                <div className="bg-[#2EC4B6] border-2 border-[#111111] poster-shadow-sm p-4 text-center">
                  <span className="poster-label text-xs font-black text-[#111111] block mb-1">2ND PLACE // SILVER</span>
                  <h2 className="font-display font-black text-2xl text-[#111111]">
                    RUNNER-UP! 🥈
                  </h2>
                  <p className="font-mono text-xs font-bold text-[#111111]/80 mt-1">
                    Podium Silver Finisher
                  </p>
                </div>
              ) : myResult.rank === 3 ? (
                <div className="bg-[#7B61FF] border-2 border-[#111111] poster-shadow-sm p-4 text-center text-white">
                  <span className="poster-label text-xs font-black text-[#F4EFE6] block mb-1">3RD PLACE // BRONZE</span>
                  <h2 className="font-display font-black text-2xl text-[#F4EFE6]">
                    PODIUM FINISH! 🥉
                  </h2>
                  <p className="font-mono text-xs font-bold text-[#F4EFE6]/80 mt-1">
                    Podium Bronze Finisher
                  </p>
                </div>
              ) : (
                <div className="bg-[#E5DFD5] border-2 border-[#111111] poster-shadow-sm p-4 text-center">
                  <span className="poster-label text-xs font-black text-[#111111]/70 block mb-1">SHOWDOWN RANKING</span>
                  <h2 className="font-display font-black text-2xl text-[#111111]">
                    RANK #{myResult.rank || "—"} OF {finalResults.stats?.totalPlayers || 1}
                  </h2>
                  <p className="font-mono text-xs font-bold text-[#111111]/70 mt-1">
                    Great effort in the arena!
                  </p>
                </div>
              )}

              {/* Personal Performance Scorecard */}
              <div className="bg-white border-2 border-[#111111] p-3 divide-y divide-[#111111]/20 font-mono text-xs space-y-1.5 text-left">
                <div className="flex justify-between items-center pb-1">
                  <span className="text-[#111111]/70 font-semibold">FINAL SCORE:</span>
                  <span className="font-black text-base text-[#111111]">{myResult.score || totalScore} PTS</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#111111]/70 font-semibold">ACCURACY:</span>
                  <span className="font-bold text-[#1FA34A]">
                    {myResult.accuracy !== undefined
                      ? `${myResult.accuracy}%`
                      : `${myResult.correctCount || 0}/${finalResults.totalQuestions}`}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#111111]/70 font-semibold">CORRECT TAPS:</span>
                  <span className="font-bold text-[#111111]">
                    {myResult.correctCount || 0} / {finalResults.totalQuestions}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-[#111111]/70 font-semibold">BEST STREAK:</span>
                  <span className="font-bold text-[#FF4A1C]">
                    {myResult.maxStreak || streak} IN A ROW 🔥
                  </span>
                </div>
              </div>

              {/* Podium Leaders Mini-List */}
              <div className="bg-[#E5DFD5] border-2 border-[#111111] p-2.5 text-left font-mono text-[11px] space-y-1">
                <span className="poster-label text-[10px] text-[#111111]/70 block border-b border-[#111111]/20 pb-1">
                  TOP 3 CHAMPIONS
                </span>
                {finalResults.podium?.map(
                  (pod, i) =>
                    pod && (
                      <div key={i} className="flex justify-between font-bold">
                        <span>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} {pod.player}
                        </span>
                        <span>{pod.score} PTS</span>
                      </div>
                    )
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setIsJoined(false);
                setFinalResults(null);
                setActiveQuestion(null);
                setRevealData(null);
                setAnswerResult(null);
                setTotalScore(0);
                setStreak(0);
                setCorrectCount(0);
              }}
              className="w-full py-3 bg-[#111111] hover:bg-[#FF4A1C] text-[#F4EFE6] poster-label text-xs font-black uppercase tracking-wider border-2 border-[#111111] transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>PLAY ANOTHER GAME →</span>
            </button>
          </div>
        ) : !activeQuestion ? (
          /* ---------------- 2. LOBBY WAITING SCREEN ---------------- */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-[#111111] text-[#F4EFE6] border-2 border-[#111111] poster-shadow-sm flex items-center justify-center">
              <Zap className="w-6 h-6 text-[#FF4A1C]" />
            </div>

            <div className="border-b-2 border-[#111111] pb-3 w-full">
              <span className="poster-label text-xs text-[#1FA34A] block mb-1">
                CONNECTED TO ROOM {pin}
              </span>
              <h3 className="font-display font-bold text-xl text-[#111111]">
                You're In The Lobby!
              </h3>
              <p className="font-mono text-xs text-[#111111]/70 mt-1">
                Callsign: <strong className="text-[#111111]">{nickname}</strong>
              </p>
            </div>

            <p className="font-body text-xs text-[#111111]/70 font-medium">
              Watch the host screen. Questions will appear on your phone when started!
            </p>
          </div>
        ) : !isSubmitted && !revealData ? (
          /* ---------------- 3. ACTIVE QUESTION INPUT: 4 BIG BUTTONS ---------------- */
          <div className="flex-1 flex flex-col justify-between p-4 space-y-3">
            <div className="border-b-2 border-[#111111] pb-2 text-left">
              <div className="flex justify-between items-center mb-0.5">
                <span className="poster-label text-[11px] text-[#FF4A1C]">
                  QUESTION {activeQuestion.index + 1} OF {activeQuestion.totalQuestions}
                </span>
                <span className="font-mono text-xs font-bold text-[#111111]">
                  {activeQuestion.timeLimitSeconds || 15}s
                </span>
              </div>
              <h3 className="font-display font-bold text-base text-[#111111] line-clamp-2 leading-snug">
                {activeQuestion.question}
              </h3>
            </div>

            {/* 4 Colored Option Targets */}
            <div className="grid grid-cols-2 gap-2.5 flex-1 min-h-[260px]">
              {options.map((opt) => (
                <button
                  key={opt.idx}
                  onClick={() => handleSelectOption(opt.idx)}
                  className={`w-full border-2 border-[#111111] poster-shadow-sm flex flex-col items-center justify-center p-3 transition-transform active:translate-x-0.5 active:translate-y-0.5 ${opt.bg} cursor-pointer`}
                >
                  <span className="text-3xl text-[#111111] mb-1 font-black">
                    {opt.shape}
                  </span>
                  <span className="font-mono font-black text-lg text-[#111111]">
                    {opt.letter}
                  </span>
                  <span className="font-body text-[11px] font-semibold text-[#111111] line-clamp-1 mt-1 px-1 text-center">
                    {activeQuestion.options[opt.idx]}
                  </span>
                </button>
              ))}
            </div>

            <div className="text-center font-mono text-[10px] text-[#111111]/70 uppercase tracking-wider py-1 border-t border-[#111111]">
              ⚡ FASTER TAPS SCORE UP TO 1,000 PTS
            </div>
          </div>
        ) : (
          /* ---------------- 4 & 5. INSTANT VERDICT & EXPLANATION ---------------- */
          <div className="flex-1 flex flex-col justify-between p-4 space-y-3 overflow-y-auto">
            <div className="text-center space-y-3 pt-2">
              {answerResult?.isCorrect ? (
                <div className="w-full space-y-2">
                  <div className="w-12 h-12 bg-[#1FA34A] text-white border-2 border-[#111111] poster-shadow-sm flex items-center justify-center mx-auto">
                    <Check className="w-7 h-7 stroke-[3]" />
                  </div>
                  <div className="border-b-2 border-[#111111] pb-2">
                    <span className="poster-label text-xs text-[#1FA34A] block mb-0.5">
                      VERDICT // CORRECT
                    </span>
                    <h3 className="font-display font-black text-2xl text-[#111111] leading-none">
                      NAILED IT!
                    </h3>
                    <div className="font-mono font-black text-2xl text-[#1FA34A] mt-1">
                      +{answerResult?.points || 1000} PTS
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-2">
                  <div className="w-12 h-12 bg-[#D7263D] text-white border-2 border-[#111111] poster-shadow-sm flex items-center justify-center mx-auto">
                    <X className="w-7 h-7 stroke-[3]" />
                  </div>
                  <div className="border-b-2 border-[#111111] pb-2">
                    <span className="poster-label text-xs text-[#D7263D] block mb-0.5">
                      VERDICT // INCORRECT
                    </span>
                    <h3 className="font-display font-black text-2xl text-[#111111] leading-none">
                      WRONG ANSWER
                    </h3>
                    <p className="font-body text-xs text-[#111111]/70 mt-1 font-semibold">
                      Correct Option:{" "}
                      <strong>
                        Option {options[answerResult?.correctIndex ?? revealData?.correctIndex]?.letter} (
                        {options[answerResult?.correctIndex ?? revealData?.correctIndex]?.shape})
                      </strong>
                    </p>
                  </div>
                </div>
              )}

              {/* Explanation box */}
              {(answerResult?.explanation || revealData?.explanation) && (
                <div className="text-left bg-white border-2 border-[#111111] p-3 poster-shadow-sm">
                  <span className="poster-label text-[10px] text-[#FF4A1C] block mb-1">
                    EXPLANATION
                  </span>
                  <p className="font-body text-xs text-[#111111] leading-relaxed font-medium">
                    {answerResult?.explanation || revealData?.explanation}
                  </p>
                </div>
              )}

              {/* Current Score & Streak Card */}
              <div className="bg-[#E5DFD5] border-2 border-[#111111] p-2.5 text-left font-mono text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#111111]/70">STREAK:</span>
                  <span className="font-bold text-[#FF4A1C]">
                    {streak} IN A ROW 🔥
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#111111]/70">TOTAL SCORE:</span>
                  <span className="font-bold text-[#111111]">{totalScore} PTS</span>
                </div>
              </div>
            </div>

            <div className="text-center font-mono text-[11px] text-[#111111]/60 py-1">
              Host will advance to next question...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

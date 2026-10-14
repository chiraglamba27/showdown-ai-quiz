// In-memory room manager and authoritative state machine for live multiplayer quizzes

class RoomManager {
  constructor() {
    this.rooms = new Map(); // pin -> roomState
    this.playerToRoom = new Map(); // socketId -> pin
    this.hostToRoom = new Map(); // socketId -> pin
    this.initDemoRoom();
  }

  initDemoRoom() {
    const demoQuiz = {
      title: "Operating Systems Memory & Concurrency",
      topic: "Operating Systems",
      difficulty: "hard",
      questions: [
        {
          question:
            "When adding physical memory frames paradoxically INCREASES the page fault rate, which non-stack algorithm is in effect?",
          options: [
            "Least Recently Used (LRU) on cyclic reference loops",
            "First-In-First-Out (FIFO) under Belady's Anomaly",
            "Optimal Algorithm (OPT) on forward reference strings",
            "Clock Algorithm with dirty-bit eviction preference",
          ],
          correctIndex: 1,
          explanation:
            "Belady's Anomaly occurs with FIFO because it is not a stack algorithm; an n-frame allocation is not guaranteed to be a subset of an (n+1)-frame allocation.",
          difficulty: "hard",
        },
        {
          question:
            "To guarantee conflict serializability AND eliminate cascading rollbacks, which lock protocol is mandated?",
          options: [
            "Conservative Two-Phase Locking with pre-declared read sets",
            "Basic 2PL with immediate release during shrinking phase",
            "Strict 2PL (holding all exclusive write locks until commit)",
            "Optimistic Concurrency Control with timestamp reordering",
          ],
          correctIndex: 2,
          explanation:
            "Strict Two-Phase Locking holds exclusive locks until transaction termination (COMMIT or ABORT), preventing uncommitted dirty reads.",
          difficulty: "hard",
        },
        {
          question:
            "In Unix-like virtual memory subsystems, what optimization defers page frame duplication during fork()?",
          options: [
            "Demand Paging with swap-backed anonymous regions",
            "Copy-On-Write (COW) using read-only PTE page flags",
            "HugeTLB memory mapping via shared anonymous inodes",
            "Kernel Samepage Merging (KSM) batch background scanning",
          ],
          correctIndex: 1,
          explanation:
            "Copy-On-Write (COW) marks parent/child PTEs read-only until an actual write occurs.",
          difficulty: "hard",
        },
      ],
      timeLimitSeconds: 15,
    };

    const roomState = {
      pin: "839201",
      hostSocketId: null,
      quiz: demoQuiz,
      currentQIndex: 0,
      state: "LOBBY",
      questionStartTime: 0,
      timeLimitMs: 15000,
      players: new Map(),
      votes: [0, 0, 0, 0],
      createdAt: Date.now(),
      isDemo: true,
    };

    this.rooms.set("839201", roomState);
    console.log("[RoomManager] Permanent Demo Room initialized with PIN: 839201");
  }

  generateUniquePin() {
    let pin;
    let attempts = 0;
    do {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
      attempts++;
    } while (this.rooms.has(pin) && attempts < 100);
    return pin;
  }

  createRoom({ hostSocketId, quiz, requestedPin }) {
    // If this host already has a room, clean it up (unless it's the demo room)
    const existingPin = this.hostToRoom.get(hostSocketId);
    if (existingPin && existingPin !== "839201") {
      this.deleteRoom(existingPin);
    }

    const pin = requestedPin
      ? requestedPin.toString().replace(/\s+/g, "")
      : this.generateUniquePin();

    const timeLimitMs = (quiz.timeLimitSeconds || 15) * 1000;

    // If room already exists (e.g. demo room 839201), adopt it
    const existingRoom = this.rooms.get(pin);
    if (existingRoom) {
      existingRoom.hostSocketId = hostSocketId;
      if (quiz && quiz.questions && quiz.questions.length > 0) {
        existingRoom.quiz = {
          title: quiz.title || `${quiz.topic || "Showdown"} Quiz`,
          topic: quiz.topic || "General",
          difficulty: quiz.difficulty || "medium",
          questions: quiz.questions,
        };
      }
      existingRoom.state = "LOBBY";
      existingRoom.currentQIndex = 0;
      existingRoom.votes = [0, 0, 0, 0];
      this.hostToRoom.set(hostSocketId, pin);
      return existingRoom;
    }

    const roomState = {
      pin,
      hostSocketId,
      quiz: {
        title: quiz.title || `${quiz.topic || "Showdown"} Quiz`,
        topic: quiz.topic || "General",
        difficulty: quiz.difficulty || "medium",
        questions: quiz.questions || [],
      },
      currentQIndex: 0,
      state: "LOBBY", // LOBBY | QUESTION_ACTIVE | QUESTION_REVEAL | LEADERBOARD | FINISHED
      questionStartTime: 0,
      timeLimitMs,
      players: new Map(), // socketId -> playerData
      votes: [0, 0, 0, 0],
      createdAt: Date.now(),
    };

    this.rooms.set(pin, roomState);
    this.hostToRoom.set(hostSocketId, pin);
    return roomState;
  }

  getRoom(pin) {
    if (!pin) return null;
    const cleanPin = pin.toString().replace(/\s+/g, "");
    return this.rooms.get(cleanPin) || null;
  }

  getRoomByHostSocketId(socketId) {
    const pin = this.hostToRoom.get(socketId);
    return pin ? this.rooms.get(pin) : null;
  }

  getRoomByPlayerSocketId(socketId) {
    const pin = this.playerToRoom.get(socketId);
    return pin ? this.rooms.get(pin) : null;
  }

  addPlayer(pin, { socketId, nickname }) {
    const room = this.getRoom(pin);
    if (!room) {
      return { success: false, error: "Room not found. Check the 6-digit PIN." };
    }

    // Ensure unique nickname in room
    let finalNickname = (nickname || "player").trim().slice(0, 15);
    const existingNicknames = Array.from(room.players.values()).map((p) =>
      p.nickname.toLowerCase()
    );

    let counter = 1;
    let base = finalNickname;
    while (existingNicknames.includes(finalNickname.toLowerCase())) {
      finalNickname = `${base}_${counter}`;
      counter++;
    }

    const playerData = {
      id: socketId,
      socketId,
      nickname: finalNickname,
      score: 0,
      streak: 0,
      maxStreak: 0,
      correctCount: 0,
      lastAnswer: null,
      answeredAt: null,
      lastPoints: 0,
      isCorrect: null,
      connected: true,
    };

    room.players.set(socketId, playerData);
    this.playerToRoom.set(socketId, room.pin);

    return {
      success: true,
      room,
      player: playerData,
      playersCount: room.players.size,
    };
  }

  removePlayer(socketId) {
    const pin = this.playerToRoom.get(socketId);
    if (!pin) return null;

    const room = this.rooms.get(pin);
    if (!room) return null;

    const player = room.players.get(socketId);
    room.players.delete(socketId);
    this.playerToRoom.delete(socketId);

    return { room, player, playersCount: room.players.size };
  }

  deleteRoom(pin) {
    const room = this.rooms.get(pin);
    if (!room) return false;

    // If demo room, don't delete permanently; clear players and reset
    if (pin === "839201") {
      for (const socketId of room.players.keys()) {
        this.playerToRoom.delete(socketId);
      }
      if (room.hostSocketId) {
        this.hostToRoom.delete(room.hostSocketId);
      }
      room.players.clear();
      room.hostSocketId = null;
      room.state = "LOBBY";
      room.currentQIndex = 0;
      room.votes = [0, 0, 0, 0];
      return true;
    }

    // Clean player mappings
    for (const socketId of room.players.keys()) {
      this.playerToRoom.delete(socketId);
    }
    this.hostToRoom.delete(room.hostSocketId);
    this.rooms.delete(pin);
    return true;
  }

  startQuestion(pin, qIndex) {
    const room = this.getRoom(pin);
    if (!room) return null;

    const questions = room.quiz.questions;
    if (qIndex < 0 || qIndex >= questions.length) return null;

    room.currentQIndex = qIndex;
    room.state = "QUESTION_ACTIVE";
    room.questionStartTime = Date.now();
    room.votes = [0, 0, 0, 0];

    // Reset player per-question answer states
    for (const player of room.players.values()) {
      player.lastAnswer = null;
      player.answeredAt = null;
      player.lastPoints = 0;
      player.isCorrect = null;
    }

    const fullQuestion = questions[qIndex];

    // Anti-Cheat: sanitize question sent to contestants (NO correctIndex, NO explanation)
    const sanitizedQuestion = {
      index: qIndex,
      totalQuestions: questions.length,
      question: fullQuestion.question,
      options: fullQuestion.options,
      difficulty: fullQuestion.difficulty || room.quiz.difficulty,
      category: room.quiz.topic,
      timeLimitSeconds: Math.round(room.timeLimitMs / 1000),
    };

    return {
      room,
      fullQuestion,
      sanitizedQuestion,
    };
  }

  recordAnswer(pin, socketId, optionIndex) {
    const room = this.getRoom(pin);
    if (!room) return { success: false, error: "Room not found" };

    if (room.state !== "QUESTION_ACTIVE") {
      return { success: false, error: "Question is not currently active" };
    }

    const player = room.players.get(socketId);
    if (!player) {
      return { success: false, error: "Player not in room" };
    }

    if (player.lastAnswer !== null) {
      return { success: false, error: "Answer already submitted" };
    }

    const now = Date.now();
    const latencyMs = Math.max(0, now - room.questionStartTime);

    // 1000ms grace period for network latency
    if (latencyMs > room.timeLimitMs + 1000) {
      return { success: false, error: "Time expired" };
    }

    const currentQuestion = room.quiz.questions[room.currentQIndex];
    const isCorrect = Number(optionIndex) === currentQuestion.correctIndex;

    let points = 0;
    if (isCorrect) {
      // Speed-based scoring formula:
      // Response in 0s = 1000 pts; response at timeLimit = 500 pts.
      const ratio = Math.min(1, latencyMs / room.timeLimitMs);
      points = Math.max(500, Math.round(1000 * (1 - ratio / 2)));
      player.streak += 1;
      player.correctCount = (player.correctCount || 0) + 1;
      if (player.streak > (player.maxStreak || 0)) {
        player.maxStreak = player.streak;
      }
    } else {
      player.streak = 0;
    }

    player.score += points;
    player.lastAnswer = optionIndex;
    player.answeredAt = now;
    player.lastPoints = points;
    player.isCorrect = isCorrect;

    // Increment vote distribution tally (0-3)
    if (optionIndex >= 0 && optionIndex <= 3) {
      room.votes[optionIndex] += 1;
    }

    const totalAnswered = Array.from(room.players.values()).filter(
      (p) => p.lastAnswer !== null
    ).length;

    const allAnswered = totalAnswered >= room.players.size && room.players.size > 0;

    return {
      success: true,
      player,
      isCorrect,
      points,
      streak: player.streak,
      totalScore: player.score,
      votes: [...room.votes],
      totalAnswered,
      totalPlayers: room.players.size,
      allAnswered,
    };
  }

  revealQuestion(pin) {
    const room = this.getRoom(pin);
    if (!room) return null;

    room.state = "QUESTION_REVEAL";
    const currentQuestion = room.quiz.questions[room.currentQIndex];

    const playerResults = Array.from(room.players.values()).map((p) => ({
      id: p.id,
      nickname: p.nickname,
      selectedOption: p.lastAnswer,
      isCorrect: p.isCorrect,
      pointsAwarded: p.lastPoints,
      totalScore: p.score,
      streak: p.streak,
    }));

    return {
      room,
      qIndex: room.currentQIndex,
      correctIndex: currentQuestion.correctIndex,
      explanation: currentQuestion.explanation,
      votes: [...room.votes],
      playerResults,
    };
  }

  getLeaderboard(pin) {
    const room = this.getRoom(pin);
    if (!room) return [];

    const sortedPlayers = Array.from(room.players.values())
      .sort((a, b) => b.score - a.score)
      .map((p, idx) => ({
        rank: (idx + 1 < 10 ? `0${idx + 1}` : `${idx + 1}`),
        id: p.id,
        player: p.nickname,
        score: p.score.toLocaleString(),
        rawScore: p.score,
        streak: `${p.streak}x`,
        delta: "+1",
      }));

    return sortedPlayers;
  }

  finishRoom(pin) {
    const room = this.getRoom(pin);
    if (!room) return null;

    room.state = "FINISHED";
    const totalQuestions = room.quiz.questions.length;

    const sortedPlayers = Array.from(room.players.values())
      .sort((a, b) => b.score - a.score)
      .map((p, idx) => {
        const correctCount = p.correctCount || 0;
        const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
        return {
          rank: idx + 1,
          rankLabel: idx + 1 < 10 ? `0${idx + 1}` : `${idx + 1}`,
          id: p.id,
          player: p.nickname,
          score: p.score.toLocaleString(),
          rawScore: p.score,
          correctCount,
          totalQuestions,
          accuracy,
          maxStreak: p.maxStreak || p.streak || 0,
        };
      });

    const podium = [
      sortedPlayers[0] || null, // 1st Place
      sortedPlayers[1] || null, // 2nd Place
      sortedPlayers[2] || null, // 3rd Place
    ];

    const stats = {
      totalPlayers: sortedPlayers.length,
      totalQuestions,
      winner: sortedPlayers[0] || null,
      averageScore: sortedPlayers.length > 0
        ? Math.round(sortedPlayers.reduce((sum, p) => sum + p.rawScore, 0) / sortedPlayers.length)
        : 0,
      averageAccuracy: sortedPlayers.length > 0
        ? Math.round(sortedPlayers.reduce((sum, p) => sum + p.accuracy, 0) / sortedPlayers.length)
        : 0,
    };

    return {
      pin: room.pin,
      topic: room.quiz.topic,
      totalQuestions,
      leaderboard: sortedPlayers,
      podium,
      stats,
    };
  }
}

export const roomManager = new RoomManager();

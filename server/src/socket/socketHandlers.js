// Socket.IO event handlers for live multiplayer sessions
import { roomManager } from "./roomManager.js";

export function initSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    // ---------------- 1. HOST: CREATE ROOM ----------------
    socket.on("host:create-room", ({ quiz, pin }, callback) => {
      try {
        if (!quiz || !quiz.questions || quiz.questions.length === 0) {
          if (callback) callback({ success: false, error: "Quiz has no questions" });
          return;
        }

        const room = roomManager.createRoom({
          hostSocketId: socket.id,
          quiz,
          requestedPin: pin,
        });

        // Join socket room
        socket.join(`room:${room.pin}`);
        console.log(`[Socket] Host ${socket.id} created/registered room: ${room.pin}`);

        const response = {
          success: true,
          pin: room.pin,
          totalQuestions: room.quiz.questions.length,
          timeLimitSeconds: Math.round(room.timeLimitMs / 1000),
        };

        if (callback) callback(response);
        socket.emit("room:created", response);
      } catch (err) {
        console.error("[Socket] Error creating room:", err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ---------------- 2. PLAYER: JOIN ROOM ----------------
    socket.on("player:join-room", ({ pin, nickname }, callback) => {
      try {
        const result = roomManager.addPlayer(pin, {
          socketId: socket.id,
          nickname,
        });

        if (!result.success) {
          console.warn(`[Socket] Join failed for ${socket.id} on PIN ${pin}: ${result.error}`);
          if (callback) callback(result);
          return;
        }

        const room = result.room;
        socket.join(`room:${room.pin}`);
        console.log(`[Socket] Player "${result.player.nickname}" (${socket.id}) joined room ${room.pin}`);

        const response = {
          success: true,
          pin: room.pin,
          player: result.player,
          roomState: room.state,
          totalQuestions: room.quiz.questions.length,
          topic: room.quiz.topic,
          activeQuestion:
            room.state === "QUESTION_ACTIVE"
              ? roomManager.getSanitizedQuestion(room.pin)
              : null,
        };

        if (callback) callback(response);

        // Notify host and room of new player
        const playersList = Array.from(room.players.values()).map((p) => ({
          id: p.id,
          nickname: p.nickname,
          score: p.score,
        }));

        io.to(`room:${room.pin}`).emit("room:player-joined", {
          player: result.player,
          players: playersList,
          playersCount: room.players.size,
        });
      } catch (err) {
        console.error("[Socket] Error joining room:", err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ---------------- 3. HOST: START QUESTION ----------------
    socket.on("host:start-question", ({ pin, qIndex }, callback) => {
      try {
        const room = roomManager.getRoom(pin);
        if (!room) {
          if (callback) callback({ success: false, error: "Room not found" });
          return;
        }

        if (room.hostSocketId !== socket.id) {
          if (callback) callback({ success: false, error: "Unauthorized" });
          return;
        }

        const targetIndex = qIndex !== undefined ? qIndex : room.currentQIndex;
        const result = roomManager.startQuestion(pin, targetIndex);

        if (!result) {
          if (callback) callback({ success: false, error: "Invalid question index" });
          return;
        }

        if (callback) callback({ success: true, question: result.fullQuestion });

        // Send full question to host
        socket.emit("host:question-started", {
          qIndex: targetIndex,
          totalQuestions: room.quiz.questions.length,
          question: result.fullQuestion,
          timeLimitSeconds: Math.round(room.timeLimitMs / 1000),
        });

        // Anti-Cheat: broadcast sanitized question to players (no correctIndex)
        socket.to(`room:${room.pin}`).emit("game:question-started", {
          ...result.sanitizedQuestion,
        });
      } catch (err) {
        console.error("[Socket] Error starting question:", err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ---------------- 4. PLAYER: SUBMIT ANSWER ----------------
    socket.on("player:submit-answer", ({ pin, optionIndex }, callback) => {
      try {
        const result = roomManager.recordAnswer(pin, socket.id, optionIndex);

        if (!result.success) {
          if (callback) callback(result);
          return;
        }

        // Send instant result + explanation directly to the answering player
        const room = roomManager.getRoom(pin);
        const currentQ = room?.quiz?.questions?.[room?.currentQIndex];

        const playerFeedback = {
          success: true,
          optionIndex,
          points: result.points,
          isCorrect: result.isCorrect,
          correctIndex: currentQ?.correctIndex,
          explanation: currentQ?.explanation,
          streak: result.streak,
          totalScore: result.totalScore,
        };

        if (callback) callback(playerFeedback);
        socket.emit("player:answer-confirmed", playerFeedback);

        if (room) {
          // Broadcast live vote counts to host
          io.to(`room:${room.pin}`).emit("room:votes-updated", {
            votes: result.votes,
            totalAnswered: result.totalAnswered,
            totalPlayers: result.totalPlayers,
            allAnswered: result.allAnswered,
          });
        }
      } catch (err) {
        console.error("[Socket] Error submitting answer:", err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ---------------- 5. HOST: REVEAL ANSWER ----------------
    socket.on("host:reveal-answer", ({ pin }, callback) => {
      try {
        const room = roomManager.getRoom(pin);
        if (!room) {
          if (callback) callback({ success: false, error: "Room not found" });
          return;
        }

        const result = roomManager.revealQuestion(pin);
        if (!result) {
          if (callback) callback({ success: false, error: "Cannot reveal" });
          return;
        }

        if (callback) callback({ success: true, result });

        // Broadcast reveal breakdown to everyone in room
        io.to(`room:${room.pin}`).emit("game:question-revealed", {
          qIndex: result.qIndex,
          correctIndex: result.correctIndex,
          explanation: result.explanation,
          votes: result.votes,
          playerResults: result.playerResults,
        });
      } catch (err) {
        console.error("[Socket] Error revealing answer:", err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ---------------- 6. HOST: SHOW LEADERBOARD ----------------
    socket.on("host:show-leaderboard", ({ pin }, callback) => {
      try {
        const room = roomManager.getRoom(pin);
        if (!room) {
          if (callback) callback({ success: false, error: "Room not found" });
          return;
        }

        room.state = "LEADERBOARD";
        const leaderboard = roomManager.getLeaderboard(pin);

        if (callback) callback({ success: true, leaderboard });

        io.to(`room:${room.pin}`).emit("game:leaderboard-updated", {
          leaderboard,
        });
      } catch (err) {
        console.error("[Socket] Error getting leaderboard:", err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ---------------- 7. HOST: FINISH QUIZ / SHOW PODIUM ----------------
    socket.on("host:finish-quiz", ({ pin }, callback) => {
      try {
        const room = roomManager.getRoom(pin);
        if (!room) {
          if (callback) callback({ success: false, error: "Room not found" });
          return;
        }

        const finaleData = roomManager.finishRoom(pin);
        if (!finaleData) {
          if (callback) callback({ success: false, error: "Could not finalize quiz" });
          return;
        }

        console.log(
          `[Socket] Host finalized quiz in room ${room.pin}. Winner: ${
            finaleData.stats.winner?.player || "None"
          }`
        );

        if (callback) callback({ success: true, ...finaleData });

        // Broadcast game:quiz-finished to everyone in room (host + all contestants)
        io.to(`room:${room.pin}`).emit("game:quiz-finished", finaleData);
      } catch (err) {
        console.error("[Socket] Error finishing quiz:", err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ---------------- 7. DISCONNECT HANDLING ----------------
    socket.on("disconnect", () => {
      // Check if disconnected socket was a host
      const hostPin = roomManager.hostToRoom.get(socket.id);
      if (hostPin) {
        io.to(`room:${hostPin}`).emit("room:host-disconnected", {
          message: "Host disconnected. Room ended.",
        });
        roomManager.deleteRoom(hostPin);
        return;
      }

      // Check if disconnected socket was a player
      const playerResult = roomManager.removePlayer(socket.id);
      if (playerResult && playerResult.room) {
        const room = playerResult.room;
        const playersList = Array.from(room.players.values()).map((p) => ({
          id: p.id,
          nickname: p.nickname,
          score: p.score,
        }));

        io.to(`room:${room.pin}`).emit("room:player-left", {
          playerId: socket.id,
          nickname: playerResult.player?.nickname,
          players: playersList,
          playersCount: room.players.size,
        });
      }
    });
  });
}

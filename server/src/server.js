import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";
import quizRoutes from "./routes/quizRoutes.js";
import { initSocketHandlers } from "./socket/socketHandlers.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(
  cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);
app.use(express.json());

// Routes
app.use("/api/quizzes", quizRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    timestamp: new Date().toISOString(),
  });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../../client/dist");

// Serve frontend build in production
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

// Create HTTP server and attach Socket.IO
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["polling", "websocket"],
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Initialize real-time multiplayer socket events
initSocketHandlers(io);

// Start HTTP and WebSocket server
httpServer.listen(PORT, () => {
  console.log(`[Express + Socket.IO] Multiplayer server running on http://localhost:${PORT}`);
});

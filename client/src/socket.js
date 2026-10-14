import { io } from "socket.io-client";

// Dynamically connect to the backend server
const getSocketUrl = () => {
  if (import.meta.env?.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
  // In production (bundled build served by Express/Docker), connect to same origin
  if (!import.meta.env.DEV) return "/";
  // In local development (Vite dev server), point to backend port 5001
  const hostname = typeof window !== "undefined" ? window.location.hostname || "localhost" : "localhost";
  return `http://${hostname}:5001`;
};

export const socket = io(getSocketUrl(), {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 20,
  reconnectionDelay: 1000,
  transports: ["polling", "websocket"],
});

socket.on("connect", () => {
  console.log("[Socket.IO] Connected to backend server! ID:", socket.id);
});

socket.on("connect_error", (err) => {
  console.warn("[Socket.IO] Connection error:", err.message);
});

socket.on("disconnect", (reason) => {
  console.log("[Socket.IO] Disconnected from server:", reason);
});

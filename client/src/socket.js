import { io } from "socket.io-client";

// Dynamically connect to the backend server
const getSocketUrl = () => {
  if (import.meta.env?.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
  if (typeof window === "undefined") return "http://localhost:5001";
  const { hostname, port } = window.location;
  // If running on Vite dev server (port 5173, 5174, etc.)
  if (port && port !== "5001") {
    return `http://${hostname}:5001`;
  }
  return "/";
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

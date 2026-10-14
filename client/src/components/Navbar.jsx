import React from "react";

export function Navbar({
  flowState,
  onReset,
  onLaunchLive,
  onEndLive,
  onTogglePhone,
  isPhoneOpen,
}) {
  return (
    <header className="border-b-2 border-[#111111] bg-[#F4EFE6] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={onReset}
        >
          <div className="w-8 h-8 bg-[#111111] text-[#F4EFE6] flex items-center justify-center font-display font-black text-sm border-2 border-[#111111] group-hover:bg-[#FF4A1C] transition">
            ▲
          </div>
          <div className="flex flex-col">
            <span className="font-display font-extrabold text-xl tracking-tight uppercase text-[#111111] leading-none">
              SHOWDOWN<span className="text-[#FF4A1C]">.AI</span>
            </span>
            <span className="poster-label text-[10px] text-[#111111]/70 leading-none mt-0.5">
              LIVE MULTIPLAYER QUIZ ENGINE
            </span>
          </div>
        </div>

        {/* Cohesive Step Indicators (No messy fake tabs) */}
        <div className="hidden md:flex items-center space-x-2">
          <div
            className={`px-3 py-1 poster-label text-xs border-2 ${
              flowState === "create"
                ? "bg-[#111111] text-[#F4EFE6] border-[#111111] font-bold"
                : "bg-transparent text-[#111111]/60 border-transparent"
            }`}
          >
            1. PROMPT
          </div>
          <span className="text-[#111111]/30">→</span>
          <div
            className={`px-3 py-1 poster-label text-xs border-2 ${
              flowState === "review"
                ? "bg-[#111111] text-[#F4EFE6] border-[#111111] font-bold"
                : "bg-transparent text-[#111111]/60 border-transparent"
            }`}
          >
            2. DEAL & EDIT
          </div>
          <span className="text-[#111111]/30">→</span>
          <div
            className={`px-3 py-1 poster-label text-xs border-2 ${
              flowState === "live"
                ? "bg-[#FF4A1C] text-[#F4EFE6] border-[#111111] font-bold animate-pulse"
                : "bg-transparent text-[#111111]/60 border-transparent"
            }`}
          >
            3. LIVE ARENA
          </div>
        </div>

        {/* Contextual Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Phone Simulation Toggle */}
          <button
            onClick={onTogglePhone}
            className={`poster-label px-3 py-1.5 text-xs transition border-2 border-[#111111] cursor-pointer ${
              isPhoneOpen
                ? "bg-[#111111] text-[#F4EFE6]"
                : "bg-[#F4EFE6] text-[#111111] hover:bg-[#E5DFD5]"
            }`}
            title="Toggle contestant phone simulation"
          >
            📱{" "}
            {flowState === "live"
              ? isPhoneOpen
                ? "HIDE DOCKED PHONE"
                : "SPLIT PHONE VIEW"
              : isPhoneOpen
              ? "HIDE PHONE"
              : "CONTESTANT PHONE"}
          </button>

          {flowState === "review" && (
            <button
              onClick={onLaunchLive}
              className="poster-label px-3.5 py-1.5 text-xs font-black uppercase transition border-2 border-[#111111] bg-[#FF4A1C] text-[#F4EFE6] hover:bg-[#111111] cursor-pointer"
            >
              RUN LIVE →
            </button>
          )}

          {flowState === "live" && (
            <button
              onClick={onEndLive}
              className="poster-label px-3 py-1.5 text-xs font-bold uppercase transition border-2 border-[#111111] bg-[#F4EFE6] hover:bg-[#D7263D] hover:text-white text-[#111111] cursor-pointer"
            >
              ✕ END GAME
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

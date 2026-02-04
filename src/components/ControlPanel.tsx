import React, { useState, useEffect } from "react";
import { MicOff, Settings, Send, Power } from "lucide-react";
import api from "../api";
import type { VoiceProfile } from "../api";

interface ControlPanelProps {
  isActive: boolean;
  onToggle: () => void;
  currentVoice: string;
  onVoiceChange: (voice: string) => void;
  onSendText: (text: string) => void;
  onSettingsClick: () => void;
  isCompact?: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  isActive,
  onToggle,
  currentVoice,
  onVoiceChange,
  onSendText,
  onSettingsClick,
  isCompact = false,
}) => {
  const [inputText, setInputText] = useState("");
  const [voices, setVoices] = useState<VoiceProfile[]>([]);

  useEffect(() => {
    loadVoices();
  }, []);

  const loadVoices = async () => {
    try {
      const res = await api.listVoices();
      setVoices(res.voices);
    } catch (err) {
      console.error("Failed to load voices:", err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendText(inputText);
      setInputText("");
    }
  };

  return (
    <div 
      className={`fixed left-1/2 -translate-x-1/2 flex flex-col items-center w-full z-50 transition-all duration-300
      ${isCompact 
        ? "bottom-4 gap-3 max-w-5xl px-4" 
        : "bottom-8 gap-4 max-w-4xl px-6"
      }`}
    >
      <div 
        className={`flex items-center bg-slate-900/95 backdrop-blur-2xl border border-slate-700/50 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] w-full transition-all duration-300 focus-within:ring-2 focus-within:ring-indigo-500/20
        ${isCompact 
          ? "gap-2 p-2 rounded-2xl" 
          : "gap-3 p-2.5 rounded-[2rem]"
        }`}
      >
        {/* Toggle Connection / Mic */}
        <button
          onClick={onToggle}
          title={isActive ? "Disconnect Session" : "Connect Session"}
          className={`flex-shrink-0 flex items-center justify-center transition-all duration-300 group
          ${isCompact 
            ? "w-10 h-10 rounded-xl" 
            : "w-12 h-12 rounded-2xl"}
          ${isActive
              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white"
              : "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95"
          }`}
        >
          {isActive ? (
            <MicOff className={isCompact ? "w-4 h-4" : "w-5 h-5"} />
          ) : (
            <Power className={isCompact ? "w-4 h-4" : "w-5 h-5"} />
          )}
        </button>

        {/* Text Input Column */}
        {/* Text Input Column */}
        <form
          onSubmit={handleSubmit}
          className={`flex-1 flex items-center bg-slate-800/40 border border-slate-700/20 transition-all focus-within:bg-slate-800/60 focus-within:border-indigo-500/40
          ${isCompact 
            ? "rounded-xl px-3" 
            : "rounded-2xl px-5"
          }`}
        >
          <input
            type="text"
            placeholder={
              isActive
                ? "Ketik pesan untuk Luna..."
                : "Ketik untuk memulai percakapan..."
            }
            className={`bg-transparent flex-1 text-white placeholder:text-slate-500 focus:outline-none
            ${isCompact ? "py-3 text-sm" : "py-3.5 text-sm"}`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className={`transition-all duration-300 ${isCompact ? "p-2" : "p-2"} ${
              inputText.trim()
                ? "text-indigo-400 hover:text-indigo-300 scale-110"
                : "text-slate-600 scale-100"
            }`}
          >
            <Send className={isCompact ? "w-4 h-4" : "w-5 h-5"} />
          </button>
        </form>

        {/* Voice Selector - Desktop Only */}
        <div className={`hidden md:flex items-center border-l border-slate-800
        ${isCompact ? "px-2 gap-2" : "px-4 gap-3"}`}>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Voice Profile
            </span>
            <select
              className="bg-transparent text-xs font-bold text-indigo-400 focus:outline-none cursor-pointer hover:text-indigo-300 transition-colors max-w-[120px]"
              value={currentVoice}
              onChange={(e) => onVoiceChange(e.target.value)}
            >
              <option
                value="default"
                className="bg-slate-900 text-white font-sans"
              >
                Default (Male)
              </option>
              {voices.map((v) => (
                <option
                  key={v.name}
                  value={v.name}
                  className="bg-slate-900 text-white font-sans"
                >
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Audio Visualizer Activity */}
          <div className="flex gap-1 items-end h-6 w-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-500 ${isActive ? "bg-indigo-500" : "bg-slate-700 h-1"}`}
                style={{
                  height: isActive ? `${30 + Math.random() * 70}%` : "4px",
                  animation: isActive
                    ? `pulse 1.5s ease-in-out infinite ${i * 0.2}s`
                    : "none",
                }}
              />
            ))}
          </div>

          {/* Settings Button */}
          {/* Settings Button */}
          <button
            onClick={onSettingsClick}
            className={`rounded-xl hover:bg-slate-800 text-slate-500 hover:text-white transition-colors
            ${isCompact ? "p-2" : "p-2"}`}
            title="Settings"
          >
            <Settings className={isCompact ? "w-4 h-4" : "w-5 h-5"} />
          </button>
        </div>
      </div>

      {/* Keyboard Hint */}
      <div className="flex items-center gap-2 text-[9px] font-bold text-slate-600 uppercase tracking-widest">
        <span>Press</span>
        <span className="px-1.5 py-0.5 rounded border border-slate-800 bg-slate-900">
          Enter
        </span>
        <span>to send message</span>
      </div>
    </div>
  );
};

export default ControlPanel;
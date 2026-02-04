import React from "react";
import type { PipelineState } from "../types";
import {
  MessageSquare,
  Cpu,
  Volume2,
  ChevronRight,
  Loader2,
} from "lucide-react";

interface PipelineMonitorProps {
  status: PipelineState;
}

const PipelineMonitor: React.FC<PipelineMonitorProps> = ({ status }) => {
  // Calculate current active step based on pipeline state
  const getActiveStep = () => {
    if (status.output === "playing") return 4;
    if (status.downlink === "receiving") return 3;
    if (status.processing === "thinking") return 2;
    if (status.uplink === "transmitting") return 1;
    if (status.input === "active") return 0;
    return -1;
  };

  const activeStep = getActiveStep();

  const steps = [
    {
      id: "input",
      icon: MessageSquare,
      label: "Input",
      desc: "User Message",
      isActive: status.input === "active" || activeStep >= 0,
    },
    {
      id: "processing",
      icon: Cpu,
      label: "AI Processing",
      desc: "LLM + Context",
      isActive: activeStep >= 1,
      isThinking: status.processing === "thinking",
    },
    {
      id: "output",
      icon: Volume2,
      label: "Output",
      desc: "TTS + Voice Clone",
      isActive: activeStep >= 3,
      isPlaying: status.output === "playing",
    },
  ];

  return (
    <div className="flex items-center gap-1 bg-slate-900/60 backdrop-blur-md border border-slate-800 px-4 py-2 rounded-2xl shadow-xl">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          {/* Step */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300 ${
              step.isActive
                ? step.isThinking || step.isPlaying
                  ? "bg-indigo-600/30 border border-indigo-500/50"
                  : "bg-slate-800/80"
                : "bg-transparent"
            }`}
          >
            {/* Icon */}
            <div
              className={`p-1.5 rounded-lg transition-all duration-300 ${
                step.isThinking || step.isPlaying
                  ? "bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.6)]"
                  : step.isActive
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-slate-800 text-slate-600"
              }`}
            >
              {step.isThinking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <step.icon
                  className={`w-3.5 h-3.5 ${step.isPlaying ? "animate-pulse" : ""}`}
                />
              )}
            </div>

            {/* Label */}
            <div className="flex flex-col">
              <span
                className={`text-[9px] font-bold uppercase tracking-wider leading-none ${
                  step.isThinking || step.isPlaying
                    ? "text-indigo-300"
                    : step.isActive
                      ? "text-slate-300"
                      : "text-slate-600"
                }`}
              >
                {step.label}
              </span>
              <span
                className={`text-[7px] tracking-wide ${
                  step.isActive ? "text-slate-500" : "text-slate-700"
                }`}
              >
                {step.isThinking
                  ? "Processing..."
                  : step.isPlaying
                    ? "Speaking..."
                    : step.desc}
              </span>
            </div>
          </div>

          {/* Arrow connector */}
          {index < steps.length - 1 && (
            <div className="flex items-center">
              <ChevronRight
                className={`w-4 h-4 transition-colors duration-300 ${
                  steps[index + 1].isActive
                    ? "text-indigo-500"
                    : "text-slate-700"
                }`}
              />
            </div>
          )}
        </React.Fragment>
      ))}

      {/* Progress bar */}
      <div className="ml-3 w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            status.processing === "thinking"
              ? "bg-indigo-500 animate-pulse"
              : status.output === "playing"
                ? "bg-emerald-500"
                : "bg-slate-700"
          }`}
          style={{
            width:
              activeStep === -1
                ? "0%"
                : activeStep === 0
                  ? "10%"
                  : activeStep === 1
                    ? "33%"
                    : activeStep === 2
                      ? "66%"
                      : activeStep >= 3
                        ? "100%"
                        : "0%",
          }}
        />
      </div>
    </div>
  );
};

export default PipelineMonitor;
import React, { useEffect, useState, useRef, useCallback } from "react";
import type { VTuberState } from "../types";

// Character types
export interface VTuberCharacterData {
  id: string;
  name: string;
  type: "svg" | "image" | "live2d";
  path?: string | null;
  thumbnail?: string | null;
}

// Default SVG character
export const DEFAULT_CHARACTER: VTuberCharacterData = {
  id: "default",
  name: "Luna (Default)",
  type: "svg",
};

interface VTuberCharacterProps {
  state: VTuberState;
  character?: VTuberCharacterData;
  apiBaseUrl?: string;
  emotion?: string;  // Current emotion from Gemini analysis
}

// Default SVG Character Component
const DefaultSVGCharacter: React.FC<{ state: VTuberState; blink: boolean }> = ({
  state,
  blink,
}) => (
  <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
    {/* Hair Back */}
    <path
      d="M40,100 Q40,40 100,40 Q160,40 160,100 L170,140 Q100,160 30,140 Z"
      fill="#4C1D95"
    />

    {/* Body */}
    <ellipse cx="100" cy="180" rx="60" ry="40" fill="#6D28D9" />
    <rect x="70" y="150" width="60" height="30" fill="#6D28D9" rx="10" />

    {/* Head Shape */}
    <path
      d="M55,100 Q55,50 100,50 Q145,50 145,100 Q145,145 100,145 Q55,145 55,100"
      fill="#FDE047"
    />

    {/* Blush */}
    <circle cx="75" cy="115" r="8" fill="#FCA5A5" opacity="0.4" />
    <circle cx="125" cy="115" r="8" fill="#FCA5A5" opacity="0.4" />

    {/* Eyes */}
    {blink ? (
      <>
        <line
          x1="70"
          y1="100"
          x2="90"
          y2="100"
          stroke="#1E1B4B"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <line
          x1="110"
          y1="100"
          x2="130"
          y2="100"
          stroke="#1E1B4B"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </>
    ) : (
      <>
        {/* Left Eye */}
        <circle cx="80" cy="100" r="10" fill="#1E1B4B" />
        <circle cx="83" cy="97" r="3" fill="white" />
        {/* Right Eye */}
        <circle cx="120" cy="100" r="10" fill="#1E1B4B" />
        <circle cx="123" cy="97" r="3" fill="white" />
      </>
    )}

    {/* Brows */}
    <path
      d="M70,85 Q80,80 90,85"
      fill="none"
      stroke="#1E1B4B"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M110,85 Q120,80 130,85"
      fill="none"
      stroke="#1E1B4B"
      strokeWidth="2"
      strokeLinecap="round"
    />

    {/* Mouth */}
    <g transform="translate(100, 125)">
      {state.isTalking ? (
        <ellipse
          cx="0"
          cy="0"
          rx="12"
          ry="8"
          fill="#881337"
          className="mouth-talking"
          style={{ transformOrigin: "center" }}
        />
      ) : (
        <path
          d="M-8,0 Q0,8 8,0"
          fill="none"
          stroke="#881337"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}
    </g>

    {/* Hair Front */}
    <path
      d="M50,100 Q50,45 100,45 Q150,45 150,100 Q150,60 120,55 Q100,50 80,55 Q50,60 50,100"
      fill="#5B21B6"
    />
  </svg>
);

// Live2D Character Component using iframe approach (more reliable)
const Live2DCharacter: React.FC<{
  state: VTuberState;
  modelPath: string;
  apiBaseUrl: string;
  emotion?: string;
  characterName?: string;
}> = ({ state, modelPath, apiBaseUrl, emotion = "neutral", characterName = "Unknown" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);

  // console.log(`🎨 [Live2DCharacter] Rendered (modelPath: ${modelPath}, isTalking: ${state.isTalking})`);

  const initLive2D = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      setIsLoading(true);
      setError(null);
      setModelLoaded(false);

      // 1. Cleanup old app if exists
      if (pixiAppRef.current) {
        try {
            pixiAppRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
        } catch (e) {}
        pixiAppRef.current = null;
        modelRef.current = null;
      }

      // Clear container
      containerRef.current.innerHTML = "";

      // 2. Create canvas
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 400;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      containerRef.current.appendChild(canvas);

      const PIXI = (window as any).PIXI;
      const Live2DModel = PIXI?.live2d?.Live2DModel;

      if (!PIXI || !Live2DModel) {
        throw new Error("Live2D SDK (PIXI/Live2DModel) not found. Check index.html.");
      }

      // 3. Init PIXI App
      const app = new PIXI.Application({
        view: canvas,
        transparent: true,
        backgroundAlpha: 0,
        width: 400,
        height: 400,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      pixiAppRef.current = app;

      // 4. Load Model
      let fullUrl = modelPath;
      if (!modelPath.startsWith("/") && !modelPath.startsWith("http")) {
        fullUrl = `${apiBaseUrl}${modelPath}`;
      }
      
      const model = await Live2DModel.from(fullUrl, { 
        autoInteract: true, // Enable auto-interaction for more dynamic behavior (e.g. head tracking)
      });
      
      // Re-check if we are still mounted
      if (!containerRef.current || pixiAppRef.current !== app) {
        try { app.destroy(true); } catch(e) {}
        return;
      }

      modelRef.current = model;

      // Scale/Pos
      const scale = Math.min(app.screen.width / model.width, app.screen.height / model.height) * 2.5;
      model.scale.set(scale);
      model.anchor.set(0.5, 0.5);
      model.x = app.screen.width / 2;
      model.y = app.screen.height / 0.85;

      app.stage.addChild(model);
      
      setModelLoaded(true);
      setIsLoading(false);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Live2D model");
      setIsLoading(false);
    }
  }, [modelPath, apiBaseUrl, characterName]);

  useEffect(() => {
    initLive2D();
    return () => {
      if (pixiAppRef.current) {
        try {
            pixiAppRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
        } catch (e) {}
        pixiAppRef.current = null;
        modelRef.current = null;
      }
    };
  }, [initLive2D]);

  useEffect(() => {
    const app = pixiAppRef.current;
    const model = modelRef.current;

    if (!app || !model || !modelLoaded) return;

    // --- Animation State ---
    let blinkValue = 1;
    let blinkTimer = 2 + Math.random() * 3;
    let isBlinking = false;

    // Saccade state (micro eye jumps)
    let saccadeTimer = 0.5 + Math.random() * 1.5;
    let saccadeOffsetX = 0;
    let saccadeOffsetY = 0;

    // Spring-Damper state for smooth eye tracking (for future mouse tracking)
    let eyeVelX = 0;
    let eyeVelY = 0;
    let eyePosX = 0;
    let eyePosY = 0;
    const eyeSpringK = 8; // Stiffness
    const eyeDamping = 0.5; // Damping factor

    // --- Helper: Fractal Noise (Layered Sine for Perlin-like effect) ---
    const fractalNoise = (t: number, octaves: number = 4, persistence: number = 0.5): number => {
      let total = 0;
      let amplitude = 1;
      let maxValue = 0;
      let frequency = 1;
      for (let i = 0; i < octaves; i++) {
        total += Math.sin(t * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= 2.1; // Slightly different ratio for less predictability
      }
      return total / maxValue;
    };

    const onUpdate = () => {
      const coreModel = model.internalModel?.coreModel;
      if (!coreModel) return;

      const safeSetParam = (id: string, val: number) => {
        try {
          if (model.setParameterValue) model.setParameterValue(id, val);
          else if (coreModel.setParameterValueById) coreModel.setParameterValueById(id, val);
        } catch (e) {}
      };

      const now = Date.now();
      const time = now / 1000;
      const deltaTime = Math.min(app.ticker.elapsedMS / 1000, 0.1); // Capped delta

      // =============================================
      // 1. Natural Eye Blinking Logic
      // =============================================
      if (!isBlinking) {
        blinkTimer -= deltaTime;
        if (blinkTimer <= 0) {
          isBlinking = true;
          blinkTimer = 0.12 + Math.random() * 0.06; // 120-180ms blink
        }
      } else {
        blinkTimer -= deltaTime;
        const halfBlink = 0.06 + Math.random() * 0.03;
        if (blinkTimer > halfBlink) {
          blinkValue = (blinkTimer - halfBlink) / halfBlink;
        } else if (blinkTimer > 0) {
          blinkValue = (halfBlink - blinkTimer) / halfBlink;
        } else {
          isBlinking = false;
          blinkValue = 1;
          blinkTimer = 2 + Math.random() * 4; // 2-6s until next blink
        }
      }
      safeSetParam("ParamEyeLOpen", blinkValue);
      safeSetParam("ParamEyeROpen", blinkValue);
      safeSetParam("PARAM_EYE_L_OPEN", blinkValue);
      safeSetParam("PARAM_EYE_R_OPEN", blinkValue);

      // =============================================
      // 2. Breathing (Organic Noise)
      // =============================================
      const breathVal = (fractalNoise(time * 0.6, 2, 0.6) + 1) / 2;
      safeSetParam("ParamBreath", breathVal);

      // =============================================
      // 3. Head & Body Sway (Perlin-like Fractal Noise)
      // =============================================
      const headX = fractalNoise(time * 0.35 + 100, 3, 0.5) * 8;
      const headY = fractalNoise(time * 0.4 + 200, 3, 0.5) * 5;
      const headZ = fractalNoise(time * 0.25 + 300, 2, 0.6) * 4;

      safeSetParam("ParamAngleX", headX);
      safeSetParam("ParamAngleY", headY);
      safeSetParam("ParamAngleZ", headZ);

      // Body follows head with reduced intensity (physics coupling)
      safeSetParam("ParamBodyAngleX", headX * 0.5);
      safeSetParam("ParamBodyAngleY", headY * 0.4);
      safeSetParam("ParamBodyAngleZ", headZ * 0.3);
      
      // Kamiyahakuko specific body IDs
      safeSetParam("Param49", headX * 0.25);
      safeSetParam("Param51", headY * 0.2);
      safeSetParam("Param50", headZ * 0.15);

      // =============================================
      // 4. Saccadic Gaze (Micro Eye Movements)
      // =============================================
      saccadeTimer -= deltaTime;
      if (saccadeTimer <= 0) {
        // Trigger a new saccade (quick jump to a new point)
        saccadeOffsetX = (Math.random() - 0.5) * 0.4;
        saccadeOffsetY = (Math.random() - 0.5) * 0.25;
        saccadeTimer = 0.3 + Math.random() * 1.2; // Next saccade in 0.3-1.5s
      }

      // Target gaze (base + saccade offset)
      const targetGazeX = fractalNoise(time * 0.15, 2, 0.5) * 0.3 + saccadeOffsetX;
      const targetGazeY = fractalNoise(time * 0.12 + 50, 2, 0.5) * 0.2 + saccadeOffsetY;

      // Spring-Damper physics for smooth interpolation
      const accelX = (targetGazeX - eyePosX) * eyeSpringK - eyeVelX * eyeDamping;
      const accelY = (targetGazeY - eyePosY) * eyeSpringK - eyeVelY * eyeDamping;
      eyeVelX += accelX * deltaTime;
      eyeVelY += accelY * deltaTime;
      eyePosX += eyeVelX * deltaTime;
      eyePosY += eyeVelY * deltaTime;

      safeSetParam("ParamEyeBallX", eyePosX);
      safeSetParam("ParamEyeBallY", eyePosY);

      // =============================================
      // 5. Subtle Physics (Accessories, Ribbons)
      // =============================================
      const physicsSway = fractalNoise(time * 1.2, 2, 0.5) * 0.6;
      safeSetParam("Param52", physicsSway); // Ribbon
      safeSetParam("Param53", fractalNoise(time * 0.8 + 400, 2, 0.5) * 0.15); // Chest X
      safeSetParam("Param56", fractalNoise(time * 0.9 + 500, 2, 0.5) * 0.1); // Chest Y

      // =============================================
      // 6. Mouth (Talking)
      // =============================================
      const mouthIds = [
        "ParamMouthOpenY", "paramMouthOpenY", "MouthOpenY",
        "PARAM_MOUTH_OPEN_Y", "ParamMouthOpen", "ParamA"
      ];
      if (state.isTalking) {
        const talkVal = Math.sin(now / 80) * 0.5 + 0.5;
        mouthIds.forEach(id => safeSetParam(id, talkVal));
        safeSetParam("ParamMouthForm", 0.2 + Math.sin(time * 2) * 0.1);
      } else {
        mouthIds.forEach(id => safeSetParam(id, 0));
        safeSetParam("ParamMouthForm", 0);
      }

      // =============================================
      // 7. Emotion Override
      // =============================================
      const expressionMap: Record<string, Record<string, number>> = {
        happy: { ParamEyeLSmile: 1, ParamEyeRSmile: 1, ParamMouthForm: 1, ParamBrowLForm: 1, ParamBrowRForm: 1, Param91: 0.5 },
        sad: { ParamBrowLY: -1, ParamBrowRY: -1, ParamMouthForm: -1, ParamBrowLForm: -1, ParamBrowRForm: -1 },
        angry: { ParamBrowLY: 1, ParamBrowRY: 1, ParamMouthForm: -1, ParamBrowLForm: -0.5, ParamBrowRForm: -0.5, Param92: 1 },
        surprised: { ParamBrowLY: 1, ParamBrowRY: 1, ParamEyeBallY: 0.5, ParamEyeLOpen: 1.2, ParamEyeROpen: 1.2 },
      };
      const params = expressionMap[emotion || "neutral"] || {};
      Object.entries(params).forEach(([id, val]) => safeSetParam(id, val));
    };

    app.ticker.add(onUpdate);
    return () => {
      if (app && app.ticker) app.ticker.remove(onUpdate);
    };
  }, [state.isTalking, emotion, modelLoaded, characterName]);

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-rose-400 p-4">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-sm text-center max-w-[250px] mb-2">{error}</p>
        <p className="text-xs text-slate-500 text-center mb-4">
          Pastikan Live2D SDK script di index.html sudah benar
        </p>
        <button
          onClick={initLive2D}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-500"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full h-full flex items-center justify-center bg-transparent"
      style={{ background: 'transparent' }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-transparent">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            <p className="text-xs text-slate-400">Loading Live2D...</p>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center bg-transparent"
        style={{ background: 'transparent' }}
      />
    </div>
  );
};

const VTuberCharacter: React.FC<VTuberCharacterProps> = ({
  state,
  character = DEFAULT_CHARACTER,
  apiBaseUrl = "http://localhost:8000",
  emotion = "neutral",
}) => {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const blinkInterval = setInterval(
      () => {
        setBlink(true);
        setTimeout(() => setBlink(false), 150);
      },
      4000 + Math.random() * 3000
    );
    return () => clearInterval(blinkInterval);
  }, []);

  // console.log(`👤 [VTuberCharacter] Rendering character: ${character.name} (ID: ${character.id}, Type: ${character.type})`);

  const renderCharacter = () => {
    // Default SVG character
    if (character.id === "default" || character.type === "svg") {
      return <DefaultSVGCharacter state={state} blink={blink} />;
    }

    // Live2D character
    if (character.type === "live2d" && character.path) {
      return (
        <Live2DCharacter
          state={state}
          modelPath={character.path}
          apiBaseUrl={apiBaseUrl}
          emotion={emotion}
          characterName={character.name}
        />
      );
    }

    // Fallback to default
    return <DefaultSVGCharacter state={state} blink={blink} />;
  };

  return (
    <div 
      className="relative w-full h-full flex items-center justify-center pointer-events-none bg-transparent"
      style={{ background: 'transparent' }}
    >
      <style>{`
        @keyframes floating {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        @keyframes mouthMove {
          0% { transform: scaleY(0.2); }
          50% { transform: scaleY(1.2); }
          100% { transform: scaleY(0.2); }
        }
        .animate-float {
          animation: floating 4s ease-in-out infinite;
        }
        .mouth-talking {
          animation: mouthMove 0.15s ease-in-out infinite;
        }
      `}</style>

      <div className="animate-float relative w-64 h-64 md:w-96 md:h-96">
        {renderCharacter()}

        {/* STATUS INDICATOR (THOUGHT BUBBLE STYLE) */}
        <div className="absolute top-0 left-[60%] -translate-x-1/2 z-20">
          {state.isThinking && (
            <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div
                className="bg-slate-800/90 backdrop-blur-xl px-5 py-3 rounded-3xl border border-indigo-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.2)]
                              after:absolute after:content-[''] 
                              after:border-t-[12px] after:border-t-slate-800/90 
                              after:border-l-[12px] after:border-l-transparent
                              after:border-r-[0px] after:border-r-transparent
                              after:bottom-[-11px] after:left-6 after:skew-x-[-10deg]"
              >
                <div className="flex gap-2">
                  <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce"></span>
                  <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VTuberCharacter;
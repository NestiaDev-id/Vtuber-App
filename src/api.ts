/**
 * API Service - Connects frontend to Tauri Backend (Rust)
 */

import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";

// Types
export interface ChatRequest {
  message: string;
  sessionId?: string;
  useVoiceOutput?: boolean;
}

export interface ChatResponse {
  response: string;
  sessionId: string;
  audioPath?: string;
  responseTime: number;
}

export interface OrchestratedResponse {
  response: string;
  emotion: string;
  expression_params: Record<string, number>;
  provider_used: string;
  resource_state: string;
  sessionId: string;
  audioPath?: string;
}

export interface ResourceStatus {
  cpu_percent: number;
  ram_percent: number;
  ram_used_gb: number;
  ram_total_gb: number;
  gpu_percent?: number;
  gpu_memory_used_gb?: number;
  gpu_memory_total_gb?: number;
  state: string;
}

export interface VoiceProfile {
  name: string;
  audioPath: string;
  sampleRate: number;
  description: string;
}

export interface VoiceListResponse {
  voices: VoiceProfile[];
  activeVoice?: string;
}

export interface HealthResponse {
  status: string;
  llm_loaded: boolean;
  voice_cloning_active: boolean;
  active_voice?: string;
}

export interface AudioAnalysis {
  filepath: string;
  sample_rate: number;
  duration: number;
  channels: number;
  rms_level: number;
  peak_level: number;
  noise_floor: number;
  quality: string;
}

export interface PreprocessResponse {
  success: boolean;
  output_path?: string;
  original_analysis?: AudioAnalysis;
  processed_analysis?: AudioAnalysis;
  message: string;
}

export interface SessionInfo {
  session_id: string;
  turn_count: number;
}


// API Usage Statistics
export interface ProviderUsage {
  today: number;
  total: number;
  lastReset: string;
}

export interface UsageStats {
  groq: ProviderUsage;
  gemini: ProviderUsage;
  mistral: ProviderUsage;
  openai: ProviderUsage;
  tts: ProviderUsage;
}

// ========================================
// Memory / RAG System Types
// ========================================

export interface MemoryEntry {
  id: string;
  text: string;
  role: string;  // "user" or "assistant"
  timestamp: number;
}

export interface StoreMemoryRequest {
  text: string;
  role: string;
  mistralApiKey: string;
}

export interface QueryMemoryRequest {
  query: string;
  mistralApiKey: string;
  topK?: number;
}

export interface QueryMemoryResponse {
  memories: MemoryEntry[];
}

// API Functions
export const api = {
  // Health check - Mocked for Rust
  async health(): Promise<HealthResponse> {
    return { 
        status: "ok", 
        llm_loaded: true, 
        voice_cloning_active: false,
        active_voice: "default"
    };
  },

  // Load LLM model - No-op for API providers
  async loadModel(): Promise<{ status: string }> {
    return { status: "loaded" };
  },

  // Set click-through mode for transparent window
  async setClickThrough(enable: boolean): Promise<void> {
    await invoke("set_click_through", { enable });
  },

  // Send chat message
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    // Determine provider/key from settings (handled in Rust or we pass them? NO, Rust handles it via stored settings actually)
    // Wait, the Rust command 'send_chat_message' takes provider/key in arguments in llm.rs.
    // So we need to fetch settings first? OR we should update Rust command to read settings internally.
    // The current `llm.rs` EXPECTS provider/key in the request.
    // So `api.ts` must fetch settings first.
    
    // 1. Get Settings
    const settings = await api.getApiSettings();
    if (!settings.apiKey && settings.provider !== "local") {
         throw new Error("API Key not set");
    }

    // 2. Prepare Request
    const rustRequest = {
        message: request.message,
        sessionId: request.sessionId,
        provider: settings.provider,
        apiKey: settings.apiKey,
        model: settings.model || settings.defaultModels[settings.provider] || "llama-3.3-70b-versatile"
    };

    try {
        const res: any = await invoke("send_chat_message", { request: rustRequest });
        return {
            response: res.response,
            sessionId: res.sessionId,
            responseTime: 0
        };
    } catch (e) {
        throw new Error(String(e));
    }
  },

  // Emotion Analysis (Gemini Pro)
  async analyzeEmotion(text: string): Promise<{ emotion: string; confidence: number }> {
    try {
      const settings = await api.getApiSettings();
      // Use Gemini API key - check if current provider is gemini, otherwise use env var
      let geminiKey = "";
      if (settings.provider === "gemini") {
        geminiKey = settings.apiKey;
      } else {
        // Fallback to env var for Gemini specifically
        geminiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
      }
      
      if (!geminiKey) {
        console.warn("No Gemini API key for emotion analysis, defaulting to neutral");
        return { emotion: "neutral", confidence: 0.5 };
      }

      const result = await invoke("analyze_emotion", {
        request: { text, apiKey: geminiKey }
      }) as { emotion: string; confidence: number };
      
      console.log("🔍 [Emotion Analysis Raw]:", result);
      return result;
    } catch (err) {
      console.error("❌ Emotion analysis failed:", err);
      return { emotion: "neutral", confidence: 0.5 };
    }
  },

  // Send chat via Orchestrator (with parallel emotion analysis)
  async sendOrchestrated(request: ChatRequest): Promise<OrchestratedResponse> {
    // Start emotion analysis in parallel with chat
    const emotionPromise = api.analyzeEmotion(request.message);
    
    // Main chat response
    const res = await api.sendMessage(request);
    
    let audioPath = undefined;
    if (request.useVoiceOutput) {
        const voices = await api.listVoices();
        const activeVoice = voices.activeVoice || "en-US-AriaNeural";
        const ttsRes = await api.synthesize(res.response, true, activeVoice);
        if (ttsRes.success) {
            audioPath = ttsRes.audioPath;
        }
    }

    // Wait for emotion analysis (should be done by now or soon)
    const emotionResult = await emotionPromise;

    return {
        response: res.response,
        emotion: emotionResult.emotion,
        expression_params: { confidence: emotionResult.confidence },
        provider_used: "rust-backend",
        resource_state: "ok",
        sessionId: res.sessionId,
        audioPath: audioPath
    };
  },

  // Get system resource status (Mocked/Removed)
  async getResourceStatus(): Promise<ResourceStatus> {
    return {
        cpu_percent: 0,
        ram_percent: 0,
        ram_used_gb: 0,
        ram_total_gb: 0,
        state: "ok"
    };
  },

  // TTS synthesize
  async synthesize(text: string, _saveAudio: boolean = true, voice: string = ""): Promise<{ success: boolean; audioPath?: string; message: string }> {
    try {
        const path: string = await invoke("synthesize_audio", { text, voice });
        return { success: true, audioPath: path, message: "Synthesis successful" };
    } catch (e) {
        console.error("TTS Error:", e);
        return { success: false, message: String(e) };
    }
  },

  // Get audio file URL (Stubbed)
  getAudioUrl(_filename: string): string {
    return "";
  },

  // List voices
  async listVoices(): Promise<VoiceListResponse> {
    try {
        const res: any = await invoke("list_voices");
        return res;
    } catch (e) {
        console.error(e);
        return { voices: [], activeVoice: undefined };
    }
  },

  // Set active voice
  async setActiveVoice(voiceName: string): Promise<{ status: string; active_voice: string }> {
    try {
        await invoke("set_active_voice", { voiceName });
        return { status: "ok", active_voice: voiceName };
    } catch (e) {
        throw new Error(String(e));
    }
  },

  // Upload voice sample (Stubbed)
  async uploadVoice(_file: File): Promise<{ status: string; voice_name?: string; processed_path?: string; message: string }> {
    return { status: "error", message: "Upload not supported yet" };
  },

  // Analyze audio (Stubbed)
  async analyzeAudio(_file: File): Promise<AudioAnalysis> {
    throw new Error("Analysis not supported yet");
  },

  // Preprocess audio (Stubbed)
  async preprocessAudio(_file: File): Promise<PreprocessResponse> {
    throw new Error("Preprocessing not supported yet");
  },

  // Validate for cloning (Stubbed)
  async validateForCloning(_file: File): Promise<{ valid: boolean; message: string }> {
     return { valid: true, message: "Skipped validation" };
  },

  // Session info (Stubbed)
  async getSession(): Promise<SessionInfo> {
    return { session_id: "default", turn_count: 0 };
  },

  // Clear session (Stubbed)
  async clearSession(): Promise<{ status: string }> {
    return { status: "cleared" };
  },

  // List characters (Frontend fallback)
  async listCharacters(): Promise<CharacterListResponse> {
    const savedChar = localStorage.getItem("active_character") || "default";
    return {
        characters: [
          {
            id: "default",
            name: "Luna (Default)",
            type: "svg",
            thumbnail: null,
            path: null
          },
          {
            id: "hiyori",
            name: "Hiyori",
            type: "live2d",
            thumbnail: null,
            path: "/vtuber_chara/hiyori_free_en/runtime/hiyori_free_t08.model3.json"
          },
          {
            id: "pachan",
            name: "Pachirisu Girl",
            type: "live2d",
            thumbnail: null,
            path: "/vtuber_chara/pachan 2.0/pachirisu anime girl - top half.model3.json"
          },
          {
            id: "witch",
            name: "Witch",
            type: "live2d",
            thumbnail: null,
            path: "/vtuber_chara/Witch/魔女.model3.json" 
          },
          {
            id: "kamiyahakuko",
            name: "Kamiyahakuko",
            type: "live2d",
            thumbnail: null,
            path: "/vtuber_chara/Kamiyahakuko/神宫白子模型/面饼0.model3.json"
          },
          {
            id: "hiyori_pro",
            name: "Hiyori Pro",
            type: "live2d",
            thumbnail: null,
            path: "/vtuber_chara/hiyori_pro_en/runtime/hiyori_pro_t11.model3.json"
          },
          {
            id: "mao_pro",
            name: "Mao Pro",
            type: "live2d",
            thumbnail: null,
            path: "/vtuber_chara/mao_pro/runtime/mao_pro.model3.json"
          },
          {
            id: "miara_pro",
            name: "Miara Pro",
            type: "live2d",
            thumbnail: null,
            path: "/vtuber_chara/miara_pro_en/runtime/miara_pro_t03.model3.json"
          },
          {
            id: "shizuku",
            name: "Shizuku",
            type: "live2d",
            thumbnail: null,
            path: "/vtuber_chara/shizuku/runtime/shizuku.model3.json"
          },
          {
            id: "tsumiki",
            name: "Tsumiki",
            type: "live2d",
            thumbnail: null,
            path: "/vtuber_chara/tsumiki/runtime/tsumiki.model3.json"
          },
          {
            id: "haru_greeter",
            name: "Haru Greeter",
            type: "live2d",
            thumbnail: null,
            path: "/vtuber_chara/haru_greeter_pro_jp/runtime/haru_greeter_t05.model3.json"
          }
        ],
        active_character: savedChar
    };
  },

  // Set active character
  async setActiveCharacter(characterId: string): Promise<{ status: string; active_character: string }> {
    localStorage.setItem("active_character", characterId);
    try {
        await emit('character_changed', { id: characterId });
    } catch (e) {
        console.warn("Failed to emit character event event:", e);
    }
    return { status: "ok", active_character: characterId };
  },

  // Get character thumbnail URL
  getCharacterThumbnailUrl(path: string): string {
    if (!path) return "";
    return path; 
  },

  // ========================
  // API Settings (Rust Backend)
  // ========================

  async getApiSettings(): Promise<ApiSettingsResponse> {
    try {
        // First try to get from Rust backend
        const res: ApiSettingsResponse = await invoke("get_api_settings");
        
        // Check for environment variables if key is missing (Fallback logic moved to Frontend)
        let apiKey = res.apiKey;
        if (!apiKey) {
            if (res.provider === 'groq') apiKey = (import.meta as any).env.VITE_GROQ_API_KEY || "";
            if (res.provider === 'gemini') apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || "";
            if (res.provider === 'mistral') apiKey = (import.meta as any).env.VITE_MISTRAL_API_KEY || "";
            if (res.provider === 'openai') apiKey = (import.meta as any).env.VITE_OPENAI_API_KEY || "";
        }
        
        return { ...res, apiKey };
    } catch (e) {
        console.error("Failed to get settings", e);
        return {
            provider: "local",
            apiKey: "",
            apiKeySet: false,
            model: "",
            availableProviders: [],
            defaultModels: {},
            error: String(e)
        };
    }
  },

  async saveApiSettings(settings: ApiSettingsRequest): Promise<{ status: string; message: string }> {
    try {
        const payload = { ...settings, apiKey: settings.api_key };
        const msg: string = await invoke("save_api_settings", { settings: payload });
        return { status: "ok", message: msg };
    } catch (e) {
        throw new Error(String(e));
    }
  },

  async testApiConnection(settings: ApiSettingsRequest): Promise<{ success: boolean; message: string }> {
    try {
        // Enforce env var fallback locally before sending to test if needed
        let apiKey = settings.api_key; 
        
        if (!apiKey) {
            if (settings.provider === 'groq') apiKey = (import.meta as any).env.VITE_GROQ_API_KEY || "";
            if (settings.provider === 'gemini') apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || "";
            if (settings.provider === 'mistral') apiKey = (import.meta as any).env.VITE_MISTRAL_API_KEY || "";
            if (settings.provider === 'openai') apiKey = (import.meta as any).env.VITE_OPENAI_API_KEY || "";
        }
        
        const payload = { ...settings, apiKey };

        const res: any = await invoke("test_api_connection", { settings: payload });
        return res;
    } catch (e) {
        return { success: false, message: String(e) };
    }
  },

  // Usage Statistics
  async getUsageStats(): Promise<UsageStats> {
    try {
      return await invoke("get_usage_stats");
    } catch (e) {
      console.error("Failed to get usage stats:", e);
      // Return empty stats if failed
      const empty = { today: 0, total: 0, lastReset: "" };
      return { groq: empty, gemini: empty, mistral: empty, openai: empty, tts: empty };
    }
  },

  async resetUsageStats(): Promise<{ status: string }> {
    try {
      const msg: string = await invoke("reset_usage_stats");
      return { status: msg };
    } catch (e) {
      throw new Error(String(e));
    }
  },

  // ========================================
  // Memory / RAG System Functions
  // ========================================

  /** Initialize memory database (call on app startup) */
  async initMemory(customPath?: string): Promise<string> {
    try {
      const dbPath: string = await invoke("init_memory_db", { customPath });
      console.log("📦 Memory DB initialized at:", dbPath);
      return dbPath;
    } catch (e) {
      console.error("Failed to init memory DB:", e);
      throw new Error(String(e));
    }
  },

  /** Store a message in long-term memory */
  async storeMemory(text: string, role: "user" | "assistant"): Promise<string> {
    try {
      // Get Mistral API key
      const mistralKey = (import.meta as any).env?.VITE_MISTRAL_API_KEY || "";
      if (!mistralKey) {
        console.warn("⚠️ No Mistral API key for memory storage");
        return "";
      }

      const request: StoreMemoryRequest = {
        text,
        role,
        mistralApiKey: mistralKey
      };

      const id: string = await invoke("store_memory", { request });
      console.log(`💾 Stored memory: ${id} (${role})`);
      return id;
    } catch (e) {
      console.error("Failed to store memory:", e);
      return "";
    }
  },

  /** Query relevant memories for RAG */
  async queryMemory(query: string, topK: number = 5): Promise<MemoryEntry[]> {
    try {
      const mistralKey = (import.meta as any).env?.VITE_MISTRAL_API_KEY || "";
      if (!mistralKey) {
        console.warn("⚠️ No Mistral API key for memory query");
        return [];
      }

      const request: QueryMemoryRequest = {
        query,
        mistralApiKey: mistralKey,
        topK
      };

      const response: QueryMemoryResponse = await invoke("query_memory", { request });
      console.log(`🔍 Found ${response.memories.length} relevant memories`);
      return response.memories;
    } catch (e) {
      console.error("Failed to query memory:", e);
      return [];
    }
  },

  /** Get recent memories chronologically */
  async getRecentMemories(limitCount: number = 20): Promise<MemoryEntry[]> {
    try {
      const response: QueryMemoryResponse = await invoke("get_recent_memories", { limitCount });
      return response.memories;
    } catch (e) {
      console.error("Failed to get recent memories:", e);
      return [];
    }
  },

  /** Clear all memories (hard reset) */
  async clearMemories(): Promise<void> {
    try {
      await invoke("clear_all_memories");
      console.log("🗑️ All memories cleared");
    } catch (e) {
      console.error("Failed to clear memories:", e);
      throw new Error(String(e));
    }
  },

  /** RAG-enhanced chat: retrieve memories and include in context */
  async sendWithRAG(request: ChatRequest): Promise<OrchestratedResponse> {
    // 1. Query relevant memories first
    const memories = await api.queryMemory(request.message, 3);
    
    // 2. Build augmented prompt with memory context
    let augmentedMessage = request.message;
    if (memories.length > 0) {
      const memoryContext = memories
        .map(m => `[${m.role}]: ${m.text}`)
        .join("\n");
      augmentedMessage = `Context from previous conversations:\n${memoryContext}\n\n---\nCurrent message: ${request.message}`;
    }

    // 3. Send the augmented request
    const response = await api.sendOrchestrated({
      ...request,
      message: augmentedMessage
    });

    // 4. Store both the user message and assistant response in memory
    await api.storeMemory(request.message, "user");
    await api.storeMemory(response.response, "assistant");

    return response;
  },

  /** Open folder picker dialog */
  async selectDirectory(): Promise<string | null> {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Pilih Folder Penyimpanan Memori"
      });
      return selected as string | null;
    } catch (e) {
      console.error("Failed to open dialog:", e);
      return null;
    }
  },

  // ========================================
  // Launcher Settings (UI Preferences)
  // ========================================

  /** Get launcher settings from persistent storage */
  async getLauncherSettings(): Promise<LauncherSettings> {
    try {
      return await invoke("get_launcher_settings");
    } catch (e) {
      console.error("Failed to get launcher settings:", e);
      return {
        language: "English",
        autoLaunchOnStartup: false,
        checkUpdatesOnStartup: true,
        installationPath: "C:\\Games\\VTuber-App",
        speedLimitEnabled: false,
        speedLimitKBps: 4096,
        allowDesktopNotifications: false,
        notifyOnUpdate: true,
        notifyOnDownloadComplete: true,
      };
    }
  },

  /** Save launcher settings to persistent storage */
  async saveLauncherSettings(settings: LauncherSettings): Promise<string> {
    try {
      return await invoke("save_launcher_settings", { settings });
    } catch (e) {
      console.error("Failed to save launcher settings:", e);
      throw new Error(String(e));
    }
  },
};

export interface LauncherSettings {
  language: string;
  autoLaunchOnStartup: boolean;
  checkUpdatesOnStartup: boolean;
  installationPath: string;
  speedLimitEnabled: boolean;
  speedLimitKBps: number;
  allowDesktopNotifications: boolean;
  notifyOnUpdate: boolean;
  notifyOnDownloadComplete: boolean;
}

export interface CharacterData {
  id: string;
  name: string;
  type: 'svg' | 'image' | 'live2d';
  thumbnail?: string | null;
  path?: string | null;
}

export interface CharacterListResponse {
  characters: CharacterData[];
  active_character: string;
}

export interface ApiProvider {
  id: string;
  name: string;
  requiresKey: boolean;
}

export interface ApiSettingsResponse {
  provider: string;
  apiKey: string;
  apiKeySet: boolean;
  model: string;
  memoryPath?: string;
  availableProviders: ApiProvider[];
  defaultModels: Record<string, string>;
  error?: string;
}

// Update Request interface to match what components send vs what we transform
export interface ApiSettingsRequest {
  provider: string;
  api_key: string; // Components probably still send snake_case unless I update them
  model: string;
  memoryPath?: string;
  apiKey?: string; // For internal use
}

export default api;
import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Upload,
  Mic,
  Volume2,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  User,
  Sparkles,
  Key,
  Eye,
  EyeOff,
  Zap,
  BarChart2,
  RefreshCw,
} from "lucide-react";

const FRONTEND_DEFAULTS: Record<string, string> = {
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-3-flash-preview",
  mistral: "mistral-tiny",
  openai: "gpt-4o",
};
import api from "../api";
import type { VoiceProfile, AudioAnalysis, CharacterData, ApiProvider, ApiSettingsResponse, UsageStats } from "../api";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVoiceChange?: (voiceName: string) => void;
  onCharacterChange?: (character: CharacterData) => void;
  isCompact?: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onVoiceChange,
  onCharacterChange,
  isCompact = false,
}) => {
  const [activeTab, setActiveTab] = useState<"voice" | "upload" | "character" | "api" | "system" | "usage">(
    "voice",
  );
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [activeVoice, setActiveVoice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "processing" | "success" | "error"
  >("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysis | null>(
    null,
  );
  const [llmLoaded, setLlmLoaded] = useState(false);

  // Upload form state
  const [voiceName, setVoiceName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Character state
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [activeCharacter, setActiveCharacter] = useState<string>("default");
  const [characterError, setCharacterError] = useState<string | null>(null);

  // API Settings state
  const [apiProvider, setApiProvider] = useState<string>("local");
  const [apiKey, setApiKey] = useState<string>("");
  const [apiModel, setApiModel] = useState<string>("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiProviders, setApiProviders] = useState<ApiProvider[]>([]);
  const [defaultModels, setDefaultModels] = useState<Record<string, string>>({});
  const [apiTestStatus, setApiTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [apiTestMessage, setApiTestMessage] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [memoryPath, setMemoryPath] = useState<string>("");
  
  // Usage Stats State
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadVoices();
      loadCharacters();
      loadApiSettings();
      loadApiSettings();
      checkHealth();
      loadUsageStats();
    }
  }, [isOpen]);

  const loadUsageStats = async () => {
    try {
      const stats = await api.getUsageStats();
      setUsageStats(stats);
    } catch (err) {
      console.error("Failed to load usage stats:", err);
    }
  };

  const handleResetStats = async () => {
    if (window.confirm("Are you sure you want to reset all usage statistics?")) {
        try {
            await api.resetUsageStats();
            loadUsageStats();
        } catch (e) {
            console.error(e);
        }
    }
  };

  const loadVoices = async () => {
    try {
      setLoading(true);
      const res = await api.listVoices();
      setVoices(res.voices);
      setActiveVoice(res.activeVoice || "default");
    } catch (err) {
      console.error("Failed to load voices:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCharacters = async () => {
    try {
      const res = await api.listCharacters();
      setCharacters(res.characters);
      setActiveCharacter(res.active_character);
    } catch (err) {
      console.error("Failed to load characters:", err);
    }
  };

  const checkHealth = async () => {
    try {
      const res = await api.health();
      setLlmLoaded(res.llm_loaded);
    } catch (err) {
      console.error("Health check failed:", err);
    }
  };

  const loadApiSettings = async () => {
    try {
      const res: ApiSettingsResponse = await api.getApiSettings();
      setApiProvider(res.provider);
      setApiModel(res.model);
      setApiProviders(res.availableProviders || []);
      setDefaultModels(res.defaultModels || {});
      setApiKeySet(res.apiKeySet);
      setMemoryPath(res.memoryPath || "");
      if (res.apiKeySet) {
        setApiKey("••••••••••••••••");
      }
    } catch (err) {
      console.error("Failed to load API settings:", err);
    }
  };

  const handleSaveApiSettings = async () => {
    try {
      setLoading(true);
      const actualKey = apiKey.includes("••••") ? "" : apiKey;
      await api.saveApiSettings({
        provider: apiProvider,
        api_key: actualKey || (apiKeySet ? "" : ""),
        model: apiModel,
        memoryPath: memoryPath,
      });
      setApiTestStatus("success");
      setApiTestMessage("Settings saved!");
      setTimeout(() => setApiTestStatus("idle"), 2000);
    } catch (err) {
      setApiTestStatus("error");
      setApiTestMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTestApiConnection = async () => {
    try {
      setApiTestStatus("testing");
      setApiTestMessage("Testing connection...");
      const actualKey = apiKey.includes("••••") ? "" : apiKey;
      const result = await api.testApiConnection({
        provider: apiProvider,
        api_key: actualKey,
        model: apiModel,
      });
      if (result.success) {
        setApiTestStatus("success");
        setApiTestMessage(result.message);
      } else {
        setApiTestStatus("error");
        setApiTestMessage(result.message);
      }
    } catch (err) {
      setApiTestStatus("error");
      setApiTestMessage(err instanceof Error ? err.message : "Test failed");
    }
  };

  const handleCharacterSelect = async (character: CharacterData) => {
    try {
      setLoading(true);
      setCharacterError(null);
      await api.setActiveCharacter(character.id);
      setActiveCharacter(character.id);
      onCharacterChange?.(character);
    } catch (err: unknown) {
      // Extract error message from backend
      let errorMessage = "Gagal mengubah karakter";
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          errorMessage = parsed.detail || err.message;
        } catch {
          errorMessage = err.message;
        }
      }
      // Try to get detail from fetch error response
      if (typeof err === 'object' && err !== null && 'detail' in err) {
        errorMessage = (err as {detail: string}).detail;
      }
      setCharacterError(errorMessage);
      console.error("Character error:", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceSelect = async (voiceName: string) => {
    try {
      setLoading(true);
      if (voiceName === "default") {
        // Use default pyttsx3 voice
        setActiveVoice("default");
        onVoiceChange?.("default");
      } else {
        await api.setActiveVoice(voiceName);
        setActiveVoice(voiceName);
        onVoiceChange?.(voiceName);
      }
    } catch (err) {
      console.error("Failed to set voice:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMemoryPath = async () => {
    try {
      const selected = await api.selectDirectory();
      if (selected) {
        setMemoryPath(selected);
      }
    } catch (err) {
      console.error("Failed to select directory:", err);
    }
  };

  const handleApplyMemoryPath = async () => {
    if (window.confirm("⚠️ Mengubah lokasi penyimpanan akan me-restart database memori. Memori lama tidak akan otomatis dipindah ke folder baru.\n\nLanjutkan?")) {
      try {
        setLoading(true);
        // Save first so backend has it in api_settings.json
        await handleSaveApiSettings();
        // Re-init with new path
        const newPath = await api.initMemory(memoryPath);
        alert("✅ Database memori diinisialisasi di: " + newPath);
      } catch (err) {
        alert("❌ Gagal inisialisasi: " + err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "audio/wav",
      "audio/mpeg",
      "audio/mp3",
      "audio/flac",
      "audio/ogg",
    ];
    if (
      !validTypes.includes(file.type) &&
      !file.name.match(/\.(wav|mp3|flac|ogg|m4a)$/i)
    ) {
      setUploadStatus("error");
      setUploadMessage(
        "Format tidak didukung. Gunakan WAV, MP3, FLAC, atau OGG.",
      );
      return;
    }

    setSelectedFile(file);
    setUploadStatus("idle");
    setUploadMessage("");

    // Auto-generate name from filename if empty
    if (!voiceName) {
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      setVoiceName(baseName);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus("error");
      setUploadMessage("Pilih file audio terlebih dahulu");
      return;
    }

    if (!voiceName.trim()) {
      setUploadStatus("error");
      setUploadMessage("Masukkan nama untuk voice profile");
      return;
    }

    setUploadStatus("uploading");
    setUploadMessage("Menganalisis audio...");

    try {
      const analysis = await api.analyzeAudio(selectedFile);
      setAudioAnalysis(analysis);

      setUploadMessage("Memproses audio...");
      setUploadStatus("processing");

      // Create FormData with custom name
      const formData = new FormData();
      formData.append("file", selectedFile);

      const result = await api.uploadVoice(selectedFile);

      if (result.status === "success") {
        setUploadStatus("success");
        setUploadMessage(`Voice "${voiceName}" berhasil ditambahkan!`);
        loadVoices();

        // Reset form
        setVoiceName("");
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        setUploadStatus("error");
        setUploadMessage(result.message || "Gagal memproses audio");
      }
    } catch (err: unknown) {
      setUploadStatus("error");
      setUploadMessage(
        err instanceof Error ? err.message : "Terjadi kesalahan",
      );
    }
  };

  const handleLoadModel = async () => {
    try {
      setLoading(true);
      await api.loadModel();
      setLlmLoaded(true);
    } catch (err) {
      console.error("Failed to load model:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSession = async () => {
    try {
      await api.clearSession();
    } catch (err) {
      console.error("Failed to clear session:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full ${isCompact ? "max-w-[320px] max-h-[85vh]" : "max-w-2xl max-h-[85vh]"} bg-slate-900/95 backdrop-blur-2xl border border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-4 border-b border-slate-800 overflow-x-auto">
          {[
            { id: "voice", label: "Voice", icon: Volume2 },
            { id: "upload", label: "Upload", icon: Upload },
            { id: "character", label: "Character", icon: Sparkles },
            { id: "api", label: "API", icon: Zap },
            { id: "usage", label: "Usage", icon: BarChart2 },
            { id: "system", label: "System", icon: Mic },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* Voice Profiles Tab */}
          {activeTab === "voice" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Pilih voice profile untuk TTS output. Voice profile dari folder
                data/ akan menggunakan suara yang di-clone.
              </p>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                </div>
              ) : (
                <div className="grid gap-3">
                  {/* Default Voice */}
                  <button
                    onClick={() => handleVoiceSelect("default")}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      activeVoice === "default"
                        ? "bg-indigo-600/20 border-indigo-500/50 text-white"
                        : "bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          activeVoice === "default"
                            ? "bg-indigo-600"
                            : "bg-slate-700"
                        }`}
                      >
                        <User className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">Default (Female)</p>
                        <p className="text-xs text-slate-500">
                          System pyttsx3 voice
                        </p>
                      </div>
                    </div>
                    {activeVoice === "default" && (
                      <Check className="w-5 h-5 text-indigo-400" />
                    )}
                  </button>

                  {/* Voice profiles from data/ */}
                  {voices.length === 0 ? (
                    <div className="text-center py-4 text-slate-500">
                      <p className="text-xs">
                        Belum ada voice profile custom. Upload di tab "Upload
                        Voice".
                      </p>
                    </div>
                  ) : (
                    voices.map((voice) => (
                      <button
                        key={voice.name}
                        onClick={() => handleVoiceSelect(voice.name)}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                          activeVoice === voice.name
                            ? "bg-indigo-600/20 border-indigo-500/50 text-white"
                            : "bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              activeVoice === voice.name
                                ? "bg-indigo-600"
                                : "bg-slate-700"
                            }`}
                          >
                            <Volume2 className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{voice.name}</p>
                            <p className="text-xs text-slate-500">
                              {Math.round(voice.sampleRate / 1000)}kHz •{" "}
                              {voice.description || "Custom voice"}
                            </p>
                          </div>
                        </div>
                        {activeVoice === voice.name && (
                          <Check className="w-5 h-5 text-indigo-400" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === "upload" && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-slate-400 mb-4">
                  Upload audio untuk membuat voice profile baru. Audio akan
                  diproses secara otomatis (noise reduction, volume
                  normalization).
                </p>
              </div>

              {/* Voice Name Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Nama Voice Profile
                </label>
                <input
                  type="text"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  placeholder="Contoh: Luna, Sarah, Custom Voice..."
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                />
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  File Audio
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".wav,.mp3,.flac,.ogg,.m4a"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={
                    uploadStatus === "uploading" ||
                    uploadStatus === "processing"
                  }
                  className={`w-full p-6 rounded-2xl border-2 border-dashed transition-all ${
                    selectedFile
                      ? "border-emerald-500/50 bg-emerald-600/10"
                      : uploadStatus === "uploading" ||
                          uploadStatus === "processing"
                        ? "border-indigo-500/50 bg-indigo-600/10"
                        : "border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800/50"
                  }`}
                >
                  {uploadStatus === "uploading" ||
                  uploadStatus === "processing" ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                      <p className="text-sm text-indigo-400">{uploadMessage}</p>
                    </div>
                  ) : selectedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <Check className="w-8 h-8 text-emerald-500" />
                      <p className="text-sm text-emerald-400">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        Klik untuk ganti file
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-slate-500" />
                      <p className="text-sm text-slate-400">
                        Klik untuk pilih file audio
                      </p>
                      <p className="text-xs text-slate-600">
                        WAV, MP3, FLAC, OGG (min 6 detik)
                      </p>
                    </div>
                  )}
                </button>
              </div>

              {/* Upload Button */}
              <button
                onClick={handleUpload}
                disabled={
                  !selectedFile ||
                  !voiceName.trim() ||
                  uploadStatus === "uploading" ||
                  uploadStatus === "processing"
                }
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-xl transition-colors"
              >
                {uploadStatus === "uploading" || uploadStatus === "processing"
                  ? "Processing..."
                  : "Upload & Process"}
              </button>

              {/* Status Message */}
              {uploadStatus !== "idle" &&
                uploadStatus !== "uploading" &&
                uploadStatus !== "processing" && (
                  <div
                    className={`flex items-center gap-3 p-4 rounded-xl ${
                      uploadStatus === "success"
                        ? "bg-emerald-500/10 border border-emerald-500/20"
                        : "bg-rose-500/10 border border-rose-500/20"
                    }`}
                  >
                    {uploadStatus === "success" ? (
                      <Check className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-500" />
                    )}
                    <p
                      className={`text-sm ${uploadStatus === "success" ? "text-emerald-400" : "text-rose-400"}`}
                    >
                      {uploadMessage}
                    </p>
                  </div>
                )}

              {/* Audio Analysis */}
              {audioAnalysis && (
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <h4 className="text-sm font-medium text-white mb-3">
                    Audio Analysis
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Duration:</span>
                      <span className="text-white ml-2">
                        {audioAnalysis.duration.toFixed(1)}s
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Sample Rate:</span>
                      <span className="text-white ml-2">
                        {audioAnalysis.sample_rate}Hz
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Channels:</span>
                      <span className="text-white ml-2">
                        {audioAnalysis.channels}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Quality:</span>
                      <span
                        className={`ml-2 ${
                          audioAnalysis.quality === "excellent" ||
                          audioAnalysis.quality === "good"
                            ? "text-emerald-400"
                            : audioAnalysis.quality === "acceptable"
                              ? "text-yellow-400"
                              : "text-rose-400"
                        }`}
                      >
                        {audioAnalysis.quality}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Character Tab */}
          {activeTab === "character" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Pilih karakter VTuber untuk tampilan. Karakter dari folder data/vtuber_chara.
              </p>

              {/* Error Notification */}
              {characterError && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-rose-400">Error</p>
                    <p className="text-xs text-rose-300/80 mt-0.5">{characterError}</p>
                  </div>
                  <button 
                    onClick={() => setCharacterError(null)}
                    className="ml-auto p-1 hover:bg-rose-500/20 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-rose-400" />
                  </button>
                </div>
              )}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {characters.map((char) => (
                    <button
                      key={char.id}
                      onClick={() => handleCharacterSelect(char)}
                      className={`group relative flex flex-col items-center gap-3 p-4 rounded-xl border transition-all duration-300 ${
                        activeCharacter === char.id
                          ? "bg-indigo-600/20 border-indigo-500/50 shadow-[0_0_20px_rgba(79,70,229,0.2)]"
                          : "bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600"
                      }`}
                    >
                      {/* Character Preview */}
                      <div
                        className={`w-16 h-16 rounded-xl flex items-center justify-center mb-2 overflow-hidden ${
                          activeCharacter === char.id
                            ? "bg-indigo-600"
                            : "bg-slate-700"
                        }`}
                      >
                        {char.type === "svg" ? (
                          <div className="w-full h-full p-3 flex items-center justify-center">
                            <Sparkles className="w-8 h-8 text-white" />
                          </div>
                        ) : char.thumbnail ? (
                          <img 
                            src={api.getCharacterThumbnailUrl(char.thumbnail)} 
                            alt={char.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full">
                             <span className="text-xl font-bold uppercase tracking-widest text-white/50">
                                {char.name.substring(0, 2)}
                             </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Checkmark Overlay (Simplified) */}
                      {activeCharacter === char.id && (
                         <div className="absolute top-2 right-2 hidden"></div> 
                      )}

                      <div className="w-full text-center">
                        <p className={`text-sm font-medium truncate ${activeCharacter === char.id ? "text-indigo-400" : "text-white"}`}>
                          {char.name}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase mt-0.5">
                          {char.type}
                        </p>
                        {activeCharacter === char.id && (
                            <Check className="w-4 h-4 text-indigo-400 mt-1 mx-auto" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Usage Stats Tab */}
          {activeTab === "usage" && usageStats && (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">
                        Statistik penggunaan API (diset ulang setiap hari secara otomatis).
                    </p>
                    <button 
                        onClick={handleResetStats}
                        className="p-2 text-xs bg-slate-800 hover:bg-rose-900/30 text-slate-400 hover:text-rose-400 rounded-lg transition-colors flex items-center gap-1"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Reset Stats
                    </button>
                </div>

                <div className="grid gap-4">
                    {[
                        { id: 'groq', name: 'Groq API', data: usageStats.groq, icon: Zap, color: 'text-orange-400', bg: 'bg-orange-500/20' },
                        { id: 'gemini', name: 'Gemini (Emotion)', data: usageStats.gemini, icon: Sparkles, color: 'text-blue-400', bg: 'bg-blue-500/20' },
                        { id: 'mistral', name: 'Mistral AI', data: usageStats.mistral, icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/20' },
                        { id: 'openai', name: 'OpenAI', data: usageStats.openai, icon: User, color: 'text-green-400', bg: 'bg-green-500/20' },
                        { id: 'tts', name: 'Text-to-Speech', data: usageStats.tts, icon: Volume2, color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
                    ].map((item) => (
                        <div key={item.id} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`p-2 rounded-lg ${item.bg}`}>
                                    <item.icon className={`w-5 h-5 ${item.color}`} />
                                </div>
                                <div>
                                    <h3 className="font-medium text-white">{item.name}</h3>
                                    <p className="text-xs text-slate-500">Reset: {item.data.lastReset}</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-lg bg-slate-900/50">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Today</p>
                                    <p className="text-2xl font-bold text-white">{item.data.today}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-900/50">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total</p>
                                    <p className="text-2xl font-bold text-slate-300">{item.data.total}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          )}

          {/* API Settings Tab */}
          {activeTab === "api" && (
            <div className="space-y-5">
              <p className="text-sm text-slate-400">
                Konfigurasi API untuk text generation. Gunakan Groq atau Gemini untuk respons cepat, atau Local LLM untuk offline.
              </p>

              {/* Provider Dropdown */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Provider</label>
                <select
                  value={apiProvider}
                  onChange={(e) => {
                    const newProvider = e.target.value;
                    setApiProvider(newProvider);
                    // Use backend default if available, otherwise use frontend default
                    const newModel = defaultModels[newProvider] || FRONTEND_DEFAULTS[newProvider] || "";
                    setApiModel(newModel);
                  }}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {apiProviders.length > 0 ? apiProviders.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  )) : (
                    <>
                      <option value="local">Local LLM (Ollama)</option>
                      <option value="groq">Groq API (Free)</option>
                      <option value="gemini">Google Gemini (Free)</option>
                      <option value="mistral">Mistral AI</option>
                    </>
                  )}
                </select>
              </div>

              {/* API Key Input */}
              {apiProvider !== "local" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">API Key</label>
                  <div className="relative">
                    <input
                      type={apiKeyVisible ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={apiKeySet ? "••••••••••••" : "Masukkan API key"}
                      className="w-full px-4 py-3 pr-12 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setApiKeyVisible(!apiKeyVisible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                    >
                      {apiKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    {apiProvider === "groq" && (
                      <>Get free API key: <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">console.groq.com</a></>
                    )}
                    {apiProvider === "gemini" && (
                      <>Get free API key: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">aistudio.google.com</a></>
                    )}
                    {apiProvider === "mistral" && (
                      <>Get API key: <a href="https://console.mistral.ai/api-keys/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">console.mistral.ai</a></>
                    )}
                  </p>
                </div>
              )}

              {/* Model Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Model</label>
                <input
                  type="text"
                  value={apiModel}
                  onChange={(e) => setApiModel(e.target.value)}
                  placeholder={defaultModels[apiProvider] || FRONTEND_DEFAULTS[apiProvider] || "Model name"}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-500">
                  Default: {defaultModels[apiProvider] || FRONTEND_DEFAULTS[apiProvider] || "llama-3.3-70b-versatile"}
                </p>
              </div>

              {/* Status Message */}
              {apiTestStatus !== "idle" && (
                <div className={`p-3 rounded-xl flex items-center gap-2 ${
                  apiTestStatus === "success" ? "bg-emerald-500/10 border border-emerald-500/30" :
                  apiTestStatus === "error" ? "bg-rose-500/10 border border-rose-500/30" :
                  "bg-slate-700/50 border border-slate-600/30"
                }`}>
                  {apiTestStatus === "testing" && <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />}
                  {apiTestStatus === "success" && <Check className="w-4 h-4 text-emerald-400" />}
                  {apiTestStatus === "error" && <AlertCircle className="w-4 h-4 text-rose-400" />}
                  <span className={`text-sm ${
                    apiTestStatus === "success" ? "text-emerald-400" :
                    apiTestStatus === "error" ? "text-rose-400" : "text-slate-300"
                  }`}>
                    {apiTestMessage}
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleTestApiConnection}
                  disabled={loading || apiTestStatus === "testing"}
                  className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-xl font-medium hover:bg-slate-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {apiTestStatus === "testing" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4" />
                  )}
                  Test Connection
                </button>
                <button
                  onClick={handleSaveApiSettings}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Save Settings
                </button>
              </div>
            </div>
          )}

          {/* System Tab */}
          {activeTab === "system" && (
            <div className="space-y-6">
              {/* LLM Status */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-white">LLM Model</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Qwen 2.5 1.5B Instruct
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-medium ${llmLoaded ? "text-emerald-400" : "text-slate-500"}`}
                    >
                      {llmLoaded ? "Loaded" : "Not loaded"}
                    </span>
                    {!llmLoaded && (
                      <button
                        onClick={handleLoadModel}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Load Model"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Clear Session */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-white">Clear Session</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Reset conversation history
                    </p>
                  </div>
                  <button
                    onClick={handleClearSession}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600/20 text-rose-400 text-sm font-medium hover:bg-rose-600/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </button>
                </div>
              </div>

              {/* API Status */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <h4 className="font-medium text-white mb-3">API Endpoints</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-slate-400">localhost:8000</span>
                  </div>
                </div>
              </div>

              {/* Long-Term Memory Section */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-white flex items-center gap-2">
                      🧠 Long-Term Memory
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Lokasi penyimpanan dan manajemen memori permanen
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (confirm("⚠️ PERINGATAN: Ini akan menghapus SEMUA memori permanen. Aksi ini tidak bisa dibatalkan!\n\nLanjutkan?")) {
                          try {
                            await api.clearMemories();
                            alert("✅ Semua memori telah dihapus");
                          } catch (err) {
                            alert("❌ Gagal menghapus: " + err);
                          }
                        }
                      }}
                      className="p-2 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 transition-colors"
                      title="Clear All Memories"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-700/50">
                   <label className="text-sm font-medium text-slate-300">Custom Storage Path</label>
                   <div className="flex gap-2">
                      <input 
                        type="text"
                        value={memoryPath}
                        onChange={(e) => setMemoryPath(e.target.value)}
                        placeholder="Default: App Data / vector_db"
                        className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button 
                        onClick={handleSelectMemoryPath}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-white transition-colors"
                      >
                        Browse
                      </button>
                   </div>
                   <button 
                    onClick={handleApplyMemoryPath}
                    disabled={loading}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-xs font-medium text-white transition-colors"
                   >
                     {loading ? "Initializing..." : "Apply & Initialize Path"}
                   </button>
                   <p className="text-[10px] text-slate-500 italic">
                     * Kosongkan untuk menggunakan folder default aplikasi.
                   </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
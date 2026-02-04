// Voice profiles are now dynamic - loaded from API
// Default voice is the system pyttsx3 voice (male)
export const DEFAULT_VOICE = "default";

export interface TranscriptionEntry {
  text: string;
  isUser: boolean;
  timestamp: number;
}

export interface VTuberState {
  isTalking: boolean;
  isBlinking: boolean;
  isThinking: boolean;
  expression: 'happy' | 'sad' | 'angry' | 'surprised' | 'thinking' | 'confused' | 'excited' | 'neutral' | 'talking';
}

export interface PipelineState {
  input: 'idle' | 'active';
  uplink: 'idle' | 'transmitting';
  processing: 'idle' | 'thinking';
  downlink: 'idle' | 'receiving';
  output: 'idle' | 'playing';
}

// Voice profile from API
export interface VoiceProfile {
  name: string;
  audio_path: string;
  sample_rate: number;
  description: string;
}

export enum LauncherStatus {
  CHECKING = 'CHECKING',
  UPDATE_AVAILABLE = 'UPDATE_AVAILABLE',
  DOWNLOADING = 'DOWNLOADING',
  VERIFYING = 'VERIFYING',
  READY = 'READY',
  PLAYING = 'PLAYING'
}

export interface NewsItem {
  id: string;
  title: string;
  category: 'EVENT' | 'NOTICE' | 'INFO';
  date: string;
  image: string;
  content: string;
}

export interface GameVersion {
  version: string;
  size: string;
  downloadSizeMB: number;
}

// =============================================
// Updater Types (matching Rust backend)
// =============================================

export type UpdateStage = 'checking' | 'downloading' | 'patching' | 'verifying' | 'ready' | 'error';

export interface UpdateProgress {
  stage: UpdateStage;
  currentFile?: string;
  downloadedBytes: number;
  totalBytes: number;
  filesCompleted: number;
  filesTotal: number;
  message: string;
}

export interface AssetEntry {
  path: string;
  hash: string;
  size: number;
  pack?: string;
}

export interface PatchEntry {
  fromVersion: string;
  toVersion: string;
  file: string;
  size: number;
}

export interface ManifestDiff {
  needsUpdate: boolean;
  filesToDownload: AssetEntry[];
  patchesAvailable: PatchEntry[];
  totalDownloadSize: number;
}
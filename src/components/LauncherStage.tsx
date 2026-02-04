import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import BackgroundCarousel from './launcher/BackgroundCarousel';
import Sidebar from './launcher/Sidebar';
import ActionPanel from './launcher/ActionPanel';
import SettingsModal from './launcher/SettingsModal';
import { LauncherStatus, UpdateProgress, ManifestDiff } from '../types';
import './LauncherStage.css';

interface LauncherStageProps {
  onReady: () => void;
  manifestUrl?: string;
}

// Default manifest URL - should be set to your GitHub releases
const DEFAULT_MANIFEST_URL = 'https://github.com/NestiaDev-id/Vtuber-App/releases/latest/download/manifest.json';

const LauncherStage: React.FC<LauncherStageProps> = ({ 
  onReady, 
  manifestUrl = DEFAULT_MANIFEST_URL 
}) => {
  const [status, setStatus] = useState<LauncherStatus>(LauncherStatus.CHECKING);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [manifestDiff, setManifestDiff] = useState<ManifestDiff | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Listen to backend update_progress events
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<UpdateProgress>('update_progress', (event) => {
        setProgress(event.payload);
        
        // Map backend stage to LauncherStatus
        switch (event.payload.stage) {
          case 'checking':
            setStatus(LauncherStatus.CHECKING);
            break;
          case 'downloading':
          case 'patching':
            setStatus(LauncherStatus.DOWNLOADING);
            break;
          case 'verifying':
            setStatus(LauncherStatus.VERIFYING);
            break;
          case 'ready':
            setStatus(LauncherStatus.READY);
            break;
          case 'error':
            setError(event.payload.message);
            break;
        }
      });
    };

    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Check for updates on mount
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        setStatus(LauncherStatus.CHECKING);
        setError(null);
        
        const diff = await invoke<ManifestDiff>('check_asset_updates', { 
          manifestUrl 
        });
        
        setManifestDiff(diff);
        
        if (diff.needsUpdate) {
          setStatus(LauncherStatus.UPDATE_AVAILABLE);
        } else {
          setStatus(LauncherStatus.READY);
        }
      } catch (err) {
        console.error('Update check failed:', err);
        // If network fails, allow skip to READY (offline mode)
        setError(String(err));
        setStatus(LauncherStatus.READY);
      }
    };

    checkForUpdates();
  }, [manifestUrl]);

  // Auto-proceed when ready
  useEffect(() => {
    if (status === LauncherStatus.READY && !error) {
      const timer = setTimeout(() => {
        onReady();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, error, onReady]);

  // Handle starting the update process
  const handleStartUpdate = async () => {
    if (!manifestDiff) return;
    
    try {
      setStatus(LauncherStatus.DOWNLOADING);
      setError(null);
      
      // Base URL for downloading files (same path but without manifest.json)
      const baseUrl = manifestUrl.replace('/manifest.json', '');
      
      await invoke('apply_asset_updates', {
        manifestUrl,
        baseUrl,
        diff: manifestDiff
      });
      
      // Success - status will be updated via event listener
    } catch (err) {
      console.error('Update failed:', err);
      setError(String(err));
      setStatus(LauncherStatus.UPDATE_AVAILABLE);
    }
  };

  return (
    <div className="relative w-screen h-screen bg-slate-900 text-white overflow-hidden select-none font-sans">
      
      {/* 1. Background Layer */}
      <BackgroundCarousel />

      {/* 2. UI Overlay Layer */}
      <div className="relative z-10 w-full h-full">
        
        {/* Top Right Window Controls */}
        <div className="absolute top-0 right-0 p-4 flex gap-4 text-gray-400 z-50">
          <button className="hover:text-white transition-colors">_</button>
          <button className="hover:text-white transition-colors">☐</button>
          <button className="hover:text-red-500 transition-colors">✕</button>
        </div>

        <Sidebar />
        
        <ActionPanel 
          status={status} 
          setStatus={setStatus}
          progress={progress}
          onStartUpdate={handleStartUpdate}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Error Display */}
        {error && (
          <div className="fixed bottom-32 right-10 max-w-[400px] bg-red-900/80 backdrop-blur-md p-4 rounded-lg border border-red-500/50 z-20">
            <p className="text-red-200 text-sm">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="mt-2 text-xs text-red-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Real Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
};

export default LauncherStage;
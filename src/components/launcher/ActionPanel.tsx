import React from 'react';
import { Menu } from 'lucide-react';
import { LauncherStatus, UpdateProgress } from '../../types';
import { CURRENT_VERSION } from '../../constants';

interface ActionPanelProps {
  status: LauncherStatus;
  setStatus: (status: LauncherStatus) => void;
  progress: UpdateProgress | null;
  onStartUpdate: () => void;
  onOpenSettings: () => void;
}

const ActionPanel: React.FC<ActionPanelProps> = ({ 
  status, 
  setStatus, 
  progress,
  onStartUpdate,
  onOpenSettings 
}) => {
  // Calculate display values from real progress
  const downloadedMB = progress ? progress.downloadedBytes / 1_000_000 : 0;
  const totalMB = progress ? progress.totalBytes / 1_000_000 : CURRENT_VERSION.downloadSizeMB;
  const percentage = totalMB > 0 ? (downloadedMB / totalMB) * 100 : 0;
  
  // Estimate speed (simplified - backend should provide this)
  const [lastBytes, setLastBytes] = React.useState(0);
  const [speed, setSpeed] = React.useState(0);
  
  React.useEffect(() => {
    if (progress) {
      const delta = progress.downloadedBytes - lastBytes;
      if (delta > 0) {
        setSpeed(delta / 100_000); // Rough MB/s estimate
      }
      setLastBytes(progress.downloadedBytes);
    }
  }, [progress, lastBytes]);

  const handleMainAction = () => {
    if (status === LauncherStatus.UPDATE_AVAILABLE || status === LauncherStatus.CHECKING) {
      onStartUpdate();
    } else if (status === LauncherStatus.READY) {
      setStatus(LauncherStatus.PLAYING);
      // This will trigger onReady in parent after a delay
    }
  };

  const getMainButtonContent = () => {
    switch (status) {
      case LauncherStatus.CHECKING:
        return <span className="animate-pulse">CHECKING...</span>;
      case LauncherStatus.UPDATE_AVAILABLE:
        return (
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold tracking-widest">UPDATE</span>
            <span className="text-xs opacity-70">
              {progress ? `${(progress.totalBytes / 1_000_000).toFixed(0)} MB` : `Ver ${CURRENT_VERSION.version}`}
            </span>
          </div>
        );
      case LauncherStatus.DOWNLOADING:
        return <span className="tracking-widest">PAUSE</span>;
      case LauncherStatus.VERIFYING:
        return <span className="animate-pulse tracking-widest">VERIFYING</span>;
      case LauncherStatus.READY:
        return <span className="text-2xl font-bold tracking-widest pl-1">LAUNCH</span>;
      case LauncherStatus.PLAYING:
        return <span className="tracking-widest">RUNNING</span>;
      default:
        return "START";
    }
  };

  const isDownloading = status === LauncherStatus.DOWNLOADING;
  const isVerifying = status === LauncherStatus.VERIFYING;
  const isReady = status === LauncherStatus.READY;
  
  const buttonColorClass = isReady 
    ? "bg-yellow-400 text-black hover:bg-yellow-300 hover:scale-105 shadow-[0_0_20px_rgba(255,230,0,0.4)]" 
    : status === LauncherStatus.PLAYING
      ? "bg-blue-500 text-white cursor-not-allowed"
      : status === LauncherStatus.DOWNLOADING
        ? "bg-transparent border-2 border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
        : "bg-yellow-400 text-black hover:bg-yellow-300 hover:scale-105 shadow-[0_0_20px_rgba(255,230,0,0.4)]";

  return (
    <div className="fixed bottom-10 right-10 z-20 flex flex-col items-end gap-4 w-[400px]">
      
      {/* Download Details Panel */}
      {(isDownloading || isVerifying) && (
        <div className="w-full bg-black/60 backdrop-blur-md p-4 rounded-lg border border-white/10 mb-2">
          <div className="flex justify-between text-gray-300 text-sm mb-2">
            <span>
              {isVerifying 
                ? "Verifying Files..." 
                : progress?.currentFile 
                  ? `Downloading: ${progress.currentFile}` 
                  : "Downloading Resources"
              }
            </span>
            <span>{Math.min(percentage, 100).toFixed(1)}%</span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-yellow-400 transition-all duration-300 ease-out relative"
              style={{ width: `${Math.min(percentage, 100)}%` }}
            >
              <div className="absolute top-0 right-0 bottom-0 w-2 bg-white/50 shadow-[0_0_10px_white]"></div>
            </div>
          </div>

          <div className="flex justify-between text-xs text-gray-500 mt-2 font-mono">
            <span>{speed.toFixed(1)} MB/s</span>
            <span>
              {progress 
                ? `${progress.filesCompleted}/${progress.filesTotal} files`
                : `${Math.max(0, totalMB - downloadedMB).toFixed(0)} MB Remaining`
              }
            </span>
          </div>
          
          {/* Current file indicator */}
          {progress?.currentFile && (
            <div className="mt-2 text-xs text-gray-400 truncate">
              {progress.message}
            </div>
          )}
        </div>
      )}

      {/* Main Action Area */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onOpenSettings}
          className="w-12 h-12 rounded-full bg-black/40 backdrop-blur hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-all group"
        >
          <Menu className="group-hover:rotate-90 transition-transform duration-300" size={20} />
        </button>

        {/* The Big Button */}
        <button
          onClick={handleMainAction}
          disabled={status === LauncherStatus.PLAYING || status === LauncherStatus.VERIFYING || status === LauncherStatus.CHECKING}
          className={`w-64 h-20 rounded-sm transition-all duration-300 flex items-center justify-center relative overflow-hidden group ${buttonColorClass}`}
          style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 100%, 0% 100%)' }}
        >
          <div className="absolute top-0 left-0 w-full h-[2px] bg-white/20"></div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-black/10"></div>
          {getMainButtonContent()}
        </button>
      </div>

      {/* Server Info */}
      <div className="flex items-center gap-4 text-white/60 text-sm">
        <div className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></div>
          <span>Server Online</span>
        </div>
        <span className="w-[1px] h-3 bg-white/20"></span>
        <span>v{CURRENT_VERSION.version}</span>
      </div>
    </div>
  );
};

export default ActionPanel;

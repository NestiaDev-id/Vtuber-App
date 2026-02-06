import React, { useState } from 'react';
import { X, Globe, Download, Bell, Wrench, Info, FolderOpen, Loader2, CheckCircle, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { CURRENT_VERSION } from '../../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Settings state interface
interface LauncherSettings {
  language: string;
  autoLaunchOnStartup: boolean;
  minimizeToTray: boolean;
  checkUpdatesOnStartup: boolean;
  installationPath: string;
  speedLimitEnabled: boolean;
  speedLimitKBps: number;
  allowDesktopNotifications: boolean;
  notifyOnUpdate: boolean;
  notifyOnDownloadComplete: boolean;
}

const DEFAULT_MANIFEST_URL = 'https://github.com/NestiaDev-id/Vtuber-App/releases/latest/download/manifest.json';

// Toggle component moved outside to prevent re-creation on render
const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!enabled)}
    className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${enabled ? 'bg-yellow-500' : 'bg-gray-700'}`}
  >
    <motion.div 
      animate={{ x: enabled ? 20 : 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.8 }}
      className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm"
    ></motion.div>
  </button>
);

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('general');
  
  // Settings state
  const [settings, setSettings] = useState<LauncherSettings>({
    language: 'English',
    autoLaunchOnStartup: false,
    minimizeToTray: false,
    checkUpdatesOnStartup: true,
    installationPath: 'C:\\Games\\VTuber-App',
    speedLimitEnabled: false,
    speedLimitKBps: 4096,
    allowDesktopNotifications: false,
    notifyOnUpdate: true,
    notifyOnDownloadComplete: true,
  });

  // Diagnosis state
  const [diagnosisStatus, setDiagnosisStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [diagnosisMessage, setDiagnosisMessage] = useState('');

  const tabs = [
    { id: 'general', label: 'General', icon: <Globe size={18} /> },
    { id: 'download', label: 'Download', icon: <Download size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { id: 'tools', label: 'Tools', icon: <Wrench size={18} /> },
    { id: 'about', label: 'About', icon: <Info size={18} /> },
  ];

  const handleRunDiagnosis = async () => {
    setDiagnosisStatus('running');
    setDiagnosisMessage('Scanning files...');
    try {
      const result = await invoke<{ needsUpdate: boolean; filesToDownload: unknown[] }>('verify_assets', {
        manifestUrl: DEFAULT_MANIFEST_URL,
      });
      if (result.needsUpdate) {
        setDiagnosisStatus('error');
        setDiagnosisMessage(`Found ${result.filesToDownload.length} corrupted/missing files. Please update.`);
      } else {
        setDiagnosisStatus('success');
        setDiagnosisMessage('All files verified successfully!');
      }
    } catch (err) {
      setDiagnosisStatus('error');
      setDiagnosisMessage(`Scan failed: ${err}`);
    }
  };

  const updateSetting = <K extends keyof LauncherSettings>(key: K, value: LauncherSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleResetSettings = () => {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      setSettings({
        language: 'English',
        autoLaunchOnStartup: false,
        minimizeToTray: false,
        checkUpdatesOnStartup: true,
        installationPath: 'C:\\Games\\VTuber-App',
        speedLimitEnabled: false,
        speedLimitKBps: 4096,
        allowDesktopNotifications: false,
        notifyOnUpdate: true,
        notifyOnDownloadComplete: true,
      });
    }
  };


  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 30, stiffness: 250 }}
            className="relative w-[800px] h-[550px] bg-[#1a1f2e] border border-gray-700 rounded-xl shadow-2xl flex overflow-hidden"
          >
            
            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full z-10"
            >
              <X size={24} />
            </button>

            {/* Sidebar */}
            <div className="w-56 bg-[#111625] p-6 flex flex-col gap-2 border-r border-gray-800">
              <h2 className="text-xl font-bold text-white mb-6 font-tech tracking-wider">SETTINGS</h2>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 relative ${
                    activeTab === tab.id 
                      ? 'text-yellow-400' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {activeTab === tab.id && (
                    <motion.div 
                      layoutId="activeTab"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      className="absolute inset-0 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    {tab.icon}
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 p-8 overflow-y-auto relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -4 }}
                  transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                  className="space-y-6"
                >
                  
                  {/* === GENERAL TAB === */}
                  {activeTab === 'general' && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-white mb-4">General Settings</h3>
                      
                      {/* Language */}
                      <div className="space-y-2">
                        <label className="text-sm text-gray-400">Launcher Language</label>
                        <Select 
                          value={settings.language}
                          onValueChange={(value) => updateSetting('language', value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select Language" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="English">English</SelectItem>
                            <SelectItem value="Indonesian">Indonesian</SelectItem>
                            <SelectItem value="Japanese">Japanese</SelectItem>
                            <SelectItem value="Korean">Korean</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Toggles Group */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between py-3 border-b border-gray-800">
                          <div>
                            <span className="text-gray-300">Auto-launch on Startup</span>
                            <p className="text-xs text-gray-500 mt-0.5">Start the launcher when Windows starts</p>
                          </div>
                          <Toggle enabled={settings.autoLaunchOnStartup} onChange={(v) => updateSetting('autoLaunchOnStartup', v)} />
                        </div>

                        <div className="flex items-center justify-between py-3 border-b border-gray-800">
                          <div>
                            <span className="text-gray-300">Minimize to Tray on Close</span>
                            <p className="text-xs text-gray-500 mt-0.5">Keep the launcher running in the background</p>
                          </div>
                          <Toggle enabled={settings.minimizeToTray} onChange={(v) => updateSetting('minimizeToTray', v)} />
                        </div>

                        <div className="flex items-center justify-between py-3 border-b border-gray-800">
                          <div>
                            <span className="text-gray-300">Check for Updates at Startup</span>
                            <p className="text-xs text-gray-500 mt-0.5">Automatically check for game updates</p>
                          </div>
                          <Toggle enabled={settings.checkUpdatesOnStartup} onChange={(v) => updateSetting('checkUpdatesOnStartup', v)} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* === DOWNLOAD TAB === */}
                  {activeTab === 'download' && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Download Settings</h3>
                      
                      {/* Installation Path */}
                      <div className="space-y-2">
                        <label className="text-sm text-gray-400">Installation Path</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={settings.installationPath} 
                            readOnly 
                            className="flex-1 bg-black/30 border border-gray-700 rounded p-2.5 text-gray-300" 
                          />
                          <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm flex items-center gap-2 transition-colors">
                            <FolderOpen size={16} />
                            Browse
                          </button>
                        </div>
                      </div>

                      {/* Speed Limit Selection Styled as Radio */}
                      <div className="space-y-3 mt-4">
                        <label className="text-sm text-gray-400">Select download speed limit</label>
                        
                        <label className="flex items-center gap-3 cursor-pointer group mt-2">
                          <div 
                            onClick={() => updateSetting('speedLimitEnabled', false)}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              !settings.speedLimitEnabled ? 'border-yellow-500' : 'border-gray-600 group-hover:border-gray-500'
                            }`}
                          >
                            {!settings.speedLimitEnabled && <motion.div layoutId="radioDot" className="w-2.5 h-2.5 rounded-full bg-yellow-500" />}
                          </div>
                          <span 
                            onClick={() => updateSetting('speedLimitEnabled', false)}
                            className={`text-sm ${!settings.speedLimitEnabled ? 'text-white' : 'text-gray-400'}`}
                          >
                            No limit
                          </span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group mt-2">
                          <div 
                            onClick={() => updateSetting('speedLimitEnabled', true)}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              settings.speedLimitEnabled ? 'border-yellow-500' : 'border-gray-600 group-hover:border-gray-500'
                            }`}
                          >
                            {settings.speedLimitEnabled && <motion.div layoutId="radioDot" className="w-2.5 h-2.5 rounded-full bg-yellow-500" />}
                          </div>
                          <span 
                            onClick={() => updateSetting('speedLimitEnabled', true)}
                            className={`text-sm ${settings.speedLimitEnabled ? 'text-white' : 'text-gray-400'}`}
                          >
                            Speed limit
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={settings.speedLimitKBps}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              updateSetting('speedLimitEnabled', true);
                              updateSetting('speedLimitKBps', value === '' ? 0 : parseInt(value));
                            }}
                            onFocus={() => updateSetting('speedLimitEnabled', true)}
                            className="w-20 bg-black/30 border border-gray-700 rounded px-2 py-1 text-white text-sm outline-none focus:border-yellow-500 text-center"
                          />
                          <span className="text-sm text-gray-500">KB/S</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* === NOTIFICATIONS TAB === */}
                  {activeTab === 'notifications' && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Notification Settings</h3>
                      
                      <div className="space-y-1">
                        {/* Desktop Notifications Toggle */}
                        <div className="flex items-center justify-between py-3 border-b border-gray-800">
                          <div>
                            <span className="text-gray-300">Allow Desktop Notifications</span>
                            <p className="text-xs text-gray-500 mt-0.5">Show notifications outside the launcher</p>
                          </div>
                          <Toggle enabled={settings.allowDesktopNotifications} onChange={(v) => updateSetting('allowDesktopNotifications', v)} />
                        </div>

                        {/* Notify on Update */}
                        <div className="flex items-center justify-between py-3 border-b border-gray-800">
                          <div>
                            <span className="text-gray-300">Notify on Update Available</span>
                            <p className="text-xs text-gray-500 mt-0.5">Alert me when a new version is released</p>
                          </div>
                          <Toggle enabled={settings.notifyOnUpdate} onChange={(v) => updateSetting('notifyOnUpdate', v)} />
                        </div>

                        {/* Notify on Download Complete */}
                        <div className="flex items-center justify-between py-3 border-b border-gray-800">
                          <div>
                            <span className="text-gray-300">Notify on Download Complete</span>
                            <p className="text-xs text-gray-500 mt-0.5">Alert me when the update is ready to install</p>
                          </div>
                          <Toggle enabled={settings.notifyOnDownloadComplete} onChange={(v) => updateSetting('notifyOnDownloadComplete', v)} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* === TOOLS TAB === */}
                  {activeTab === 'tools' && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Tools & Maintenance</h3>
                      
                      <div className="grid grid-cols-1 gap-4">
                        {/* Diagnosis */}
                        <div className="p-4 bg-black/20 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex gap-3">
                              <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-400">
                                <Wrench size={20} />
                              </div>
                              <div>
                                <h4 className="text-white font-medium">Scan & Verify Files</h4>
                                <p className="text-xs text-gray-500 mt-1">Check for corrupted or missing game files</p>
                              </div>
                            </div>
                            <button 
                              onClick={handleRunDiagnosis}
                              disabled={diagnosisStatus === 'running'}
                              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-600 text-black font-medium rounded text-sm transition-colors whitespace-nowrap"
                            >
                              {diagnosisStatus === 'running' ? 'Scanning...' : 'Start Scan'}
                            </button>
                          </div>

                          {/* Diagnosis Result */}
                          <AnimatePresence>
                            {diagnosisStatus !== 'idle' && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className={`mt-4 p-3 rounded-lg flex items-center gap-3 overflow-hidden ${
                                  diagnosisStatus === 'running' ? 'bg-blue-500/10 border border-blue-500/20' :
                                  diagnosisStatus === 'success' ? 'bg-green-500/10 border border-green-500/20' :
                                  'bg-red-500/10 border border-red-500/20'
                                }`}
                              >
                                {diagnosisStatus === 'running' && <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />}
                                {diagnosisStatus === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                                {diagnosisStatus === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                                <span className={`text-sm ${
                                  diagnosisStatus === 'running' ? 'text-blue-300' :
                                  diagnosisStatus === 'success' ? 'text-green-300' :
                                  'text-red-300'
                                }`}>{diagnosisMessage}</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Manual Update Check */}
                        <div className="p-4 bg-black/20 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex gap-3">
                              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                                <RefreshCw size={20} />
                              </div>
                              <div>
                                <h4 className="text-white font-medium">Launcher Updates</h4>
                                <p className="text-xs text-gray-500 mt-1">Check if a new version of the launcher is available</p>
                              </div>
                            </div>
                            <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded text-sm transition-colors">
                              Check
                            </button>
                          </div>
                        </div>

                        {/* Reset Settings */}
                        <div className="p-4 bg-black/20 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex gap-3">
                              <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
                                <Trash2 size={20} />
                              </div>
                              <div>
                                <h4 className="text-white font-medium">Reset Settings</h4>
                                <p className="text-xs text-gray-500 mt-1">Restore all settings to their default values</p>
                              </div>
                            </div>
                            <button 
                              onClick={handleResetSettings}
                              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded text-sm transition-colors"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* === ABOUT TAB === */}
                  {activeTab === 'about' && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-white mb-4">About the App</h3>
                      
                      <div className="p-6 bg-black/20 rounded-lg border border-gray-700 text-center">
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.1 }}
                        >
                          <h4 className="text-2xl font-bold text-yellow-400 mb-2 font-tech tracking-wider">VTUBER APP</h4>
                          <p className="text-gray-400 text-sm mb-4">AI-Powered Virtual Character Desktop Application</p>
                        </motion.div>
                        
                        <div className="inline-block px-4 py-2 bg-gray-800 rounded-full text-sm">
                          <span className="text-gray-400">Version:</span>
                          <span className="text-white ml-2 font-mono">{CURRENT_VERSION.version}</span>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-800">
                          <p className="text-xs text-gray-500">
                            Built with ❤️ by <span className="text-yellow-400">NestiaDev-id</span>
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Tauri • React • Rust • Live2D • Generative AI
                          </p>
                          <div className="mt-4 flex justify-center gap-4 text-xs text-gray-400">
                            <a href="#" className="hover:text-yellow-400 transition-colors">GitHub</a>
                            <a href="#" className="hover:text-yellow-400 transition-colors">Documentation</a>
                            <a href="#" className="hover:text-yellow-400 transition-colors">Discord</a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SettingsModal;

import React, { useState } from 'react';
import { X, Monitor, Volume2, Globe, FileText } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('general');

  if (!isOpen) return null;

  const tabs = [
    { id: 'general', label: 'General', icon: <Globe size={18} /> },
    { id: 'graphics', label: 'Graphics', icon: <Monitor size={18} /> },
    { id: 'audio', label: 'Audio', icon: <Volume2 size={18} /> },
    { id: 'resources', label: 'Resources', icon: <FileText size={18} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-[800px] h-[500px] bg-[#1a1f2e] border border-gray-700 rounded-xl shadow-2xl flex overflow-hidden">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full"
        >
          <X size={24} />
        </button>

        {/* Sidebar */}
        <div className="w-64 bg-[#111625] p-6 flex flex-col gap-2 border-r border-gray-800">
          <h2 className="text-xl font-bold text-white mb-6 font-tech tracking-wider">SETTINGS</h2>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id 
                  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Launcher Language</label>
                <select className="w-full bg-black/30 border border-gray-700 rounded p-2 text-white outline-none focus:border-yellow-500">
                  <option>English</option>
                  <option>Japanese</option>
                  <option>Korean</option>
                  <option>Chinese</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Installation Path</label>
                <div className="flex gap-2">
                  <input type="text" value="C:\Games\Aetheria" readOnly className="flex-1 bg-black/30 border border-gray-700 rounded p-2 text-gray-300" />
                  <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">Change</button>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-gray-300">Minimize to tray on close</span>
                <div className="w-10 h-6 bg-yellow-500 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'graphics' && (
            <div className="space-y-6">
               <div className="space-y-2">
                <label className="text-sm text-gray-400">Resolution</label>
                <select className="w-full bg-black/30 border border-gray-700 rounded p-2 text-white">
                  <option>1920 x 1080 (Fullscreen)</option>
                  <option>2560 x 1440 (Fullscreen)</option>
                  <option>Windowed</option>
                </select>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-300">V-Sync</span>
                 <div className="w-10 h-6 bg-gray-700 rounded-full relative cursor-pointer">
                  <div className="absolute left-1 top-1 w-4 h-4 bg-gray-400 rounded-full"></div>
                </div>
              </div>
            </div>
          )}
          
          {/* Placeholders for other tabs */}
          {(activeTab === 'audio' || activeTab === 'resources') && (
             <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <p>Advanced configuration options would appear here.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

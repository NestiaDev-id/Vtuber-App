import React, { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import { NewsItem } from '../../types';

interface NewsModalProps {
  item: NewsItem | null;
  onClose: () => void;
}

const NewsModal: React.FC<NewsModalProps> = ({ item, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [activeItem, setActiveItem] = useState<NewsItem | null>(item);

  useEffect(() => {
    if (item) {
      setActiveItem(item);
      setIsClosing(false);
    }
  }, [item]);

  if (!item && !isClosing) return null;
  const displayItem = item || activeItem;
  if (!displayItem) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setActiveItem(null);
    }, 300);
  };

  const renderContent = (text: string) => {
    return text.split('\n').map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={index} className="h-4" />;

      const processInlineStyles = (str: string) => {
        const parts = str.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="text-yellow-400 font-bold">{part.slice(2, -2)}</strong>;
          }
          return part;
        });
      };

      if (trimmed.startsWith('##')) {
        return (
          <h3 key={index} className="text-xl font-bold text-white mt-8 mb-4 border-l-4 border-yellow-400 pl-3">
            {processInlineStyles(trimmed.replace(/^##\s*/, ''))}
          </h3>
        );
      }

      if (trimmed.startsWith('- ') || /^\d+\./.test(trimmed)) {
        return (
          <div key={index} className="flex gap-3 mb-2 pl-2 group">
            <span className="shrink-0 text-yellow-400 mt-1.5 text-[10px]">●</span>
            <div className="leading-relaxed text-gray-300 text-sm">
              {processInlineStyles(trimmed.replace(/^[-\d.]+\s*/, ''))}
            </div>
          </div>
        );
      }

      return (
        <p key={index} className="mb-2 leading-relaxed text-gray-300 text-sm">
          {processInlineStyles(trimmed)}
        </p>
      );
    });
  };

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
      onClick={handleClose}
    >
      <div 
        className={`relative w-[900px] max-h-[80vh] bg-slate-900 border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden flex flex-col ${isClosing ? 'animate-scale-out' : 'animate-scale-in'}`}
        onClick={(e) => e.stopPropagation()}
      >
        
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 flex items-center justify-center bg-black/40 hover:bg-yellow-400 text-white hover:text-black rounded-full transition-all duration-300 backdrop-blur border border-white/10 group"
        >
          <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>

        {/* Hero Image */}
        <div className="relative h-72 shrink-0 group overflow-hidden">
          <img 
            src={displayItem.image} 
            alt={displayItem.title} 
            className="w-full h-full object-cover transition-transform duration-[3s] ease-out group-hover:scale-110" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent"></div>
          
          <div className="absolute bottom-6 left-8 right-8">
            <div className="flex gap-3 mb-3">
              <span className={`px-2 py-0.5 text-xs font-bold tracking-wider rounded border ${
                displayItem.category === 'EVENT' ? 'bg-purple-900/40 text-purple-300 border-purple-500/30' : 
                displayItem.category === 'NOTICE' ? 'bg-red-900/40 text-red-300 border-red-500/30' : 
                'bg-blue-900/40 text-blue-300 border-blue-500/30'
              }`}>
                {displayItem.category}
              </span>
              <span className="flex items-center gap-1 text-gray-400 text-xs font-mono bg-black/40 px-2 rounded border border-white/5">
                <Calendar size={12} /> {displayItem.date}
              </span>
            </div>
            <h2 className="text-3xl font-bold text-white leading-tight drop-shadow-lg max-w-2xl">
              {displayItem.title}
            </h2>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-900">
          <div className="prose prose-invert max-w-none">
            {renderContent(displayItem.content)}
          </div>
          
          <div className="mt-12 pt-8 border-t border-gray-800 flex justify-end">
            <button onClick={handleClose} className="px-8 py-2 border border-gray-600 hover:border-yellow-400 hover:text-yellow-400 text-gray-400 transition-colors rounded text-sm tracking-widest uppercase">
              Close
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        .animate-fade-out { animation: fadeOut 0.3s ease-out forwards; }
        .animate-scale-in { animation: scaleIn 0.3s ease-out forwards; }
        .animate-scale-out { animation: scaleOut 0.3s ease-out forwards; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes scaleOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.95); } }
      `}</style>
    </div>
  );
};

export default NewsModal;

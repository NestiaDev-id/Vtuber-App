import React, { useState } from 'react';
import { NEWS_ITEMS, SOCIAL_LINKS } from '../../constants';
import { NewsItem } from '../../types';
import NewsModal from './NewsModal';
import { Home, Newspaper, Users, Info, ExternalLink } from 'lucide-react';

const Sidebar: React.FC = () => {
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  return (
    <>
      <div className="fixed left-0 top-0 bottom-0 w-[400px] z-10 flex flex-col p-12 bg-gradient-to-r from-black/80 to-transparent">
        
        {/* Logo Area */}
        <div className="mb-16 animate-fade-in-down flex items-center gap-4">
          <div className="w-16 h-16 relative">
            <div className="absolute inset-0 bg-yellow-400/20 blur-xl rounded-full animate-pulse"></div>
            <img 
              src="/logo.png" 
              alt="App Logo" 
              className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_10px_rgba(255,255,b,0.3)]"
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-4xl font-black text-white tracking-tighter italic drop-shadow-lg leading-none">
              VTUBER
            </h1>
            <h2 className="text-sm font-light text-yellow-400 tracking-[0.3em] mt-1 uppercase">
              Companion
            </h2>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-6 mb-auto">
          <NavItem icon={<Home size={20}/>} label="HOME" active />
          <NavItem icon={<Newspaper size={20}/>} label="NEWS" />
          <NavItem icon={<Users size={20}/>} label="CHARACTERS" />
          <NavItem icon={<Info size={20}/>} label="INFO" />
        </nav>

        {/* News Snippet */}
        <div className="mt-8 mb-12 relative group">
          <h3 className="text-yellow-400 font-bold text-xs tracking-widest mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-400"></span>
            LATEST NEWS
          </h3>
          
          <div className="space-y-4">
            {NEWS_ITEMS.slice(0, 2).map((item, index) => (
              <div 
                key={item.id} 
                onClick={() => setSelectedNews(item)}
                style={{ animationDelay: `${index * 150}ms` }}
                className="bg-white/5 hover:bg-white/10 p-4 rounded border-l-2 border-transparent hover:border-yellow-400 transition-all cursor-pointer group/item hover:translate-x-2 duration-300"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-gray-400 font-mono tracking-wider">{item.date}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
                    item.category === 'EVENT' ? 'border-purple-500/50 text-purple-300' : 
                    item.category === 'NOTICE' ? 'border-red-500/50 text-red-300' : 
                    'border-blue-500/50 text-blue-300'
                  }`}>
                    {item.category}
                  </span>
                </div>
                <p className="text-sm text-gray-200 group-hover/item:text-white line-clamp-2 leading-snug font-medium transition-colors">
                  {item.title}
                </p>
              </div>
            ))}
          </div>
          <button className="text-xs text-gray-400 mt-4 flex items-center gap-2 hover:text-yellow-400 transition-all hover:translate-x-1">
            VIEW ALL <ExternalLink size={12} />
          </button>
        </div>

        {/* Social Icons */}
        <div className="flex gap-4">
          {SOCIAL_LINKS.map((link) => (
            <button key={link.name} className="w-10 h-10 rounded-full bg-white/5 hover:bg-yellow-400 hover:text-black text-gray-400 flex items-center justify-center transition-all duration-300 hover:scale-110">
              <span className="text-xs font-bold">{link.name[0]}</span>
            </button>
          ))}
        </div>
      </div>

      <NewsModal 
        item={selectedNews} 
        onClose={() => setSelectedNews(null)} 
      />
    </>
  );
};

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active }) => (
  <button className={`flex items-center gap-4 text-lg font-medium transition-all duration-300 group ${active ? 'text-white translate-x-4' : 'text-gray-400 hover:text-white hover:translate-x-2'}`}>
    <span className={`p-2 rounded-lg transition-colors ${active ? 'bg-yellow-400 text-black' : 'bg-transparent group-hover:bg-white/10'}`}>
      {icon}
    </span>
    <span className="tracking-wide">{label}</span>
  </button>
);

export default Sidebar;

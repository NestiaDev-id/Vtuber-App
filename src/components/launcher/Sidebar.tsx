import React from 'react';
import { motion } from 'framer-motion';
import NewsPanel from './NewsPanel';

const Sidebar: React.FC = () => {
  return (
    <>
      {/* Floating Logo - Top Left */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="fixed left-10 top-20 z-20 flex items-center gap-4"
      >
        <div className="w-14 h-14 relative">
          <div className="absolute inset-0 bg-yellow-400/20 blur-xl rounded-full animate-pulse"></div>
          <img 
            src="/logo.png" 
            alt="App Logo" 
            className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_10px_rgba(255,255,0,0.3)]"
          />
        </div>
        <div className="flex flex-col">
          <h1 className="text-3xl font-black text-white tracking-tighter italic drop-shadow-lg leading-none">
            VTUBER
          </h1>
          <h2 className="text-[10px] font-light text-yellow-400 tracking-[0.3em] mt-1 uppercase">
            Companion
          </h2>
        </div>
      </motion.div>

      {/* News Panel with Carousel */}
      <NewsPanel />
    </>
  );
};

export default Sidebar;

import React, { useState, useEffect } from 'react';
import { NEWS_ITEMS } from '../../constants';
import { NewsItem } from '../../types';
import NewsModal from './NewsModal';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NewsPanel: React.FC = () => {
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [activeTab, setActiveTab] = useState<'NOTICE' | 'NEWS'>('NOTICE');
  const [carouselIndex, setCarouselIndex] = useState(0);

  const [hoveredItem, setHoveredItem] = useState<NewsItem | null>(null);

  // Filter news by category for tabs
  const noticeItems = NEWS_ITEMS.filter(item => item.category === 'NOTICE');
  const newsItems = NEWS_ITEMS.filter(item => item.category === 'INFO' || item.category === 'EVENT');
  const displayItems = activeTab === 'NOTICE' ? noticeItems : newsItems;

  // Banner images for carousel (use all news images)
  const bannerItems = NEWS_ITEMS.slice(0, 4);

  // Auto-slide carousel every 6.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % bannerItems.length);
    }, 6500);
    return () => clearInterval(interval);
  }, [carouselIndex, bannerItems.length]);

  const nextSlide = () => {
    setCarouselIndex((prev) => (prev + 1) % bannerItems.length);
  };

  const prevSlide = () => {
    setCarouselIndex((prev) => (prev - 1 + bannerItems.length) % bannerItems.length);
  };

  return (
    <>
      {/* Floating News Panel - Bottom Left */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="fixed left-10 bottom-10 z-20 w-[325px]"
      >
        <div className="bg-slate-950/40 backdrop-blur-xl rounded-xl border border-white/10 overflow-visible shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
          
          {/* Image Carousel */}
          <div className="relative h-[160px] overflow-hidden group">
            <AnimatePresence mode="wait">
              <motion.div
                key={carouselIndex}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 cursor-pointer"
                onClick={() => setSelectedNews(bannerItems[carouselIndex])}
              >
                <img 
                  src={bannerItems[carouselIndex].image} 
                  alt={bannerItems[carouselIndex].title}
                  className="w-full h-full object-cover"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              </motion.div>
            </AnimatePresence>

            {/* Navigation Arrows */}
            <button 
              onClick={prevSlide}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/70 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={nextSlide}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/70 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
            >
              <ChevronRight size={20} />
            </button>

            {/* Progress Indicators */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              {bannerItems.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCarouselIndex(idx)}
                  className={`rounded-full bg-white/20 overflow-hidden relative transition-all duration-300 ${
                    idx === carouselIndex ? 'h-1 w-5' : 'h-1.5 w-1.5'
                  }`}
                >
                  {idx === carouselIndex && (
                    <motion.div
                      key={carouselIndex}
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 6.5, ease: "linear" }}
                      className="absolute inset-0 bg-yellow-400"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex border-b border-white/10">
            <button 
              onClick={() => setActiveTab('NOTICE')}
              className={`flex-1 py-3 text-sm font-medium transition-all relative ${
                activeTab === 'NOTICE' 
                  ? 'text-yellow-400' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Notice
              {activeTab === 'NOTICE' && (
                <motion.div 
                  layoutId="tabIndicator" 
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-400" 
                />
              )}
            </button>
            <button 
              onClick={() => setActiveTab('NEWS')}
              className={`flex-1 py-3 text-sm font-medium transition-all relative ${
                activeTab === 'NEWS' 
                  ? 'text-yellow-400' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              News
              {activeTab === 'NEWS' && (
                <motion.div 
                  layoutId="tabIndicator" 
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-400" 
                />
              )}
            </button>
          </div>

          {/* News List */}
          <div className="h-[105px] overflow-visible">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                {displayItems.length > 0 ? (
                  displayItems.slice(0, 2).map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => setSelectedNews(item)}
                      onMouseEnter={() => setHoveredItem(item)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className="flex justify-between items-center px-4 py-3 hover:bg-white/5 cursor-pointer transition-all border-b border-white/5 last:border-0 group/item relative"
                    >
                      <p className="text-sm text-gray-200 group-hover/item:text-yellow-400 line-clamp-1 flex-1 mr-4 transition-all duration-300">
                        {item.title}
                      </p>
                      <span className="text-xs text-gray-500 font-mono whitespace-nowrap group-hover/item:text-yellow-400/80 transition-colors">
                        {item.date.slice(5)} {/* Show MM-DD */}
                      </span>

                      {/* Floating Tooltip Tooltip */}
                      <AnimatePresence>
                        {hoveredItem?.id === item.id && (
                          <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="absolute left-[105%] top-1/2 -translate-y-1/2 z-50 pointer-events-none"
                          >
                            <div className="bg-black/90 backdrop-blur-md px-4 py-3 rounded-lg border border-white/20 shadow-2xl whitespace-nowrap flex items-center gap-2">
                              {/* Small triangle arrow */}
                              <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-white/20" />
                              <span className="text-white text-sm font-semibold tracking-wide">
                                {item.title}
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center text-gray-500 text-sm">
                    No items found
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <NewsModal 
        item={selectedNews} 
        onClose={() => setSelectedNews(null)} 
      />
    </>
  );
};

export default NewsPanel;

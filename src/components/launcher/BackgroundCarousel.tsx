import React, { useState, useEffect } from 'react';
import { BACKGROUND_IMAGES } from '../../constants';

const BackgroundCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % BACKGROUND_IMAGES.length);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black">
      {BACKGROUND_IMAGES.map((src, index) => (
        <div
          key={src}
          className={`absolute inset-0 transition-opacity duration-[2000ms] ease-in-out ${
            index === currentIndex ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img
            src={src}
            alt="Background"
            className="w-full h-full object-cover"
            style={{
              animation: index === currentIndex ? 'kenburns 20s infinite alternate' : 'none'
            }}
          />
          {/* Gradients for UI readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent w-1/2" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent h-1/2 mt-auto" />
          
          {/* Sci-fi Overlay Pattern */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '4px 4px' }} />
        </div>
      ))}
      <style>{`
        @keyframes kenburns {
          0% { transform: scale(1.0); }
          100% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};

export default BackgroundCarousel;

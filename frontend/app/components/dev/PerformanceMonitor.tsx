import React, { useEffect, useState } from 'react';

interface PerformanceMonitorProps {
  enabled?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  enabled = false,
  position = 'top-right'
}) => {
  const [metrics, setMetrics] = useState({
    loadTime: 0,
    lazyImagesLoaded: 0,
    cacheHits: 0,
    totalRequests: 0,
    fps: 0
  });

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrame: number;

    const updateFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime >= lastTime + 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        setMetrics(prev => ({ ...prev, fps }));
        frameCount = 0;
        lastTime = currentTime;
      }
      
      animationFrame = requestAnimationFrame(updateFPS);
    };

    // Observer les images lazy loading
    const imageObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const addedImages = Array.from(mutation.addedNodes)
            .filter(node => node instanceof HTMLImageElement);
          
          if (addedImages.length > 0) {
            setMetrics(prev => ({
              ...prev,
              lazyImagesLoaded: prev.lazyImagesLoaded + addedImages.length
            }));
          }
        }
      });
    });

    // Mesurer le temps de chargement initial
    const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
    setMetrics(prev => ({ ...prev, loadTime }));

    imageObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    updateFPS();

    return () => {
      imageObserver.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [enabled]);

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      default:
        return 'top-4 right-4';
    }
  };

  if (!enabled) return null;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className={`fixed ${getPositionClasses()} z-50 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors`}
        title="Performance Monitor"
      >
        📊
      </button>

      {/* Performance panel */}
      {isVisible && (
        <div className={`fixed ${getPositionClasses()} z-40 bg-black bg-opacity-90 text-white p-4 rounded-lg shadow-xl text-xs font-mono mt-12 min-w-[200px]`}>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-green-400">Performance</h3>
            <button
              onClick={() => setIsVisible(false)}
              className="text-red-400 hover:text-red-300"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Load Time:</span>
              <span className="text-yellow-400">{metrics.loadTime}ms</span>
            </div>
            
            <div className="flex justify-between">
              <span>FPS:</span>
              <span className={metrics.fps > 55 ? 'text-green-400' : metrics.fps > 30 ? 'text-yellow-400' : 'text-red-400'}>
                {metrics.fps}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>Lazy Images:</span>
              <span className="text-blue-400">{metrics.lazyImagesLoaded}</span>
            </div>
            
            <div className="flex justify-between">
              <span>Memory:</span>
              <span className="text-purple-400">
                {(performance as any).memory ? 
                  `${Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)}MB` : 
                  'N/A'
                }
              </span>
            </div>
          </div>
          
          <div className="mt-2 pt-2 border-t border-gray-600">
            <div className="text-xs text-gray-400">
              Dev Tools Only
            </div>
          </div>
        </div>
      )}
    </>
  );
};
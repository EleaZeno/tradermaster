
import { useEffect } from 'react';

export const usePerformanceMonitor = () => {
  useEffect(() => {
    // Check if PerformanceObserver is supported
    if (typeof PerformanceObserver === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        // Log game loop tick duration
        if (entry.name === 'game-tick') {
            if (entry.duration > 16) {
                console.warn(`[Perf] Game Tick Slow: ${entry.duration.toFixed(2)}ms`);
            } else {
                // Uncomment for verbose logging
                // console.debug(`[Perf] Game Tick: ${entry.duration.toFixed(2)}ms`);
            }
        }
      });
    });

    observer.observe({ entryTypes: ['measure'] });

    return () => observer.disconnect();
  }, []);
};


import { useEffect } from 'react';

export const usePerformanceMonitor = () => {
  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const tickEntry = entries.find(e => e.name === 'game-tick');

      if (tickEntry && tickEntry.duration > 16) {
          // If slow, log details
          const details = entries
            .filter(e => e.name.startsWith('pipeline-') || e.name.startsWith('eco-'))
            .map(e => `${e.name}: ${e.duration.toFixed(2)}ms`)
            .join(', ');
            
          console.warn(`[Perf] Slow Tick (${tickEntry.duration.toFixed(2)}ms) -> ${details}`);
      }
    });

    observer.observe({ entryTypes: ['measure'] });

    return () => observer.disconnect();
  }, []);
};


import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';

export const useGameLoop = () => {
  // Select specific parts of the store to avoid unnecessary re-renders in the loop itself
  const isRunning = useGameStore(s => s.isRunning);
  const gameSpeed = useGameStore(s => s.gameSpeed); // Read speed
  const tick = useGameStore(s => s.tick);
  
  // We don't return the full state here anymore. 
  // Components should select what they need directly from the store.
  // But for compatibility with existing App.tsx structure during refactor,
  // we can return the getters/setters.
  const gameState = useGameStore(s => s.gameState);
  const setIsRunning = (v: boolean) => v ? useGameStore.getState().start() : useGameStore.getState().stop();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning) {
      // Calculate delay: 1x=1000ms, 2x=500ms, 5x=200ms
      const delay = 1000 / Math.max(1, gameSpeed);
      
      interval = setInterval(() => {
        tick();
      }, delay);
    }
    return () => clearInterval(interval);
  }, [isRunning, gameSpeed, tick]);

  return { gameState, isRunning, setIsRunning };
};

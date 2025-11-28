
import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { GAME_CONFIG } from '../config';

export const useGameLoop = () => {
  const isRunning = useGameStore(state => state.isRunning);
  const gameSpeed = useGameStore(state => state.gameSpeed); 
  const tick = useGameStore(state => state.tick);
  
  const gameState = useGameStore(state => state.gameState);
  const setIsRunning = (value: boolean) => value ? useGameStore.getState().start() : useGameStore.getState().stop();

  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!isRunning) {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      return;
    }

    const animate = (time: number) => {
      if (lastTimeRef.current !== undefined) {
        const deltaTime = time - lastTimeRef.current;
        
        // Calculate interval based on CORE_ECO rate to ensure 1x speed = 1 Day / Second
        // CORE_ECO is the number of ticks per day.
        const ticksPerDay = GAME_CONFIG.UPDATE_RATES.CORE_ECO || 5;
        const baseInterval = 1000 / ticksPerDay;
        const interval = baseInterval / Math.max(1, gameSpeed);

        if (deltaTime >= interval) {
          tick();
          lastTimeRef.current = time;
        }
      } else {
        lastTimeRef.current = time;
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isRunning, gameSpeed, tick]);

  return { gameState, isRunning, setIsRunning };
};
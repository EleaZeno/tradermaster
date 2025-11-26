import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';

export const useGameLoop = () => {
  const isRunning = useGameStore(state => state.isRunning);
  const gameSpeed = useGameStore(state => state.gameSpeed); 
  const tick = useGameStore(state => state.tick);
  
  const gameState = useGameStore(state => state.gameState);
  const setIsRunning = (value: boolean) => value ? useGameStore.getState().start(true) : useGameStore.getState().stop(true);

  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();

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
        const interval = 1000 / Math.max(1, gameSpeed);

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
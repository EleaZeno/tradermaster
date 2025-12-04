
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';
import { 
  GameStore, 
  createGameSlice, 
  createPlayerSlice, 
  createCompanySlice, 
  createBankSlice,
  createMarketSlice,
  createUISlice
} from './slices';

export const useGameStore = create<GameStore>()(
  persist(
    immer((...a) => ({
      ...createGameSlice(...a),
      ...createPlayerSlice(...a),
      ...createCompanySlice(...a),
      ...createBankSlice(...a),
      ...createMarketSlice(...a),
      ...createUISlice(...a),
    })),
    {
      name: 'ecotycoon-save-v1', // unique name
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        gameState: state.gameState,
        gameSpeed: state.gameSpeed
      }), // Only persist game state and settings, not transient UI states
    }
  )
);

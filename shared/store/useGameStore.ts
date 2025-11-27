
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { 
  GameStore, 
  createGameSlice, 
  createPlayerSlice, 
  createCompanySlice, 
  createBankSlice 
} from './slices';

export const useGameStore = create<GameStore>()(
  immer((...a) => ({
    ...createGameSlice(...a),
    ...createPlayerSlice(...a),
    ...createCompanySlice(...a),
    ...createBankSlice(...a),
  }))
);

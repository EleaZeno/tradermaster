
import { GameState } from '../shared/types';

export const ACHIEVEMENTS = [
  { 
    id: 'first_wealth', 
    name: '第一桶金', 
    description: '拥有超过 500 oz 现金', 
    icon: '💰', 
    condition: (s: GameState) => (s.population.residents.find(r => r.isPlayer)?.cash || 0) >= 500 
  },
  { 
    id: 'magnate', 
    name: '商业大亨', 
    description: '拥有超过 5,000 oz 现金', 
    icon: '🏦', 
    condition: (s: GameState) => (s.population.residents.find(r => r.isPlayer)?.cash || 0) >= 5000 
  },
  { 
    id: 'founder', 
    name: '创业先锋', 
    description: '创立一家公司', 
    icon: '🏢', 
    condition: (s: GameState) => s.companies.some(c => c.isPlayerFounded) 
  },
  { 
    id: 'shareholder', 
    name: '资本家', 
    description: '拥有一家公司 10% 以上的股份', 
    icon: '📈', 
    condition: (s: GameState) => {
      const p = s.population.residents.find(r => r.isPlayer);
      return s.companies.some(c => (p?.portfolio[c.id] || 0) / c.totalShares >= 0.1);
    }
  },
  { 
    id: 'monopoly', 
    name: '垄断者', 
    description: '拥有一家公司 51% 以上的股份', 
    icon: '🦁', 
    condition: (s: GameState) => {
      const p = s.population.residents.find(r => r.isPlayer);
      return s.companies.some(c => (p?.portfolio[c.id] || 0) / c.totalShares >= 0.51);
    }
  },
  { 
    id: 'landlord', 
    name: '大地主', 
    description: '拥有土地代币', 
    icon: '🌍', 
    condition: (s: GameState) => (s.population.residents.find(r => r.isPlayer)?.landTokens || 0) > 0 
  },
  {
    id: 'trader',
    name: '交易员',
    description: '参与期货交易',
    icon: '📜',
    condition: (s: GameState) => s.futures.some(f => {
        const p = s.population.residents.find(r => r.isPlayer);
        return p && p.futuresPositions.includes(f);
    })
  }
];

export const checkAchievements = (state: GameState): string[] => {
    const unlocked: string[] = [];
    ACHIEVEMENTS.forEach(ach => {
        const already = state.achievements.find(a => a.id === ach.id);
        if (!already && ach.condition(state)) {
            unlocked.push(ach.id);
        }
    });
    return unlocked;
};

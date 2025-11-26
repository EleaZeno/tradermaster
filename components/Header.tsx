
import React, { memo } from 'react';
import { TrendingUp, Wallet, Calendar, Pause, Coffee } from 'lucide-react';
import { GameState, LivingStandard } from '../shared/types';

interface HeaderProps {
  gameState: GameState;
  isRunning: boolean;
  gameSpeed: number;
  onStop: () => void;
  onSetGameSpeed: (speed: number) => void;
  onSetLivingStandard: (level: LivingStandard) => void;
}

export const Header = memo<HeaderProps>(({ 
  gameState, isRunning, gameSpeed, onStop, onSetGameSpeed, onSetLivingStandard 
}) => {
  const player = gameState.population.residents.find(r => r.isPlayer);

  return (
    <header className="fixed top-0 inset-x-0 h-16 bg-stone-900/90 backdrop-blur border-b border-stone-800 z-40 px-4 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2">
         <div className="bg-gradient-to-br from-amber-500 to-yellow-600 p-1.5 rounded-lg text-white shadow-lg shadow-amber-900/20">
            <TrendingUp size={20} />
         </div>
         <div>
           <h1 className="text-lg font-bold text-stone-100">伊甸谷 <span className="text-stone-500 text-xs font-normal border border-stone-700 px-1 rounded ml-1">混沌模式</span></h1>
         </div>
      </div>

      <div className="flex items-center gap-4 text-sm font-mono">
         {player && (
             <div className="flex items-center gap-2 bg-stone-800 rounded p-1 hidden sm:flex">
                 <Coffee size={14} className="ml-2 text-stone-400"/>
                 <select 
                      className="bg-stone-800 text-xs text-stone-300 focus:outline-none"
                      value={player.livingStandard}
                      onChange={(e) => onSetLivingStandard(e.target.value as LivingStandard)}
                 >
                     <option value="SURVIVAL">生存模式</option>
                     <option value="BASIC">温饱</option>
                     <option value="COMFORT">小康</option>
                     <option value="LUXURY">奢靡</option>
                 </select>
             </div>
         )}

         <div className="hidden sm:flex items-center gap-2 text-amber-400 bg-amber-950/30 px-3 py-1.5 rounded border border-amber-900/50 shadow-inner">
            <Wallet size={14} />
            {gameState.cash.toFixed(2)} oz
         </div>
         <div className="flex items-center gap-2 text-stone-400 bg-stone-800/50 px-3 py-1.5 rounded">
            <Calendar size={14} />
            第 {gameState.day} 天
         </div>
         
         <div className="flex items-center bg-stone-800 rounded-lg p-1 gap-1 border border-stone-700">
           <button 
              className={`p-1.5 rounded transition-colors ${!isRunning ? 'bg-red-900/50 text-red-200' : 'text-stone-400 hover:bg-stone-700 hover:text-stone-200'}`} 
              onClick={onStop}
              title="暂停"
           >
              <Pause size={14} fill={!isRunning ? "currentColor" : "none"}/>
           </button>
           
           <div className="w-px h-4 bg-stone-700 mx-1"></div>

           {[1, 2, 5].map(speed => (
              <button
                  key={speed}
                  onClick={() => onSetGameSpeed(speed)}
                  className={`px-2 py-0.5 text-xs font-mono font-bold rounded transition-all duration-200 ${
                      isRunning && gameSpeed === speed 
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50 scale-105' 
                      : 'text-stone-500 hover:bg-stone-700 hover:text-stone-300'
                  }`}
              >
                  {speed}x
              </button>
           ))}
         </div>
      </div>
    </header>
  );
});



import React, { memo, useState } from 'react';
import { TrendingUp, Wallet, Calendar, Pause, Coffee, Trophy, Settings } from 'lucide-react';
import { GameState, LivingStandard } from '../shared/types';
import { AchievementsModal } from './modals/AchievementsModal';
import { SettingsModal } from './modals/SettingsModal';
import { useResponsive } from '../shared/hooks/useResponsive';
import { getTranslation } from '../shared/utils/i18n';

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
  const [showAchievements, setShowAchievements] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const player = gameState.population.residents.find(r => r.isPlayer);
  const unlockedCount = gameState.achievements.length;
  const { isDesktop, isMobile } = useResponsive();
  
  const lang = gameState.settings.language;
  const t = (key: string) => getTranslation(key, lang);

  return (
    <>
    <header className="fixed top-0 inset-x-0 h-16 bg-stone-900/90 backdrop-blur border-b border-stone-800 z-40 px-4 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2">
         <div className="bg-gradient-to-br from-amber-500 to-yellow-600 p-1.5 rounded-lg text-white shadow-lg shadow-amber-900/20">
            <TrendingUp size={20} />
         </div>
         <div>
           <h1 className="text-lg font-bold text-stone-100 flex items-center gap-2">
               {t('header.title')}
               {isDesktop && <span className="text-stone-500 text-xs font-normal border border-stone-700 px-1 rounded ml-1">Chaos Mode</span>}
           </h1>
         </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 text-sm font-mono">
         <button 
             onClick={() => setShowAchievements(true)}
             className="flex items-center gap-2 text-stone-400 hover:text-amber-400 transition-colors bg-stone-800/50 px-2 sm:px-3 py-1.5 rounded hover:bg-stone-800"
             title={t('header.achievements')}
         >
             <Trophy size={14} className={unlockedCount > 0 ? "text-amber-500" : ""} />
             <span className="hidden sm:inline">{t('header.achievements')}</span>
             {unlockedCount > 0 && <span className="bg-amber-900 text-amber-500 text-[10px] px-1.5 rounded-full">{unlockedCount}</span>}
         </button>
         
         <button 
             onClick={() => setShowSettings(true)}
             className="flex items-center gap-2 text-stone-400 hover:text-blue-400 transition-colors bg-stone-800/50 px-2 sm:px-3 py-1.5 rounded hover:bg-stone-800"
             title={t('settings.title')}
         >
             <Settings size={14} />
         </button>

         {player && isDesktop && (
             <div className="flex items-center gap-2 bg-stone-800 rounded p-1 hidden sm:flex">
                 <Coffee size={14} className="ml-2 text-stone-400"/>
                 <select 
                      className="bg-stone-800 text-xs text-stone-300 focus:outline-none"
                      value={player.livingStandard}
                      onChange={(e) => onSetLivingStandard(e.target.value as LivingStandard)}
                 >
                     <option value="SURVIVAL">Survival</option>
                     <option value="BASIC">Basic</option>
                     <option value="COMFORT">Comfort</option>
                     <option value="LUXURY">Luxury</option>
                 </select>
             </div>
         )}

         <div className="flex items-center gap-2 text-amber-400 bg-amber-950/30 px-2 sm:px-3 py-1.5 rounded border border-amber-900/50 shadow-inner">
            <Wallet size={14} />
            {Math.floor(gameState.cash)} <span className="hidden sm:inline">oz</span>
         </div>
         <div className="hidden sm:flex items-center gap-2 text-stone-400 bg-stone-800/50 px-3 py-1.5 rounded">
            <Calendar size={14} />
            D{gameState.day}
         </div>
         
         {!isMobile && (
             <div className="flex items-center bg-stone-800 rounded-lg p-1 gap-1 border border-stone-700">
            <button 
                className={`p-1.5 rounded transition-colors ${!isRunning ? 'bg-red-900/50 text-red-200' : 'text-stone-400 hover:bg-stone-700 hover:text-stone-200'}`} 
                onClick={onStop}
                title={t('header.pause')}
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
         )}
         
         {isMobile && (
             <button 
                 onClick={onStop}
                 className={`p-2 rounded ${!isRunning ? 'text-red-400' : 'text-stone-500'}`}
             >
                 <Pause size={16} fill={!isRunning ? "currentColor" : "none"}/>
             </button>
         )}
      </div>
    </header>
    {showAchievements && <AchievementsModal onClose={() => setShowAchievements(false)} />}
    {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
});
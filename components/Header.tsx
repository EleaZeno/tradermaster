
import React, { memo, useState, useEffect } from 'react';
import { TrendingUp, Wallet, Calendar, Pause, Coffee, Trophy, Settings, Terminal, Bell, Play } from 'lucide-react';
import { LivingStandard } from '../shared/types';
import { AchievementsModal } from './modals/AchievementsModal';
import { SettingsModal } from './modals/SettingsModal';
import { useResponsive } from '../shared/hooks/useResponsive';
import { getTranslation } from '../shared/utils/i18n';
import { useGameStore } from '../shared/store/useGameStore';
import { useShallow } from 'zustand/react/shallow';
import { AnimatePresence, motion } from 'framer-motion';

interface HeaderProps {
  onStop: () => void;
  onSetGameSpeed: (speed: number) => void;
  onToggleDevTools: () => void;
}

const NewsTicker = () => {
    const events = useGameStore(useShallow(s => s.gameState.events));
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (events.length === 0) return;
        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % events.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [events.length]);

    if (events.length === 0) return null;

    const currentEvent = events[currentIndex];
    
    // Only show NEWS type events or relevant ones
    if (currentEvent.type !== 'NEWS') return null;

    const impactColor = currentEvent.impactType === 'BAD' ? 'text-red-400' : currentEvent.impactType === 'GOOD' ? 'text-emerald-400' : 'text-blue-400';

    return (
        <div className="hidden lg:flex items-center gap-2 bg-stone-950/50 px-3 py-1 rounded-full border border-stone-800 text-xs max-w-[400px] overflow-hidden">
            <Bell size={12} className="text-amber-500 shrink-0 animate-pulse" />
            <div className="overflow-hidden relative h-5 w-full">
                <AnimatePresence mode='wait'>
                    <motion.div 
                        key={currentEvent.turnCreated + currentIndex}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        className={`truncate ${impactColor} font-medium absolute w-full`}
                    >
                        {currentEvent.headline}: <span className="text-stone-400 font-normal">{currentEvent.description}</span>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

export const Header = memo<HeaderProps>(({ 
  onStop, onSetGameSpeed, onToggleDevTools
}) => {
  const [showAchievements, setShowAchievements] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const isRunning = useGameStore(s => s.isRunning);
  const gameSpeed = useGameStore(s => s.gameSpeed);
  const cash = useGameStore(s => s.gameState.cash);
  const day = useGameStore(s => s.gameState.day);
  const achievements = useGameStore(s => s.gameState.achievements);
  const lang = useGameStore(s => s.gameState.settings.language);
  const player = useGameStore(useShallow(s => s.gameState.population.residents.find(r => r.isPlayer)));
  const setLivingStandard = useGameStore(s => s.setLivingStandard);

  const unlockedCount = achievements.length;
  const { isDesktop, isMobile } = useResponsive();
  
  const t = (key: string) => getTranslation(key, lang);

  return (
    <>
    <header className="fixed top-0 inset-x-0 h-16 bg-stone-900/90 backdrop-blur border-b border-stone-800 z-40 px-4 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-4">
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
         <NewsTicker />
      </div>

      <div className="flex items-center gap-2 sm:gap-4 text-sm font-mono">
         <button 
             onClick={onToggleDevTools}
             className="flex items-center gap-2 text-stone-400 hover:text-emerald-400 transition-colors bg-stone-800/50 px-2 sm:px-3 py-1.5 rounded hover:bg-stone-800"
             title="Developer Tools (Ctrl+Shift+D)"
         >
             <Terminal size={14} />
         </button>

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
                      className="bg-stone-800 text-xs text-stone-300 focus:outline-none cursor-pointer"
                      value={player.livingStandard}
                      onChange={(e) => setLivingStandard(e.target.value as LivingStandard)}
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
            {Math.floor(cash)} <span className="hidden sm:inline">oz</span>
         </div>
         <div className="hidden sm:flex items-center gap-2 text-stone-400 bg-stone-800/50 px-3 py-1.5 rounded">
            <Calendar size={14} />
            D{day}
         </div>
         
         {!isMobile && (
             <div className="flex items-center bg-stone-800 rounded-lg p-1 gap-1 border border-stone-700">
            <button 
                className={`p-1.5 rounded transition-colors ${!isRunning ? 'bg-red-900/50 text-red-200' : 'text-stone-400 hover:bg-stone-700 hover:text-stone-200'}`} 
                onClick={onStop}
                title={t('header.pause')}
            >
                {isRunning ? <Pause size={14}/> : <Play size={14}/>}
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

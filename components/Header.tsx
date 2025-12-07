
import React, { memo, useState, useEffect } from 'react';
import { TrendingUp, Wallet, Calendar, Pause, Coffee, Trophy, Settings, Terminal, Bell, Play, RotateCcw } from 'lucide-react';
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
    
    // Only show NEWS type events
    if (currentEvent.type !== 'NEWS') return null;

    const impactColor = currentEvent.impactType === 'BAD' ? 'text-red-400' : currentEvent.impactType === 'GOOD' ? 'text-emerald-400' : 'text-blue-400';

    return (
        <div className="hidden xl:flex items-center gap-2 bg-stone-900/50 px-3 py-1.5 rounded-full border border-stone-800 text-xs w-[350px] overflow-hidden shadow-inner">
            <Bell size={12} className="text-amber-500 shrink-0 animate-pulse" />
            <div className="overflow-hidden relative h-5 w-full">
                <AnimatePresence mode='wait'>
                    <motion.div 
                        key={currentEvent.turnCreated + currentIndex}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        className={`truncate ${impactColor} font-medium absolute w-full font-mono`}
                    >
                        {currentEvent.headline}
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
  const reset = useGameStore(s => s.reset);
  
  const unlockedCount = achievements.length;
  const { isDesktop, isMobile } = useResponsive();
  
  const t = (key: string) => getTranslation(key, lang);

  const handleReset = () => {
      if (confirm(t('header.reset_confirm') || 'Reset Game to Day 1?')) {
          reset();
      }
  };

  return (
    <>
    {/* Header is now a static flex item in the dashboard column */}
    <header className="h-16 shrink-0 bg-stone-950/80 backdrop-blur-sm border-b border-stone-800 flex items-center justify-between px-6 z-30 shadow-sm">
      <div className="flex items-center gap-4">
         {/* Mobile Logo if needed */}
         {!isDesktop && (
             <div className="bg-emerald-600 p-1.5 rounded-lg">
                 <TrendingUp size={16} className="text-white"/>
             </div>
         )}
         
         <div className="hidden sm:flex items-center gap-2 text-stone-400 bg-stone-900 border border-stone-800 px-3 py-1.5 rounded-lg shadow-sm">
            <Calendar size={14} className="text-stone-500" />
            <span className="font-mono font-bold text-sm">DAY {day}</span>
         </div>

         <NewsTicker />
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
         <div className="flex items-center gap-2 text-amber-400 bg-stone-900 px-3 py-1.5 rounded-lg border border-amber-900/30 shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)]">
            <Wallet size={16} />
            <span className="font-mono font-bold text-lg">{Math.floor(cash).toLocaleString()}</span> 
            <span className="text-xs text-amber-600 font-bold mt-1">oz</span>
         </div>

         <div className="h-6 w-px bg-stone-800 mx-1 hidden sm:block"></div>

         <button 
             onClick={onToggleDevTools}
             className="text-stone-500 hover:text-emerald-400 transition-colors p-2 hover:bg-stone-900 rounded-lg hidden sm:block"
             title="Terminal (Ctrl+Shift+D)"
         >
             <Terminal size={18} />
         </button>

         <button 
             onClick={() => setShowAchievements(true)}
             className="text-stone-500 hover:text-amber-400 transition-colors p-2 hover:bg-stone-900 rounded-lg relative hidden sm:block"
             title={t('header.achievements')}
         >
             <Trophy size={18} />
             {unlockedCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>}
         </button>
         
         <button 
             onClick={() => setShowSettings(true)}
             className="text-stone-500 hover:text-blue-400 transition-colors p-2 hover:bg-stone-900 rounded-lg"
             title={t('settings.title')}
         >
             <Settings size={18} />
         </button>

         {!isMobile && (
             <div className="flex items-center bg-stone-900 rounded-lg p-1 gap-1 border border-stone-800 ml-2">
                <button 
                    className={`p-1.5 rounded-md transition-all ${!isRunning ? 'bg-red-900/20 text-red-400' : 'text-stone-400 hover:bg-stone-800'}`} 
                    onClick={onStop}
                    title={t('header.pause')}
                >
                    {isRunning ? <Pause size={16}/> : <Play size={16}/>}
                </button>
                
                <button 
                    className="p-1.5 rounded-md transition-all text-stone-400 hover:bg-stone-800 hover:text-red-400"
                    onClick={handleReset}
                    title={t('header.reset')}
                >
                    <RotateCcw size={16}/>
                </button>
                
                <div className="w-px h-4 bg-stone-800 mx-1"></div>

                {[1, 2, 5].map(speed => (
                    <button
                        key={speed}
                        onClick={() => onSetGameSpeed(speed)}
                        className={`px-2 py-0.5 text-xs font-mono font-bold rounded-md transition-all duration-200 ${
                            isRunning && gameSpeed === speed 
                            ? 'bg-emerald-600 text-white shadow-md' 
                            : 'text-stone-500 hover:bg-stone-800 hover:text-stone-300'
                        }`}
                    >
                        {speed}x
                    </button>
                ))}
            </div>
         )}
      </div>
    </header>
    {showAchievements && <AchievementsModal onClose={() => setShowAchievements(false)} />}
    {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
});

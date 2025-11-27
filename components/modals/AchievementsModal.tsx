
import React from 'react';
import { useGameStore } from '../../shared/store/useGameStore';
import { ACHIEVEMENTS } from '../../services/achievementService';
import { Card } from '../../shared/components';
import { motion } from 'framer-motion';
import { X, Lock, Unlock } from 'lucide-react';

interface AchievementsModalProps {
  onClose: () => void;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({ onClose }) => {
  const gameState = useGameStore(s => s.gameState);
  
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
       <motion.div
         initial={{ scale: 0.9, opacity: 0 }}
         animate={{ scale: 1, opacity: 1 }}
         className="w-full max-w-2xl bg-stone-900 border border-stone-700 rounded-xl overflow-hidden max-h-[80vh] flex flex-col"
       >
          <div className="p-4 border-b border-stone-800 flex justify-between items-center bg-stone-900">
             <h2 className="text-xl font-bold text-white flex items-center gap-2">🏆 成就系统</h2>
             <button onClick={onClose} className="p-2 hover:bg-stone-800 rounded-full text-stone-400 hover:text-white">
                 <X size={20} />
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-stone-950/50">
             {ACHIEVEMENTS.map(ach => {
                 const unlocked = gameState.achievements.find(a => a.id === ach.id);
                 return (
                     <div 
                        key={ach.id} 
                        className={`p-4 rounded-lg border flex items-center gap-4 transition-all ${
                            unlocked 
                            ? 'bg-emerald-950/30 border-emerald-900/50' 
                            : 'bg-stone-900/50 border-stone-800 opacity-60 grayscale'
                        }`}
                     >
                         <div className="text-4xl">{ach.icon}</div>
                         <div className="flex-1">
                             <div className="flex items-center gap-2">
                                <h3 className={`font-bold ${unlocked ? 'text-emerald-400' : 'text-stone-400'}`}>{ach.name}</h3>
                                {unlocked && <Unlock size={12} className="text-emerald-500"/>}
                                {!unlocked && <Lock size={12} className="text-stone-600"/>}
                             </div>
                             <p className="text-xs text-stone-500 mt-1">{ach.description}</p>
                             {unlocked && (
                                 <div className="text-[10px] text-stone-600 mt-2 font-mono">
                                     Unlocked: {new Date(unlocked.unlockedAt).toLocaleTimeString()}
                                 </div>
                             )}
                         </div>
                     </div>
                 );
             })}
          </div>
          
          <div className="p-4 border-t border-stone-800 bg-stone-900 text-center text-xs text-stone-500">
              已解锁: {gameState.achievements.length} / {ACHIEVEMENTS.length}
          </div>
       </motion.div>
    </div>
  );
};

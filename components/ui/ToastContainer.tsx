

import React from 'react';
import { useGameStore } from '../../shared/store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, CheckCircle, Info, AlertTriangle, X, Trash2 } from 'lucide-react';
import { getTranslation } from '../../shared/utils/i18n';

export const ToastContainer: React.FC = () => {
  const notifications = useGameStore(s => s.gameState.notifications);
  const settings = useGameStore(s => s.gameState.settings);
  const dismissNotification = useGameStore(s => s.dismissNotification);
  const clearNotifications = useGameStore(s => s.clearNotifications);

  const t = (key: string) => getTranslation(key, settings.language);

  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 w-80 pointer-events-none">
      {/* Clear All Button */}
      <AnimatePresence>
        {notifications.length > 1 && (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex justify-end mb-2 pointer-events-auto"
            >
                <button 
                    onClick={clearNotifications}
                    className="bg-stone-800 hover:bg-red-900/50 text-stone-400 hover:text-red-200 text-xs px-2 py-1 rounded border border-stone-700 flex items-center gap-1 transition-colors shadow-lg backdrop-blur-md"
                >
                    <Trash2 size={12}/> {t('toast.clear')} ({notifications.length})
                </button>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode='popLayout'>
        {notifications.map(n => (
            <motion.div
               layout
               key={n.id}
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: 20 }}
               transition={{ duration: 0.2 }}
               onClick={() => dismissNotification(n.id)} // Click anywhere to dismiss
               className={`pointer-events-auto p-3 rounded-lg shadow-lg border backdrop-blur-md flex items-start gap-3 cursor-pointer hover:scale-[1.02] transition-transform ${
                   n.type === 'success' ? 'bg-emerald-950/80 border-emerald-800' :
                   n.type === 'error' ? 'bg-red-950/80 border-red-800' :
                   n.type === 'warning' ? 'bg-amber-950/80 border-amber-800' :
                   'bg-stone-800/80 border-stone-700'
               }`}
            >
               <div className="mt-0.5 shrink-0">
                   {n.type === 'success' && <CheckCircle size={16} className="text-emerald-500"/>}
                   {n.type === 'error' && <XCircle size={16} className="text-red-500"/>}
                   {n.type === 'warning' && <AlertTriangle size={16} className="text-amber-500"/>}
                   {n.type === 'info' && <Info size={16} className="text-blue-500"/>}
               </div>
               <div className="flex-1 min-w-0">
                   <p className="text-sm font-medium text-stone-200 break-words leading-tight">{n.message}</p>
                   <p className="text-[10px] text-stone-500 mt-1">{new Date(n.timestamp).toLocaleTimeString()}</p>
               </div>
               <button onClick={(e) => { e.stopPropagation(); dismissNotification(n.id); }} className="text-stone-500 hover:text-white shrink-0">
                   <X size={14}/>
               </button>
            </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
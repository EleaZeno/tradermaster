
import React, { useEffect } from 'react';
import { useGameStore } from '../../shared/store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const notifications = useGameStore(s => s.gameState.notifications);
  const dismissNotification = useGameStore(s => s.dismissNotification);

  // Auto dismiss after 5 seconds
  useEffect(() => {
     if (notifications.length > 0) {
         const timer = setTimeout(() => {
             dismissNotification(notifications[0].id);
         }, 5000);
         return () => clearTimeout(timer);
     }
  }, [notifications, dismissNotification]);

  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 w-80 pointer-events-none">
      <AnimatePresence>
        {notifications.map(n => (
            <motion.div
               key={n.id}
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: 20 }}
               className={`pointer-events-auto p-3 rounded-lg shadow-lg border backdrop-blur-md flex items-start gap-3 ${
                   n.type === 'success' ? 'bg-emerald-950/80 border-emerald-800' :
                   n.type === 'error' ? 'bg-red-950/80 border-red-800' :
                   n.type === 'warning' ? 'bg-amber-950/80 border-amber-800' :
                   'bg-stone-800/80 border-stone-700'
               }`}
            >
               <div className="mt-0.5">
                   {n.type === 'success' && <CheckCircle size={16} className="text-emerald-500"/>}
                   {n.type === 'error' && <XCircle size={16} className="text-red-500"/>}
                   {n.type === 'warning' && <AlertTriangle size={16} className="text-amber-500"/>}
                   {n.type === 'info' && <Info size={16} className="text-blue-500"/>}
               </div>
               <div className="flex-1">
                   <p className="text-sm font-medium text-stone-200">{n.message}</p>
                   <p className="text-[10px] text-stone-500 mt-1">{new Date(n.timestamp).toLocaleTimeString()}</p>
               </div>
               <button onClick={() => dismissNotification(n.id)} className="text-stone-500 hover:text-white">
                   <X size={14}/>
               </button>
            </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

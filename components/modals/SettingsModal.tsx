
import React from 'react';
import { useGameStore } from '../../shared/store/useGameStore';
import { Card, Button } from '../../shared/components';
import { motion } from 'framer-motion';
import { X, Globe, Bell } from 'lucide-react';
import { getTranslation } from '../../shared/utils/i18n';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const settings = useGameStore(s => s.gameState.settings);
  const updateSettings = useGameStore(s => s.updateSettings);
  
  const lang = settings.language;
  const t = (key: string) => getTranslation(key, lang);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
       <motion.div
         initial={{ scale: 0.9, opacity: 0 }}
         animate={{ scale: 1, opacity: 1 }}
         className="w-full max-w-md bg-stone-900 border border-stone-700 rounded-xl overflow-hidden shadow-2xl"
       >
          <div className="p-4 border-b border-stone-800 flex justify-between items-center bg-stone-950">
             <h2 className="text-xl font-bold text-white flex items-center gap-2">{t('settings.title')}</h2>
             <button onClick={onClose} className="p-2 hover:bg-stone-800 rounded-full text-stone-400 hover:text-white">
                 <X size={20} />
             </button>
          </div>
          
          <div className="p-6 space-y-6">
             {/* Language Section */}
             <div className="space-y-3">
                 <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2">
                     <Globe size={14}/> {t('settings.language')}
                 </h3>
                 <div className="grid grid-cols-2 gap-2">
                     <button 
                        onClick={() => updateSettings({ language: 'zh' })}
                        className={`p-2 rounded border text-sm transition-colors ${
                            settings.language === 'zh' 
                            ? 'bg-blue-600 border-blue-500 text-white' 
                            : 'bg-stone-800 border-stone-700 text-stone-400 hover:bg-stone-700'
                        }`}
                     >
                         简体中文
                     </button>
                     <button 
                        onClick={() => updateSettings({ language: 'en' })}
                        className={`p-2 rounded border text-sm transition-colors ${
                            settings.language === 'en' 
                            ? 'bg-blue-600 border-blue-500 text-white' 
                            : 'bg-stone-800 border-stone-700 text-stone-400 hover:bg-stone-700'
                        }`}
                     >
                         English
                     </button>
                 </div>
             </div>

             {/* Notifications Section */}
             <div className="space-y-3">
                 <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2">
                     <Bell size={14}/> {t('settings.notifications')}
                 </h3>
                 
                 <div className="bg-stone-950 rounded-lg border border-stone-800 p-2 space-y-1">
                     <label className="flex items-center justify-between p-2 hover:bg-stone-900 rounded cursor-pointer">
                         <span className="text-stone-300 text-sm">{t('settings.notif.trades')}</span>
                         <input 
                            type="checkbox" 
                            checked={settings.notifications.trades}
                            onChange={(e) => updateSettings({ trades: e.target.checked })}
                            className="accent-blue-600 h-4 w-4"
                         />
                     </label>
                     <label className="flex items-center justify-between p-2 hover:bg-stone-900 rounded cursor-pointer">
                         <span className="text-stone-300 text-sm">{t('settings.notif.achievements')}</span>
                         <input 
                            type="checkbox" 
                            checked={settings.notifications.achievements}
                            onChange={(e) => updateSettings({ achievements: e.target.checked })}
                            className="accent-blue-600 h-4 w-4"
                         />
                     </label>
                     <label className="flex items-center justify-between p-2 hover:bg-stone-900 rounded cursor-pointer">
                         <span className="text-stone-300 text-sm">{t('settings.notif.news')}</span>
                         <input 
                            type="checkbox" 
                            checked={settings.notifications.news}
                            onChange={(e) => updateSettings({ news: e.target.checked })}
                            className="accent-blue-600 h-4 w-4"
                         />
                     </label>
                 </div>
             </div>
          </div>
          
          <div className="p-4 border-t border-stone-800 bg-stone-950 flex justify-end">
              <Button onClick={onClose}>{t('settings.close')}</Button>
          </div>
       </motion.div>
    </div>
  );
};

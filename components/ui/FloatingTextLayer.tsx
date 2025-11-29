import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

export const FloatingTextLayer: React.FC = () => {
  const [items, setItems] = useState<FloatingText[]>([]);
  const idCounter = useRef(0);

  useEffect(() => {
    const handleGameEffect = (e: CustomEvent) => {
      const { type, value, x, y, label } = e.detail;
      
      const id = `ft_${Date.now()}_${idCounter.current++}`;
      let text = '';
      let color = 'text-white';

      // Default position if mouse event not provided (center screenish)
      const startX = x || window.innerWidth / 2;
      const startY = y || window.innerHeight / 2;

      if (type === 'income') {
          text = `+${Math.floor(value).toLocaleString()} oz`;
          color = 'text-emerald-400';
      } else if (type === 'expense') {
          text = `-${Math.floor(Math.abs(value)).toLocaleString()} oz`;
          color = 'text-red-400';
      } else if (type === 'item_gain') {
          text = `+${value} ${label}`;
          color = 'text-blue-300';
      } else if (type === 'item_loss') {
          text = `-${value} ${label}`;
          color = 'text-orange-300';
      }

      setItems(prev => [...prev, { id, x: startX, y: startY, text, color }]);

      // Auto remove
      setTimeout(() => {
          setItems(prev => prev.filter(i => i.id !== id));
      }, 1500);
    };

    window.addEventListener('game-effect' as any, handleGameEffect);
    return () => window.removeEventListener('game-effect' as any, handleGameEffect);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
        <AnimatePresence>
            {items.map(item => (
                <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: item.y, x: item.x, scale: 0.5 }}
                    animate={{ opacity: 1, y: item.y - 100, x: item.x, scale: 1 }}
                    exit={{ opacity: 0, y: item.y - 150 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`absolute font-bold text-shadow-sm text-xl ${item.color} font-mono`}
                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                >
                    {item.text}
                </motion.div>
            ))}
        </AnimatePresence>
    </div>
  );
};
import React, { useRef, useEffect, useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { GameState, GodModeData, ChatMessage } from '../shared/types';
import { getFinancialAdvisorResponse } from '../services/advisorService';

// @ts-ignore
const marked = window.marked;

interface ChatWidgetProps {
  gameState: GameState;
  godModeData: GodModeData;
  onUpdateHistory: (history: ChatMessage[]) => void;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({ gameState, godModeData, onUpdateHistory }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [gameState.chatHistory, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
    onUpdateHistory([...gameState.chatHistory, userMsg]);
    setInput("");
    setIsTyping(true);

    const response = await getFinancialAdvisorResponse(
      input, 
      gameState, 
      godModeData, 
      gameState.chatHistory.map(c => ({ role: c.role, text: c.text }))
    );

    const botMsg: ChatMessage = { role: 'model', text: response, timestamp: Date.now() };
    onUpdateHistory([...gameState.chatHistory, userMsg, botMsg]);
    setIsTyping(false);
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex flex-col items-end transition-all duration-300 ${isOpen ? 'w-96' : 'w-auto'}`}>
      {isOpen && (
        <div className="w-full bg-stone-900 border border-stone-700 rounded-xl shadow-2xl overflow-hidden flex flex-col mb-4 h-[500px]">
          <div className="bg-stone-800 p-3 flex justify-between items-center border-b border-stone-700">
             <div className="flex items-center gap-2 text-stone-200 font-bold"><Bot size={16} className="text-emerald-400"/> Alpha (AI 董事)</div>
             <button onClick={() => setIsOpen(false)} className="text-stone-500 hover:text-white"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-950/90 custom-scrollbar">
             {gameState.chatHistory.map((msg, idx) => (
               <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div 
                  className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-stone-800 text-stone-300 border border-stone-700'}`}
                  dangerouslySetInnerHTML={{ __html: marked ? marked.parse(msg.text) : msg.text }}
                 />
               </div>
             ))}
             {isTyping && <div className="text-stone-500 text-xs italic animate-pulse">Alpha 正在思考...</div>}
             <div ref={chatEndRef}></div>
          </div>
          <div className="p-3 bg-stone-800 border-t border-stone-700 flex gap-2">
             <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="输入问题..." 
                className="flex-1 bg-stone-900 border border-stone-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
             />
             <button onClick={handleSend} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-500 disabled:opacity-50" disabled={isTyping}>
                <Send size={16} />
             </button>
          </div>
        </div>
      )}
      <button 
         onClick={() => setIsOpen(!isOpen)}
         className="bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-500 transition-transform active:scale-95 flex items-center justify-center"
      >
         {isOpen ? <X size={24} /> : <Bot size={24} />}
      </button>
    </div>
  );
};
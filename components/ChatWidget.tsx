
import React, { useRef, useEffect, useState } from 'react';
import { Bot, Send, X, Loader2 } from 'lucide-react';
import { ChatMessage } from '../shared/types';
import { aiService } from '../infrastructure/ai/GeminiAdapter';
import { useGameStore } from '../shared/store/useGameStore';
import { useGodModeData } from '../shared/hooks/useGodModeData';
import DOMPurify from 'dompurify';

// @ts-ignore
const marked = window.marked;

export const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState(""); 
  const [isStreaming, setIsStreaming] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const chatHistory = useGameStore(s => s.gameState.chatHistory);
  const updateChatHistory = useGameStore(s => s.updateChatHistory);
  
  const gameState = useGameStore(s => s.gameState);
  const godModeData = useGodModeData(gameState);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isOpen, streamingContent]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    
    const sanitizedInput = input.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const userMsg: ChatMessage = { role: 'user', text: sanitizedInput, timestamp: Date.now() };
    
    const currentHistory = [...chatHistory, userMsg];
    updateChatHistory(currentHistory);
    setInput("");
    
    setIsStreaming(true);
    setStreamingContent("");

    await aiService.getFinancialAdvisorResponseStream(
        sanitizedInput,
        gameState,
        godModeData,
        currentHistory,
        (chunk) => {
            setStreamingContent(prev => prev + chunk);
        }
    );

    setIsStreaming(false);
    setStreamingContent((finalContent) => {
        const botMsg: ChatMessage = { role: 'model', text: finalContent, timestamp: Date.now() };
        updateChatHistory([...currentHistory, botMsg]);
        return ""; 
    });
  };

  const renderMessageContent = (text: string) => {
      if (!marked) return text;
      const rawHtml = marked.parse(text);
      return DOMPurify.sanitize(rawHtml as string);
  };

  return (
    <div className={`fixed bottom-20 lg:bottom-4 right-4 z-50 flex flex-col items-end transition-all duration-300 ${isOpen ? 'w-full max-w-[380px]' : 'w-auto'}`}>
      {isOpen && (
        <div className="w-full bg-stone-900 border border-stone-700 rounded-xl shadow-2xl overflow-hidden flex flex-col mb-4 h-[500px]">
          <div className="bg-stone-800 p-3 flex justify-between items-center border-b border-stone-700">
             <div className="flex items-center gap-2 text-stone-200 font-bold"><Bot size={16} className="text-emerald-400"/> Alpha (AI 董事)</div>
             <button onClick={() => setIsOpen(false)} className="text-stone-500 hover:text-white"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-950/90 custom-scrollbar">
             {chatHistory.map((msg, idx) => (
               <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div 
                  className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-stone-800 text-stone-300 border border-stone-700'}`}
                  dangerouslySetInnerHTML={{ __html: renderMessageContent(msg.text) }}
                 />
               </div>
             ))}
             
             {isStreaming && (
                 <div className="flex justify-start">
                     <div className="max-w-[85%] rounded-lg p-3 text-xs leading-relaxed shadow-sm bg-stone-800 text-stone-300 border border-stone-700 animate-pulse-subtle">
                        {streamingContent ? (
                            <div dangerouslySetInnerHTML={{ __html: renderMessageContent(streamingContent) }} />
                        ) : (
                            <div className="flex items-center gap-2 italic text-stone-500">
                                <Loader2 size={12} className="animate-spin"/> 思考中...
                            </div>
                        )}
                     </div>
                 </div>
             )}
             <div ref={chatEndRef}></div>
          </div>
          <div className="p-3 bg-stone-800 border-t border-stone-700 flex gap-2">
             <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="询问经济状况..." 
                className="flex-1 bg-stone-900 border border-stone-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                disabled={isStreaming}
             />
             <button onClick={handleSend} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-500 disabled:opacity-50" disabled={isStreaming || !input.trim()}>
                <Send size={16} />
             </button>
          </div>
        </div>
      )}
      <button 
         onClick={() => setIsOpen(!isOpen)}
         className="bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-500 transition-transform active:scale-95 flex items-center justify-center relative group"
      >
         {isOpen ? <X size={24} /> : <Bot size={24} />}
         {!isOpen && (
             <span className="absolute right-full mr-2 bg-stone-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                 咨询 AI
             </span>
         )}
      </button>
    </div>
  );
};

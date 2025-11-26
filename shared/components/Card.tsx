import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, action, onClick }) => {
  return (
    <div 
      className={`bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden flex flex-col ${className}`}
      onClick={onClick}
    >
      {(title || action) && (
        <div className="px-5 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 backdrop-blur-sm">
          {title && <h3 className="text-lg font-semibold text-slate-100 tracking-tight">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5 flex-1">
        {children}
      </div>
    </div>
  );
};
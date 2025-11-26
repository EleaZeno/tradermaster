import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  disabled,
  ...props 
}) => {
  const baseStyles = "font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900";
  
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white focus:ring-blue-500 disabled:bg-blue-900 disabled:text-blue-400",
    secondary: "bg-slate-700 hover:bg-slate-600 text-slate-100 focus:ring-slate-500 disabled:bg-slate-800 disabled:text-slate-500",
    danger: "bg-red-600 hover:bg-red-500 text-white focus:ring-red-500 disabled:bg-red-900",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white focus:ring-emerald-500 disabled:bg-emerald-900"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
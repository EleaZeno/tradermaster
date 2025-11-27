import React, { useMemo } from 'react';
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, CartesianGrid, Cell } from 'recharts';
import { Candle } from '../../types';

interface KLineChartProps {
  data: Candle[];
  height?: number | string;
  width?: string | number;
}

// Custom Shape for Candlestick
const CandlestickShape = (props: any) => {
  const { x, width, payload, yAxis } = props;
  const { open, close, high, low } = payload;
  
  const isRising = close >= open;
  const color = isRising ? '#10b981' : '#ef4444'; // Emerald-500 : Red-500
  
  // Use scale from yAxis to convert values to pixels
  const scale = yAxis?.scale;
  if (!scale) return null;

  const yHigh = scale(high);
  const yLow = scale(low);
  const yOpen = scale(open);
  const yClose = scale(close);
  
  const barTop = Math.min(yOpen, yClose);
  const barBottom = Math.max(yOpen, yClose);
  const barHeight = Math.max(1, barBottom - barTop); // Ensure at least 1px height

  const candleWidth = Math.max(2, width * 0.6);
  const candleX = x + (width - candleWidth) / 2;
  const wickX = x + width / 2;

  return (
    <g>
      {/* Wick */}
      <line x1={wickX} y1={yHigh} x2={wickX} y2={yLow} stroke={color} strokeWidth={1} />
      {/* Body */}
      <rect 
        x={candleX} 
        y={barTop} 
        width={candleWidth} 
        height={barHeight} 
        fill={color} 
        stroke="none"
      />
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isRising = data.close >= data.open;
    const changePercent = ((data.close - data.open) / data.open * 100).toFixed(2);

    return (
      <div className="bg-stone-900/95 border border-stone-700 p-3 rounded-lg shadow-2xl backdrop-blur-md z-50 min-w-[180px]">
        <div className="flex justify-between items-center mb-2 border-b border-stone-700 pb-2">
            <span className="text-stone-400 font-bold text-xs font-mono">Day {data.day}</span>
            <span className={`text-xs font-bold font-mono ${isRising ? "text-emerald-400" : "text-red-400"}`}>
                {Number(changePercent) > 0 ? '+' : ''}{changePercent}%
            </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
           <span className="text-stone-500">Open</span> 
           <span className="text-right text-stone-200">{data.open.toFixed(2)}</span>
           
           <span className="text-stone-500">High</span> 
           <span className="text-right text-stone-200">{data.high.toFixed(2)}</span>
           
           <span className="text-stone-500">Low</span> 
           <span className="text-right text-stone-200">{data.low.toFixed(2)}</span>
           
           <span className="text-stone-500">Close</span> 
           <span className="text-right font-bold text-stone-100">{data.close.toFixed(2)}</span>
           
           <div className="col-span-2 my-1 border-t border-stone-800"></div>
           
           <span className="text-stone-500">Vol</span> 
           <span className="text-right text-blue-400">{Math.floor(data.volume).toLocaleString()}</span>

           {data.ma5 && (
             <>
               <span className="text-stone-500 flex items-center gap-1">
                 <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>MA5
               </span> 
               <span className="text-right text-yellow-400">{data.ma5.toFixed(2)}</span>
             </>
           )}
           
           {data.ma20 && (
             <>
               <span className="text-stone-500 flex items-center gap-1">
                 <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>MA20
               </span> 
               <span className="text-right text-purple-400">{data.ma20.toFixed(2)}</span>
             </>
           )}
        </div>
      </div>
    );
  }
  return null;
};

export const KLineChart: React.FC<KLineChartProps> = ({ data, height = "100%", width = "100%" }) => {
  // Pre-calculate Indicators
  const processedData = useMemo(() => {
     return data.map((d, i, arr) => {
         // Simple Moving Averages
         const getMA = (n: number) => {
             if (i < n - 1) return null;
             const sum = arr.slice(i - n + 1, i + 1).reduce((acc, val) => acc + val.close, 0);
             return sum / n;
         };
         return {
             ...d,
             ma5: getMA(5),
             ma20: getMA(20)
         };
     });
  }, [data]);

  if (!data || data.length === 0) {
      return <div className="flex items-center justify-center h-full text-stone-600 text-xs">暂无数据</div>;
  }

  const minLow = Math.min(...data.map(d => d.low));
  const maxHigh = Math.max(...data.map(d => d.high));
  const padding = (maxHigh - minLow) * 0.1;
  const domain = [Math.max(0, minLow - padding), maxHigh + padding];

  return (
    <ResponsiveContainer width={width as any} height={height as any}>
      <ComposedChart data={processedData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
        <defs>
            <pattern id="gridPattern" width="100%" height="100%" patternUnits="userSpaceOnUse">
                 <path d="M 0 0 L 0 0 0 0" />
            </pattern>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
        
        <XAxis 
            dataKey="day" 
            hide 
        />
        
        {/* Main Price Axis */}
        <YAxis 
            domain={domain} 
            orientation="right" 
            tick={{fontSize: 10, fill: '#64748b', fontFamily: 'monospace'}} 
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(value) => value.toFixed(1)}
        />
        
        {/* Volume Axis (Scaled to stay at bottom) */}
        <YAxis 
            yAxisId="vol" 
            domain={[0, 'dataMax * 5']} 
            orientation="left" 
            hide 
        />

        <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ stroke: '#64748b', strokeDasharray: '3 3', strokeWidth: 1 }} 
            isAnimationActive={false}
        />
        
        {/* Volume Bars */}
        <Bar dataKey="volume" yAxisId="vol" isAnimationActive={false} barSize={4}>
            {processedData.map((entry, index) => (
                <Cell 
                    key={`vol-${index}`} 
                    fill={entry.close >= entry.open ? '#10b981' : '#ef4444'} 
                    opacity={0.3} 
                />
            ))}
        </Bar>

        {/* Moving Averages */}
        <Line 
            type="monotone" 
            dataKey="ma5" 
            stroke="#facc15" 
            strokeWidth={1} 
            dot={false} 
            isAnimationActive={false} 
        />
        <Line 
            type="monotone" 
            dataKey="ma20" 
            stroke="#c084fc" 
            strokeWidth={1} 
            dot={false} 
            isAnimationActive={false} 
        />

        {/* Candlesticks */}
        <Bar 
            dataKey="close" 
            shape={<CandlestickShape />} 
            isAnimationActive={false} 
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};
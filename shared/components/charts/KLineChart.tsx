import React from 'react';
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line } from 'recharts';
import { Candle } from '../../types';

interface KLineChartProps {
  data: Candle[];
  height?: number;
  width?: string | number;
}

// Custom Shape for Candlestick
const CandlestickShape = (props: any) => {
  const { x, width, payload, yAxis } = props;
  const { open, close, high, low } = payload;
  
  const isRising = close > open;
  const color = isRising ? '#10b981' : '#ef4444'; // Emerald for rising, Red for falling
  
  const scale = yAxis?.scale;
  if (!scale) return null;

  const yHigh = scale(high);
  const yLow = scale(low);
  const yOpen = scale(open);
  const yClose = scale(close);
  
  const barTop = Math.min(yOpen, yClose);
  const barHeight = Math.abs(yOpen - yClose);
  const candleWidth = width * 0.6;
  const candleX = x + width * 0.2;
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
        height={Math.max(1, barHeight)} // Ensure at least 1px height
        fill={color} 
        stroke={color}
      />
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isRising = data.close > data.open;
    return (
      <div className="bg-stone-900 border border-stone-700 p-2 rounded shadow-xl text-xs font-mono">
        <p className="text-stone-400 mb-1">Day {data.day}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
           <span className="text-stone-500">Open:</span> <span className={isRising ? "text-emerald-400" : "text-red-400"}>{data.open.toFixed(2)}</span>
           <span className="text-stone-500">Close:</span> <span className={isRising ? "text-emerald-400" : "text-red-400"}>{data.close.toFixed(2)}</span>
           <span className="text-stone-500">High:</span> <span>{data.high.toFixed(2)}</span>
           <span className="text-stone-500">Low:</span> <span>{data.low.toFixed(2)}</span>
           <span className="text-stone-500">Vol:</span> <span className="text-blue-400">{data.volume}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const KLineChart: React.FC<KLineChartProps> = ({ data, height = 300, width = "100%" }) => {
  const minLow = Math.min(...data.map(d => d.low));
  const maxHigh = Math.max(...data.map(d => d.high));
  const domain = [minLow * 0.95, maxHigh * 1.05];

  // Moving Averages
  const dataWithMA = data.map((d, idx, arr) => {
      const ma5Slice = arr.slice(Math.max(0, idx - 4), idx + 1);
      const ma5 = ma5Slice.reduce((s, x) => s + x.close, 0) / ma5Slice.length;
      return { ...d, ma5 };
  });

  return (
    <ResponsiveContainer width={width as any} height={height}>
      <ComposedChart data={dataWithMA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
            <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
        </defs>
        <XAxis dataKey="day" hide />
        <YAxis domain={domain} hide />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#57534e', strokeDasharray: '3 3' }} />
        
        {/* MA Lines */}
        <Line type="monotone" dataKey="ma5" stroke="#fcd34d" dot={false} strokeWidth={1} isAnimationActive={false} />

        {/* Volume (as faint background bars) */}
        <YAxis yAxisId="vol" orientation="right" hide domain={[0, 'dataMax * 4']} />
        <Bar dataKey="volume" yAxisId="vol" fill="url(#volGradient)" barSize={10} />

        {/* Candles */}
        <Bar dataKey="close" shape={<CandlestickShape />} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
};
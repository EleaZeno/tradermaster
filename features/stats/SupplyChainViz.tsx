
import React, { useMemo } from 'react';
import { useGameStore } from '../../shared/store/useGameStore';
import { ResourceType, ProductType } from '../../shared/types';
import { motion } from 'framer-motion';
import { Wheat, Cookie, Factory, ShoppingCart, Users, AlertTriangle, TrendingUp } from 'lucide-react';

export const SupplyChainViz: React.FC = () => {
  const gameState = useGameStore(s => s.gameState);
  const companies = gameState.companies;
  const market = gameState.market;

  // Data Processing
  const data = useMemo(() => {
    // 1. Raw Material Sector (Grain)
    const grainProducers = companies.filter(c => c.productionLines.some(l => l.type === ResourceType.GRAIN));
    const grainProduction = grainProducers.reduce((sum, c) => sum + (c.monthlyProductionVolume || 0), 0);
    const grainInventory = grainProducers.reduce((sum, c) => sum + (c.inventory.finished[ResourceType.GRAIN] || 0), 0);
    
    // Market Logic
    const grainMarketBook = market[ResourceType.GRAIN];
    const grainSupply = grainMarketBook?.asks.reduce((s, o) => s + o.remainingQuantity, 0) || 0;
    const grainDemand = grainMarketBook?.bids.reduce((s, o) => s + o.remainingQuantity, 0) || 0;
    const grainPrice = gameState.resources[ResourceType.GRAIN].currentPrice;

    // 2. Manufacturing Sector (Bread)
    const breadProducers = companies.filter(c => c.productionLines.some(l => l.type === ProductType.BREAD));
    const breadProduction = breadProducers.reduce((sum, c) => sum + (c.monthlyProductionVolume || 0), 0);
    const breadInputNeed = breadProduction * 0.8; // Approx recipe
    
    // Bread Market
    const breadMarketBook = market[ProductType.BREAD];
    const breadSupply = breadMarketBook?.asks.reduce((s, o) => s + o.remainingQuantity, 0) || 0;
    const breadDemand = breadMarketBook?.bids.reduce((s, o) => s + o.remainingQuantity, 0) || 0;
    const breadPrice = gameState.products[ProductType.BREAD].marketPrice;

    // 3. Consumers
    const population = gameState.population.total;
    const avgHappiness = gameState.population.averageHappiness;

    // Crisis Detection
    const grainCrisis = grainSupply < 5 && grainDemand > 20;
    const breadCrisis = breadSupply < 5 && breadDemand > 20;
    const productionCrisis = grainProduction < breadInputNeed;

    return {
      grain: { 
          producers: grainProducers.length, 
          volume: grainProduction, 
          stock: grainInventory,
          supply: grainSupply, 
          price: grainPrice 
      },
      bread: { 
          producers: breadProducers.length, 
          volume: breadProduction, 
          supply: breadSupply, 
          price: breadPrice 
      },
      consumers: { count: population, happiness: avgHappiness },
      alerts: { grainCrisis, breadCrisis, productionCrisis }
    };
  }, [gameState.companies, gameState.market, gameState.resources, gameState.products, gameState.population, gameState.day]);

  // SVG Config
  const width = 900;
  const height = 320;
  const nodeY = 160;
  
  const pos = {
    grainBase: 60,
    grainFactory: 220,
    grainMarket: 380,
    breadFactory: 540,
    breadMarket: 700,
    consumer: 840
  };

  const FlowLine = ({ start, end, volume, isCrisis, label }: { start: number, end: number, volume: number, isCrisis: boolean, label?: string }) => {
    const active = volume > 0;
    const color = isCrisis ? "#ef4444" : active ? "#fbbf24" : "#333";
    const strokeWidth = isCrisis ? 4 : active ? Math.min(6, Math.max(2, volume / 20)) : 1;
    
    return (
      <g>
        <path 
          d={`M ${start + 30} ${nodeY} C ${start + 100} ${nodeY}, ${end - 100} ${nodeY}, ${end - 30} ${nodeY}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={active ? "none" : "5,5"}
          opacity={active ? 0.8 : 0.3}
        />
        {/* Animated Particles */}
        {active && !isCrisis && (
           <circle r={isCrisis ? 6 : 3} fill={isCrisis ? "#ef4444" : "#f59e0b"}>
              <animateMotion 
                dur={`${Math.max(0.5, 300 / (volume + 1))}s`} 
                repeatCount="indefinite" 
                path={`M ${start + 30} ${nodeY} C ${start + 100} ${nodeY}, ${end - 100} ${nodeY}, ${end - 30} ${nodeY}`} 
              />
           </circle>
        )}
        {/* Crisis Pulse */}
        {isCrisis && (
            <circle r="6" fill="#ef4444">
                <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite" />
                <animateMotion 
                    dur="1s" 
                    repeatCount="indefinite" 
                    path={`M ${start + 30} ${nodeY} C ${start + 100} ${nodeY}, ${end - 100} ${nodeY}, ${end - 30} ${nodeY}`} 
                />
            </circle>
        )}
        {label && (
            <text x={(start + end) / 2} y={nodeY - 15} textAnchor="middle" fill={isCrisis ? "#ef4444" : "#666"} fontSize="10" fontWeight="bold">
                {label}
            </text>
        )}
      </g>
    );
  };

  const Node = ({ x, icon: Icon, color, title, sub1, sub2, alert }: any) => (
      <g transform={`translate(${x}, ${nodeY})`}>
          <circle r="35" fill="#1c1917" stroke={alert ? "#ef4444" : color} strokeWidth={alert ? 3 : 2} />
          {alert && (
              <circle r="35" fill="none" stroke="#ef4444" strokeWidth="2" opacity="0.5">
                  <animate attributeName="r" values="35;50" dur="1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0" dur="1s" repeatCount="indefinite" />
              </circle>
          )}
          <foreignObject x="-16" y="-16" width="32" height="32">
              <div className={`flex items-center justify-center h-full ${alert ? "text-red-500" : ""}`} style={{color: alert ? undefined : color}}>
                  <Icon size={24}/>
              </div>
          </foreignObject>
          <text y="55" textAnchor="middle" fill="#ccc" fontSize="12" fontWeight="bold">{title}</text>
          <text y="70" textAnchor="middle" fill="#888" fontSize="10">{sub1}</text>
          <text y="82" textAnchor="middle" fill={color} fontSize="10">{sub2}</text>
          {alert && (
              <foreignObject x="15" y="-45" width="20" height="20">
                  <AlertTriangle size={16} className="text-red-500 fill-red-900"/>
              </foreignObject>
          )}
      </g>
  );

  return (
    <div className="w-full bg-stone-950 rounded-xl border border-stone-800 p-2 overflow-hidden relative">
       <div className="absolute top-3 left-4 z-10 flex gap-4 text-xs font-mono">
           <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> 正常流转</div>
           <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div> 供给中断/危机</div>
       </div>

       <div className="overflow-x-auto custom-scrollbar pb-2">
          <div className="min-w-[900px]">
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
                {/* FLOWS */}
                <FlowLine start={pos.grainBase} end={pos.grainFactory} volume={50} isCrisis={false} />
                
                <FlowLine 
                    start={pos.grainFactory} 
                    end={pos.grainMarket} 
                    volume={data.grain.volume} 
                    isCrisis={data.alerts.productionCrisis} 
                    label={`${Math.floor(data.grain.volume)} units`}
                />

                <FlowLine 
                    start={pos.grainMarket} 
                    end={pos.breadFactory} 
                    volume={data.bread.volume * 1.2} // Consumes more grain
                    isCrisis={data.alerts.grainCrisis}
                    label={data.alerts.grainCrisis ? "SUPPLY SHOCK" : undefined}
                />

                <FlowLine 
                    start={pos.breadFactory} 
                    end={pos.breadMarket} 
                    volume={data.bread.volume} 
                    isCrisis={data.bread.volume < 5} 
                />

                <FlowLine 
                    start={pos.breadMarket} 
                    end={pos.consumer} 
                    volume={data.consumers.count} 
                    isCrisis={data.alerts.breadCrisis}
                    label={data.alerts.breadCrisis ? "FAMINE RISK" : undefined}
                />

                {/* NODES */}
                <Node x={pos.grainBase} icon={Wheat} color="#854d0e" title="自然资源" sub1="无限供给" sub2="土地 (Land)" />
                
                <Node 
                    x={pos.grainFactory} icon={Factory} color="#fbbf24" 
                    title="农业公司" sub1={`${data.grain.producers} Producers`} sub2={`Inv: ${Math.floor(data.grain.stock)}`} 
                />
                
                <Node 
                    x={pos.grainMarket} icon={ShoppingCart} color="#f59e0b" 
                    title="粮食市场" sub1={`Price: ${data.grain.price.toFixed(2)}`} sub2={`Supply: ${Math.floor(data.grain.supply)}`}
                    alert={data.alerts.grainCrisis}
                />
                
                <Node 
                    x={pos.breadFactory} icon={Factory} color="#f97316" 
                    title="食品加工" sub1={`${data.bread.producers} Factories`} sub2={`Out: ${Math.floor(data.bread.volume)}`}
                    alert={data.alerts.productionCrisis} 
                />
                
                <Node 
                    x={pos.breadMarket} icon={ShoppingCart} color="#ea580c" 
                    title="成品市场" sub1={`Price: ${data.bread.price.toFixed(2)}`} sub2={`Supply: ${Math.floor(data.bread.supply)}`}
                    alert={data.alerts.breadCrisis}
                />
                
                <Node 
                    x={pos.consumer} icon={Users} color={data.consumers.happiness > 50 ? "#10b981" : "#ef4444"}
                    title="居民消费" sub1={`Pop: ${data.consumers.count}`} sub2={`Mood: ${Math.floor(data.consumers.happiness)}`}
                    alert={data.consumers.happiness < 30}
                />
            </svg>
          </div>
       </div>
    </div>
  );
};



import { GameState, MacroMetric } from '../../shared/types';

export interface StylizedFactResult {
  passed: boolean;
  score: number; // 0 to 1 or -1 to 1 correlation
  label: string;
  description: string;
  chartData?: any[];
  meta?: any;
}

export class CalibrationService {
  
  // Fact 1: Consumption Smoothing (Consumption is less volatile than GDP)
  static checkConsumptionSmoothing(history: MacroMetric[]): StylizedFactResult {
    if (history.length < 10) return { passed: false, score: 0, label: "Insufficient Data", description: "Need more data." };

    const gdpGrowth = this.calculateGrowth(history.map(h => h.gdp));
    const consGrowth = this.calculateGrowth(history.map(h => h.components?.c || 0));

    const gdpVol = this.calculateStdDev(gdpGrowth);
    const consVol = this.calculateStdDev(consGrowth);
    
    // Avoid division by zero
    if (gdpVol === 0) return { passed: true, score: 0, label: "Stable State", description: "No volatility detected." };

    const ratio = consVol / gdpVol;
    
    // In real economies, ratio is typically < 1 (smoothing)
    // If ratio > 1, consumers are highly reactive or hand-to-mouth
    const passed = ratio < 1.0;

    return {
      passed,
      score: parseFloat(ratio.toFixed(2)),
      label: "Consumption Smoothing",
      description: `Ratio of Consumption Volatility to GDP Volatility. Expected < 1.0. Current: ${ratio.toFixed(2)}`,
      meta: { gdpVol, consVol }
    };
  }

  // Fact 2: Phillips Curve (Negative correlation between Unemployment and Inflation)
  static checkPhillipsCurve(history: MacroMetric[]): StylizedFactResult {
    if (history.length < 20) return { passed: false, score: 0, label: "Insufficient Data", description: "Need more data." };
    
    // Using a lag? Phillips curve is often lagged. Let's use simple contemporaneous for now.
    const unemployment = history.map(h => h.unemployment);
    const inflation = history.map(h => h.inflation);

    const correlation = this.calculateCorrelation(unemployment, inflation);
    
    // We expect negative correlation
    const passed = correlation < 0; // Weak check

    const chartData = history.map(h => ({ x: h.unemployment * 100, y: h.inflation * 100, day: h.day }));

    return {
      passed,
      score: parseFloat(correlation.toFixed(2)),
      label: "Phillips Curve",
      description: `Correlation between Unemployment and Inflation. Expected < 0. Current: ${correlation.toFixed(2)}`,
      chartData
    };
  }

  // Fact 3: Firm Size Distribution (Zipf's Law)
  static checkFirmSize(gameState: GameState): StylizedFactResult {
    const employees = gameState.companies.map(c => c.employees).sort((a, b) => b - a); // Descending
    
    if (employees.length < 2) return { passed: true, score: 1, label: "N/A", description: "Not enough firms" };

    // Zipf's law: Log(Rank) vs Log(Size) should have slope -1
    const data = employees.map((size, index) => ({
      rank: index + 1,
      size: size,
      logRank: Math.log10(index + 1),
      logSize: Math.log10(size)
    })).filter(d => d.size > 0);

    if (data.length < 2) return { passed: false, score: 0, label: "N/A", description: "Firms too small" };

    // Simple slope estimation
    const slope = this.calculateSlope(data.map(d => d.logRank), data.map(d => d.logSize));
    
    // Real world is close to -1.
    const passed = slope < -0.5 && slope > -1.5;

    return {
      passed,
      score: parseFloat(slope.toFixed(2)),
      label: "Firm Size (Zipf)",
      description: `Power Law exponent of firm sizes. Expected ~ -1.0. Current: ${slope.toFixed(2)}`,
      chartData: data.map(d => ({ x: d.rank, y: d.size }))
    };
  }
  
  // Fact 4: MPC Heterogeneity (Poor spend higher % of wealth/income than Rich)
  static checkMPC(gameState: GameState): StylizedFactResult {
      const residents = gameState.population.residents;
      // Sort by Wealth (Cash + Portfolio Value approx)
      const sorted = [...residents].sort((a, b) => (a.cash) - (b.cash));
      
      const quartiles = 4;
      const chunkSize = Math.ceil(sorted.length / quartiles);
      
      const data: {quartile: string, mpc: number}[] = [];
      let isRegressive = true;
      let prevMPC = Infinity;

      for (let i = 0; i < quartiles; i++) {
          const chunk = sorted.slice(i * chunkSize, (i + 1) * chunkSize);
          if (chunk.length === 0) continue;
          
          // Estimate MPC: propensityToConsume parameter (theoretical) 
          // OR actual expenditure / cash.
          // Let's use the parameter for now as it drives behavior.
          const avgPropensity = chunk.reduce((s, r) => s + (r.propensityToConsume || 0), 0) / chunk.length;
          
          data.push({ quartile: `Q${i+1}`, mpc: avgPropensity });
          
          if (avgPropensity > prevMPC) isRegressive = false; // Should decrease as wealth increases
          prevMPC = avgPropensity;
      }

      return {
          passed: true, // This is usually a setting, but we report it
          score: 0,
          label: "Wealth vs MPC",
          description: "Marginal Propensity to Consume by Wealth Quartile.",
          chartData: data
      };
  }

  // Fact 5: Okun's Law
  static checkOkunsLaw(history: MacroMetric[]): StylizedFactResult {
      if (history.length < 20) return { passed: false, score: 0, label: "Insufficient Data", description: "Need more data." };
      
      // Real GDP = Nominal GDP / CPI
      const realGdp = history.map(h => h.gdp / (h.cpi || 1));
      const realGdpGrowth = this.calculateGrowth(realGdp);
      
      const u = history.map(h => h.unemployment);
      const uChange = [];
      // Calculate change in unemployment rate
      for(let i=1; i<u.length; i++) uChange.push(u[i] - u[i-1]);
      
      // Calculate correlation between Real GDP Growth and Change in Unemployment
      const correlation = this.calculateCorrelation(realGdpGrowth, uChange);
      
      // Expect negative correlation (Higher growth -> Lower unemployment)
      const passed = correlation < -0.2; 
      
      // Prepare chart data (scatter plot)
      const chartData = realGdpGrowth.map((g, i) => ({ x: g * 100, y: uChange[i] * 100 }));

      return {
          passed,
          score: parseFloat(correlation.toFixed(2)),
          label: "Okun's Law",
          description: `Correlation between Real GDP Growth and Change in Unemployment. Expected < -0.2. Current: ${correlation.toFixed(2)}`,
          chartData
      };
  }

  // Fact 6: Quantity Theory of Money (Long-run neutrality)
  static checkQuantityTheoryOfMoney(history: MacroMetric[]): StylizedFactResult {
      if (history.length < 30) return { passed: false, score: 0, label: "Insufficient Data", description: "Need more data." };
      
      // Correlation between Money Supply Growth and Inflation
      const moneySupply = history.map(h => h.moneySupply || 0);
      const mGrowth = this.calculateGrowth(moneySupply);
      
      // Inflation is already growth of CPI
      // calculateGrowth drops index 0, so we align inflation array
      const inflation = history.slice(1).map(h => h.inflation);

      const correlation = this.calculateCorrelation(mGrowth, inflation);
      
      // Expect positive correlation in long run
      const passed = correlation > 0.3;

      const chartData = mGrowth.map((m, i) => ({ x: m * 100, y: inflation[i] * 100 }));

      return {
          passed,
          score: parseFloat(correlation.toFixed(2)),
          label: "QTM (Monetarism)",
          description: `Correlation between Money Growth and Inflation. Expected > 0.3. Current: ${correlation.toFixed(2)}`,
          chartData
      };
  }

  // --- Helpers ---

  private static calculateGrowth(series: number[]): number[] {
    const growth: number[] = [];
    for (let i = 1; i < series.length; i++) {
        if (series[i-1] === 0) growth.push(0);
        else growth.push((series[i] - series[i-1]) / series[i-1]);
    }
    return growth;
  }

  private static calculateStdDev(data: number[]): number {
    if (data.length === 0) return 0;
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const sqDiff = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
    return Math.sqrt(sqDiff / data.length);
  }

  private static calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    
    let num = 0, denX = 0, denY = 0;
    for (let i = 0; i < n; i++) {
        const dx = x[i] - meanX;
        const dy = y[i] - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
    }
    
    if (denX === 0 || denY === 0) return 0;
    return num / Math.sqrt(denX * denY);
  }

  private static calculateSlope(x: number[], y: number[]): number {
      const n = x.length;
      if (n < 2) return 0;
      const meanX = x.reduce((a, b) => a + b, 0) / n;
      const meanY = y.reduce((a, b) => a + b, 0) / n;
      
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) {
          num += (x[i] - meanX) * (y[i] - meanY);
          den += (x[i] - meanX) ** 2;
      }
      return den === 0 ? 0 : num / den;
  }
}
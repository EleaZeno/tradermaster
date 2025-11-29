# EcoTycoon AI - Immersive Economic Simulator

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Tech](https://img.shields.io/badge/Tech-React%20%7C%20TypeScript%20%7C%20Zustand%20%7C%20Gemini-green)

**EcoTycoon AI** is a sophisticated browser-based economic simulation game. It models a closed-loop economy with realistic micro-foundations (agent-based modeling) and macro-economic dynamics (business cycles, inflation, monetary policy).

Powered by **Google Gemini 2.5 Flash**, the game features an AI Chief Economist that can diagnose the economy, generate news events, and provide strategic advice based on real-time simulation data.

---

## 🧠 Core Economic Engines

### 1. Micro-Foundations (Agent-Based)
*   **Residents (Agents):** 30+ autonomous agents with individual utility functions (Stone-Geary / Cobb-Douglas), memory, and political stances.
*   **Labor Market:** Dynamic wage setting based on Marginal Productivity Theory of Labor (MPL). Agents have reservation wages that adjust to inflation expectations (Sticky Wages).
*   **Consumption:** Keynesian consumption functions with dynamic Marginal Propensity to Consume (MPC) based on consumer sentiment and wealth.

### 2. Market Microstructure
*   **Limit Order Book (LOB):** Every transaction (Grain, Bread, Stocks) passes through a realistic matching engine. Prices are emergent properties of supply and demand, not arbitrary formulas.
*   **Supply Chain:** `Raw Material (Grain)` -> `Manufacturing (Bread)` -> `Consumer`. Supply shocks propagate through the chain.

### 3. Macro-Economics & Policy
*   **Central Bank:** Implements the **Taylor Rule** to automatically adjust interest rates to target inflation and unemployment.
*   **Business Cycles:** Simulates distinct phases (Expansion, Peak, Recession, Depression, Recovery) based on GDP growth and inflation signals.
*   **Fiscal Policy:** Government collects taxes (Income, Corporate, Consumption) and manages welfare/stimulus based on the Mayor's personality (Keynesian, Austrian, Populist).

### 4. Validation Lab (Stylized Facts)
The simulation is calibrated against real-world economic laws:
*   **Phillips Curve:** Trade-off between unemployment and inflation.
*   **Okun's Law:** Relationship between GDP growth and unemployment.
*   **Zipf's Law:** Power-law distribution of firm sizes.
*   **Quantity Theory of Money (QTM):** Long-run relationship between money supply and price levels.

---

## 🛠️ Technical Architecture

The project follows a **Domain-Driven Design (DDD)** approach to manage complexity.

```text
src/
├── application/    # Game Loop & Orchestration
├── domain/         # Pure Logic (Banking, Labor, Production, Market)
├── features/       # React UI Components (Dashboards, Modals)
├── infrastructure/ # External Services (Gemini AI Adapter)
└── shared/         # Stores, Types, Config, Utils
```

*   **Frontend:** React 18, Tailwind CSS, Framer Motion.
*   **State Management:** Zustand + Immer (Mutable draft syntax).
*   **Visualization:** Recharts for real-time K-Line charts and macro indicators.
*   **Performance:** Optimized tick processing with dedicated update rates for different subsystems.

---

## 🚀 Quick Start

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Setup**
    Ensure you have a valid Gemini API Key if you wish to use the AI features.
    The app expects `process.env.API_KEY` to be injected by the environment/build tool.

3.  **Run Development Server**
    ```bash
    npm run dev
    ```

4.  **Run Tests**
    ```bash
    npm run test
    ```

---

## 🎮 How to Play

1.  **The Dashboard:** Monitor the Health Score and Business Cycle. Watch the **Supply Chain Visualization** for bottlenecks.
2.  **My Empire:** Use your starting capital to **Create a Company (IPO)** or trade commodities.
3.  **Stock Market:** Buy shares in undervalued companies (Look at P/E and Tobin's Q).
4.  **City Hall:** Monitor the Mayor's fiscal policies. High taxes might stifle growth; high spending might cause inflation.
5.  **AI Validation:** Go to the "Validation" tab to run an "AI Diagnosis" or perform "Policy Shocks" (e.g., print money) to see what happens.

---

## 🤝 Contribution

Contributions are welcome! Please ensure any logic changes maintain the conservation of mass (money/inventory) within the system.

## 📄 License

MIT

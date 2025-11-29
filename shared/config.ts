
export const GAME_CONFIG = {
  TOTAL_POPULATION: 30,
  INITIAL_PLAYER_CASH: 100,
  TOTAL_LAND_TOKENS: 80,
  DAILY_GRAIN_NEED: 1.0,
  BREAD_SUBSTITUTE_RATIO: 0.8,
  GAME_SPEEDS: [1, 2, 5],
  TAX_RATES: {
    INCOME_LOW: 0.10,
    INCOME_MID: 0.20,
    INCOME_HIGH: 0.40,
    CORPORATE: 0.20,
    CONSUMPTION: 0.05
  },
  // Optimization: System Update Rates (in ticks)
  // Higher = Less frequent updates = Better performance
  UPDATE_RATES: {
    MARKET: 1,      // Run every tick (High frequency for UI responsiveness)
    CORE_ECO: 5,    // Run every 5 ticks (Production, Labor, Consumption) -> Represents 1 Day
    MACRO: 20       // Run GDP/Banking every 20 ticks
  }
};

// Physics Constants for Stability & Realism
export const ECO_CONSTANTS = {
    BANKING: {
        MIN_CAR: 0.08, // Minimum Capital Adequacy Ratio (Basel III approx)
        RISK_WEIGHT_RWA: 1.0, // Risk Weight for Corporate Loans
        CREDIT_CRUNCH_TRIGGER: 0.06, // Panic level
        LEVERAGE_MAX: 20.0, // Max Bank Leverage
    },
    ECONOMY: {
        FIXED_COST_PER_LINE: 5.0, // Maintenance cost per production line per day
        FIXED_COST_PER_LAND: 2.0, // Property tax/maintenance per land token
        WAGE_SENSITIVITY: 0.5,    // How strongly wages react to CPI changes (0.0 - 1.0)
        WAGE_STICKINESS_DAYS: 7,  // Frequency of wage updates
        MAX_WAGE_CUT: 0.01,       // Max 1% cut per update
        DEPRECIATION_RATE: 0.005, // 0.5% daily capital depreciation
        SCRAP_EFFICIENCY_THRESHOLD: 0.3, // Efficiency below this = scrap
        DEMAND_ELASTICITY: {
          GRAIN: -0.4, // Inelastic (Necessity)
          BREAD: -0.8  // Elastic (Substitutable)
        }
    },
    INFLATION: {
        EXPECTATION_ALPHA: 0.1, // Smooths inflation expectations over ~10 periods
    },
    LABOR: {
        XP_PER_DAY: 1,
        SKILL_THRESHOLDS: {
            NOVICE: 0,
            SKILLED: 100,
            EXPERT: 300
        },
        PRODUCTIVITY_MULTIPLIER: {
            NOVICE: 1.0,
            SKILLED: 1.5,
            EXPERT: 2.2
        }
    },
    LIFECYCLE: {
        STARTUP_MAX_AGE: 30, // days
    },
    LIMITS: {
        MAX_PRICE: 10000,
        MIN_PRICE: 0.01,
        MAX_QTY: 1000000
    }
};
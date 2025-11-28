

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
    MACRO: 20       // Run every 20 ticks (Banking, Audit, Stocks)
  },
  // New Economic Constants
  ECONOMY: {
    FIXED_COST_PER_LINE: 5.0, // Maintenance cost per production line per day
    FIXED_COST_PER_LAND: 2.0, // Property tax/maintenance per land token
    WAGE_SENSITIVITY: 0.5,    // How strongly wages react to CPI changes (0.0 - 1.0)
    DEMAND_ELASTICITY: {
      GRAIN: -0.4, // Inelastic (Necessity)
      BREAD: -0.8  // Elastic (Substitutable)
    }
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
      GROWTH_PROFIT_THRESHOLD: 1000,
      DECLINE_LOSS_STREAK: 5
  }
};

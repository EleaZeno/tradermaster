
/**
 * Economic Physics Math Utilities
 * Prevents simulation explosions (Infinity/NaN) and provides smoothing functions.
 */

export const safeDivide = (numerator: number, denominator: number, fallback = 0): number => {
  if (Math.abs(denominator) < 0.000001) return fallback;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

/**
 * Exponential Moving Average
 * Used for modeling "Expectations" (Adaptive Expectations Hypothesis)
 * @param current The latest data point
 * @param previous The previous EMA value
 * @param alpha Smoothing factor (0 < alpha < 1). Lower = Stickier/Slower.
 */
export const calculateEMA = (current: number, previous: number, alpha: number): number => {
  return (current * alpha) + (previous * (1 - alpha));
};

export const sigmoid = (t: number): number => {
    return 1 / (1 + Math.exp(-t));
};

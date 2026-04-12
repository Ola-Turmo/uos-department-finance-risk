/**
 * Statistical Anomaly Detection Engine
 * Phase 1: Anomaly Engine
 * 
 * Implements time-series anomaly detection using pure statistics (no ML libraries).
 * Methods include:
 * - Z-score anomaly detection
 * - IQR (Interquartile Range) outlier detection
 * - Rolling statistics for trend analysis
 * - Seasonal anomaly detection
 * - Volatility-adjusted thresholds
 * - Moving average crossover detection
 * 
 * PRD Reference: VAL-DEPT-FR-002 - Statistical Anomaly Detection
 */

import { nanoid } from "nanoid";

// ============================================
// Type Definitions
// ============================================

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
}

export interface ZScoreParams {
  threshold?: number;       // Z-score threshold (default: 2.5)
  knownMean?: number;      // Known population mean (optional)
  knownStdDev?: number;    // Known population std dev (optional)
  minDataPoints?: number;   // Minimum data points required (default: 3)
}

export interface IQRParams {
  multiplier?: number;       // IQR multiplier (default: 1.5)
  minDataPoints?: number;    // Minimum data points required (default: 4)
}

export interface RollingStatsParams {
  windowSize: number;
  minDataPoints?: number;   // Minimum data points (default: windowSize)
}

export interface SeasonalAnomalyParams {
  period: number;                  // Seasonal period (e.g., 7 for weekly, 12 for monthly)
  threshold?: number;               // Z-score threshold for comparison (default: 2.5)
  minPeriodDataPoints?: number;     // Minimum data points per period (default: period)
}

export interface AnomalyDetectionResult<T = number> {
  anomalies: AnomalyMarker<T>[];
  method: string;
  statistics?: StatisticsSummary;
  explanation?: string;
  insufficientData?: boolean;
}

export interface AnomalyMarker<T = number> {
  index: number;
  value: T;
  severityScore: number;      // Higher = more anomalous
  zScore?: number;
  deviationFromExpected?: number;
}

export interface StatisticsSummary {
  mean: number;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  count: number;
  q1?: number;
  q3?: number;
  iqr?: number;
}

export interface EnsembleResult {
  anomalies: AnomalyMarker<number>[];
  method: string;
  ensembleVotes: VoteRecord[];
  consensusAnomalies: number[];
  statistics?: StatisticsSummary;
  explanation?: string;
  insufficientData?: boolean;
}

export interface VoteRecord {
  index: number;
  value: number;
  votes: number;              // Number of methods that flagged this
  methods: string[];          // Methods that flagged this
  severityScore: number;       // Average severity across methods
}

// ============================================
// Basic Statistics Functions
// ============================================

export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

export function calculateVariance(values: number[], sample: boolean = true): number {
  if (values.length < 2) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const divisor = sample ? Math.max(1, values.length - 1) : values.length;
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / divisor;
}

export function calculateStandardDeviation(values: number[], sample: boolean = true): number {
  return Math.sqrt(calculateVariance(values, sample));
}

export function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0; // No variance means no z-score deviation possible
  return (value - mean) / stdDev;
}

function calculateMedian(sortedValues: number[]): number {
  const n = sortedValues.length;
  if (n === 0) return 0;
  if (n % 2 === 0) {
    return (sortedValues[n / 2 - 1] + sortedValues[n / 2]) / 2;
  }
  return sortedValues[Math.floor(n / 2)];
}

export function calculateQuartiles(values: number[]): { q1: number; q2: number; q3: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  
  const q2 = calculateMedian(sorted);
  
  // For Q1 and Q3, we use the median of the lower and upper halves
  // Linear interpolation method (same as R's type 7)
  const q1Index = (n - 1) * 0.25;
  const q1Floor = Math.floor(q1Index);
  const q1Ceil = Math.ceil(q1Index);
  const q1 = q1Floor === q1Ceil 
    ? sorted[q1Floor] 
    : sorted[q1Floor] + (sorted[q1Ceil] - sorted[q1Floor]) * (q1Index - q1Floor);
  
  const q3Index = (n - 1) * 0.75;
  const q3Floor = Math.floor(q3Index);
  const q3Ceil = Math.ceil(q3Index);
  const q3 = q3Floor === q3Ceil 
    ? sorted[q3Floor] 
    : sorted[q3Floor] + (sorted[q3Ceil] - sorted[q3Floor]) * (q3Index - q3Floor);
  
  return { q1, q2, q3 };
}

// ============================================
// Z-Score Anomaly Detection
// ============================================

export interface ZScoreResult {
  anomalyIndices: number[];
  severityScores: Map<number, number>;
  statistics: StatisticsSummary;
  insufficientData?: boolean;
}

export function detectZScoreAnomalies(
  data: number[],
  params: ZScoreParams = {}
): ZScoreResult {
  const {
    threshold = 2.5,
    knownMean,
    knownStdDev,
    minDataPoints = 3,
  } = params;

  // Check minimum data points
  if (data.length < minDataPoints) {
    return {
      anomalyIndices: [],
      severityScores: new Map(),
      statistics: createEmptyStatistics(),
      insufficientData: true,
    };
  }

  // Calculate or use known statistics
  const mean = knownMean ?? calculateMean(data);
  const stdDev = knownStdDev ?? calculateStandardDeviation(data, true);
  
  // Handle zero standard deviation (constant data)
  if (stdDev === 0) {
    return {
      anomalyIndices: [],
      severityScores: new Map(),
      statistics: createStatisticsSummary(data, mean, stdDev),
      insufficientData: false,
    };
  }

  const anomalyIndices: number[] = [];
  const severityScores = new Map<number, number>();

  data.forEach((value, index) => {
    const zScore = calculateZScore(value, mean, stdDev);
    const absZScore = Math.abs(zScore);

    if (absZScore > threshold) {
      anomalyIndices.push(index);
      // Severity score is proportional to how far beyond threshold
      severityScores.set(index, absZScore - threshold);
    }
  });

  return {
    anomalyIndices,
    severityScores,
    statistics: createStatisticsSummary(data, mean, stdDev),
    insufficientData: false,
  };
}

// ============================================
// IQR Outlier Detection
// ============================================

export interface IQRResult {
  outlierIndices: number[];
  q1: number;
  q3: number;
  iqr: number;
  lowerBound: number;
  upperBound: number;
  insufficientData?: boolean;
}

export function detectIQROutliers(
  data: number[],
  params: IQRParams = {}
): IQRResult {
  const { multiplier = 1.5, minDataPoints = 4 } = params;

  // Check minimum data points
  if (data.length < minDataPoints) {
    return {
      outlierIndices: [],
      q1: 0,
      q3: 0,
      iqr: 0,
      lowerBound: 0,
      upperBound: 0,
      insufficientData: true,
    };
  }

  const { q1, q3 } = calculateQuartiles(data);
  const iqr = q3 - q1;
  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;

  const outlierIndices: number[] = [];

  data.forEach((value, index) => {
    if (value < lowerBound || value > upperBound) {
      outlierIndices.push(index);
    }
  });

  return {
    outlierIndices,
    q1,
    q3,
    iqr,
    lowerBound,
    upperBound,
    insufficientData: false,
  };
}

// ============================================
// Rolling Statistics
// ============================================

export function calculateRollingMean(
  data: number[],
  windowSize: number
): (number | null)[] {
  if (data.length < windowSize) {
    return data.map(() => null);
  }

  const result: (number | null)[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < windowSize - 1) {
      result.push(null);
    } else {
      const window = data.slice(i - windowSize + 1, i + 1);
      result.push(calculateMean(window));
    }
  }

  return result;
}

export function calculateRollingStdDev(
  data: number[],
  windowSize: number,
  sample: boolean = true
): (number | null)[] {
  if (data.length < windowSize) {
    return data.map(() => null);
  }

  const result: (number | null)[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < windowSize - 1) {
      result.push(null);
    } else {
      const window = data.slice(i - windowSize + 1, i + 1);
      result.push(calculateStandardDeviation(window, sample));
    }
  }

  return result;
}

// ============================================
// Seasonal Anomaly Detection
// ============================================

export interface SeasonalAnomalyResult {
  anomalyIndices: number[];
  seasonalProfiles: Map<number, { mean: number; stdDev: number; count: number }>;
  insufficientData?: boolean;
}

export function detectSeasonalAnomaly(
  data: TimeSeriesDataPoint[],
  params: SeasonalAnomalyParams
): SeasonalAnomalyResult {
  const { period, threshold = 2.5, minPeriodDataPoints = period } = params;

  // Check minimum data points
  if (data.length < minPeriodDataPoints) {
    return {
      anomalyIndices: [],
      seasonalProfiles: new Map(),
      insufficientData: true,
    };
  }

  // Calculate seasonal profiles (mean and std dev for each position in the period)
  const seasonalProfiles = new Map<number, { mean: number; stdDev: number; count: number }>();
  
  // Collect values for each position in the period
  const periodValues: Map<number, number[]> = new Map();
  for (let i = 0; i < data.length; i++) {
    const positionInPeriod = i % period;
    if (!periodValues.has(positionInPeriod)) {
      periodValues.set(positionInPeriod, []);
    }
    periodValues.get(positionInPeriod)!.push(data[i].value);
  }

  // Calculate statistics for each position
  periodValues.forEach((values, position) => {
    if (values.length >= 2) {
      const mean = calculateMean(values);
      const stdDev = calculateStandardDeviation(values, true);
      seasonalProfiles.set(position, { mean, stdDev, count: values.length });
    }
  });

  // Detect anomalies
  const anomalyIndices: number[] = [];

  data.forEach((point, index) => {
    const positionInPeriod = index % period;
    const profile = seasonalProfiles.get(positionInPeriod);
    
    if (profile) {
      // Only detect anomalies if we have enough data points for this position AND there's variance
      if (profile.count >= 2 && profile.stdDev > 0) {
        const zScore = Math.abs(calculateZScore(point.value, profile.mean, profile.stdDev));
        if (zScore > threshold) {
          anomalyIndices.push(index);
        }
      } else if (profile.count >= 2 && profile.stdDev === 0) {
        // If stdDev is 0, all values at this position should be the same
        // Any difference is an anomaly
        if (point.value !== profile.mean) {
          anomalyIndices.push(index);
        }
      }
    }
  });

  return {
    anomalyIndices,
    seasonalProfiles,
    insufficientData: false,
  };
}

// ============================================
// Volatility-Adjusted Thresholds
// ============================================

export interface VolatilityThreshold {
  mean: number;
  upper: number;
  lower: number;
  stdDev: number;
  volatilityRatio: number;  // Ratio relative to overall volatility
}

export function calculateVolatilityAdjustedThreshold(
  data: number[],
  numStdDevs: number = 2
): VolatilityThreshold {
  const mean = calculateMean(data);
  const stdDev = calculateStandardDeviation(data, true);
  
  // Calculate a volatility ratio based on coefficient of variation
  const cv = stdDev / Math.abs(mean);
  
  // Adjust the threshold multiplier based on volatility
  // High volatility = wider thresholds
  const volatilityAdjustment = 1 + cv;
  const adjustedMultiplier = numStdDevs * volatilityAdjustment;
  
  return {
    mean,
    upper: mean + adjustedMultiplier * stdDev,
    lower: mean - adjustedMultiplier * stdDev,
    stdDev,
    volatilityRatio: cv,
  };
}

// ============================================
// Moving Average Crossover Detection
// ============================================

export interface CrossoverResult {
  crossoverIndices: number[];
  crossoverTypes: Map<number, "bullish" | "bearish">;
  shortMA: (number | null)[];
  longMA: (number | null)[];
  insufficientData?: boolean;
}

export function detectMovingAverageCrossover(
  data: number[],
  shortWindow: number,
  longWindow: number
): CrossoverResult {
  if (data.length < longWindow) {
    return {
      crossoverIndices: [],
      crossoverTypes: new Map(),
      shortMA: data.map(() => null),
      longMA: data.map(() => null),
      insufficientData: true,
    };
  }

  const shortMA = calculateRollingMean(data, shortWindow);
  const longMA = calculateRollingMean(data, longWindow);

  const crossoverIndices: number[] = [];
  const crossoverTypes = new Map<number, "bullish" | "bearish">();

  let previousShortAboveLong: boolean | null = null;

  for (let i = longWindow - 1; i < data.length; i++) {
    const short = shortMA[i];
    const long = longMA[i];

    if (short !== null && long !== null) {
      const currentShortAboveLong = short > long;

      // Initialize on first valid comparison
      if (previousShortAboveLong === null) {
        previousShortAboveLong = currentShortAboveLong;
        continue;
      }

      // Check for crossover (state change)
      if (currentShortAboveLong !== previousShortAboveLong) {
        crossoverIndices.push(i);
        crossoverTypes.set(i, currentShortAboveLong ? "bullish" : "bearish");
      }

      previousShortAboveLong = currentShortAboveLong;
    }
  }

  return {
    crossoverIndices,
    crossoverTypes,
    shortMA,
    longMA,
    insufficientData: false,
  };
}

// ============================================
// Statistical Anomaly Engine Class
// ============================================

export type DetectionMethod = "zscore" | "iqr";
export type DetectionParams = ZScoreParams | IQRParams;

export class StatisticalAnomalyEngine {
  /**
   * Detect anomalies using a single method
   */
  detect<T extends number | TimeSeriesDataPoint>(
    method: DetectionMethod,
    data: T[],
    params?: DetectionParams
  ): AnomalyDetectionResult<T> {
    // Extract values if time series data
    const values: number[] = data.map(d => 
      typeof d === 'number' ? d : (d as TimeSeriesDataPoint).value
    );

    const insufficientData = values.length < 3;
    
    if (insufficientData) {
      return {
        anomalies: [],
        method,
        insufficientData: true,
        explanation: `Insufficient data: ${values.length} points. Need at least 3.`,
      };
    }

    let result: { anomalyIndices: number[]; statistics?: StatisticsSummary; severityScores?: Map<number, number> };
    let anomalies: AnomalyMarker<T>[] = [];
    let explanation = "";

    if (method === "zscore") {
      const zscoreParams = params as ZScoreParams | undefined;
      result = detectZScoreAnomalies(values, zscoreParams);
      explanation = this.generateZScoreExplanation(result, zscoreParams?.threshold ?? 2.5);
    } else if (method === "iqr") {
      const iqrResult = detectIQROutliers(values, params as IQRParams | undefined);
      result = {
        anomalyIndices: iqrResult.outlierIndices,
        statistics: {
          mean: calculateMean(values),
          stdDev: calculateStandardDeviation(values),
          variance: calculateVariance(values),
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length,
          q1: iqrResult.q1,
          q3: iqrResult.q3,
          iqr: iqrResult.iqr,
        },
        severityScores: new Map(iqrResult.outlierIndices.map((idx, i) => [idx, i + 1])),
      };
      explanation = this.generateIQRExplanation(iqrResult);
    } else {
      throw new Error(`Unknown detection method: ${method}`);
    }

    // Convert indices to AnomalyMarker objects
    result.anomalyIndices.forEach((index) => {
      const value = data[index];
      const severityScore = result.severityScores?.get(index) ?? 1;
      const mean = result.statistics?.mean ?? 0;
      const stdDev = result.statistics?.stdDev ?? 1;
      
      let zScore: number | undefined;
      let deviationFromExpected: number | undefined;
      
      if (typeof value === "number") {
        zScore = calculateZScore(value, mean, stdDev);
        deviationFromExpected = value - mean;
      } else {
        zScore = calculateZScore(value.value, mean, stdDev);
        deviationFromExpected = value.value - mean;
      }
      
      anomalies.push({
        index,
        value,
        severityScore,
        zScore,
        deviationFromExpected,
      });
    });

    // Sort by severity (most severe first)
    anomalies.sort((a, b) => b.severityScore - a.severityScore);

    return {
      anomalies,
      method,
      statistics: result.statistics,
      explanation,
      insufficientData: false,
    };
  }

  /**
   * Detect anomalies using multiple methods (ensemble detection)
   */
  detectWithEnsemble<T extends number | TimeSeriesDataPoint>(
    data: T[],
    methods: DetectionMethod[],
    params?: { threshold?: number; multiplier?: number }
  ): EnsembleResult {
    const values: number[] = data.map(d => 
      typeof d === 'number' ? d : (d as TimeSeriesDataPoint).value
    );

    if (values.length < 3) {
      return {
        anomalies: [],
        method: "ensemble",
        ensembleVotes: [],
        consensusAnomalies: [],
        insufficientData: true,
        explanation: "Insufficient data for ensemble detection",
      };
    }

    // Collect votes from each method
    const votes = new Map<number, { methods: string[]; severityScore: number }>();

    methods.forEach((method) => {
      const result = this.detect(method, data, 
        method === "zscore" 
          ? { threshold: params?.threshold ?? 2.5 }
          : { multiplier: params?.multiplier ?? 1.5 }
      );

      result.anomalies.forEach((anomaly) => {
        const existing = votes.get(anomaly.index) ?? { methods: [], severityScore: 0 };
        existing.methods.push(method);
        existing.severityScore += anomaly.severityScore;
        votes.set(anomaly.index, existing);
      });
    });

    // Convert votes to VoteRecord
    const ensembleVotes: VoteRecord[] = [];
    votes.forEach((vote, index) => {
      ensembleVotes.push({
        index,
        value: typeof data[index] === "number" ? data[index] as number : (data[index] as TimeSeriesDataPoint).value,
        votes: vote.methods.length,
        methods: vote.methods,
        severityScore: vote.severityScore / vote.methods.length,
      });
    });

    // Consensus: anomalies flagged by majority of methods
    const majorityThreshold = Math.ceil(methods.length / 2);
    const consensusAnomalies = ensembleVotes
      .filter((v) => v.votes >= majorityThreshold)
      .map((v) => v.index)
      .sort((a, b) => b - a); // Most severe first (based on avg severity)

    // Build consensus anomaly list
    const anomalies: AnomalyMarker<T>[] = consensusAnomalies.map((index) => {
      const vote = votes.get(index)!;
      return {
        index,
        value: data[index],
        severityScore: vote.severityScore / vote.methods.length,
      };
    });

    return {
      anomalies: anomalies as AnomalyMarker<number>[],
      method: "ensemble",
      ensembleVotes,
      consensusAnomalies,
      statistics: {
        mean: calculateMean(values),
        stdDev: calculateStandardDeviation(values),
        variance: calculateVariance(values),
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      },
      explanation: `Ensemble detection using ${methods.join(", ")}. Anomalies require majority vote (>=${majorityThreshold} methods). Found ${consensusAnomalies.length} consensus anomalies.`,
      insufficientData: false,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private isTimeSeries(data: number[] | TimeSeriesDataPoint[]): data is TimeSeriesDataPoint[] {
    return data.length > 0 && typeof data[0] === "object" && "timestamp" in data[0];
  }

  private generateZScoreExplanation(result: { anomalyIndices: number[]; statistics?: StatisticsSummary }, threshold: number): string {
    const { anomalyIndices, statistics } = result;
    
    if (anomalyIndices.length === 0) {
      return `Z-score analysis with threshold ${threshold}: No anomalies detected. Mean=${statistics?.mean.toFixed(2) ?? 'N/A'}, StdDev=${statistics?.stdDev.toFixed(2) ?? 'N/A'}.`;
    }
    
    return `Z-score analysis with threshold ${threshold}: Detected ${anomalyIndices.length} anomaly(ies) at indices [${anomalyIndices.join(", ")}]. Mean=${statistics?.mean.toFixed(2) ?? 'N/A'}, StdDev=${statistics?.stdDev.toFixed(2) ?? 'N/A'}.`;
  }

  private generateIQRExplanation(result: IQRResult): string {
    return `IQR analysis with multiplier ${1.5}: Detected ${result.outlierIndices.length} outlier(s) at indices [${result.outlierIndices.join(", ")}]. Q1=${result.q1.toFixed(2)}, Q3=${result.q3.toFixed(2)}, IQR=${result.iqr.toFixed(2)}. Bounds=[${result.lowerBound.toFixed(2)}, ${result.upperBound.toFixed(2)}].`;
  }
}

// ============================================
// Utility Functions
// ============================================

function createEmptyStatistics(): StatisticsSummary {
  return {
    mean: 0,
    stdDev: 0,
    variance: 0,
    min: 0,
    max: 0,
    count: 0,
  };
}

function createStatisticsSummary(data: number[], mean: number, stdDev: number): StatisticsSummary {
  return {
    mean,
    stdDev,
    variance: calculateVariance(data, true),
    min: Math.min(...data),
    max: Math.max(...data),
    count: data.length,
  };
}

// ============================================
// Simple ARIMA-inspired Forecasting (Basic)
// ============================================

/**
 * Simple moving average forecast (ARIMA-inspired, simplified)
 * No external ML libraries - pure statistics implementation
 */
export function simpleMovingAverageForecast(
  data: number[],
  periods: number = 1
): number[] {
  if (data.length < 3) {
    return data; // Not enough data for meaningful forecast
  }

  const forecast: number[] = [];
  
  // Use last n periods to calculate moving average
  const windowSize = Math.min(3, data.length);
  
  for (let i = 0; i < periods; i++) {
    const windowData = data.slice(-windowSize);
    const ma = calculateMean(windowData);
    forecast.push(ma);
  }

  return forecast;
}

/**
 * Exponential smoothing forecast (simplified ARIMA component)
 */
export function exponentialSmoothingForecast(
  data: number[],
  alpha: number = 0.3,
  periods: number = 1
): { forecast: number[]; smoothedValues: number[] } {
  if (data.length < 2) {
    return { forecast: data, smoothedValues: data };
  }

  const smoothedValues: number[] = [data[0]];
  
  // Calculate smoothed series
  for (let i = 1; i < data.length; i++) {
    const smoothed = alpha * data[i] + (1 - alpha) * smoothedValues[i - 1];
    smoothedValues.push(smoothed);
  }

  // Forecast future periods using last smoothed value
  const lastSmoothed = smoothedValues[smoothedValues.length - 1];
  const trend = smoothedValues.length > 1 
    ? smoothedValues[smoothedValues.length - 1] - smoothedValues[smoothedValues.length - 2]
    : 0;

  const forecast: number[] = [];
  for (let i = 1; i <= periods; i++) {
    forecast.push(lastSmoothed + i * trend);
  }

  return { forecast, smoothedValues };
}

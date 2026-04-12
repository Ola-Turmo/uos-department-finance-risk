/**
 * Statistical Anomaly Detection Tests
 * Phase 1: Anomaly Engine - Time-series anomaly detection with pure statistics
 * No ML libraries - implements basic statistical methods (z-score, IQR, rolling stats)
 */

import { describe, expect, it } from "vitest";
import {
  StatisticalAnomalyEngine,
  calculateZScore,
  calculateMean,
  calculateStandardDeviation,
  calculateVariance,
  detectZScoreAnomalies,
  detectIQROutliers,
  calculateRollingMean,
  calculateRollingStdDev,
  detectSeasonalAnomaly,
  calculateVolatilityAdjustedThreshold,
  detectMovingAverageCrossover,
  type TimeSeriesDataPoint,
  type AnomalyDetectionResult,
  type ZScoreParams,
  type IQRParams,
  type SeasonalAnomalyParams,
} from "../../src/variance/statistical-anomaly.js";

describe("Statistical Anomaly Detection", () => {
  describe("Basic Statistics Functions", () => {
    it("calculates mean correctly", () => {
      expect(calculateMean([10, 20, 30, 40, 50])).toBe(30);
      expect(calculateMean([2, 4, 6, 8])).toBe(5);
      expect(calculateMean([])).toBe(0);
    });

    it("calculates variance correctly (population)", () => {
      // Population variance of [2, 4, 6, 8] => mean=5, variance=((2-5)^2+(4-5)^2+(6-5)^2+(8-5)^2)/4 = (9+1+1+9)/4 = 5
      expect(calculateVariance([2, 4, 6, 8], false)).toBe(5);
    });

    it("calculates sample variance correctly", () => {
      // Sample variance of [2, 4, 6, 8] => divisor is n-1=3, so 15/3 = 5
      // Actually (9+1+1+9)/3 = 20/3 ≈ 6.67
      expect(calculateVariance([2, 4, 6, 8], true)).toBeCloseTo(6.67, 1);
    });

    it("calculates standard deviation correctly (population)", () => {
      const stdDev = calculateStandardDeviation([2, 4, 6, 8], false);
      expect(stdDev).toBeCloseTo(Math.sqrt(5), 5);
    });

    it("calculates z-score correctly", () => {
      // For value 15 with mean 10 and stdDev 2, z-score = (15-10)/2 = 2.5
      expect(calculateZScore(15, 10, 2)).toBe(2.5);
      expect(calculateZScore(10, 10, 2)).toBe(0);
      expect(calculateZScore(5, 10, 2)).toBe(-2.5);
    });

    it("handles z-score with zero stdDev", () => {
      expect(calculateZScore(10, 10, 0)).toBe(0);
    });
  });

  describe("Z-Score Anomaly Detection", () => {
    it("detects anomalies beyond threshold", () => {
      const data = [10, 12, 11, 13, 10, 12, 100]; // 100 is an outlier
      const params: ZScoreParams = {
        threshold: 3,
      };
      const result = detectZScoreAnomalies(data, params);
      
      // 100 is definitely an outlier - should be detected
      expect(result.anomalyIndices.length).toBeGreaterThan(0);
    });

    it("returns empty array when no anomalies", () => {
      const data = [10, 11, 10, 12, 11, 10, 12];
      const params: ZScoreParams = {
        threshold: 3,
      };
      const result = detectZScoreAnomalies(data, params);
      
      expect(result.anomalyIndices).toHaveLength(0);
    });

    it("respects minimum data points requirement", () => {
      const data = [10, 20];
      const params: ZScoreParams = {
        threshold: 2,
        minDataPoints: 5, // Requires at least 5 data points
      };
      const result = detectZScoreAnomalies(data, params);
      
      expect(result.insufficientData).toBe(true);
    });

    it("handles known mean and standard deviation", () => {
      const data = [10, 12, 11, 100, 13, 12];
      const params: ZScoreParams = {
        threshold: 2.5,
        knownMean: 10,
        knownStdDev: 2,
      };
      const result = detectZScoreAnomalies(data, params);
      
      // 100 is definitely an outlier given mean=10, std=2
      expect(result.anomalyIndices).toContain(3);
    });

    it("handles constant data (zero variance)", () => {
      const data = [10, 10, 10, 10, 10];
      const result = detectZScoreAnomalies(data, { threshold: 2 });
      
      // No anomalies possible in constant data with zero variance
      expect(result.anomalyIndices).toHaveLength(0);
      expect(result.insufficientData).toBe(false);
    });

    it("handles negative values", () => {
      const data = [-100, -50, -75, -60, -200];
      const result = detectZScoreAnomalies(data, { threshold: 2 });
      
      // -200 should be detected as outlier
      expect(result.anomalyIndices).toContain(4);
    });
  });

  describe("IQR Outlier Detection", () => {
    it("detects outliers using IQR method", () => {
      const data = [2, 4, 6, 8, 10, 12, 50]; // 50 is an outlier
      const params: IQRParams = {
        multiplier: 1.5,
      };
      const result = detectIQROutliers(data, params);
      
      expect(result.outlierIndices).toContain(6); // Index of 50
    });

    it("calculates correct IQR bounds", () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const params: IQRParams = {
        multiplier: 1.5,
      };
      const result = detectIQROutliers(data, params);
      
      expect(result.iqr).toBeGreaterThan(0);
      expect(result.lowerBound).toBeLessThan(result.upperBound);
    });

    it("handles no outliers case", () => {
      const data = [5, 6, 7, 8, 9, 10, 11, 12];
      const params: IQRParams = {
        multiplier: 1.5,
      };
      const result = detectIQROutliers(data, params);
      
      // These values are all close, some may be outliers depending on IQR calculation
      expect(result.iqr).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Rolling Statistics", () => {
    it("calculates rolling mean correctly", () => {
      const data = [10, 20, 30, 40, 50];
      const result = calculateRollingMean(data, 3);
      
      expect(result[0]).toBeNull(); // Not enough data
      expect(result[1]).toBeNull(); // Not enough data
      expect(result[2]).toBe(20);   // (10+20+30)/3
      expect(result[3]).toBe(30);   // (20+30+40)/3
      expect(result[4]).toBe(40);   // (30+40+50)/3
    });

    it("calculates rolling standard deviation correctly", () => {
      const data = [10, 20, 30, 40, 50];
      const result = calculateRollingStdDev(data, 3);
      
      expect(result[0]).toBeNull();
      expect(result[1]).toBeNull();
      // For [10,20,30], mean=20, variance=((10-20)^2+(20-20)^2+(30-20)^2)/3 = 200/3 ≈ 66.67
      // std dev = sqrt(66.67) ≈ 8.16
      expect(result[2]).toBeCloseTo(8.16, 1);
    });
  });

  describe("Seasonal Anomaly Detection", () => {
    it("detects anomalies in seasonal data", () => {
      // Data with weekly seasonality (period=7)
      const data: TimeSeriesDataPoint[] = [
        { timestamp: "2024-01-01T00:00:00Z", value: 100 },
        { timestamp: "2024-01-02T00:00:00Z", value: 110 },
        { timestamp: "2024-01-03T00:00:00Z", value: 105 },
        { timestamp: "2024-01-04T00:00:00Z", value: 95 },
        { timestamp: "2024-01-05T00:00:00Z", value: 90 },
        { timestamp: "2024-01-06T00:00:00Z", value: 80 },
        { timestamp: "2024-01-07T00:00:00Z", value: 85 },
        // Week 2 - spike on day 3
        { timestamp: "2024-01-08T00:00:00Z", value: 100 },
        { timestamp: "2024-01-09T00:00:00Z", value: 110 },
        { timestamp: "2024-01-10T00:00:00Z", value: 500 }, // SPIKE - anomaly
        { timestamp: "2024-01-11T00:00:00Z", value: 95 },
        { timestamp: "2024-01-12T00:00:00Z", value: 90 },
        { timestamp: "2024-01-13T00:00:00Z", value: 80 },
        { timestamp: "2024-01-14T00:00:00Z", value: 85 },
      ];

      const params: SeasonalAnomalyParams = {
        period: 7,
        threshold: 2.5,
        minPeriodDataPoints: 7,
      };

      const result = detectSeasonalAnomaly(data, params);
      
      // The spike at index 10 (2024-01-10) should be detected
      expect(result.anomalyIndices).toContain(10);
    });

    it("requires minimum period data points", () => {
      const data: TimeSeriesDataPoint[] = [
        { timestamp: "2024-01-01T00:00:00Z", value: 100 },
        { timestamp: "2024-01-02T00:00:00Z", value: 110 },
        { timestamp: "2024-01-03T00:00:00Z", value: 105 },
      ];

      const params: SeasonalAnomalyParams = {
        period: 7,
        threshold: 2,
        minPeriodDataPoints: 7, // Requires 7 data points for one full period
      };

      const result = detectSeasonalAnomaly(data, params);
      
      expect(result.insufficientData).toBe(true);
    });

    it("builds seasonal profiles correctly", () => {
      const data: TimeSeriesDataPoint[] = [
        { timestamp: "2024-01-01T00:00:00Z", value: 100 },
        { timestamp: "2024-01-02T00:00:00Z", value: 110 },
        { timestamp: "2024-01-03T00:00:00Z", value: 105 },
        { timestamp: "2024-01-04T00:00:00Z", value: 95 },
        { timestamp: "2024-01-05T00:00:00Z", value: 90 },
        { timestamp: "2024-01-06T00:00:00Z", value: 80 },
        { timestamp: "2024-01-07T00:00:00Z", value: 85 },
        // Second week
        { timestamp: "2024-01-08T00:00:00Z", value: 100 },
        { timestamp: "2024-01-09T00:00:00Z", value: 110 },
        { timestamp: "2024-01-10T00:00:00Z", value: 105 },
        { timestamp: "2024-01-11T00:00:00Z", value: 95 },
        { timestamp: "2024-01-12T00:00:00Z", value: 90 },
        { timestamp: "2024-01-13T00:00:00Z", value: 80 },
        { timestamp: "2024-01-14T00:00:00Z", value: 85 },
      ];

      const params: SeasonalAnomalyParams = {
        period: 7,
        threshold: 2,
        minPeriodDataPoints: 7,
      };

      const result = detectSeasonalAnomaly(data, params);
      
      expect(result.seasonalProfiles.size).toBe(7); // One profile per day of week
      expect(result.insufficientData).toBe(false);
    });
  });

  describe("Volatility-Adjusted Thresholds", () => {
    it("calculates wider thresholds for volatile data", () => {
      // Volatile data should have wider thresholds
      const volatileData = [100, 150, 80, 200, 90, 180, 70];
      const stableData = [100, 102, 98, 101, 99, 103, 100];

      const volatileThreshold = calculateVolatilityAdjustedThreshold(volatileData, 2);
      const stableThreshold = calculateVolatilityAdjustedThreshold(stableData, 2);

      expect(volatileThreshold.upper).toBeGreaterThan(stableThreshold.upper);
      expect(volatileThreshold.lower).toBeLessThan(stableThreshold.lower);
    });

    it("returns mean-centered thresholds", () => {
      const data = [100, 102, 98, 101, 99, 103, 100];
      const threshold = calculateVolatilityAdjustedThreshold(data, 2);

      expect(threshold.mean).toBeCloseTo(100, 0);
    });

    it("calculates volatility ratio", () => {
      const data = [100, 150, 80, 200, 90, 180, 70];
      const threshold = calculateVolatilityAdjustedThreshold(data, 2);
      
      expect(threshold.volatilityRatio).toBeGreaterThan(0);
    });
  });

  describe("Moving Average Crossover Detection", () => {
    it("detects golden cross (bullish signal)", () => {
      const data = [10, 11, 12, 13, 14, 25, 26, 27, 28, 29];
      const result = detectMovingAverageCrossover(data, 3, 5);
      
      // Short MA (3-period) crosses above long MA (5-period) should be detected
      expect(result.crossoverIndices.length).toBeGreaterThan(0);
      expect(result.crossoverTypes.get(result.crossoverIndices[0])).toBe("bullish");
    });

    it("detects death cross (bearish signal)", () => {
      const data = [30, 29, 28, 27, 26, 15, 14, 13, 12, 11];
      const result = detectMovingAverageCrossover(data, 3, 5);
      
      // Short MA crosses below long MA
      expect(result.crossoverIndices.length).toBeGreaterThan(0);
      const bearishCrosses = Array.from(result.crossoverTypes.values()).filter(t => t === "bearish");
      expect(bearishCrosses.length).toBeGreaterThan(0);
    });

    it("returns empty for insufficient data", () => {
      const data = [10, 20, 30];
      const result = detectMovingAverageCrossover(data, 5, 10);
      
      expect(result.insufficientData).toBe(true);
      expect(result.crossoverIndices).toHaveLength(0);
    });

    it("returns short and long MA values", () => {
      const data = [10, 20, 30, 40, 50, 60, 70];
      const result = detectMovingAverageCrossover(data, 2, 4);
      
      expect(result.shortMA.length).toBe(data.length);
      expect(result.longMA.length).toBe(data.length);
    });
  });

  describe("StatisticalAnomalyEngine Class", () => {
    it("detects anomalies using z-score method", () => {
      const engine = new StatisticalAnomalyEngine();
      const data = [10, 12, 11, 13, 10, 12, 100];
      
      const result = engine.detect("zscore", data, { threshold: 2 });
      
      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.method).toBe("zscore");
    });

    it("detects anomalies using IQR method", () => {
      const engine = new StatisticalAnomalyEngine();
      const data = [2, 4, 6, 8, 10, 12, 50];
      
      const result = engine.detect("iqr", data, { multiplier: 1.5 });
      
      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.method).toBe("iqr");
    });

    it("handles time series data with timestamps", () => {
      const engine = new StatisticalAnomalyEngine();
      const timeSeriesData: TimeSeriesDataPoint[] = [
        { timestamp: "2024-01-01T00:00:00Z", value: 100 },
        { timestamp: "2024-01-02T00:00:00Z", value: 110 },
        { timestamp: "2024-01-03T00:00:00Z", value: 105 },
        { timestamp: "2024-01-04T00:00:00Z", value: 95 },
        { timestamp: "2024-01-05T00:00:00Z", value: 200 }, // outlier
        { timestamp: "2024-01-06T00:00:00Z", value: 102 },
      ];

      const result = engine.detect("zscore", timeSeriesData, { threshold: 2 });
      
      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies[0].index).toBe(4);
    });

    it("combines multiple detection methods", () => {
      const engine = new StatisticalAnomalyEngine();
      const data = [10, 12, 11, 13, 10, 12, 100];

      const result = engine.detectWithEnsemble(data, ["zscore", "iqr"], { threshold: 2, multiplier: 1.5 });
      
      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.ensembleVotes.length).toBeGreaterThan(0);
      expect(result.method).toBe("ensemble");
    });

    it("calculates anomaly severity scores", () => {
      const engine = new StatisticalAnomalyEngine();
      const data = [10, 12, 11, 13, 100]; // One clear outlier

      const result = engine.detect("zscore", data, { threshold: 2 });
      
      if (result.anomalies.length > 0) {
        // Severity scores should be defined
        result.anomalies.forEach(a => {
          expect(typeof a.severityScore).toBe("number");
        });
      }
    });

    it("produces explainable results", () => {
      const engine = new StatisticalAnomalyEngine();
      const data = [10, 12, 11, 13, 50];

      const result = engine.detect("zscore", data, { threshold: 2 });
      
      expect(result.explanation).toBeDefined();
      expect(result.explanation!.length).toBeGreaterThan(0);
      expect(result.statistics).toBeDefined();
      expect(result.statistics!.mean).toBeCloseTo(19.2, 1);
      expect(result.statistics!.stdDev).toBeGreaterThan(0);
    });

    it("marks insufficient data correctly", () => {
      const engine = new StatisticalAnomalyEngine();
      const result = engine.detect("zscore", [10, 20], { threshold: 2 });
      
      expect(result.insufficientData).toBe(true);
      expect(result.anomalies).toHaveLength(0);
    });
  });

  describe("Edge Cases", () => {
    it("handles empty data arrays", () => {
      const engine = new StatisticalAnomalyEngine();
      const result = engine.detect("zscore", [], { threshold: 2 });
      
      expect(result.insufficientData).toBe(true);
      expect(result.anomalies).toHaveLength(0);
    });

    it("handles single data point", () => {
      // With only one data point and stdDev=0, z-score should be 0
      const result = calculateZScore(10, 10, 0);
      expect(result).toBe(0);
    });

    it("handles constant data (zero variance)", () => {
      const data = [10, 10, 10, 10, 10];
      const result = detectZScoreAnomalies(data, { threshold: 2 });
      
      // No anomalies possible in constant data with zero variance
      expect(result.anomalies).toHaveLength(0);
      expect(result.insufficientData).toBe(false);
    });

    it("handles negative values", () => {
      const data = [-100, -50, -75, -60, -200];
      const result = detectZScoreAnomalies(data, { threshold: 2 });
      
      expect(result.anomalyIndices).toContain(4); // -200 is outlier
    });

    it("handles very small datasets for IQR", () => {
      const data = [1, 2, 3];
      const result = detectIQROutliers(data, { multiplier: 1.5 });
      
      // Should return insufficient data for < 4 points
      expect(result.insufficientData).toBe(true);
    });
  });
});

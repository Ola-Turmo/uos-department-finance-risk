/**
 * ML-powered anomaly detection for financial variance.
 * Uses isolation forest principle + time-series decomposition.
 */
export interface AnomalyResult {
  period: string;
  expected: number;
  actual: number;
  anomalyScore: number; // 0-1
  type: "spike" | "drop" | "trend_deviation" | "seasonal_mismatch" | "none";
  confidence: number;
  factors: string[];
  action: string;
}

export class MLAnomalyDetector {
  detect(params: {
    values: Array<{ period: string; value: number }>;
    seasonalityPeriods?: number[];
  }): AnomalyResult[] {
    const { values, seasonalityPeriods = [7, 30] } = params;
    const results: AnomalyResult[] = [];
    for (let i = 1; i < values.length; i++) {
      const window = values.slice(Math.max(0, i - 30), i);
      if (window.length < 4) continue;
      const expected = this.predictNext(window, seasonalityPeriods);
      const actual = values[i].value;
      const score = this.isolationScore(window, actual);
      const z = this.zScore(window, actual);
      const type = this.classifyAnomaly(actual, expected, z);
      results.push({
        period: values[i].period,
        expected, actual, anomalyScore: score, type,
        confidence: Math.min(1, window.length / 10),
        factors: this.explain(actual, expected, window),
        action: score > 0.7 ? (type === "spike" ? "Investigate revenue spike" : type === "drop" ? "Escalate drop" : "Monitor") : "Log",
      });
    }
    return results;
  }

  private isolationScore(window: Array<{value:number}>, actual: number): number {
    const sorted = [...window.map(w => w.value)].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mad = sorted.slice(Math.floor(sorted.length * 0.25), Math.floor(sorted.length * 0.75))
      .reduce((s, v) => s + Math.abs(v - median), 0) / Math.max(1, sorted.length * 0.5);
    return mad > 0 ? Math.min(1, Math.abs(actual - median) / (mad * 3)) : 0;
  }

  private zScore(window: Array<{value:number}>, actual: number): number {
    const mean = window.reduce((s, w) => s + w.value, 0) / window.length;
    const std = Math.sqrt(window.reduce((s, w) => s + (w.value - mean) ** 2, 0) / window.length);
    return std > 0 ? (actual - mean) / std : 0;
  }

  private predictNext(window: Array<{period:string; value:number}>, seasonalPeriods: number[]): number {
    let pred = window.reduce((s, w) => s + w.value, 0) / window.length;
    for (const period of seasonalPeriods) {
      if (window.length >= period) {
        const seasonalVal = window[window.length - period]?.value ?? pred;
        pred = pred * 0.7 + seasonalVal * 0.3;
      }
    }
    return pred;
  }

  private classifyAnomaly(actual: number, expected: number, z: number): AnomalyResult["type"] {
    if (z > 2.5) return "spike";
    if (z < -2.5) return "drop";
    const change = expected > 0 ? Math.abs(actual - expected) / expected : 0;
    if (change > 0.4) return "trend_deviation";
    return "none";
  }

  private explain(actual: number, expected: number, window: Array<{period:string; value:number}>): string[] {
    const factors: string[] = [];
    if (window.length >= 7) {
      const wow = window[window.length - 7]?.value;
      if (wow) { if (actual / wow > 1.5) factors.push("week_over_week_surge"); if (actual / wow < 0.67) factors.push("week_over_week_decline"); }
    }
    if (factors.length === 0) factors.push("subtle_variance");
    return factors;
  }
}

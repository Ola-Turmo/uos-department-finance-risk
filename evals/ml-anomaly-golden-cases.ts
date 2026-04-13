# Evals: ML Anomaly Detection Golden Cases

## Purpose
Golden cases for regression testing the `MLAnomalyDetector` class and variance explanation workflows.

## Test Case 1: Revenue Spike Detection

**Input**:
```typescript
const values = [
  { period: "2026-01-01", value: 100000 },
  { period: "2026-01-02", value: 102000 },
  { period: "2026-01-03", value: 101500 },
  { period: "2026-01-04", value: 101000 },
  { period: "2026-01-05", value: 98000 },
  { period: "2026-01-06", value: 99000 },
  { period: "2026-01-07", value: 150000 }, // Spike!
];
```

**Expected**:
- Period "2026-01-07" detected as anomaly
- Type: "spike"
- Factors: "week_over_week_surge" (comparing to 2026-01-06)
- Action: "Investigate revenue spike"
- Confidence: > 0.7 (sufficient window size)

## Test Case 2: Revenue Drop Detection

**Input**:
```typescript
const values = [
  { period: "2026-01-01", value: 100000 },
  { period: "2026-01-02", value: 98000 },
  { period: "2026-01-03", value: 102000 },
  { period: "2026-01-04", value: 99000 },
  { period: "2026-01-05", value: 101000 },
  { period: "2026-01-06", value: 100000 },
  { period: "2026-01-07", value: 45000 }, // Drop!
];
```

**Expected**:
- Period "2026-01-07" detected as anomaly
- Type: "drop"
- Factors: "week_over_week_decline" (comparing to 2026-01-06)
- Action: "Escalate drop"
- Confidence: > 0.7

## Test Case 3: No Anomaly (Normal Variation)

**Input**:
```typescript
const values = [
  { period: "2026-01-01", value: 100000 },
  { period: "2026-01-02", value: 102000 },
  { period: "2026-01-03", value: 99000 },
  { period: "2026-01-04", value: 101000 },
  { period: "2026-01-05", value: 100500 },
  { period: "2026-01-06", value: 99500 },
  { period: "2026-01-07", value: 100200 },
];
```

**Expected**:
- No anomalies detected (all within normal variance)
- All periods return type: "none"
- anomalyScore < 0.5 for all

## Test Case 4: Trend Deviation

**Input** (steady upward trend + sudden drop):
```typescript
const values = [
  { period: "2026-01-01", value: 100000 },
  { period: "2026-01-02", value: 105000 },
  { period: "2026-01-03", value: 110000 },
  { period: "2026-01-04", value: 115000 },
  { period: "2026-01-05", value: 120000 },
  { period: "2026-01-06", value: 125000 },
  { period: "2026-01-07", value: 85000 }, // Deviation!
];
```

**Expected**:
- Period "2026-01-07" detected as anomaly
- Type: "trend_deviation"
- Expected value: ~125000 (trend following)
- Actual: 85000

## Test Case 5: Small Window Grace

**Input**:
```typescript
const values = [
  { period: "2026-01-01", value: 100000 },
  { period: "2026-01-02", value: 150000 }, // Only 2 data points prior
];
```

**Expected**:
- Should continue without error (window < 4 is skipped per implementation)
- No anomaly result for period "2026-01-02"

## Test Case 6: Seasonality Pattern

**Input** (with weekly seasonality):
```typescript
const values = [
  { period: "2026-W01-Mon", value: 100000 },
  { period: "2026-W01-Tue", value: 102000 },
  { period: "2026-W01-Wed", value: 101000 },
  { period: "2026-W01-Thu", value: 99000 },
  { period: "2026-W01-Fri", value: 98000 },
  { period: "2026-W01-Sat", value: 50000 },
  { period: "2026-W01-Sun", value: 40000 },
  { period: "2026-W02-Mon", value: 100000 },
  { period: "2026-W02-Tue", value: 101000 },
  { period: "2026-W02-Wed", value: 100500 },
  { period: "2026-W02-Thu", value: 98000 },
  { period: "2026-W02-Fri", value: 97000 },
  { period: "2026-W02-Sat", value: 48000 },
  { period: "2026-W02-Sun", value: 38000 },
  { period: "2026-W03-Mon", value: 100000 },
  { period: "2026-W03-Tue", value: 102000 },
  { period: "2026-W03-Wed", value: 101000 },
  { period: "2026-W03-Thu", value: 99000 },
  { period: "2026-W03-Fri", value: 98500 },
  { period: "2026-W03-Sat", value: 52000 },
  { period: "2026-W03-Sun", value: 42000 },
  { period: "2026-W04-Mon", value: 100000 },
  { period: "2026-W04-Tue", value: 101500 },
  { period: "2026-W04-Wed", value: 101000 },
  { period: "2026-W04-Thu", value: 99000 },
  { period: "2026-W04-Fri", value: 98000 },
  { period: "2026-W04-Sat", value: 55000 },
  { period: "2026-W04-Sun", value: 45000 },
  // Week 5 Monday - potential spike if unexpected
  { period: "2026-W05-Mon", value: 180000 },
];
const seasonalityPeriods = [7]; // Weekly seasonality
```

**Expected**:
- Week 5 Monday spike (180k vs expected ~100k) detected
- Type: "spike"
- Factors should identify week-over-week surge
- Action: "Investigate revenue spike"

## Confidence Scoring

The MLAnomalyDetector uses:
- `isolationScore`: Based on Median Absolute Deviation (MAD)
- `zScore`: Classical statistical z-score
- Window size factor: `Math.min(1, window.length / 10)`

Minimum confidence thresholds:
- Low: 0.3-0.4 (small windows)
- Medium: 0.5-0.6 (moderate windows)
- High: 0.7+ (sufficient historical data)

## Running These Evals

```typescript
import { MLAnomalyDetector } from '../src/variance/ml-anomaly-detector';

const detector = new MLAnomalyDetector();
const results = detector.detect({
  values: [...],
  seasonalityPeriods: [7, 30]
});

// Assert results match expectations above
```

## Regression Criteria

- All spike/drop detections must have anomalyScore >= 0.7
- All "none" type results must have anomalyScore < 0.5
- No runtime errors on any input format
- Seasonality periods correctly influence predictions

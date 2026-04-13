# Variance Anomaly Service Runbook

## Overview
The VarianceAnomalyService handles forecast variance detection, explanation, and follow-up management. It is a core component of the finance-risk department overlay.

## Service Initialization

```typescript
import { VarianceAnomalyService } from './variance-anomaly-service';

// Create with optional initial state for persistence
const service = new VarianceAnomalyService(initialState);
```

## Core Workflows

### 1. Variance Detection

```typescript
const variance = service.detectVariance({
  title: "Q1 Revenue Forecast Movement",
  description: "Material variance in Q1 revenue vs plan",
  varianceType: "forecast",
  previousValue: 1000000,
  currentValue: 1200000,
  materialityThreshold: 50000,
  ownerRoleKey: "finance-fpa-lead"
});
```

### 2. Variance Explanation

After detection, explain with driver analysis:

```typescript
service.explainVariance({
  varianceId: variance.id,
  driverCategories: ["volume", "price"],
  primaryDriver: "volume",
  driverExplanations: [
    {
      category: "volume",
      explanation: "Units sold increased 45% due to new product launch",
      quantifiedImpact: 175000,
      confidence: "high",
      source: "salesforce-crm"
    },
    {
      category: "price",
      explanation: "Average selling price up 2%",
      quantifiedImpact: 25000,
      confidence: "medium"
    }
  ],
  isMaterial: true,
  impactDescription: "Positive variance driven by volume outperformance"
});
```

### 3. Variance Follow-Up Actions

```typescript
service.assignVarianceFollowUp({
  varianceId: variance.id,
  title: "Update Q2 Forecast with Volume Assumptions",
  description: "Incorporate learnings from Q1 into Q2 planning",
  priority: "high",
  ownerRoleKey: "finance-fpa-lead",
  dueDate: "2026-04-20",
  reversibility: "fully-reversible",
  rollbackProcedure: "Revert forecast to previous version",
  verificationCriteria: "Q2 forecast within 5% of model output"
});
```

### 4. Anomaly Detection

```typescript
const anomaly = service.detectAnomaly({
  title: "Unusual SG&A Spending Pattern",
  description: "SG&A expenses 40% above trend for past 2 weeks",
  category: "spending-spike",
  detectedValue: 85000,
  expectedValue: 60000,
  ownerRoleKey: "finance-controllership-lead"
});
```

### 5. Anomaly Explanation

```typescript
service.explainAnomaly({
  anomalyId: anomaly.id,
  possibleCauses: [
    {
      description: "True anomaly - unusual vendor billing",
      likelihood: "likely",
      quantifiedImpact: 25000,
      requiresInvestigation: true
    },
    {
      description: "Timing difference - payment cycle shift",
      likelihood: "possible",
      quantifiedImpact: 10000,
      requiresInvestigation: false
    }
  ],
  primaryCauseDescription: "True anomaly - unusual vendor billing",
  explanation: "Investigation confirmed vendor billing error. Credit expected within 30 days."
});
```

### 6. Marking False Positives

```typescript
service.markFalsePositive({
  anomalyId: anomaly.id,
  reason: "Pricing model update caused apparent spike - actual is correct",
  markedByRoleKey: "finance-fpa-lead"
});
```

## Query Operations

### Get Material Variances
```typescript
const materialVariances = service.getMaterialVariances();
```

### Get Urgent Anomalies
```typescript
const urgentAnomalies = service.getUrgentAnomalies();
```

### Get Variances by Status
```typescript
const openVariances = service.getVariancesByStatus("detected");
const explainedVariances = service.getVariancesByStatus("explained");
```

## Integration with Approval Intelligence

The service integrates with `ApprovalIntelligence` for risk context:

```typescript
// Track variance follow-ups in approval intelligence
approvalIntelligence.trackRequest(varianceFollowUpRequest);

// Get risk context for prioritization
const riskContext = approvalIntelligence.getRiskContext(varianceFollowUpRequest.id);
```

## State Persistence

```typescript
// Get current state for persistence
const state = service.getState();

// Recreate service with persisted state
const restoredService = new VarianceAnomalyService(savedState);
```

## KPI Tracking

### Variance Explanation Coverage
Track explained vs detected material variances:
```typescript
const allVariances = service.getAllVariances();
const materialVariances = service.getMaterialVariances();
const explainedMaterial = materialVariances.filter(v => v.status === "explained" || v.status === "resolved");
const coverage = explainedMaterial.length / materialVariances.length;
```

### Anomaly False Positive Rate
```typescript
const allAnomalies = service.getAllAnomalies();
const falsePositives = allAnomalies.filter(a => a.status === "false-positive");
const fpRate = falsePositives.length / allAnomalies.length;
```

## Common Issues

### Issue: Variance not found
**Cause**: Using incorrect varianceId
**Fix**: Verify varianceId from detectVariance response

### Issue: Follow-up not transitioning status
**Cause**: updateVarianceFollowUpStatus called with wrong followUpId
**Fix**: Use the followUp.id from assignVarianceFollowUp response

### Issue: Confidence always "low"
**Cause**: Driver explanations not provided or low-confidence
**Fix**: Ensure driverExplanations array is populated with varied confidence levels

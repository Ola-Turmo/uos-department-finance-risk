# Variance Explanation Evals

## Purpose
Golden cases for testing variance explanation workflows and KPI compliance.

## KPI: Variance Explanation Coverage >= 90%

For material forecast movements (>= materiality threshold), the system must produce explanations within reasonable time.

### Test Case 1: Material Variance Explanation

**Setup**:
- Variance detected: $50,000 increase (materiality threshold: $10,000)
- Status: "detected"

**Action**: Explain variance with driver analysis

**Expected**:
- Status transitions to "explained"
- driverCategories populated
- primaryDriver identified
- driverExplanations array with confidence scores
- isMaterial remains true
- confidence is "high", "medium", or "low" (calculated from driver explanations)

### Test Case 2: Non-Material Variance (No Explanation Required)

**Setup**:
- Variance detected: $5,000 increase (materiality threshold: $10,000)
- Status: "detected"

**Expected**:
- isMaterial = false
- Can be resolved without full explanation if desired
- Status can transition to "dismissed"

### Test Case 3: Multiple Driver Explanations

**Action**: Explain variance with multiple drivers

**Expected**:
- Multiple driverCategories in array
- Quantified impact sums to approximately total variance
- Confidence calculated as weighted average

### Test Case 4: Explanation with Lessons Learned

**Action**: Explain variance and capture lessons learned

**Expected**:
- lessonsLearned array populated
- Follow-up actions can reference lessons

## KPI: Follow-up Action Tracking

### Test Case 5: Reversible Action

**Setup**: Assign follow-up with reversibility = "fully-reversible"

**Expected**:
- Verification criteria defined
- Rollback procedure documented
- Status can be tracked

### Test Case 6: Non-Reversible Action

**Setup**: Assign follow-up with reversibility = "not-reversible"

**Expected**:
- Requires escalation approval per PRD
- Higher scrutiny on completion

## KPI: Resolution Tracking

### Test Case 7: Complete Variance Resolution

**Setup**:
- Variance with one or more follow-up actions

**Action**: Complete all follow-up actions

**Expected**:
- Status transitions to "resolved"
- resolvedAt timestamp set

## Running These Evals

```typescript
import { VarianceAnomalyService } from '../src/variance-anomaly-service';

const service = new VarianceAnomalyService();

// Test case 1
const variance = service.detectVariance({
  title: "Revenue increase Q1",
  description: "...",
  varianceType: "forecast",
  previousValue: 100000,
  currentValue: 150000,
  materialityThreshold: 10000,
  ownerRoleKey: "finance-fpa-lead"
});

const explained = service.explainVariance({
  varianceId: variance.id,
  driverCategories: ["volume", "price"],
  primaryDriver: "volume",
  driverExplanations: [
    {
      category: "volume",
      explanation: "Units sold increased 40%",
      quantifiedImpact: 40000,
      confidence: "high"
    },
    {
      category: "price",
      explanation: "Average price up 5%",
      quantifiedImpact: 10000,
      confidence: "medium"
    }
  ],
  isMaterial: true,
  impactDescription: "Positive variance from volume growth"
});

// Assert explained.status === "explained"
```

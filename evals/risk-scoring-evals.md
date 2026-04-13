# Risk Scoring and Approval Intelligence Evals

## Purpose
Golden cases for testing approval intelligence, risk scoring, and bottleneck prediction.

## KPI: Approval SLA <= 1 Business Day

For standard requests with complete evidence.

### Test Case 1: Standard Request SLA Compliance

**Setup**:
- Request with complete evidence package
- Standard control boundary (not elevated/restricted)
- Priority: medium
- Amount: $5,000

**Action**: Submit for approval

**Expected**:
- SLA deadline calculated as 5 business days (120 hours)
- Request tracked in approval intelligence
- Recommendation can be obtained

### Test Case 2: High-Value Request (Enhanced Controls)

**Setup**:
- Request with complete evidence
- Amount: $75,000 (elevated boundary)
- Priority: high

**Expected**:
- Control boundary level: "elevated"
- Risk score higher than standard request
- Second approval likely required

### Test Case 3: Critical Request SLA

**Setup**:
- Critical priority request
- SLA deadline: 4 hours

**Expected**:
- SLA urgency bonus applied to approver load calculation
- Bottleneck prediction more sensitive to queue depth

## Risk Scoring Tests

### Test Case 4: Amount-Based Risk Scoring

**Input**:
```typescript
calculateRiskScore({
  amount: 100000,
  priority: "medium",
  controlBoundaryLevel: "standard",
  requiresSecondApproval: false,
  hasExceptions: false,
  daysInQueue: 0,
  evidenceCompleteness: 100
});
```

**Expected**:
- Score >= 30 (high amount component)
- Total score reflects risk factors

### Test Case 5: Combined Risk Factors

**Input**:
```typescript
calculateRiskScore({
  amount: 75000,
  priority: "critical",
  controlBoundaryLevel: "restricted",
  requiresSecondApproval: true,
  hasExceptions: true,
  daysInQueue: 2,
  evidenceCompleteness: 60
});
```

**Expected**:
- Score near maximum (100)
- All factors contribute additively

### Test Case 6: Evidence Incompleteness Risk

**Input**:
```typescript
calculateRiskScore({
  amount: 5000,
  priority: "low",
  controlBoundaryLevel: "standard",
  requiresSecondApproval: false,
  hasExceptions: false,
  daysInQueue: 0,
  evidenceCompleteness: 40  // Incomplete
});
```

**Expected**:
- Higher score than equivalent with complete evidence
- Evidence completeness factor visible

## Delegation Suggestion Tests

### Test Case 7: Overloaded Approver Delegation

**Setup**:
- Approver A: 95% utilization, 5 pending items
- Approver B: 45% utilization, 2 pending items

**Action**: suggestOptimalDelegation for Approver A

**Expected**:
- Suggestion to delegate to Approver B
- Confidence proportional to load difference
- Time saved estimate provided

### Test Case 8: Low-Utilization Approver (No Delegation)

**Setup**:
- Approver A: 50% utilization, 2 pending items

**Action**: suggestOptimalDelegation for Approver A

**Expected**:
- No delegation suggested (below 70% threshold)

## Bottleneck Prediction Tests

### Test Case 9: Bottleneck Detection

**Setup**:
- Approver with 85% utilization
- 4+ pending items for this approver

**Action**: predictBottleneck()

**Expected**:
- Bottleneck prediction for that approver
- Predicted delay based on queue length and avg time

### Test Case 10: No Bottleneck (Healthy Capacity)

**Setup**:
- Approver with 50% utilization
- 2 pending items

**Expected**:
- No bottleneck prediction

## Pipeline Analytics Tests

### Test Case 11: Complete Pipeline Analytics

**Setup**:
- Multiple approvers with varying utilization
- Historical approvals recorded

**Action**: getPipelineAnalytics()

**Expected**:
- Overall approval velocity
- Per-approver utilization breakdown
- SLA compliance rate

## Running These Evals

```typescript
import { 
  ApprovalIntelligence, 
  calculateRiskScore,
  calculateApproverLoad,
} from '../src/approval/approval-intelligence';

// Test risk scoring
const score = calculateRiskScore({
  amount: 75000,
  priority: "high",
  controlBoundaryLevel: "elevated",
  requiresSecondApproval: true,
  hasExceptions: false,
  daysInQueue: 1,
  evidenceCompleteness: 80
});
console.log(`Risk score: ${score}`);

// Test bottleneck prediction
const intelligence = new ApprovalIntelligence();
const predictions = intelligence.predictBottleneck();
```

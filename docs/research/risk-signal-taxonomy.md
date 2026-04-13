# Risk Signal Taxonomy

## Purpose
Classification system for risk signals detected by the audit-finance-risk department overlay.

## Signal Categories

### 1. Financial Risk Signals

| Category | Description | Severity Range | Typical Response |
|----------|-------------|-----------------|------------------|
| spending-spike | Unusual increase in expenditures | high-critical | Investigate vendor, verify receipt |
| revenue-dip | Unexpected revenue reduction | high-critical | Review transactions, check for errors |
| pattern-break | Historical pattern no longer holds | medium-high | Re-evaluate forecast assumptions |
| correlation-shift | Previously correlated metrics diverge | medium-high | Identify root cause of decoupling |
| forecast-miss | Actual vs forecast exceeds threshold | medium-high | Variance analysis, driver identification |
| budget-overrun | Spending exceeds budget allocation | high-critical | Budget adjustment or reallocation |

### 2. Operational Risk Signals

| Category | Description | Severity Range | Typical Response |
|----------|-------------|-----------------|------------------|
| control-gap | Required control not functioning | critical | Immediate remediation |
| segregation-violation | Incompatible duties performed by same person | critical | Immediate reassignment |
| evidence-gap | Required documentation missing | medium-high | Obtain evidence or escalate |
| sla-breach | Required timeline not met | medium-high | Assess impact, document exception |

### 3. Compliance Risk Signals

| Category | Description | Severity Range | Typical Response |
|----------|-------------|-----------------|------------------|
| policy-conflict | Action conflicts with stated policy | high-critical | Escalate to compliance |
| scope-exceeded | Activity outside authorized scope | high-critical | Halt activity, review authorization |
| documentation-gap | Required records incomplete | medium | Complete documentation |

## Severity Definitions

- **critical**: Immediate action required; potential for material financial loss or regulatory violation
- **high**: Action within 24 hours; significant impact on operations or objectives
- **medium**: Action within 1 week; moderate impact
- **low**: Monitor and address in normal course; minimal impact

## Confidence Levels

- **high**: Multiple independent sources confirm signal
- **medium**: Single source with corroborating indirect evidence
- **low**: Single source or indirect evidence only

## Signal-to-Action Mapping

Each detected signal should map to:
1. Immediate acknowledgment action
2. Triage workflow assignment
3. Owner assignment
4. SLA for investigation
5. Follow-up action with reversibility assessment

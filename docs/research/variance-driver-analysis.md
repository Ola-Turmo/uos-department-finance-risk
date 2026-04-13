# Variance Driver Analysis Research Brief

## Research Date
2026-04-13

## Context
Part of the UoS audit-finance-risk department overlay upgrade to capture learning artifacts.

## Key Research Questions (from PRD Section 9)

### Which variance drivers most often surprise stakeholders late?

Based on the codebase analysis of `statistical-anomaly.ts` and `variance-anomaly-service.ts`:

1. **Seasonal mismatches** - Time-series decomposition failures when actuals don't align with expected seasonal patterns
2. **Trend deviations** - Gradual shifts not captured by simple moving averages
3. **One-time events** - Non-recurring items (refunds, corrections) that distort period comparisons
4. **Price vs volume mix** - Separating the impact of pricing changes from volume changes

### Where do approval flows create the most avoidable delay?

From `approval-intelligence.ts` and `approval-service.ts`:

1. **Evidence gathering bottlenecks** - Missing receipts, calculations, or justifications that require back-and-forth
2. **Delegation chains** - Sequential delegation when parallel review would suffice
3. **SLA deadline miscalculation** - Not accounting for business hours vs calendar hours
4. **Capacity mismatch** - High-utilization approvers blocking low-risk requests

### Which control exceptions recur and why?

From `monitor.ts` and `control-exception-logger.ts`:

1. **Evidence gaps** - Missing documentation for completed controls
2. **Timing violations** - Controls not executed within required frequencies
3. **Segregation violations** - Same person performing incompatible duties

## Variance Driver Library

| Driver | Description | Typical Impact | Detection Method |
|--------|-------------|----------------|------------------|
| volume | Unit/sales volume changes | Direct proportional | Statistical analysis |
| price | Average price changes | Direct on margin | Mix analysis |
| mix | Product/service mix shift | Variable by category | Variance decomposition |
| timing | Revenue/expense timing differences | Can reverse in future periods | Calendar analysis |
| currency | FX rate fluctuations | Proportional to exposure | Hedging analysis |
| one-time | Non-recurring events | No ongoing impact | Event sourcing |
| model-error | Forecast methodology issue | Requires methodology review | Back-testing |

## Recommended Variance Explanation Templates

1. **For material forecast movements (>=90% coverage target)**:
   - Primary driver with quantified impact
   - Secondary drivers ranked by contribution
   - Confidence level for each driver
   - Recommended follow-up action with reversibility assessment

2. **For anomaly investigation**:
   - Initial triage category
   - Possible causes ranked by likelihood
   - Evidence required to confirm/exclude each cause
   - Owner assignment with SLA tracking

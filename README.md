# @uos/department-finance-risk

@uos/department-finance-risk packages forecasting, approvals, controls, anomaly detection, and risk sensing into an auditable operating layer. It exists to improve financial clarity and control integrity without turning finance into a slow-moving workflow bottleneck.

Built as part of the UOS split workspace on top of [Paperclip](https://github.com/paperclipai/paperclip), which remains the upstream control-plane substrate.

## What This Repo Owns

- Forecasting support, variance analysis, and explanation workflows.
- Approval routing, controls, and audit trail support.
- Anomaly and leakage detection with triage guidance.
- Risk scoring, review, and escalation workflows.
- Learning loops from exceptions, misses, and forecast error.

## Runtime Form

- Split repo with package code as the source of truth and a Paperclip plugin scaffold available for worker, manifest, UI, and validation surfaces when the repo needs runtime or operator-facing behavior.

## Highest-Value Workflows

- Explaining forecast movement and variance drivers.
- Routing approvals with clear evidence and traceability.
- Detecting financial anomalies and prioritizing follow-up.
- Monitoring control health and exception patterns.
- Capturing lessons from misses, exceptions, and audits.

## Key Connections and Operating Surfaces

- Accounting and ERP systems such as QuickBooks, Xero, or NetSuite, billing/payments tools such as Stripe, expense systems, approvals, spreadsheets, docs, and audit trails needed to preserve both operating speed and control integrity.
- Risk, compliance, security-review, contract, and policy surfaces whenever financial decisions require governance, traceability, segregation of duties, or escalation.
- Browser and export/import workflows for finance, banking, and procurement tools that expose critical evidence outside API boundaries.
- Any adjacent system required to move from variance signal or anomaly to explanation, approval, control action, journal-impact review, and auditable resolution.

## KPI Targets

- Variance explanation coverage reaches >= 90% for material forecast movement.
- Approval SLA stays <= 1 business day for standard requests with complete evidence.
- Anomaly precision reaches >= 80% on the maintained financial benchmark corpus.
- 100% of control exceptions are logged with owner, due date, and disposition.

## Implementation Backlog

### Now
- Define the approval, control, and anomaly-handling workflows with explicit evidence requirements.
- Build the exception register and owner-tracking loop for all material control failures.
- Make forecast movement and variance explanation a first-class output instead of a manual afterthought.

### Next
- Improve anomaly precision and reduce noisy flags that waste reviewer time.
- Integrate finance, spend, and approval systems so evidence can be gathered without spreadsheet archaeology.
- Instrument SLA, exception aging, and repeated control failure patterns.

### Later
- Support more autonomous finance operations within strict approval and control boundaries.
- Expand from exception management into proactive risk sensing and control design guidance.

## Local Plugin Use

```bash
curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"packageName":"<absolute-path-to-this-repo>","isLocalPath":true}'
```

## Validation

```bash
npm install
npm run check
npm run plugin:typecheck
npm run plugin:test
```

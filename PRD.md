---
repo: "uos-department-finance-risk"
display_name: "@uos/department-finance-risk"
package_name: "@uos/department-finance-risk"
lane: "department overlay"
artifact_class: "TypeScript package / business-domain overlay"
maturity: "domain overlay focused on finance controls and risk intelligence"
generated_on: "2026-04-03"
assumptions: "Grounded in the current split-repo contents, package metadata, README/PRD alignment pass, and the Paperclip plugin scaffold presence where applicable; deeper module-level inspection should refine implementation detail as the code evolves."
autonomy_mode: "maximum-capability autonomous work with deep research and explicit learning loops"
---

# PRD: @uos/department-finance-risk

## 1. Product Intent

**Package / repo:** `@uos/department-finance-risk`  
**Lane:** department overlay  
**Artifact class:** TypeScript package / business-domain overlay  
**Current maturity:** domain overlay focused on finance controls and risk intelligence  
**Source-of-truth assumption:** Department-specific finance/risk overlay.
**Runtime form:** Split repo with package code as the source of truth and a Paperclip plugin scaffold available for worker, manifest, UI, and validation surfaces when the repo needs runtime or operator-facing behavior.

@uos/department-finance-risk packages forecasting, approvals, controls, anomaly detection, and risk sensing into an auditable operating layer. It exists to improve financial clarity and control integrity without turning finance into a slow-moving workflow bottleneck.

## 2. Problem Statement

Finance and risk work balances speed against control. Too little structure invites leakage and surprises; too much structure creates friction, shadow processes, and weak adoption. This overlay must make the right controls easier, more explainable, and more actionable.

## 3. Target Users and Jobs to Be Done

- Finance operators, approvers, and risk owners.
- Leadership consumers of forecasts and financial health signals.
- Autonomous agents helping with anomaly analysis and workflow support.
- Audit/compliance stakeholders reviewing control quality.

## 4. Outcome Thesis

**North star:** Forecasts become more explainable, approvals and controls become more reliable, and risk signals arrive earlier with clearer action paths.

### 12-month KPI targets
- Variance explanation coverage reaches >= 90% for material forecast movement.
- Approval SLA stays <= 1 business day for standard requests with complete evidence.
- Anomaly precision reaches >= 80% on the maintained financial benchmark corpus.
- 100% of control exceptions are logged with owner, due date, and disposition.
- Audit-ready traceability is present for 100% of finance automation paths in scope.

### Acceptance thresholds for the next implementation wave
- Approval flows preserve evidence, traceability, and segregation-of-duties boundaries.
- Anomaly and exception handling have a documented triage and owner model.
- No material finance workflow is automated without an audit trail and reversal path.
- Forecast and control outputs are explainable enough to survive stakeholder and audit scrutiny.

## 5. In Scope

- Forecasting support, variance analysis, and explanation workflows.
- Approval routing, controls, and audit trail support.
- Anomaly and leakage detection with triage guidance.
- Risk scoring, review, and escalation workflows.
- Learning loops from exceptions, misses, and forecast error.

## 6. Explicit Non-Goals

- Replacing accounting policy or legal judgment.
- Optimizing for workflow speed by weakening controls.
- Using black-box risk scores without explainability.

## 7. Maximum Tool and Connection Surface

- This repo should assume it may use any connection, API, browser flow, CLI, document surface, dataset, or storage system materially relevant to completing the job, as long as the access pattern is lawful, auditable, and proportionate to risk.
- Do not artificially limit execution to the tools already named in the repo if adjacent systems are clearly required to close the loop.
- Prefer first-party APIs and direct integrations when available, but use browser automation, provider CLIs, structured import/export, and human-review queues when they are the most reliable path to completion.
- Treat communication systems, docs, spreadsheets, issue trackers, code hosts, cloud consoles, dashboards, databases, and admin panels as valid operating surfaces whenever the repo's job depends on them.
- Escalate only when the action is irreversible, privacy-sensitive, financially material, or likely to create external side effects without adequate review.

### Priority surfaces for finance and risk work
- Accounting and ERP systems such as QuickBooks, Xero, or NetSuite, billing/payments tools such as Stripe, expense systems, approvals, spreadsheets, docs, and audit trails needed to preserve both operating speed and control integrity.
- Risk, compliance, security-review, contract, and policy surfaces whenever financial decisions require governance, traceability, segregation of duties, or escalation.
- Browser and export/import workflows for finance, banking, and procurement tools that expose critical evidence outside API boundaries.
- Any adjacent system required to move from variance signal or anomaly to explanation, approval, control action, journal-impact review, and auditable resolution.

### Selection rules
- Start by identifying the systems that would let the repo complete the real job end to end, not just produce an intermediate artifact.
- Use the narrowest safe action for high-risk domains, but not the narrowest tool surface by default.
- When one system lacks the evidence or authority needed to finish the task, step sideways into the adjacent system that does have it.
- Prefer a complete, reviewable workflow over a locally elegant but operationally incomplete one.

## 8. Autonomous Operating Model

This PRD assumes **maximum-capability autonomous work**. The repo should not merely accept tasks; it should research deeply, compare options, reduce uncertainty, ship safely, and learn from every outcome. Autonomy here means higher standards for evidence, reversibility, observability, and knowledge capture—not just faster execution.

### Required research before every material task
1. Read the repo README, this PRD, touched source modules, existing tests, and recent change history before proposing a solution.
1. Trace impact across adjacent UOS repos and shared contracts before changing interfaces, schemas, or runtime behavior.
1. Prefer evidence over assumption: inspect current code paths, add repro cases, and study real failure modes before implementing a fix.
1. Use external official documentation and standards for any upstream dependency, provider API, framework, CLI, or format touched by the task.
1. For non-trivial work, compare at least two approaches and explicitly choose based on reversibility, operational safety, and long-term maintainability.

### Repo-specific decision rules
- Control integrity beats convenience when the tradeoff is real.
- Explainability matters; an opaque anomaly score is not enough.
- Workflow speed is valuable only when it does not hide risk.
- Every finance automation must preserve a clean audit trail.

### Mandatory escalation triggers
- Accounting policy questions, legal/regulatory interpretations, or material financial risk.
- Any workflow that could weaken segregation of duties or traceability.
- Sensitive payment, vendor, or confidentiality issues.

## 9. Continuous Learning Requirements

### Required learning loop after every task
- Every completed task must leave behind at least one durable improvement: a test, benchmark, runbook, migration note, ADR, or automation asset.
- Capture the problem, evidence, decision, outcome, and follow-up questions in repo-local learning memory so the next task starts smarter.
- Promote repeated fixes into reusable abstractions, templates, linters, validators, or code generation rather than solving the same class of issue twice.
- Track confidence and unknowns; unresolved ambiguity becomes a research backlog item, not a silent assumption.
- Prefer instrumented feedback loops: telemetry, evaluation harnesses, fixtures, or replayable traces should be added whenever feasible.

### Repo-specific research agenda
- Which variance drivers most often surprise stakeholders late?
- Where do approval flows create the most avoidable delay?
- Which control exceptions recur and why?
- What anomaly patterns are real risk versus noisy variance?
- How can risk signals be explained in language finance teams will trust?

### Repo-specific memory objects that must stay current
- Variance driver library.
- Approval and control exception archive.
- Risk signal taxonomy.
- Audit trail playbook and evidence patterns.
- Forecast miss retrospective log.

## 10. Core Workflows the Repo Must Master

1. Explaining forecast movement and variance drivers.
1. Routing approvals with clear evidence and traceability.
1. Detecting financial anomalies and prioritizing follow-up.
1. Monitoring control health and exception patterns.
1. Capturing lessons from misses, exceptions, and audits.

## 11. Interfaces and Dependencies

- Paperclip plugin scaffold for worker, manifest, UI, and validation surfaces.

- `@uos/core` for orchestration and workflow state.
- Potential finance, spend, ERP, or risk data connectors.
- `@uos/plugin-operations-cockpit` for health and review visibility.

## 12. Implementation Backlog

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

## 13. Risks and Mitigations

- Risk scoring that looks smart but lacks auditability.
- Approval acceleration weakening control structure.
- Forecasting UX that hides uncertainty.
- High-stakes automation deployed without adequate human review.

## 14. Definition of Done

A task in this repo is only complete when all of the following are true:

- The code, configuration, or skill behavior has been updated with clear intent.
- Tests, evals, replay cases, or validation artifacts were added or updated to protect the changed behavior.
- Documentation, runbooks, or decision records were updated when the behavior, contract, or operating model changed.
- The task produced a durable learning artifact rather than only a code diff.
- Cross-repo consequences were checked wherever this repo touches shared contracts, orchestration, or downstream users.

### Repo-specific completion requirements
- Control, traceability, and explainability requirements are explicit in all new workflows.
- Forecast or anomaly changes include error-analysis thinking, not only model or rule changes.
- Exception learnings are captured in durable playbooks or controls.

## 15. Recommended Repo-Local Knowledge Layout

- `/docs/research/` for research briefs, benchmark notes, and upstream findings.
- `/docs/adrs/` for decision records and contract changes.
- `/docs/lessons/` for task-by-task learning artifacts and postmortems.
- `/evals/` for executable quality checks, golden cases, and regression suites.
- `/playbooks/` for operator runbooks, migration guides, and incident procedures.

# Connector Health Management ADR

## ADR-001: Connector Health Status Integration

**Date**: 2026-04-13  
**Status**: Accepted  
**Package**: @uos/department-finance-risk

## Context

The finance-risk department overlay depends on external connectors (Google Sheets, Stripe, ERP systems) for evidence gathering and workflow execution. When these connectors degrade, department workflows should degrade explicitly rather than failing silently or reporting false healthy status.

## Decision

We implement explicit connector health tracking in the plugin worker using the `ConnectorHealthState` type and `ConnectorHealthSummary` interface. All connector-dependent actions check health status before execution and return structured limitation messages when degradation is detected.

## Implementation

From `connector-health.ts`:
- `createInitialConnectorHealthState()`: Initialize state for all required toolkits
- `updateConnectorHealthState()`: Update status for a specific connector
- `computeDepartmentHealthStatus()`: Derive overall department health
- `generateToolkitLimitations()`: Generate actionable limitation messages
- `formatAllLimitations()`: Format limitations for display
- `performRuntimeHealthCheck()`: Actual health verification via direct connector calls

## Consequences

### Positive
- Department workflows fail explicitly with clear error messages
- Operators can see which connectors are degraded
- Workaround suggestions are provided
- Audit trail captures degradation events

### Negative
- Additional state management complexity
- Health checks add latency to connector operations
- Must maintain connector health check implementations

## Affected Workflows
All connector-dependent actions in `worker.ts`:
- `approval.*` actions requiring evidence from external systems
- `variance.*` actions requiring data from spreadsheets
- `control.*` actions requiring ERP integration

## Review Triggers
- New connector integration added
- Connector API changes
- Department health SLA changes

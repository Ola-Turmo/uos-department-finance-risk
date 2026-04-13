# Control Exception Archive

## Purpose
Tracks recurring control exceptions, their causes, resolutions, and prevention strategies.

## Archive Format
Each entry should document:
- Exception type and severity
- When it occurred and was detected
- Root cause analysis
- Resolution and disposition
- Prevention measures implemented

## Known Recurring Patterns

### 1. Evidence Gap Exceptions
**Category**: evidence-gap  
**Severity**: medium  
**Common Causes**:
- Control executed but documentation not captured at time of execution
- System integrations failing to auto-capture evidence
- Staff turnover or training gaps

**Prevention**:
- Implement mandatory evidence upload before control completion
- Auto-capture from connected systems where possible
- Regular training refreshers

### 2. Timing Violation Exceptions  
**Category**: sla-breach  
**Severity**: high  
**Common Causes**:
- Competing priorities causing delays
- Approval bottlenecks
- System outages preventing timely execution

**Prevention**:
- Automated SLA alerts at 50% and 80% of deadline
- Capacity planning based on historical execution times
- Escalation procedures for at-risk controls

### 3. Segregation Violation Exceptions
**Category**: segregation-violation  
**Severity**: critical  
**Common Causes**:
- Staff shortages requiring emergency overlap
- Insufficient cross-training
- Poor role design

**Prevention**:
- Mandatory segregation checks in control execution workflow
- Emergency delegation procedures with supervisor approval
- Regular access reviews

## Disposition Values
- **accepted**: Exception is documented and accepted with compensating controls
- **waived**: Exception waived due to extraordinary circumstances
- **escalated**: Exception escalated to appropriate authority
- **rejected**: Exception rejected as not valid

## Lessons Learned Capture

After each exception is resolved, capture:
1. What failed?
2. Why did it fail?
3. What was the impact?
4. What was done to resolve?
5. What prevents recurrence?

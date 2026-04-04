/**
 * Connectors Configuration
 * 
 * This module exports the connectors configuration as a TypeScript object
 * to avoid JSON import issues across different module resolution modes.
 */

export const connectorsConfig = {
  requiredToolkits: [
    "googlesheets",
    "gmail",
    "stripe",
    "slack"
  ],
  roleToolkits: [
    {
      roleKey: "finance",
      toolkits: ["googlesheets", "slack"]
    },
    {
      roleKey: "finance-fpa-lead",
      toolkits: ["googlesheets", "stripe", "gmail"]
    },
    {
      roleKey: "finance-reviewer",
      toolkits: ["googlesheets", "stripe"]
    },
    {
      roleKey: "risk-compliance-lead",
      toolkits: ["slack", "gmail"]
    }
  ]
} as const;

export type ConnectorsConfig = typeof connectorsConfig;

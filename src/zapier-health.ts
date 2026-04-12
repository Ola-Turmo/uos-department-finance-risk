/**
 * Zapier-based Connector Health Checks
 *
 * Replaces the Math.random() simulation in performRuntimeHealthCheck()
 * with real Zapier API health checks for available integrations.
 *
 * Available connections:
 *   gmail    → GoogleMailV2CLIAPI  (connection 63153551)
 *   discord  → DiscordCLIAPI       (63153641)
 *   youtube  → YouTubeV4CLIAPI     (63236551)
 *   grok     → App220766CLIAPI     (63153996)
 *   github   → GitHubCLIAPI        (63156867)
 *   others   → no connection → returns { checked: false }
 *
 * Auth failures → status "error" (permanent)
 * Other errors  → status "degraded" (transient)
 */

import { spawn } from "child_process";
import type { ConnectorHealthStatus } from "./connector-health.js";

// ── Connection registry ───────────────────────────────────────────────────
const ZAPIER_CONNECTIONS: Record<string, { app: string; label: string }> = {
  "63153551": { app: "GoogleMailV2CLIAPI",  label: "Gmail" },
  "63153517": { app: "GoogleMailV2CLIAPI",  label: "Gmail (ola.turmo)" },
  "63153572": { app: "GoogleDriveCLIAPI",   label: "GoogleDrive" },
  "63153641": { app: "DiscordCLIAPI",        label: "Discord" },
  "63156867": { app: "GitHubCLIAPI",          label: "GitHub" },
  "63236551": { app: "YouTubeV4CLIAPI",      label: "YouTube" },
  "63153996": { app: "App220766CLIAPI",      label: "Grok" },
  "63153937": { app: "GoogleMakerSuiteCLIAPI", label: "Google AI Studio" },
};

// ── Toolkit → Zapier action mapping ──────────────────────────────────────
const TOOLKIT_ZAPIER_MAP: Record<string, {
  connectionId: string;
  action: string;
  actionType: "read" | "search" | "write";
  params: string;
}> = {
  gmail: {
    connectionId: "63153551",
    action: "message",
    actionType: "search",
    params: '{"query": "in:inbox", "querystring": {"maxResults": 1}}',
  },
  discord: {
    connectionId: "63153641",
    action: "list_text_channels",
    actionType: "read",
    params: "{}",
  },
  youtube: {
    connectionId: "63236551",
    action: "channel_by_user",
    actionType: "read",
    params: '{"username": "outlierai"}',
  },
  grok: {
    connectionId: "63153996",
    action: "list_text_models",
    actionType: "read",
    params: "{}",
  },
  github: {
    connectionId: "63156867",
    action: "organization",
    actionType: "read",
    params: '{"org": "Paperclip-UOS"}',
  },
};

// ── Low-level Zapier spawn ─────────────────────────────────────────────────
function runZapierAction(
  app: string,
  actionType: "read" | "search" | "write",
  action: string,
  connectionId: string,
  params: string
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn("npx", [
      "zapier-sdk", "run-action",
      app, actionType, action,
      "--connection-id", connectionId,
      "--inputs", params,
      "--json",
    ], { timeout: 12_000 });

    let stdout = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });

    proc.on("close", () => {
      try {
        const j = JSON.parse(stdout);
        if (j.errors && j.errors.length > 0) {
          resolve({ ok: false, error: j.errors[0].message });
        } else {
          resolve({ ok: true });
        }
      } catch {
        resolve({ ok: false, error: stdout.trim() || "empty response" });
      }
    });

    proc.on("error", (err) => {
      resolve({ ok: false, error: err.message });
    });

    setTimeout(() => {
      try { proc.kill(); } catch { /* noop */ }
      resolve({ ok: false, error: "Timeout after 12s" });
    }, 12_000);
  });
}

// ── Public API ────────────────────────────────────────────────────────────

export type ZapierHealthResult =
  | { checked: true; status: ConnectorHealthStatus; error?: string }
  | { checked: false; reason: "no_zapier_connection" };

/**
 * Check the health of a single toolkit via Zapier.
 * Returns { checked: false } if no Zapier connection exists for this toolkit,
 * in which case the caller should preserve the existing state.
 */
export async function checkToolkitHealth(
  toolkitId: string
): Promise<ZapierHealthResult> {
  const zapier = TOOLKIT_ZAPIER_MAP[toolkitId];
  if (!zapier) {
    return { checked: false, reason: "no_zapier_connection" };
  }

  const conn = ZAPIER_CONNECTIONS[zapier.connectionId];
  if (!conn) {
    return { checked: false, reason: "no_zapier_connection" };
  }

  const result = await runZapierAction(
    conn.app, zapier.actionType, zapier.action,
    zapier.connectionId, zapier.params
  );

  if (result.ok) {
    return { checked: true, status: "ok" };
  }

  const msg = result.error ?? "Unknown error";
  const isAuthFailure = /auth|credential|token|expired|invalid|forbidden|unauthorized/i.test(msg);
  return {
    checked: true,
    status: isAuthFailure ? "error" : "degraded",
    error: msg,
  };
}

/**
 * Check all listed toolkits in parallel.
 */
export async function checkAllToolkits(
  toolkitIds: string[]
): Promise<Array<{ toolkitId: string; result: ZapierHealthResult }>> {
  return Promise.all(
    toolkitIds.map(async (toolkitId) => ({
      toolkitId,
      result: await checkToolkitHealth(toolkitId),
    }))
  );
}

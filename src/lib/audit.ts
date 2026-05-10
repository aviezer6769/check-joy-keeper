import { supabase } from "@/integrations/supabase/client";

export type AuditAction = "insert" | "update" | "delete";
export type AuditTable = "payees" | "checks" | "accounts" | "chalikah" | "saved_reports";

// Module-level "current page/action" — set by pages on mount, read on every mutation.
let currentSource = "App";

export function setAuditSource(source: string) {
  currentSource = source;
}

export function getAuditSource() {
  return currentSource;
}

/** Run a block with a temporary source override (e.g. "Payees bulk delete"). */
export async function withAuditSource<T>(source: string, fn: () => Promise<T>): Promise<T> {
  const prev = currentSource;
  currentSource = source;
  try {
    return await fn();
  } finally {
    currentSource = prev;
  }
}

const IGNORE_KEYS = new Set(["created_at", "updated_at"]);

/** Compute a diff of changed fields between before / after row objects. */
export function diffRows(
  before: Record<string, any> | null | undefined,
  after: Record<string, any> | null | undefined,
): Record<string, { from: any; to: any }> {
  const changes: Record<string, { from: any; to: any }> = {};
  const keys = new Set<string>([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);
  for (const k of keys) {
    if (IGNORE_KEYS.has(k)) continue;
    const a = before?.[k] ?? null;
    const b = after?.[k] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes[k] = { from: a, to: b };
    }
  }
  return changes;
}

interface LogParams {
  table: AuditTable;
  action: AuditAction;
  recordId?: string | null;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  source?: string;
  summary?: string;
}

/** Insert one audit log entry. Never throws — audit failures must not break UX. */
export async function logAudit(params: LogParams) {
  try {
    let changes: Record<string, any> = {};
    if (params.action === "insert") {
      const after = { ...(params.after || {}) };
      IGNORE_KEYS.forEach((k) => delete after[k]);
      changes = { after };
    } else if (params.action === "delete") {
      const before = { ...(params.before || {}) };
      IGNORE_KEYS.forEach((k) => delete before[k]);
      changes = { before };
    } else {
      changes = diffRows(params.before, params.after);
      if (Object.keys(changes).length === 0) return; // no real change
    }
    await supabase.from("audit_logs").insert({
      table_name: params.table,
      record_id: params.recordId ?? params.after?.id ?? params.before?.id ?? null,
      action: params.action,
      changes,
      source: params.source ?? currentSource,
      summary: params.summary ?? null,
    });
  } catch (e) {
    console.warn("[audit] failed to log:", e);
  }
}

/** Insert many audit log entries in one round-trip. */
export async function logAuditBatch(
  entries: LogParams[],
  defaultSource?: string,
) {
  if (entries.length === 0) return;
  try {
    const rows = entries
      .map((p) => {
        let changes: Record<string, any> = {};
        if (p.action === "insert") {
          const after = { ...(p.after || {}) };
          IGNORE_KEYS.forEach((k) => delete after[k]);
          changes = { after };
        } else if (p.action === "delete") {
          const before = { ...(p.before || {}) };
          IGNORE_KEYS.forEach((k) => delete before[k]);
          changes = { before };
        } else {
          changes = diffRows(p.before, p.after);
          if (Object.keys(changes).length === 0) return null;
        }
        return {
          table_name: p.table,
          record_id: p.recordId ?? p.after?.id ?? p.before?.id ?? null,
          action: p.action,
          changes,
          source: p.source ?? defaultSource ?? currentSource,
          summary: p.summary ?? null,
        };
      })
      .filter(Boolean);
    if (rows.length === 0) return;
    await supabase.from("audit_logs").insert(rows as any);
  } catch (e) {
    console.warn("[audit] batch failed:", e);
  }
}

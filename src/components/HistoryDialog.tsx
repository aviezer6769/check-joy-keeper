import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useRecordHistory } from "@/hooks/useAuditLogs";
import { History } from "lucide-react";

function formatVal(v: any) {
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground italic">empty</span>;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return <code className="text-xs">{JSON.stringify(v)}</code>;
  return String(v);
}

function actionBadge(action: string) {
  if (action === "insert") return <Badge className="bg-success text-success-foreground">Created</Badge>;
  if (action === "delete") return <Badge variant="destructive">Deleted</Badge>;
  return <Badge variant="secondary">Updated</Badge>;
}

interface Props {
  table: string;
  recordId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
}

export function HistoryDialog({ table, recordId, open, onOpenChange, title }: Props) {
  const { data: logs = [], isLoading } = useRecordHistory(table, open ? recordId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History {title ? `— ${title}` : ""}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No history found for this record.</p>
        ) : (
          <div className="space-y-3 pt-2">
            {logs.map((log) => {
              const changes = log.changes || {};
              const isDiff = log.action === "update";
              const snapshotKey = log.action === "insert" ? "after" : log.action === "delete" ? "before" : null;
              const snapshot = snapshotKey ? changes[snapshotKey] : null;
              return (
                <div key={log.id} className="border border-border rounded p-3 text-xs">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {actionBadge(log.action)}
                      {log.source && <span className="text-muted-foreground">{log.source}</span>}
                    </div>
                    <span className="text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  {isDiff ? (
                    <table className="w-full">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="text-left font-medium pb-1 pr-2">Field</th>
                          <th className="text-left font-medium pb-1 pr-2">From</th>
                          <th className="text-left font-medium pb-1">To</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(changes).map(([field, val]: [string, any]) => (
                          <tr key={field} className="border-t border-border/50">
                            <td className="py-1 pr-2 font-mono">{field}</td>
                            <td className="py-1 pr-2">{formatVal(val?.from)}</td>
                            <td className="py-1">{formatVal(val?.to)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : snapshot ? (
                    <pre className="text-xs whitespace-pre-wrap break-words bg-muted/50 p-2 rounded">
                      {JSON.stringify(snapshot, null, 2)}
                    </pre>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { useAuditSource } from "@/hooks/useAuditSource";

const TABLES = ["payees", "checks", "accounts", "chalikah", "saved_reports"];
const ACTIONS = ["insert", "update", "delete"];

function actionBadge(action: string) {
  if (action === "insert") return <Badge className="bg-success text-success-foreground">Created</Badge>;
  if (action === "delete") return <Badge variant="destructive">Deleted</Badge>;
  return <Badge variant="secondary">Updated</Badge>;
}

function summarizeChanges(action: string, changes: any): string {
  if (!changes) return "";
  if (action === "update") {
    const keys = Object.keys(changes);
    if (keys.length === 0) return "no changes";
    if (keys.length <= 3) return keys.join(", ");
    return `${keys.slice(0, 3).join(", ")} +${keys.length - 3} more`;
  }
  const snap = action === "insert" ? changes.after : changes.before;
  if (!snap) return "";
  return snap.payee_name || snap.account_name || snap.name || snap.payee || snap.check_number || "";
}

const AuditLog = () => {
  useAuditSource("Audit Log page");
  const [table, setTable] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: logs = [], isLoading } = useAuditLogs({
    table: table || undefined,
    action: action || undefined,
    search: search || undefined,
    fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
    toDate: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined,
  });

  const clearFilters = () => {
    setTable(""); setAction(""); setSearch(""); setFromDate(""); setToDate("");
  };

  const hasFilters = table || action || search || fromDate || toDate;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
              <p className="text-sm text-muted-foreground">Track every change made to your data</p>
            </div>
          </div>
          <span className="text-sm text-muted-foreground">{logs.length} entries</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search source / record id"
              className="pl-8 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={table || "__all__"} onValueChange={(v) => setTable(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All tables" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All tables</SelectItem>
              {TABLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={action || "__all__"} onValueChange={(v) => setAction(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All actions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All actions</SelectItem>
              {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" className="w-40" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input type="date" className="w-40" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
        </div>

        <div className="border border-border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Time</TableHead>
                <TableHead className="w-28">Action</TableHead>
                <TableHead className="w-32">Table</TableHead>
                <TableHead className="w-48">Source</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead className="w-32">Record ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
              ) : logs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No log entries.</TableCell></TableRow>
              ) : logs.map((log) => {
                const isOpen = expanded === log.id;
                return (
                  <>
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpanded(isOpen ? null : log.id)}
                    >
                      <TableCell className="text-xs whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</TableCell>
                      <TableCell>{actionBadge(log.action)}</TableCell>
                      <TableCell className="text-xs font-mono">{log.table_name}</TableCell>
                      <TableCell className="text-xs">{log.source || "—"}</TableCell>
                      <TableCell className="text-xs truncate max-w-md">{summarizeChanges(log.action, log.changes)}</TableCell>
                      <TableCell className="text-xs font-mono truncate max-w-[140px]">{log.record_id || "—"}</TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={log.id + "-detail"}>
                        <TableCell colSpan={6} className="bg-muted/30">
                          <pre className="text-xs whitespace-pre-wrap break-words p-2">
                            {JSON.stringify(log.changes, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default AuditLog;

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Printer } from "lucide-react";
import { type Check, type CheckStatus } from "@/hooks/useChecks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChalikah } from "@/hooks/useChalikah";

interface ChecksTableProps {
  checks: Check[];
  onEdit: (check: Check) => void;
  onDelete: (id: string) => void;
  onPrint: (check: Check) => void;
  onStatusChange: (check: Check, status: CheckStatus) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ChecksTable({ checks, onEdit, onDelete, onPrint, onStatusChange, selectedIds, onToggleSelect, onToggleAll }: ChecksTableProps) {
  const { data: chalikahList = [] } = useChalikah();
  const chalikahMap = Object.fromEntries(chalikahList.map((c) => [c.id, c.name]));
  const allSelected = checks.length > 0 && checks.every((c) => selectedIds.has(c.id));
  if (checks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">No checks found</p>
        <p className="text-sm">Add your first check to get started.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-10 px-2">
              <Checkbox checked={allSelected} onCheckedChange={onToggleAll} />
            </TableHead>
            <TableHead className="font-semibold">Check #</TableHead>
            <TableHead className="font-semibold">Date</TableHead>
            <TableHead className="font-semibold">Payee</TableHead>
            <TableHead className="font-semibold">Chalikah</TableHead>
            <TableHead className="font-semibold text-right">Amount</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Memo</TableHead>
            <TableHead className="font-semibold">Record #</TableHead>
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {checks.map((check, i) => (
            <TableRow
              key={check.id}
              className={`animate-fade-in ${check.status === "Void" ? "opacity-60" : ""}`}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(check.id)}
                  onCheckedChange={() => onToggleSelect(check.id)}
                />
              </TableCell>
              <TableCell className="font-mono text-sm">{check.check_number || "—"}</TableCell>
              <TableCell className="text-sm">{formatDate(check.check_date)}</TableCell>
              <TableCell className="font-medium">{check.payee}</TableCell>
              <TableCell className="text-sm">{check.chalikah_id ? chalikahMap[check.chalikah_id] || "—" : "—"}</TableCell>
              <TableCell className="text-right font-mono font-medium">
                {check.status === "Void" ? (
                  <span className="line-through text-muted-foreground">
                    {formatCurrency(check.original_amount ?? 0)}
                  </span>
                ) : (
                  formatCurrency(check.amount)
                )}
              </TableCell>
              <TableCell>
                <Select
                  value={check.status}
                  onValueChange={(v) => onStatusChange(check, v as CheckStatus)}
                >
                  <SelectTrigger className="h-7 text-xs w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["Open", "Printed", "Given", "Cleared", "Void"] as const).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-sm max-w-[200px] truncate">{check.memo || "—"}</TableCell>
              <TableCell className="font-mono text-sm">{check.payee_record_number || "—"}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onPrint(check)} title="Print">
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(check)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(check.id)} title="Delete" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

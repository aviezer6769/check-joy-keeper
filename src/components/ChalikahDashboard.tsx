import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import { type Check } from "@/hooks/useChecks";
import { useChalikah } from "@/hooks/useChalikah";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

interface ChalikahDashboardProps {
  checks: Check[];
}

interface ChalikahSummary {
  id: string;
  name: string;
  totalAmount: number;
  checkCount: number;
  givenAmount: number;
  pendingAmount: number;
  voidCount: number;
}

export function ChalikahDashboard({ checks }: ChalikahDashboardProps) {
  const { data: chalikahList = [] } = useChalikah();
  const [expanded, setExpanded] = useState(true);

  const summaries = useMemo(() => {
    const chalikahMap = new Map(chalikahList.map((c) => [c.id, c.name]));
    const map = new Map<string, ChalikahSummary>();

    for (const check of checks) {
      const cId = check.chalikah_id || "__none__";
      const cName = check.chalikah_id ? chalikahMap.get(check.chalikah_id) || "Unknown" : "Uncategorized";

      if (!map.has(cId)) {
        map.set(cId, { id: cId, name: cName, totalAmount: 0, checkCount: 0, givenAmount: 0, pendingAmount: 0, voidCount: 0 });
      }
      const s = map.get(cId)!;
      s.checkCount++;
      if (check.status === "Void") {
        s.voidCount++;
      } else {
        s.totalAmount += Number(check.amount);
        if (check.status === "Given" || check.status === "Cleared") {
          s.givenAmount += Number(check.amount);
        } else {
          s.pendingAmount += Number(check.amount);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [checks, chalikahList]);

  const grandTotal = summaries.reduce((s, c) => s + c.totalAmount, 0);
  const grandGiven = summaries.reduce((s, c) => s + c.givenAmount, 0);
  const grandPending = summaries.reduce((s, c) => s + c.pendingAmount, 0);
  const grandChecks = summaries.reduce((s, c) => s + c.checkCount, 0);

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Totals by Chalikah
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="px-4 pb-4 pt-0">
          <div className="overflow-x-auto rounded border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Chalikah</TableHead>
                  <TableHead className="font-semibold text-right">Checks</TableHead>
                  <TableHead className="font-semibold text-right">Total</TableHead>
                  <TableHead className="font-semibold text-right">Given</TableHead>
                  <TableHead className="font-semibold text-right">Pending</TableHead>
                  <TableHead className="font-semibold text-right">Void</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right font-mono">{s.checkCount}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(s.totalAmount)}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">{formatCurrency(s.givenAmount)}</TableCell>
                    <TableCell className="text-right font-mono text-amber-600">{formatCurrency(s.pendingAmount)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{s.voidCount || "—"}</TableCell>
                  </TableRow>
                ))}
                {summaries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No checks to summarize</TableCell>
                  </TableRow>
                )}
                {summaries.length > 0 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right font-mono">{grandChecks}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(grandTotal)}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">{formatCurrency(grandGiven)}</TableCell>
                    <TableCell className="text-right font-mono text-amber-600">{formatCurrency(grandPending)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {summaries.reduce((s, c) => s + c.voidCount, 0) || "—"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

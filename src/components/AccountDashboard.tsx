import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Landmark } from "lucide-react";
import { type Check } from "@/hooks/useChecks";
import { useAccounts } from "@/hooks/useAccounts";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

interface AccountDashboardProps {
  checks: Check[];
}

interface AccountSummary {
  id: string;
  name: string;
  totalAmount: number;
  checkCount: number;
  givenAmount: number;
  pendingAmount: number;
  voidCount: number;
}

export function AccountDashboard({ checks }: AccountDashboardProps) {
  const { data: accounts = [] } = useAccounts();
  const [expanded, setExpanded] = useState(true);

  const summaries = useMemo(() => {
    const accountMap = new Map(accounts.map((a) => [a.id, a.account_name]));
    const map = new Map<string, AccountSummary>();

    for (const check of checks) {
      const aId = check.account_id || "__none__";
      const aName = check.account_id ? accountMap.get(check.account_id) || "Unknown" : "No Account";

      if (!map.has(aId)) {
        map.set(aId, { id: aId, name: aName, totalAmount: 0, checkCount: 0, givenAmount: 0, pendingAmount: 0, voidCount: 0 });
      }
      const s = map.get(aId)!;
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
  }, [checks, accounts]);

  const grandTotal = summaries.reduce((s, c) => s + c.totalAmount, 0);
  const grandGiven = summaries.reduce((s, c) => s + c.givenAmount, 0);
  const grandPending = summaries.reduce((s, c) => s + c.pendingAmount, 0);
  const grandChecks = summaries.reduce((s, c) => s + c.checkCount, 0);

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            Totals by Account
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
                  <TableHead className="font-semibold">Account</TableHead>
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

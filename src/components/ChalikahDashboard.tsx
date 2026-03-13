import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ChevronRight, BarChart3 } from "lucide-react";
import { type Check } from "@/hooks/useChecks";
import { useChalikah } from "@/hooks/useChalikah";
import { useAccounts } from "@/hooks/useAccounts";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

interface ChalikahDashboardProps {
  checks: Check[];
}

interface AccountBreakdown {
  accountId: string;
  accountName: string;
  totalAmount: number;
  checkCount: number;
  givenAmount: number;
  pendingAmount: number;
  voidCount: number;
}

interface ChalikahSummary {
  id: string;
  name: string;
  totalAmount: number;
  checkCount: number;
  givenAmount: number;
  pendingAmount: number;
  voidCount: number;
  accounts: AccountBreakdown[];
}

export function ChalikahDashboard({ checks }: ChalikahDashboardProps) {
  const { data: chalikahList = [] } = useChalikah();
  const { data: accounts = [] } = useAccounts();
  const [expanded, setExpanded] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const summaries = useMemo(() => {
    const chalikahMap = new Map(chalikahList.map((c) => [c.id, c.name]));
    const accountMap = new Map(accounts.map((a) => [a.id, a.account_name]));
    const map = new Map<string, ChalikahSummary>();

    for (const check of checks) {
      const cId = check.chalikah_id || "__none__";
      const cName = check.chalikah_id ? chalikahMap.get(check.chalikah_id) || "Unknown" : "Uncategorized";

      if (!map.has(cId)) {
        map.set(cId, { id: cId, name: cName, totalAmount: 0, checkCount: 0, givenAmount: 0, pendingAmount: 0, voidCount: 0, accounts: [] });
      }
      const s = map.get(cId)!;
      s.checkCount++;

      const aId = check.account_id || "__none__";
      const aName = check.account_id ? accountMap.get(check.account_id) || "Unknown" : "No Account";
      let acct = s.accounts.find((a) => a.accountId === aId);
      if (!acct) {
        acct = { accountId: aId, accountName: aName, totalAmount: 0, checkCount: 0, givenAmount: 0, pendingAmount: 0, voidCount: 0 };
        s.accounts.push(acct);
      }
      acct.checkCount++;

      if (check.status === "Void") {
        s.voidCount++;
        acct.voidCount++;
      } else {
        const amt = Number(check.amount);
        s.totalAmount += amt;
        acct.totalAmount += amt;
        if (check.status === "Given" || check.status === "Cleared") {
          s.givenAmount += amt;
          acct.givenAmount += amt;
        } else {
          s.pendingAmount += amt;
          acct.pendingAmount += amt;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [checks, chalikahList, accounts]);

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
                {summaries.map((s) => {
                  const isOpen = expandedRows.has(s.id);
                  const hasMultipleAccounts = s.accounts.length > 1;
                  return (
                    <>
                      <TableRow
                        key={s.id}
                        className={hasMultipleAccounts ? "cursor-pointer" : ""}
                        onClick={() => hasMultipleAccounts && toggleRow(s.id)}
                      >
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-1">
                            {hasMultipleAccounts && (
                              <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                            )}
                            {s.name}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">{s.checkCount}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(s.totalAmount)}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{formatCurrency(s.givenAmount)}</TableCell>
                        <TableCell className="text-right font-mono text-amber-600">{formatCurrency(s.pendingAmount)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{s.voidCount || "—"}</TableCell>
                      </TableRow>
                      {isOpen &&
                        s.accounts
                          .sort((a, b) => b.totalAmount - a.totalAmount)
                          .map((acct) => (
                            <TableRow key={`${s.id}-${acct.accountId}`} className="bg-muted/30">
                              <TableCell className="pl-10 text-sm text-muted-foreground">{acct.accountName}</TableCell>
                              <TableCell className="text-right font-mono text-sm text-muted-foreground">{acct.checkCount}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{formatCurrency(acct.totalAmount)}</TableCell>
                              <TableCell className="text-right font-mono text-sm text-green-600">{formatCurrency(acct.givenAmount)}</TableCell>
                              <TableCell className="text-right font-mono text-sm text-amber-600">{formatCurrency(acct.pendingAmount)}</TableCell>
                              <TableCell className="text-right font-mono text-sm text-muted-foreground">{acct.voidCount || "—"}</TableCell>
                            </TableRow>
                          ))}
                    </>
                  );
                })}
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

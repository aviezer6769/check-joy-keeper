import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useChecks, type Check } from "@/hooks/useChecks";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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

interface PayeeSummary {
  payee: string;
  totalAmount: number;
  checkCount: number;
  givenCount: number;
  pendingCount: number;
  lastCheckDate: string;
  recordNumber: string | null;
  checks: Check[];
}

const Payees = () => {
  const { data: checks = [], isLoading } = useChecks();
  const [search, setSearch] = useState("");
  const [expandedPayee, setExpandedPayee] = useState<string | null>(null);

  const payees = useMemo(() => {
    const map = new Map<string, PayeeSummary>();

    for (const check of checks) {
      const key = check.payee;
      const existing = map.get(key);
      if (existing) {
        existing.totalAmount += check.amount;
        existing.checkCount += 1;
        existing.givenCount += check.check_given ? 1 : 0;
        existing.pendingCount += check.check_given ? 0 : 1;
        if (check.check_date > existing.lastCheckDate) {
          existing.lastCheckDate = check.check_date;
        }
        if (!existing.recordNumber && check.payee_record_number) {
          existing.recordNumber = check.payee_record_number;
        }
        existing.checks.push(check);
      } else {
        map.set(key, {
          payee: key,
          totalAmount: check.amount,
          checkCount: 1,
          givenCount: check.check_given ? 1 : 0,
          pendingCount: check.check_given ? 0 : 1,
          lastCheckDate: check.check_date,
          recordNumber: check.payee_record_number,
          checks: [check],
        });
      }
    }

    let result = Array.from(map.values());

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.payee.toLowerCase().includes(q) ||
          (p.recordNumber && p.recordNumber.toLowerCase().includes(q))
      );
    }

    return result.sort((a, b) => a.payee.localeCompare(b.payee));
  }, [checks, search]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Payees</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {payees.length} unique payee{payees.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search payees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
        ) : payees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-lg font-medium">No payees found</p>
            <p className="text-sm">Add checks to see payees here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold w-8"></TableHead>
                  <TableHead className="font-semibold">Payee</TableHead>
                  <TableHead className="font-semibold">Record #</TableHead>
                  <TableHead className="font-semibold text-right">Total Amount</TableHead>
                  <TableHead className="font-semibold text-center">Checks</TableHead>
                  <TableHead className="font-semibold text-center">Given</TableHead>
                  <TableHead className="font-semibold text-center">Pending</TableHead>
                  <TableHead className="font-semibold">Last Check</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payees.map((p) => (
                  <>
                    <TableRow
                      key={p.payee}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedPayee(expandedPayee === p.payee ? null : p.payee)}
                    >
                      <TableCell className="px-2">
                        {expandedPayee === p.payee ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{p.payee}</TableCell>
                      <TableCell className="font-mono text-sm">{p.recordNumber || "—"}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatCurrency(p.totalAmount)}</TableCell>
                      <TableCell className="text-center">{p.checkCount}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="default" className="bg-success text-success-foreground">{p.givenCount}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {p.pendingCount > 0 ? (
                          <Badge variant="secondary">{p.pendingCount}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(p.lastCheckDate)}</TableCell>
                    </TableRow>
                    {expandedPayee === p.payee && (
                      <TableRow key={`${p.payee}-details`}>
                        <TableCell colSpan={8} className="bg-muted/30 p-0">
                          <div className="px-8 py-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Check History</p>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Check #</TableHead>
                                  <TableHead className="text-xs">Date</TableHead>
                                  <TableHead className="text-xs">Charity</TableHead>
                                  <TableHead className="text-xs text-right">Amount</TableHead>
                                  <TableHead className="text-xs">Status</TableHead>
                                  <TableHead className="text-xs">Memo</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {p.checks
                                  .sort((a, b) => b.check_date.localeCompare(a.check_date))
                                  .map((c) => (
                                    <TableRow key={c.id}>
                                      <TableCell className="font-mono text-xs">{c.check_number || "—"}</TableCell>
                                      <TableCell className="text-xs">{formatDate(c.check_date)}</TableCell>
                                      <TableCell className="text-xs">{c.charity || "—"}</TableCell>
                                      <TableCell className="text-right font-mono text-xs">{formatCurrency(c.amount)}</TableCell>
                                      <TableCell>
                                        <Badge variant={c.check_given ? "default" : "secondary"} className={c.check_given ? "bg-success text-success-foreground text-xs" : "text-xs"}>
                                          {c.check_given ? "Given" : "Pending"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-xs max-w-[200px] truncate">{c.memo || "—"}</TableCell>
                                    </TableRow>
                                  ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
};

export default Payees;

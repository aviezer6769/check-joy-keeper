import { useState } from "react";
import { Link } from "react-router-dom";
import { usePayees, type Payee } from "@/hooks/usePayees";
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

const Payees = () => {
  const { data: payees = [], isLoading } = usePayees();
  const { data: checks = [] } = useChecks();
  const [search, setSearch] = useState("");
  const [expandedPayee, setExpandedPayee] = useState<string | null>(null);

  // Build a map of checks by payee name for the expanded detail view
  const checksByPayee = checks.reduce<Record<string, Check[]>>((acc, c) => {
    (acc[c.payee] ??= []).push(c);
    return acc;
  }, {});

  const filtered = search
    ? payees.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.payee_name.toLowerCase().includes(q) ||
          p.record_id?.toLowerCase().includes(q) ||
          p.first_name?.toLowerCase().includes(q) ||
          p.last_name?.toLowerCase().includes(q) ||
          p.first_name_yiddish?.toLowerCase().includes(q) ||
          p.last_name_yiddish?.toLowerCase().includes(q)
        );
      })
    : payees;

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
                  {filtered.length} payee{filtered.length !== 1 ? "s" : ""}
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
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-lg font-medium">No payees found</p>
            <p className="text-sm">Add payees to see them here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold w-8"></TableHead>
                  <TableHead className="font-semibold">Record ID</TableHead>
                  <TableHead className="font-semibold">Sort</TableHead>
                  <TableHead className="font-semibold">Urgent</TableHead>
                  <TableHead className="font-semibold">טיטל 1</TableHead>
                  <TableHead className="font-semibold">ערשטע נאמען</TableHead>
                  <TableHead className="font-semibold">מיטעלסטע</TableHead>
                  <TableHead className="font-semibold">לעצטע</TableHead>
                  <TableHead className="font-semibold">טיטל 2</TableHead>
                  <TableHead className="font-semibold">Title</TableHead>
                  <TableHead className="font-semibold">TitleToUse</TableHead>
                  <TableHead className="font-semibold">First Name</TableHead>
                  <TableHead className="font-semibold">Middle</TableHead>
                  <TableHead className="font-semibold">Last Name</TableHead>
                  <TableHead className="font-semibold">St #</TableHead>
                  <TableHead className="font-semibold">Street</TableHead>
                  <TableHead className="font-semibold">Apt</TableHead>
                  <TableHead className="font-semibold">City</TableHead>
                  <TableHead className="font-semibold">State</TableHead>
                  <TableHead className="font-semibold">Zip</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const payeeChecks = checksByPayee[p.payee_name] || [];
                  return (
                    <>
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedPayee(expandedPayee === p.id ? null : p.id)}
                      >
                        <TableCell className="px-2">
                          {expandedPayee === p.id ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{p.record_id || "—"}</TableCell>
                        <TableCell className="text-center">{p.sort_order}</TableCell>
                        <TableCell className="text-center">
                          {p.urgent_level > 0 ? (
                            <Badge variant="destructive">{p.urgent_level}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell dir="rtl">{p.title_1_yiddish || "—"}</TableCell>
                        <TableCell dir="rtl">{p.first_name_yiddish || "—"}</TableCell>
                        <TableCell dir="rtl">{p.middle_name_yiddish || "—"}</TableCell>
                        <TableCell dir="rtl">{p.last_name_yiddish || "—"}</TableCell>
                        <TableCell dir="rtl">{p.title_2_yiddish || "—"}</TableCell>
                        <TableCell>{p.title || "—"}</TableCell>
                        <TableCell>{p.title_to_use || "—"}</TableCell>
                        <TableCell>{p.first_name || "—"}</TableCell>
                        <TableCell>{p.middle_name || "—"}</TableCell>
                        <TableCell>{p.last_name || "—"}</TableCell>
                        <TableCell>{p.street_no || "—"}</TableCell>
                        <TableCell>{p.street_name || "—"}</TableCell>
                        <TableCell>{p.apt || "—"}</TableCell>
                        <TableCell>{p.city || "—"}</TableCell>
                        <TableCell>{p.state || "—"}</TableCell>
                        <TableCell>{p.zip || "—"}</TableCell>
                      </TableRow>
                      {expandedPayee === p.id && (
                        <TableRow key={`${p.id}-details`}>
                          <TableCell colSpan={20} className="bg-muted/30 p-0">
                            <div className="px-8 py-3">
                              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                                Check History for {p.payee_name}
                              </p>
                              {payeeChecks.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">No checks found for this payee.</p>
                              ) : (
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
                                    {payeeChecks
                                      .sort((a, b) => b.check_date.localeCompare(a.check_date))
                                      .map((c) => (
                                        <TableRow key={c.id}>
                                          <TableCell className="font-mono text-xs">{c.check_number || "—"}</TableCell>
                                          <TableCell className="text-xs">{formatDate(c.check_date)}</TableCell>
                                          <TableCell className="text-xs">{c.charity || "—"}</TableCell>
                                          <TableCell className="text-right font-mono text-xs">{formatCurrency(c.amount)}</TableCell>
                                          <TableCell>
                                            <Badge
                                              variant={c.check_given ? "default" : "secondary"}
                                              className={c.check_given ? "bg-success text-success-foreground text-xs" : "text-xs"}
                                            >
                                              {c.check_given ? "Given" : "Pending"}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="text-xs max-w-[200px] truncate">{c.memo || "—"}</TableCell>
                                        </TableRow>
                                      ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
};

export default Payees;

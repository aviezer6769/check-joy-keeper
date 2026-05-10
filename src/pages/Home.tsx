import { Link } from "react-router-dom";
import { CheckSquare, Users, FolderKanban, FileText, LayoutDashboard, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChecks } from "@/hooks/useChecks";
import { useMemo } from "react";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const sections = [
  { to: "/checks", title: "Checks", desc: "Create, print and track checks", icon: CheckSquare },
  { to: "/payees", title: "Payees", desc: "Manage payees and addresses", icon: Users },
  { to: "/chalikah", title: "Chalikah", desc: "Categorize check campaigns", icon: FolderKanban },
  { to: "/reports", title: "Reports", desc: "Payee × Chalikah matrix and saved reports", icon: FileText },
  { to: "/dashboard", title: "Dashboard", desc: "Totals across all accounts", icon: LayoutDashboard },
  { to: "/audit", title: "Audit Log", desc: "Review all data changes", icon: History },
];

const Home = () => {
  const { data: checks = [], isLoading } = useChecks(undefined, undefined);

  const stats = useMemo(() => {
    let open = 0, printed = 0, given = 0, cleared = 0, voidCount = 0;
    let totalAmount = 0, pendingAmount = 0, issuedAmount = 0;
    checks.forEach((c) => {
      totalAmount += Number(c.amount) || 0;
      if (c.status === "Open") { open++; pendingAmount += Number(c.amount) || 0; }
      else if (c.status === "Printed") { printed++; pendingAmount += Number(c.amount) || 0; }
      else if (c.status === "Given") { given++; issuedAmount += Number(c.amount) || 0; }
      else if (c.status === "Cleared") { cleared++; issuedAmount += Number(c.amount) || 0; }
      else if (c.status === "Void") { voidCount++; }
    });
    return { open, printed, given, cleared, voidCount, totalAmount, pendingAmount, issuedAmount, count: checks.length };
  }, [checks]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-6">
          <h1 className="text-2xl font-bold tracking-tight">Home</h1>
          <p className="text-sm text-muted-foreground mt-1">Choose a section to get started</p>
        </div>
      </header>

      <main className="container py-6 space-y-8">
        {/* Quick stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Checks</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{isLoading ? "—" : stats.count}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending (Open + Printed)</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "—" : fmt(stats.pendingAmount)}</div>
              <div className="text-xs text-muted-foreground mt-1">{stats.open} open · {stats.printed} printed</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Issued (Given + Cleared)</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "—" : fmt(stats.issuedAmount)}</div>
              <div className="text-xs text-muted-foreground mt-1">{stats.given} given · {stats.cleared} cleared</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Grand Total</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "—" : fmt(stats.totalAmount)}</div>
              <div className="text-xs text-muted-foreground mt-1">{stats.voidCount} void</div>
            </CardContent>
          </Card>
        </section>

        {/* Navigation tiles */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.to} to={s.to} className="group">
                <Card className="h-full transition-colors hover:border-primary hover:bg-muted/30">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                    <div className="rounded-md bg-primary/10 text-primary p-2 group-hover:bg-primary/20">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">{s.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{s.desc}</CardContent>
                </Card>
              </Link>
            );
          })}
        </section>
      </main>
    </div>
  );
};

export default Home;

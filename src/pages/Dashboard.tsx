import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useChecks } from "@/hooks/useChecks";
import { ChalikahDashboard } from "@/components/ChalikahDashboard";
import { AccountDashboard } from "@/components/AccountDashboard";
import { StatsCards } from "@/components/StatsCards";

const Dashboard = () => {
  const { data: checks = [], isLoading } = useChecks(undefined, undefined);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">Totals across all accounts</p>
            </div>
            <Link to="/">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
        ) : (
          <>
            <StatsCards checks={checks} />
            <AccountDashboard checks={checks} />
            <ChalikahDashboard checks={checks} />
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;

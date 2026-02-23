import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, FileText, CheckCircle, Clock } from "lucide-react";
import { type Check } from "@/hooks/useChecks";

interface StatsCardsProps {
  checks: Check[];
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function StatsCards({ checks }: StatsCardsProps) {
  const totalAmount = checks.reduce((sum, c) => sum + Number(c.amount), 0);
  const givenCount = checks.filter((c) => c.check_given).length;
  const pendingCount = checks.filter((c) => !c.check_given).length;

  const stats = [
    { label: "Total Checks", value: checks.length.toString(), icon: FileText, color: "text-primary" },
    { label: "Total Amount", value: formatCurrency(totalAmount), icon: DollarSign, color: "text-primary" },
    { label: "Given", value: givenCount.toString(), icon: CheckCircle, color: "text-success" },
    { label: "Pending", value: pendingCount.toString(), icon: Clock, color: "text-accent" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="animate-fade-in">
          <CardContent className="p-4 flex items-center gap-3">
            <stat.icon className={`h-8 w-8 ${stat.color} shrink-0`} />
            <div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-xl font-bold">{stat.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

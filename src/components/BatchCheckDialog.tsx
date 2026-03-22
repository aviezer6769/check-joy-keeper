import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChalikah } from "@/hooks/useChalikah";
import { useAccounts } from "@/hooks/useAccounts";
import { useChecks, type CheckInsert } from "@/hooks/useChecks";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { type Payee } from "@/hooks/usePayees";

interface BatchCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payees: Payee[];
  onDone: () => void;
}

export function BatchCheckDialog({ open, onOpenChange, payees, onDone }: BatchCheckDialogProps) {
  const { data: chalikahList = [] } = useChalikah();
  const { data: accounts = [] } = useAccounts();
  const [accountId, setAccountId] = useState<string>("");
  const { data: existingChecks = [] } = useChecks(undefined, accountId || undefined);
  const qc = useQueryClient();

  const [amount, setAmount] = useState("");
  const [checkDate, setCheckDate] = useState(new Date().toISOString().split("T")[0]);
  const [chalikahId, setChalikahId] = useState<string>("__none__");
  const [runNo, setRunNo] = useState("");
  const [autoCheckNumbers, setAutoCheckNumbers] = useState(true);
  const [manualStartNumber, setManualStartNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const nextCheckNumber = useMemo(() => {
    const nums = existingChecks
      .map((c) => parseInt(c.check_number || "", 10))
      .filter((n) => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
  }, [existingChecks]);

  // Default to first account
  const effectiveAccountId = accountId || accounts[0]?.id || "";

  const handleSubmit = async () => {
    if (!effectiveAccountId) {
      toast.error("Please select an account");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setSubmitting(true);
    const startNum = manualStartNumber ? parseInt(manualStartNumber, 10) : nextCheckNumber;
    const checks: CheckInsert[] = payees.map((p, i) => ({
      payee: p.payee_name,
      amount: parseFloat(amount),
      check_number: autoCheckNumbers ? String(startNum + i) : null,
      check_date: checkDate,
      chalikah_id: chalikahId === "__none__" ? null : chalikahId,
      status: "Open" as const,
      memo: null,
      payee_record_number: p.record_id || null,
      given_to_payee: null,
      given_to_record_number: null,
      run_no: runNo || null,
      account_id: effectiveAccountId,
    }));

    const { error } = await supabase.from("checks").insert(checks);
    setSubmitting(false);

    if (error) {
      toast.error("Failed to create checks: " + error.message);
    } else {
      toast.success(`Created ${checks.length} check(s)`);
      qc.invalidateQueries({ queryKey: ["checks"] });
      onOpenChange(false);
      onDone();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Checks for {payees.length} Payee{payees.length !== 1 ? "s" : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto border border-border rounded p-2">
            {payees.map((p) => (
              <div key={p.id} className="flex justify-between text-xs py-0.5">
                <span>{p.payee_name}</span>
                <span className="text-muted-foreground font-mono">{p.record_id || "—"}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Account</Label>
              <Select value={effectiveAccountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} />
            </div>
            <div>
              <Label>Chalikah</Label>
              <Select value={chalikahId} onValueChange={setChalikahId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {chalikahList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Run No.</Label>
              <Input value={runNo} onChange={(e) => setRunNo(e.target.value)} placeholder="Optional" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={autoCheckNumbers} onChange={(e) => setAutoCheckNumbers(e.target.checked)} className="rounded" />
                Auto Check # (from {nextCheckNumber})
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creating..." : `Create ${payees.length} Check(s)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

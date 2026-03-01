import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Check, type CheckInsert } from "@/hooks/useChecks";

interface CheckFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (check: CheckInsert) => void;
  initialData?: Check | null;
  isPending?: boolean;
}

export function CheckForm({ open, onOpenChange, onSubmit, initialData, isPending }: CheckFormProps) {
  const [payee, setPayee] = useState(initialData?.payee ?? "");
  const [amount, setAmount] = useState(initialData?.amount?.toString() ?? "");
  const [checkNumber, setCheckNumber] = useState(initialData?.check_number ?? "");
  const [checkDate, setCheckDate] = useState(initialData?.check_date ?? new Date().toISOString().split("T")[0]);
  const [charity, setCharity] = useState(initialData?.charity ?? "");
  const [checkGiven, setCheckGiven] = useState(initialData?.check_given ?? false);
  const [memo, setMemo] = useState(initialData?.memo ?? "");
  const [payeeRecordNumber, setPayeeRecordNumber] = useState(initialData?.payee_record_number ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      payee,
      amount: parseFloat(amount) || 0,
      check_number: checkNumber || null,
      check_date: checkDate,
      charity: charity || null,
      check_given: checkGiven,
      memo: memo || null,
      payee_record_number: payeeRecordNumber || null,
      account_id: initialData?.account_id ?? null,
    });
    if (!initialData) {
      setPayee("");
      setAmount("");
      setCheckNumber("");
      setCheckDate(new Date().toISOString().split("T")[0]);
      setCharity("");
      setCheckGiven(false);
      setMemo("");
      setPayeeRecordNumber("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {initialData ? "Edit Check" : "New Check"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payee">Payee *</Label>
              <Input id="payee" value={payee} onChange={(e) => setPayee(e.target.value)} required placeholder="Recipient name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input id="amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkNumber">Check #</Label>
              <Input id="checkNumber" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} placeholder="Check number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkDate">Date *</Label>
              <Input id="checkDate" type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="charity">Charity</Label>
              <Input id="charity" value={charity} onChange={(e) => setCharity(e.target.value)} placeholder="Charity name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payeeRecord">Payee Record #</Label>
              <Input id="payeeRecord" value={payeeRecordNumber} onChange={(e) => setPayeeRecordNumber(e.target.value)} placeholder="Record number" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="memo">Memo</Label>
            <Textarea id="memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Purpose or notes" rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="checkGiven" checked={checkGiven} onCheckedChange={(v) => setCheckGiven(v === true)} />
            <Label htmlFor="checkGiven" className="cursor-pointer">Check has been given</Label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : initialData ? "Update" : "Add Check"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

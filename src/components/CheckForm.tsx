import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Check, type CheckInsert } from "@/hooks/useChecks";
import { usePayees, type Payee } from "@/hooks/usePayees";
import { useChalikah, useAddChalikah } from "@/hooks/useChalikah";
import { buildPayeeName } from "@/lib/payee-utils";
import { Search, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function buildYiddishName(p: Payee) {
  return [p.title_1_yiddish, p.first_name_yiddish, p.middle_name_yiddish, p.last_name_yiddish, p.title_2_yiddish]
    .filter(Boolean)
    .join(" ");
}

function buildAddress(p: Payee) {
  return [
    [p.street_no, p.street_name].filter(Boolean).join(" "),
    p.apt ? `#${p.apt}` : "",
    [p.city, p.state].filter(Boolean).join(", "),
    p.zip,
  ].filter(Boolean).join(", ");
}

interface CheckFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (check: CheckInsert) => void;
  initialData?: Check | null;
  isPending?: boolean;
  existingChecks?: Check[];
}

export function CheckForm({ open, onOpenChange, onSubmit, initialData, isPending, existingChecks = [] }: CheckFormProps) {
  const { data: payees = [] } = usePayees();
  const { data: chalikahList = [] } = useChalikah();
  const addChalikah = useAddChalikah();

  // Compute next check number from existing checks
  const nextCheckNumber = (() => {
    if (initialData) return initialData.check_number ?? "";
    const nums = existingChecks
      .map((c) => parseInt(c.check_number || "", 10))
      .filter((n) => !isNaN(n));
    return nums.length > 0 ? String(Math.max(...nums) + 1) : "";
  })();

  const [payee, setPayee] = useState(initialData?.payee ?? "");
  const [amount, setAmount] = useState(initialData?.amount?.toString() ?? "");
  const [checkNumber, setCheckNumber] = useState(nextCheckNumber);
  const [checkDate, setCheckDate] = useState(initialData?.check_date ?? new Date().toISOString().split("T")[0]);
  const [checkGiven, setCheckGiven] = useState(initialData?.check_given ?? false);
  const [memo, setMemo] = useState(initialData?.memo ?? "");
  const [chalikahId, setChalikahId] = useState(initialData?.chalikah_id ?? "");
  const [newChalikahName, setNewChalikahName] = useState("");
  const [payeeRecordNumber, setPayeeRecordNumber] = useState(initialData?.payee_record_number ?? "");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPayee, setSelectedPayee] = useState<Payee | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter payees based on search
  const filteredPayees = searchQuery.trim()
    ? payees.filter((p) => {
        const q = searchQuery.toLowerCase();
        const yiddish = buildYiddishName(p).toLowerCase();
        const payeeName = buildPayeeName(p).toLowerCase();
        const address = buildAddress(p).toLowerCase();
        return (
          p.record_id?.toLowerCase().includes(q) ||
          yiddish.includes(q) ||
          payeeName.includes(q) ||
          address.includes(q) ||
          p.payee_name.toLowerCase().includes(q)
        );
      })
    : [];

  const selectPayee = (p: Payee) => {
    setSelectedPayee(p);
    setPayee(p.payee_name);
    setPayeeRecordNumber(p.record_id || "");
    setSearchQuery(p.payee_name);
    setShowDropdown(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      payee,
      amount: parseFloat(amount) || 0,
      check_number: checkNumber || null,
      check_date: checkDate,
      chalikah_id: chalikahId || null,
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
      setChalikahId("");
      setCheckGiven(false);
      setMemo("");
      setPayeeRecordNumber("");
      setSearchQuery("");
      setSelectedPayee(null);
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
          {/* Payee search */}
          <div className="space-y-2 relative" ref={dropdownRef}>
            <Label>Search Payee</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                  if (!e.target.value.trim()) {
                    setSelectedPayee(null);
                    setPayee("");
                    setPayeeRecordNumber("");
                  }
                }}
                onFocus={() => searchQuery.trim() && setShowDropdown(true)}
                placeholder="Search by name, record ID, Yiddish name, or address..."
                className="pl-9"
              />
            </div>
            {showDropdown && filteredPayees.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredPayees.slice(0, 20).map((p) => {
                  const yiddish = buildYiddishName(p);
                  const address = buildAddress(p);
                  return (
                    <div
                      key={p.id}
                      className="px-3 py-2 hover:bg-accent cursor-pointer border-b border-border last:border-b-0"
                      onClick={() => selectPayee(p)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{p.payee_name}</span>
                        {p.record_id && (
                          <span className="text-xs font-mono text-muted-foreground">{p.record_id}</span>
                        )}
                      </div>
                      {yiddish && <p className="text-xs text-muted-foreground" dir="rtl">{yiddish}</p>}
                      {address && <p className="text-xs text-muted-foreground">{address}</p>}
                    </div>
                  );
                })}
              </div>
            )}
            {showDropdown && searchQuery.trim() && filteredPayees.length === 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg px-3 py-2 text-sm text-muted-foreground">
                No payees found
              </div>
            )}
          </div>

          {/* Selected payee info */}
          {selectedPayee && (
            <div className="bg-muted/50 rounded-md px-3 py-2 text-sm space-y-0.5">
              <p><span className="text-muted-foreground">Payee:</span> {selectedPayee.payee_name}</p>
              {selectedPayee.record_id && <p><span className="text-muted-foreground">Record #:</span> {selectedPayee.record_id}</p>}
              {buildAddress(selectedPayee) && <p><span className="text-muted-foreground">Address:</span> {buildAddress(selectedPayee)}</p>}
            </div>
          )}

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
              <Label>Chalikah</Label>
              <div className="flex gap-2">
                <Select value={chalikahId} onValueChange={setChalikahId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select chalikah..." />
                  </SelectTrigger>
                  <SelectContent>
                    {chalikahList.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {chalikahId && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setChalikahId("")} title="Clear">
                    ×
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Add New Chalikah</Label>
              <div className="flex gap-2">
                <Input
                  value={newChalikahName}
                  onChange={(e) => setNewChalikahName(e.target.value)}
                  placeholder="New chalikah name..."
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!newChalikahName.trim() || addChalikah.isPending}
                  onClick={() => {
                    addChalikah.mutate(newChalikahName.trim(), {
                      onSuccess: (data) => {
                        setChalikahId(data.id);
                        setNewChalikahName("");
                      },
                    });
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
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

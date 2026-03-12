import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAccounts, useUpdateAccount, type Account } from "@/hooks/useAccounts";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Settings, Plus, Trash2, ChevronDown, ChevronRight, Save } from "lucide-react";

interface AccountDetailProps {
  account: Account;
  onSave: (id: string, data: Partial<Account>) => void;
  saving: boolean;
}

function AccountDetail({ account, onSave, saving }: AccountDetailProps) {
  const [form, setForm] = useState({
    account_name: account.account_name,
    bank_name: account.bank_name || "",
    account_number: account.account_number || "",
    routing_number: account.routing_number || "",
    payer_name: account.payer_name || "",
    payer_address: account.payer_address || "",
    payer_city: account.payer_city || "",
    payer_state: account.payer_state || "",
    payer_zip: account.payer_zip || "",
    payer_phone: account.payer_phone || "",
    payer_name_yiddish: account.payer_name_yiddish || "",
  });

  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const handleSave = () => {
    onSave(account.id, {
      account_name: form.account_name.trim() || account.account_name,
      bank_name: form.bank_name || null,
      account_number: form.account_number || null,
      routing_number: form.routing_number || null,
      payer_name: form.payer_name || null,
      payer_address: form.payer_address || null,
      payer_city: form.payer_city || null,
      payer_state: form.payer_state || null,
      payer_zip: form.payer_zip || null,
      payer_phone: form.payer_phone || null,
      payer_name_yiddish: form.payer_name_yiddish || null,
    });
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">Account Name</Label>
          <Input value={form.account_name} onChange={(e) => set("account_name", e.target.value)} className="h-8 text-sm" />
        </div>
      </div>

      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bank Details</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Bank Name</Label>
          <Input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} className="h-8 text-sm" placeholder="Bank name" />
        </div>
        <div>
          <Label className="text-xs">Account Number</Label>
          <Input value={form.account_number} onChange={(e) => set("account_number", e.target.value)} className="h-8 text-sm" placeholder="Account #" />
        </div>
        <div>
          <Label className="text-xs">Routing Number</Label>
          <Input value={form.routing_number} onChange={(e) => set("routing_number", e.target.value)} className="h-8 text-sm" placeholder="Routing #" />
        </div>
      </div>

      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payer Details</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">Payer Name</Label>
          <Input value={form.payer_name} onChange={(e) => set("payer_name", e.target.value)} className="h-8 text-sm" placeholder="Name on checks" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Payer Name (Yiddish)</Label>
          <Input value={form.payer_name_yiddish} onChange={(e) => set("payer_name_yiddish", e.target.value)} className="h-8 text-sm" placeholder="אידישער נאמען" dir="rtl" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Address</Label>
          <Input value={form.payer_address} onChange={(e) => set("payer_address", e.target.value)} className="h-8 text-sm" placeholder="Street address" />
        </div>
        <div>
          <Label className="text-xs">City</Label>
          <Input value={form.payer_city} onChange={(e) => set("payer_city", e.target.value)} className="h-8 text-sm" placeholder="City" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">State</Label>
            <Input value={form.payer_state} onChange={(e) => set("payer_state", e.target.value)} className="h-8 text-sm" placeholder="ST" />
          </div>
          <div>
            <Label className="text-xs">Zip</Label>
            <Input value={form.payer_zip} onChange={(e) => set("payer_zip", e.target.value)} className="h-8 text-sm" placeholder="Zip" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Phone</Label>
          <Input value={form.payer_phone} onChange={(e) => set("payer_phone", e.target.value)} className="h-8 text-sm" placeholder="Phone" />
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> Save
        </Button>
      </div>
    </div>
  );
}

export function AccountManager() {
  const { data: accounts = [] } = useAccounts();
  const updateAccount = useUpdateAccount();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("accounts").insert({ account_name: newName.trim() });
    setAdding(false);
    if (error) {
      toast.error("Failed to add account: " + error.message);
    } else {
      toast.success("Account added");
      setNewName("");
      qc.invalidateQueries({ queryKey: ["accounts"] });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? All checks in this account will lose their account assignment.`)) return;
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete: " + error.message);
    } else {
      toast.success("Account deleted");
      qc.invalidateQueries({ queryKey: ["accounts"] });
    }
  };

  const handleSave = (id: string, data: Partial<Account>) => {
    updateAccount.mutate({ id, ...data });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Accounts</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          {accounts.map((a) => (
            <div key={a.id} className="border border-border rounded-lg">
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
              >
                {expandedId === a.id ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="flex-1 text-sm font-medium">{a.account_name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive shrink-0"
                  onClick={(e) => { e.stopPropagation(); handleDelete(a.id, a.account_name); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {expandedId === a.id && (
                <div className="px-3 pb-3">
                  <AccountDetail account={a} onSave={handleSave} saving={updateAccount.isPending} />
                </div>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New account name"
              className="h-9 flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button size="sm" onClick={handleAdd} disabled={adding || !newName.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

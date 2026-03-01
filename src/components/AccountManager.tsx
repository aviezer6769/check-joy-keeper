import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccounts, useUpdateAccount, type Account } from "@/hooks/useAccounts";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Settings, Plus, Trash2, Pencil, Check, X } from "lucide-react";

export function AccountManager() {
  const { data: accounts = [] } = useAccounts();
  const updateAccount = useUpdateAccount();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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

  const startEdit = (account: Account) => {
    setEditingId(account.id);
    setEditName(account.account_name);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateAccount.mutate({ id: editingId, account_name: editName.trim() });
    setEditingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Accounts</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              {editingId === a.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-9 flex-1"
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={saveEdit}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{a.account_name}</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(a)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(a.id, a.account_name)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
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

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddPayee, usePayees, type PayeeInsert } from "@/hooks/usePayees";
import { Plus } from "lucide-react";
import { buildPayeeName } from "@/lib/payee-utils";
import { FieldSuggestInput } from "@/components/FieldSuggestInput";
import { Textarea } from "@/components/ui/textarea";

const EMPTY_PAYEE: PayeeInsert = {
  payee_name: "",
  is_active: true,
  record_id: null,
  sort_order: 0,
  urgent_level: 0,
  title_1_yiddish: null,
  first_name_yiddish: null,
  middle_name_yiddish: null,
  last_name_yiddish: null,
  title_2_yiddish: null,
  title: null,
  title_to_use: null,
  first_name: null,
  middle_name: null,
  last_name: null,
  street_no: null,
  street_name: null,
  apt: null,
  city: null,
  state: null,
  zip: null,
  memo: null,
};

interface FieldDef {
  key: keyof PayeeInsert;
  label: string;
  dir?: "rtl";
  type?: "number";
}

const FIELDS: FieldDef[] = [
  { key: "record_id", label: "Record ID" },
  { key: "sort_order", label: "Sort Order", type: "number" },
  { key: "urgent_level", label: "Urgent Level", type: "number" },
  { key: "title_1_yiddish", label: "טיטל 1", dir: "rtl" },
  { key: "first_name_yiddish", label: "ערשטע נאמען", dir: "rtl" },
  { key: "middle_name_yiddish", label: "מיטעלסטע", dir: "rtl" },
  { key: "last_name_yiddish", label: "לעצטע", dir: "rtl" },
  { key: "title_2_yiddish", label: "טיטל 2", dir: "rtl" },
  { key: "title", label: "Title" },
  { key: "title_to_use", label: "TitleToUse" },
  { key: "first_name", label: "First Name" },
  { key: "middle_name", label: "Middle Name" },
  { key: "last_name", label: "Last Name" },
  { key: "street_no", label: "Street #" },
  { key: "street_name", label: "Street Name" },
  { key: "apt", label: "Apt" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "Zip" },
  { key: "memo", label: "Memo" },
];

export function PayeeForm() {
  const [open, setOpen] = useState(false);
  const addPayee = useAddPayee();
  const { data: allPayees = [] } = usePayees();

  const nextRecordId = useMemo(() => {
    const nums = allPayees.map((p) => parseInt(p.record_id || "", 10)).filter((n) => !isNaN(n));
    return nums.length > 0 ? String(Math.max(...nums) + 1) : "1";
  }, [allPayees]);

  const [form, setForm] = useState<PayeeInsert>({ ...EMPTY_PAYEE, record_id: nextRecordId });

  const suggestionsByField = useMemo(() => {
    const map: Record<string, string[]> = {};
    FIELDS.forEach((f) => {
      if (f.type !== "number") {
        map[f.key] = allPayees.map((p) => (p as any)[f.key]).filter(Boolean) as string[];
      }
    });
    return map;
  }, [allPayees]);

  const handleChange = (key: keyof PayeeInsert, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: key === "sort_order" || key === "urgent_level" ? Number(value) || 0 : value || null,
    }));
  };

  const computedName = buildPayeeName(form);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!computedName) return;
    addPayee.mutate(
      { ...form, payee_name: computedName },
      {
        onSuccess: () => {
          setForm({ ...EMPTY_PAYEE, record_id: String(parseInt(nextRecordId) + 1) });
          setOpen(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (v) setForm((prev) => ({ ...prev, record_id: prev.record_id || nextRecordId }));
      setOpen(v);
    }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Payee
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Payee</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 pt-2">
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">Payee Name (auto-generated)</Label>
            <Input value={computedName} readOnly disabled className="bg-muted" />
          </div>
          {FIELDS.map((f) => (
            <div key={f.key} className={f.key === "memo" ? "col-span-2" : ""}>
              <Label className="text-xs mb-1 block" dir={f.dir}>
                {f.label}
              </Label>
              {f.key === "memo" ? (
                <Textarea
                  value={(form[f.key] as string) ?? ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  placeholder={f.label}
                  className="min-h-[60px]"
                />
              ) : f.type === "number" ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={form[f.key] === null ? "" : ((form[f.key] as number) ?? 0)}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    placeholder={form[f.key] === null && f.key === "urgent_level" ? "?" : f.label}
                    disabled={form[f.key] === null && f.key === "urgent_level"}
                  />
                  {f.key === "urgent_level" && (
                    <Button
                      type="button"
                      size="sm"
                      variant={form[f.key] === null ? "default" : "outline"}
                      className="h-9 px-2 text-xs shrink-0"
                      onClick={() => setForm((prev) => ({ ...prev, [f.key]: prev[f.key] === null ? 0 : null }))}
                    >
                      ?
                    </Button>
                  )}
                </div>
              ) : (
                <FieldSuggestInput
                  dir={f.dir}
                  value={(form[f.key] as string) ?? ""}
                  onChange={(v) => handleChange(f.key, v)}
                  suggestions={suggestionsByField[f.key] || []}
                  placeholder={f.label}
                />
              )}
            </div>
          ))}
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addPayee.isPending}>
              {addPayee.isPending ? "Adding..." : "Add Payee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { type Check } from "@/hooks/useChecks";

interface CheckPrintViewProps {
  check: Check;
}

function numberToWords(num: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  if (num === 0) return "Zero";

  const dollars = Math.floor(num);
  const cents = Math.round((num - dollars) * 100);

  let words = "";
  if (dollars >= 1000) {
    words += ones[Math.floor(dollars / 1000)] + " Thousand ";
    const remainder = dollars % 1000;
    if (remainder >= 100) {
      words += ones[Math.floor(remainder / 100)] + " Hundred ";
      const rem2 = remainder % 100;
      if (rem2 >= 20) {
        words += tens[Math.floor(rem2 / 10)] + " " + ones[rem2 % 10];
      } else {
        words += ones[rem2];
      }
    } else if (remainder >= 20) {
      words += tens[Math.floor(remainder / 10)] + " " + ones[remainder % 10];
    } else {
      words += ones[remainder];
    }
  } else if (dollars >= 100) {
    words += ones[Math.floor(dollars / 100)] + " Hundred ";
    const rem = dollars % 100;
    if (rem >= 20) {
      words += tens[Math.floor(rem / 10)] + " " + ones[rem % 10];
    } else {
      words += ones[rem];
    }
  } else if (dollars >= 20) {
    words += tens[Math.floor(dollars / 10)] + " " + ones[dollars % 10];
  } else {
    words += ones[dollars];
  }

  words = words.trim() + " and " + cents.toString().padStart(2, "0") + "/100";
  return words;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function CheckPrintView({ check }: CheckPrintViewProps) {
  return (
    <div className="p-8 max-w-2xl mx-auto font-mono text-foreground" id="check-print">
      <div className="border-2 border-foreground rounded-lg p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-lg font-bold">Check</p>
          </div>
          <div className="text-right">
            <p className="text-sm">Check # {check.check_number || "N/A"}</p>
            <p className="text-sm">Date: {formatDate(check.check_date)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold">PAY TO THE ORDER OF:</span>
            <span className="flex-1 border-b border-foreground pb-1 font-bold text-lg">{check.payee}</span>
            <span className="border border-foreground px-3 py-1 font-bold text-lg">{formatCurrency(check.amount)}</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="flex-1 border-b border-foreground pb-1 text-sm italic">
              {numberToWords(check.amount)} Dollars
            </span>
          </div>
        </div>

        <div className="flex justify-between items-end pt-4">
          <div className="text-sm">
            <p>Memo: {check.memo || "—"}</p>
            {check.payee_record_number && <p>Record #: {check.payee_record_number}</p>}
          </div>
          <div className="border-t border-foreground pt-1 min-w-[200px] text-center text-sm">
            Authorized Signature
          </div>
        </div>
      </div>
    </div>
  );
}

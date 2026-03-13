import { type Check } from "@/hooks/useChecks";
import { type Account } from "@/hooks/useAccounts";
import signatureImg from "@/assets/signature.png";

interface CheckPrintViewProps {
  check: Check;
  account?: Account | null;
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

function formatDateShort(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function PayerBlock({ account, useStubName }: { account?: Account | null; useStubName?: boolean }) {
  if (!account) return null;
  const name = useStubName
    ? (account.stub_payer_name || account.payer_name || account.account_name)
    : (account.check_payer_name || account.payer_name || account.account_name);
  return (
    <div className="text-xs leading-tight">
      {account.payer_name_yiddish && <p className="font-bold">{account.payer_name_yiddish}</p>}
      <p className="font-bold">{name}</p>
      {account.payer_address && <p>{account.payer_address}</p>}
      {(account.payer_city || account.payer_state || account.payer_zip) && (
        <p>{[account.payer_city, account.payer_state].filter(Boolean).join(", ")} {account.payer_zip || ""}</p>
      )}
    </div>
  );
}

function StubSection({ check, account, index }: { check: Check; account?: Account | null; index: number }) {
  return (
    <div className="flex justify-between items-start px-6 py-4" style={{ minHeight: "140px" }}>
      <div className="space-y-1">
        <PayerBlock account={account} useStubName />
      </div>
      <div className="text-right text-xs space-y-0.5">
        <p>{check.check_number || ""}</p>
        <p>{formatDateShort(check.check_date)}</p>
        <p>{formatCurrency(check.amount)}</p>
        {index === 1 && <p>{check.payee_record_number || "0"}</p>}
      </div>
    </div>
  );
}

export function CheckPrintView({ check, account }: CheckPrintViewProps) {
  const payeeName = check.payee.startsWith("Payee #") ? "" : check.payee;

  return (
    <div className="font-sans text-black bg-white" id="check-print" style={{ width: "8.5in", margin: "0 auto" }}>
      {/* ===== CHECK SECTION (top) ===== */}
      <div className="px-6 pt-4 pb-2" style={{ minHeight: "280px" }}>
        {/* Header: Payer | Bank | Check# */}
        <div className="flex justify-between items-start mb-4">
          <div className="text-xs font-bold leading-tight">
            <p>{account?.check_payer_name || account?.payer_name || account?.account_name || "CLYKT"}</p>
            {(account?.payer_city || account?.payer_state || account?.payer_zip) && (
              <p>{[account?.payer_city, account?.payer_state].filter(Boolean).join(" ")} {account?.payer_zip || ""}</p>
            )}
          </div>
          <div className="text-center text-sm">
            <p>{account?.bank_name || ""}</p>
          </div>
          <div className="text-right text-sm">
            <p>{check.check_number || ""}</p>
          </div>
        </div>

        {/* Date */}
        <div className="flex justify-end mb-3">
          <div className="text-sm">
            Date <span className="border-b border-black pb-0.5 pl-2 pr-4 ml-1">{formatDateShort(check.check_date)}</span>
          </div>
        </div>

        {/* Pay to the order of */}
        <div className="flex items-baseline gap-2 mb-1 text-sm">
          <span className="whitespace-nowrap">Pay to the</span>
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-sm whitespace-nowrap">order of</span>
          <span className="flex-1 border-b border-black pb-0.5 text-base font-medium pl-2">{payeeName}</span>
          <span className="border border-black px-3 py-0.5 text-base font-bold ml-2 whitespace-nowrap">{formatCurrency(check.amount)}</span>
        </div>

        {/* Amount in words */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className="flex-1 border-b border-black pb-0.5 text-sm italic pl-1">
            {numberToWords(check.amount)} Dollars and Zero Cents
          </span>
        </div>

        {/* Memo + Signature */}
        <div className="flex justify-between items-end mt-4">
          <div className="text-sm">
            <span>Memo </span>
            <span className="border-b border-black pb-0.5 pl-2 pr-16 inline-block min-w-[200px]">{check.memo || ""}</span>
          </div>
          <div className="min-w-[200px] text-center">
            <img src={signatureImg} alt="Signature" className="h-10 mx-auto object-contain" />
            <div className="border-t border-black" />
          </div>
        </div>

        {/* MICR line */}
        <div className="mt-4 text-xs tracking-widest font-mono text-muted-foreground">
          {account?.routing_number && <span>⑈{account.routing_number}⑈</span>}
          {" "}
          {account?.account_number && <span>{account.account_number}⑈</span>}
        </div>
      </div>

      {/* ===== Perforated line ===== */}
      <div className="border-t border-dashed border-gray-400 my-0" />

      {/* ===== STUB 1 (middle) ===== */}
      <div className="flex justify-between items-start px-6 py-4" style={{ minHeight: "140px" }}>
        <div className="space-y-1">
          <PayerBlock account={account} useStubName />
        </div>
        <div className="flex gap-12">
          <div className="text-sm">
            <p className="font-medium">{payeeName}</p>
          </div>
          <div className="text-right text-xs space-y-0.5">
            <p>{check.check_number || ""}</p>
            <p>{formatDateShort(check.check_date)}</p>
            <p>{formatCurrency(check.amount)}</p>
          </div>
        </div>
      </div>

      {/* ===== Perforated line ===== */}
      <div className="border-t border-dashed border-gray-400 my-0" />

      {/* ===== STUB 2 (bottom) ===== */}
      <div className="flex justify-between items-start px-6 py-4" style={{ minHeight: "140px" }}>
        <div className="space-y-1">
          <PayerBlock account={account} useStubName />
        </div>
        <div className="flex gap-12">
          <div className="text-sm">
            <p className="font-medium">{payeeName}</p>
          </div>
          <div className="text-right text-xs space-y-0.5">
            <p>{check.check_number || ""}</p>
            <p>{formatDateShort(check.check_date)}</p>
            <p>{formatCurrency(check.amount)}</p>
            <p>{check.payee_record_number || "0"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { type Check } from "@/hooks/useChecks";
import { type Account } from "@/hooks/useAccounts";
import { type Payee } from "@/hooks/usePayees";
import signatureImg from "@/assets/signature.png";

interface CheckPrintViewProps {
  check: Check;
  account?: Account | null;
  payee?: Payee | null;
}

function numberToWords(num: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  if (num === 0) return "Zero";

  const dollars = Math.floor(num);
  const cents = Math.round((num - dollars) * 100);

  function convertWholeNumber(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return (tens[Math.floor(n / 10)] + " " + ones[n % 10]).trim();
    if (n < 1000) return (ones[Math.floor(n / 100)] + " Hundred " + convertWholeNumber(n % 100)).trim();
    if (n < 1000000) return (convertWholeNumber(Math.floor(n / 1000)) + " Thousand " + convertWholeNumber(n % 1000)).trim();
    return n.toString();
  }

  const dollarWords = dollars === 0 ? "Zero" : convertWholeNumber(dollars);
  return dollarWords + " and " + cents.toString().padStart(2, "0") + "/100";
}

function amountToFullWords(num: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const dollars = Math.floor(num);
  const cents = Math.round((num - dollars) * 100);

  function convert(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return (tens[Math.floor(n / 10)] + " " + ones[n % 10]).trim();
    if (n < 1000) return (ones[Math.floor(n / 100)] + " Hundred " + convert(n % 100)).trim();
    if (n < 1000000) return (convert(Math.floor(n / 1000)) + " Thousand " + convert(n % 1000)).trim();
    return n.toString();
  }

  const dollarWords = dollars === 0 ? "Zero" : convert(dollars);
  const centsWords = cents === 0 ? "Zero" : convert(cents);
  return dollarWords + " Dollars and " + centsWords + " Cents";
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

function PayerBlock({ account }: { account?: Account | null }) {
  if (!account) return null;
  const name = account.stub_payer_name || account.payer_name || account.account_name;
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

function PayeeBlock({ payee }: { payee?: Payee | null }) {
  if (!payee) return null;

  // Build Yiddish display name
  const yiddishParts = [
    payee.title_1_yiddish,
    payee.first_name_yiddish,
    payee.middle_name_yiddish,
    payee.last_name_yiddish,
    payee.title_2_yiddish,
  ].filter(Boolean);
  const yiddishName = yiddishParts.length > 0 ? yiddishParts.join(" ") : null;

  // Build address
  const streetParts = [payee.street_no, payee.street_name].filter(Boolean).join(" ");
  const streetLine = payee.apt ? `${streetParts} #${payee.apt}` : streetParts;
  const cityLine = [payee.city, payee.state].filter(Boolean).join(", ") + (payee.zip ? " " + payee.zip : "");

  return (
    <div className="text-xs leading-tight mt-4">
      {yiddishName && <p>{yiddishName}</p>}
      <p>{payee.payee_name}</p>
      {streetLine && <p>{streetLine}</p>}
      {cityLine.trim() && <p>{cityLine}</p>}
    </div>
  );
}

export function CheckPrintView({ check, account, payee }: CheckPrintViewProps) {
  const payeeName = check.payee.startsWith("Payee #") ? "" : check.payee;

  return (
    <div className="font-sans text-black bg-white" id="check-print" style={{ width: "8.5in", margin: "0 auto" }}>
      {/* ===== CHECK SECTION (top) ===== */}
      <div className="px-6 pt-4 pb-2" style={{ minHeight: "280px" }}>
        {/* Header row: Payer name+address | Bank name | Check # */}
        <div className="flex justify-between items-start mb-6">
          <div className="text-xs leading-tight">
            <p className="font-bold text-sm">{account?.check_payer_name || account?.payer_name || account?.account_name || "CLYKT"}</p>
            <p className="font-bold">{[account?.payer_city, account?.payer_state].filter(Boolean).join(" ")} {account?.payer_zip || ""}</p>
          </div>
          <div className="text-center text-sm">
            {account?.bank_name || ""}
          </div>
          <div className="text-right text-sm">
            {check.check_number || ""}
          </div>
        </div>

        {/* Date row — right aligned */}
        <div className="flex justify-end mb-4">
          <span className="text-sm">Date&nbsp;&nbsp;<span className="border-b border-black inline-block min-w-[100px] pb-0.5 text-center">{formatDateShort(check.check_date)}</span></span>
        </div>

        {/* Pay to the order of */}
        <div className="mb-1 text-sm">Pay to the</div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-sm whitespace-nowrap">order of</span>
          <span className="flex-1 border-b border-black pb-0.5 pl-2 text-base font-semibold">{payeeName}</span>
          <span className="border border-black px-3 py-1 text-base font-bold whitespace-nowrap">{formatCurrency(check.amount)}</span>
        </div>

        {/* Amount in words */}
        <div className="mb-6">
          <span className="border-b border-black pb-0.5 text-sm italic inline-block w-full">
            {amountToFullWords(check.amount)}
          </span>
        </div>

        {/* Memo + Signature — side by side */}
        <div className="flex justify-between items-end mt-2">
          <div className="text-sm flex items-baseline">
            <span>Memo</span>
            <span className="border-b border-black inline-block min-w-[220px] ml-1 pb-0.5 pl-2">{check.memo || ""}</span>
          </div>
          <div className="min-w-[200px] text-center">
            <img src={signatureImg} alt="Signature" className="h-10 mx-auto object-contain" />
            <div className="border-t border-black" />
          </div>
        </div>

        {/* MICR line */}
        <div className="mt-4 text-xs tracking-widest font-mono" style={{ color: "#999" }}>
          {check.check_number && <span>⑈{check.check_number}⑈</span>}
          {"  "}
          {account?.routing_number && <span>⑈{account.routing_number}⑈</span>}
          {"  "}
          {account?.account_number && <span>{account.account_number}⑈</span>}
        </div>
      </div>

      {/* ===== Perforated line ===== */}
      <div className="border-t border-dashed" style={{ borderColor: "#aaa" }} />

      {/* ===== STUB 1 (middle) ===== */}
      <div className="px-6 py-4" style={{ minHeight: "180px" }}>
        <div className="flex justify-between items-start">
          <PayerBlock account={account} />
          <div className="text-right text-xs space-y-0.5">
            <p>{check.check_number || ""}</p>
            <p>{formatDateShort(check.check_date)}</p>
            <p>{formatCurrency(check.amount)}</p>
          </div>
        </div>
        <PayeeBlock payee={payee} />
      </div>

      {/* ===== Perforated line ===== */}
      <div className="border-t border-dashed" style={{ borderColor: "#aaa" }} />

      {/* ===== STUB 2 (bottom) ===== */}
      <div className="px-6 py-4" style={{ minHeight: "180px" }}>
        <div className="flex justify-between items-start">
          <div className="text-xs leading-tight">
            <p className="font-bold">{account?.stub_payer_name || account?.payer_name || account?.account_name || ""}</p>
            {account?.payer_address && <p>{account.payer_address}</p>}
            {(account?.payer_city || account?.payer_state || account?.payer_zip) && (
              <p>{[account?.payer_city, account?.payer_state].filter(Boolean).join(", ")} {account?.payer_zip || ""}</p>
            )}
          </div>
          <div className="text-right text-xs space-y-0.5">
            <p>{check.check_number || ""}</p>
            <p>{formatDateShort(check.check_date)}</p>
            <p>{formatCurrency(check.amount)}</p>
            <p>{check.payee_record_number || ""}</p>
            <p>{check.run_no || ""}</p>
          </div>
        </div>
        <PayeeBlock payee={payee} />
      </div>
    </div>
  );
}

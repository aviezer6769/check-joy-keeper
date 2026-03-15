import { type Check } from "@/hooks/useChecks";
import { type Account } from "@/hooks/useAccounts";
import { type Payee } from "@/hooks/usePayees";
import signatureImg from "@/assets/signature.png";

interface CheckPrintViewProps {
  check: Check;
  account?: Account | null;
  payee?: Payee | null;
}

const PAGE_WIDTH_IN = "8.5in";
const FACE_HEIGHT_IN = "3.5in";
const STUB_HEIGHT_IN = "3.0in";

function amountToFullWords(num: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
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
  return `${dollarWords} Dollars and ${centsWords} Cents`;
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

function PayeeBlock({ payee }: { payee?: Payee | null }) {
  if (!payee) return null;

  const yiddishParts = [
    payee.title_1_yiddish, payee.first_name_yiddish, payee.middle_name_yiddish,
    payee.last_name_yiddish, payee.title_2_yiddish,
  ].filter(Boolean);
  const yiddishName = yiddishParts.length > 0 ? yiddishParts.join(" ") : null;

  const streetParts = [payee.street_no, payee.street_name].filter(Boolean).join(" ");
  const streetLine = payee.apt ? `${streetParts} #${payee.apt}` : streetParts;
  const cityState = [payee.city, payee.state].filter(Boolean).join(", ");
  const cityLine = [cityState, payee.zip].filter(Boolean).join(" ");

  return (
    <div className="text-xs leading-snug" style={{ marginTop: "0.55in", marginLeft: "0.45in" }}>
      {yiddishName && <p>{yiddishName}</p>}
      <p>{payee.payee_name}</p>
      {streetLine && <p>{streetLine}</p>}
      {cityLine && <p>{cityLine}</p>}
    </div>
  );
}

function StubRightMeta({
  check,
  includeRecord,
  includeRun,
}: {
  check: Check;
  includeRecord?: boolean;
  includeRun?: boolean;
}) {
  return (
    <div className="text-right text-xs leading-snug space-y-0.5" style={{ minWidth: "100px" }}>
      <p>{check.check_number || ""}</p>
      <p>{formatDateShort(check.check_date)}</p>
      <p>{formatCurrency(check.amount)}</p>
      {includeRecord && <p>{check.payee_record_number || ""}</p>}
      {includeRun && <p>{check.run_no || ""}</p>}
    </div>
  );
}

export function CheckPrintView({ check, account, payee }: CheckPrintViewProps) {
  const payeeName = check.payee.startsWith("Payee #") ? "" : check.payee;
  const payerDisplayName = account?.check_payer_name || account?.payer_name || account?.account_name || "CLYKT";
  const stubPayerName = account?.stub_payer_name || account?.payer_name || account?.account_name;

  return (
    <div
      className="font-sans text-black bg-white"
      id="check-print"
      style={{ width: PAGE_WIDTH_IN, margin: "0 auto", minHeight: "11in" }}
    >
      {/* ===== CHECK FACE ===== */}
      <div
        className="flex flex-col justify-between"
        style={{ height: FACE_HEIGHT_IN, padding: "0.25in 0.5in 0.15in 0.5in" }}
      >
        {/* Row 1: Payer / Bank / Check# */}
        <div className="flex justify-between items-start">
          <div className="text-xs leading-tight">
            <p className="font-bold text-sm">{payerDisplayName}</p>
            <p>{[account?.payer_city, account?.payer_state].filter(Boolean).join(" ")} {account?.payer_zip || ""}</p>
          </div>
          <div className="text-sm">{account?.bank_name || ""}</div>
          <div className="text-sm">{check.check_number || ""}</div>
        </div>

        {/* Row 2: Date (right-aligned) */}
        <div className="flex justify-end" style={{ marginTop: "0.15in" }}>
          <span className="text-sm">
            Date&nbsp;&nbsp;
            <span className="border-b border-black inline-block min-w-[90px] pb-0.5 text-center">
              {formatDateShort(check.check_date)}
            </span>
          </span>
        </div>

        {/* Row 3: Pay to the / order of on separate lines */}
        <div style={{ marginTop: "0.08in" }}>
          <div className="text-sm">Pay to the</div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm whitespace-nowrap">order of</span>
            <span className="flex-1 border-b border-black pb-0.5 pl-1 text-sm">{payeeName}</span>
            <span className="border border-black px-3 py-1 text-sm font-semibold whitespace-nowrap">
              {formatCurrency(check.amount)}
            </span>
          </div>
        </div>

        {/* Row 4: Amount in words */}
        <div style={{ marginTop: "0.06in" }}>
          <span className="border-b border-black pb-0.5 text-sm inline-block w-full">
            {amountToFullWords(check.amount)}
          </span>
        </div>

        {/* Row 5: Memo + Signature */}
        <div className="flex justify-between items-end" style={{ marginTop: "0.15in" }}>
          <div className="text-sm flex items-baseline">
            <span>Memo</span>
            <span className="border-b border-black inline-block min-w-[200px] ml-1 pb-0.5 pl-2">
              {check.memo || ""}
            </span>
          </div>
          <div className="min-w-[200px] text-center">
            <img src={signatureImg} alt="Signature" className="h-9 mx-auto object-contain" />
            <div className="border-t border-black" />
          </div>
        </div>

        {/* Row 6: MICR line */}
        <div className="text-xs tracking-[0.2em] font-mono text-black/70" style={{ marginTop: "0.12in" }}>
          {check.check_number && <span>⑈{check.check_number}⑈</span>}
          {"  "}
          {account?.routing_number && <span>⑈{account.routing_number}⑈</span>}
          {"  "}
          {account?.account_number && <span>{account.account_number}⑈</span>}
        </div>
      </div>

      {/* ===== STUB 1 (middle) ===== */}
      <div style={{ height: STUB_HEIGHT_IN, padding: "0.2in 0.5in 0.15in 0.5in", borderTop: "1px dashed #bbb" }}>
        <div className="flex justify-between items-start">
          <div className="text-xs leading-tight">
            {account?.payer_name_yiddish && <p className="font-bold">{account.payer_name_yiddish}</p>}
            <p className="font-bold">{stubPayerName}</p>
            {account?.payer_address && <p>{account.payer_address}</p>}
            {(account?.payer_city || account?.payer_state || account?.payer_zip) && (
              <p>
                {[account?.payer_city, account?.payer_state].filter(Boolean).join(", ")} {account?.payer_zip || ""}
              </p>
            )}
          </div>
          <StubRightMeta check={check} />
        </div>
        <PayeeBlock payee={payee} />
      </div>

      {/* ===== STUB 2 (bottom) ===== */}
      <div style={{ height: STUB_HEIGHT_IN, padding: "0.2in 0.5in 0.15in 0.5in", borderTop: "1px dashed #bbb" }}>
        <div className="flex justify-between items-start">
          <div className="text-xs leading-tight">
            <p>{stubPayerName}</p>
            {account?.payer_address && <p>{account.payer_address}</p>}
            {(account?.payer_city || account?.payer_state || account?.payer_zip) && (
              <p>
                {[account?.payer_city, account?.payer_state].filter(Boolean).join(", ")} {account?.payer_zip || ""}
              </p>
            )}
          </div>
          <StubRightMeta check={check} includeRecord includeRun />
        </div>
        <PayeeBlock payee={payee} />
      </div>
    </div>
  );
}

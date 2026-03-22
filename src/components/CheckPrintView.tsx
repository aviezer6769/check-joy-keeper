import { type Check } from "@/hooks/useChecks";
import { type Account } from "@/hooks/useAccounts";
import { type Payee } from "@/hooks/usePayees";
import signatureImg from "@/assets/signature.png";

interface CheckPrintViewProps {
  check: Check;
  account?: Account | null;
  payee?: Payee | null;
  showSignature?: boolean;
}

const PAGE = {
  width: 8.5,
  height: 11,
  marginX: 0.45,
};

const FACE = {
  height: 3.5,
  padTop: 0.14,
  padBottom: 0.14,
  dateTop: 0.11,
  payLineTop: 0.06,
  wordsTop: 0.05,
  memoTop: 0.14,
  micrBottom: 0.04,
};

const STUB_1 = {
  height: 3.75,
  padTop: 0.36,
  padBottom: 0.16,
  payeeTop: 1.34,
};

const STUB_2 = {
  height: 3.75,
  padTop: 0.34,
  padBottom: 0.16,
  payeeTop: 1.18,
};

function inches(value: number): string {
  return `${value}in`;
}

function amountToFullWords(num: number): string {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const dollars = Math.floor(num);
  const cents = Math.round((num - dollars) * 100);

  function convert(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return `${tens[Math.floor(n / 10)]} ${ones[n % 10]}`.trim();
    if (n < 1000) return `${ones[Math.floor(n / 100)]} Hundred ${convert(n % 100)}`.trim();
    if (n < 1000000) return `${convert(Math.floor(n / 1000))} Thousand ${convert(n % 1000)}`.trim();
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
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function formatMicrLine(checkNumber?: string | null, routingNumber?: string | null, accountNumber?: string | null) {
  const checkNo = checkNumber?.trim();
  const routing = routingNumber?.trim();
  const account = accountNumber?.trim();

  return [
    checkNo ? `o${checkNo}o` : null,
    routing ? `T${routing}t` : null,
    account ? `${account}o` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function PayeeBlock({
  payee,
  topOffsetIn,
  leftOffsetIn = 0.48,
}: {
  payee?: Payee | null;
  topOffsetIn: number;
  leftOffsetIn?: number;
}) {
  if (!payee) return null;

  const yiddishParts = [
    payee.title_1_yiddish,
    payee.first_name_yiddish,
    payee.middle_name_yiddish,
    payee.last_name_yiddish,
    payee.title_2_yiddish,
  ].filter(Boolean);
  const yiddishName = yiddishParts.length > 0 ? yiddishParts.join(" ") : null;

  const streetParts = [payee.street_no, payee.street_name].filter(Boolean).join(" ");
  const streetLine = payee.apt ? `${streetParts} #${payee.apt}` : streetParts;
  const cityState = [payee.city, payee.state].filter(Boolean).join(", ");
  const cityLine = [cityState, payee.zip].filter(Boolean).join(" ");

  return (
    <div
      className="text-xs leading-snug"
      style={{
        position: "absolute",
        top: inches(topOffsetIn),
        left: inches(leftOffsetIn),
      }}
    >
      {yiddishName && <p className="font-hebrew">{yiddishName}</p>}
      <p>{payee.payee_name}</p>
      {streetLine && <p>{streetLine}</p>}
      {cityLine && <p>{cityLine}</p>}
    </div>
  );
}

function StubRightMeta({
  check,
  includeRecord,
  includeUrgent,
  payee,
}: {
  check: Check;
  includeRecord?: boolean;
  includeUrgent?: boolean;
  payee?: Payee | null;
}) {
  return (
    <div className="text-right text-xs leading-snug space-y-0.5" style={{ width: inches(1.25) }}>
      <p>{check.check_number || ""}</p>
      <p>{formatDateShort(check.check_date)}</p>
      <p>{formatCurrency(check.amount)}</p>
      {includeRecord && <p>{check.payee_record_number || ""}</p>}
      {includeUrgent && <p>{payee?.urgent_level != null ? payee.urgent_level : ""}</p>}
    </div>
  );
}

export function CheckPrintView({ check, account, payee, showSignature = true }: CheckPrintViewProps) {
  const payeeName = check.payee.startsWith("Payee #") ? "" : check.payee;
  const payerDisplayName = account?.check_payer_name || account?.payer_name || account?.account_name || "CLYKT";
  const stubPayerName = account?.stub_payer_name || account?.payer_name || account?.account_name;
  const micrLine = formatMicrLine(check.check_number, account?.routing_number, account?.account_number);

  return (
    <div
      className="text-foreground bg-card"
      id="check-print"
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        width: inches(PAGE.width),
        height: inches(PAGE.height),
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
      <div
        className="relative"
        style={{
          height: inches(FACE.height),
          padding: `${inches(FACE.padTop)} ${inches(PAGE.marginX)} ${inches(FACE.padBottom)} ${inches(PAGE.marginX)}`,
          boxSizing: "border-box",
        }}
      >
        <div className="relative min-h-[0.42in]">
          <div className="text-xs leading-tight max-w-[2.55in]">
            <p className="font-bold text-sm">{payerDisplayName}</p>
            <p>
              {[account?.payer_city, account?.payer_state].filter(Boolean).join(" ")} {account?.payer_zip || ""}
            </p>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 top-0 text-sm whitespace-nowrap">{account?.bank_name || ""}</div>
          <div className="absolute right-0 top-0 text-sm">{check.check_number || ""}</div>
        </div>

        <div className="flex justify-end" style={{ marginTop: inches(FACE.dateTop) }}>
          <span className="text-sm">
            Date&nbsp;&nbsp;
            <span className="border-b border-foreground inline-block min-w-[92px] pb-0.5 text-center">
              {formatDateShort(check.check_date)}
            </span>
          </span>
        </div>

        <div style={{ marginTop: inches(FACE.payLineTop) }}>
          <div className="text-sm">Pay to the</div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm whitespace-nowrap">order of</span>
            <span className="flex-1 border-b border-foreground pb-0.5 pl-1 text-sm">{payeeName}</span>
            <span className="border border-foreground px-3 py-1 text-sm font-semibold whitespace-nowrap">
              {formatCurrency(check.amount)}
            </span>
          </div>
        </div>

        <div style={{ marginTop: inches(FACE.wordsTop) }}>
          <span className="border-b border-foreground pb-0.5 text-sm inline-block w-full">{amountToFullWords(check.amount)}</span>
        </div>

        <div className="flex justify-between items-end" style={{ marginTop: inches(FACE.memoTop) }}>
          <div className="text-sm flex items-baseline">
            <span>Memo</span>
            <span className="border-b border-foreground inline-block min-w-[210px] ml-1 pb-0.5 pl-2">{check.memo || ""}</span>
          </div>
          <div className="min-w-[200px] text-center">
            {showSignature && <img src={signatureImg} alt="Signature" className="h-9 mx-auto object-contain" />}
            <div className="border-t border-foreground" />
          </div>
        </div>

        <div
          className="tracking-[0.16em] text-foreground/70"
          style={{
            fontFamily: "'MICR', monospace",
            fontSize: "9pt",
            position: "absolute",
            left: inches(PAGE.marginX),
            right: inches(PAGE.marginX),
            bottom: inches(FACE.micrBottom),
          }}
        >
          {micrLine}
        </div>
      </div>

      <div
        className="relative"
        style={{
          height: inches(STUB_1.height),
          padding: `${inches(STUB_1.padTop)} ${inches(PAGE.marginX)} ${inches(STUB_1.padBottom)} ${inches(PAGE.marginX)}`,
          boxSizing: "border-box",
        }}
      >
        <div className="relative h-full">
          <div className="text-xs leading-tight" style={{ maxWidth: "calc(100% - 1.45in)" }}>
            {account?.payer_name_yiddish && <p className="font-bold font-hebrew">{account.payer_name_yiddish}</p>}
            <p className="font-bold">{stubPayerName}</p>
            {account?.payer_address && <p>{account.payer_address}</p>}
            {(account?.payer_city || account?.payer_state || account?.payer_zip) && (
              <p>
                {[account?.payer_city, account?.payer_state].filter(Boolean).join(", ")} {account?.payer_zip || ""}
              </p>
            )}
          </div>

          <div className="absolute right-0 top-0">
            <StubRightMeta check={check} />
          </div>

          <PayeeBlock payee={payee} topOffsetIn={STUB_1.payeeTop} leftOffsetIn={0.48} />
        </div>
      </div>

      <div
        className="relative"
        style={{
          height: inches(STUB_2.height),
          padding: `${inches(STUB_2.padTop)} ${inches(PAGE.marginX)} ${inches(STUB_2.padBottom)} ${inches(PAGE.marginX)}`,
          boxSizing: "border-box",
        }}
      >
        <div className="relative h-full">
          <div className="text-xs leading-tight" style={{ maxWidth: "calc(100% - 1.45in)" }}>
            <p>{stubPayerName}</p>
            {account?.payer_address && <p>{account.payer_address}</p>}
            {(account?.payer_city || account?.payer_state || account?.payer_zip) && (
              <p>
                {[account?.payer_city, account?.payer_state].filter(Boolean).join(", ")} {account?.payer_zip || ""}
              </p>
            )}
          </div>

          <div className="absolute right-0 top-0">
            <StubRightMeta check={check} includeRecord includeUrgent payee={payee} />
          </div>

          <PayeeBlock payee={payee} topOffsetIn={STUB_2.payeeTop} leftOffsetIn={0.48} />
        </div>
      </div>
    </div>
  );
}

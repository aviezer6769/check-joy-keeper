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
  marginRight: 0.6,
};

const FACE = {
  height: 3.5,
  padTop: 0.28,
  padBottom: 0.14,
  dateTop: 0.06,
  payLineTop: 0.06,
  wordsTop: 0.05,
  memoTop: 0.14,
  micrBottom: 0.22,
};

const STUB_1 = {
  height: 3.75,
  padTop: 0.36,
  padBottom: 0.16,
  payeeTop: 1.62,
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
      className="leading-snug"
      style={{
        position: "absolute",
        top: inches(topOffsetIn),
        left: inches(leftOffsetIn),
        fontSize: "10pt",
      }}
    >
      {yiddishName && <p className="font-hebrew" style={{ fontSize: "11pt" }}>{yiddishName}</p>}
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
    <div className="text-right leading-snug space-y-0.5" style={{ width: inches(1.25), fontSize: "10pt" }}>
      <p>{check.check_number || ""}</p>
      <p>{formatDateShort(check.check_date)}</p>
      <p>{formatCurrency(check.amount)}</p>
      {includeRecord && <p>{check.payee_record_number || ""}</p>}
      {includeUrgent && <p>{payee?.urgent_level != null ? payee.urgent_level : ""}</p>}
    </div>
  );
}

export function CheckPrintView({ check, account, payee, showSignature = true }: CheckPrintViewProps) {
  const payeeName = (check.payee.startsWith("Payee #") || check.payee === "Blank") ? "" : check.payee;
  const payerDisplayName = account?.check_payer_name || account?.payer_name || account?.account_name || "CLYKT";
  const stubPayerName = account?.stub_payer_name || account?.payer_name || account?.account_name;
  const micrLine = formatMicrLine(check.check_number, account?.routing_number, account?.account_number);

  return (
    <div
      className="bg-card"
      id="check-print"
      style={{
        fontFamily: "'MS Reference Sans Serif', 'Reference Sans Serif', Arial, Helvetica, sans-serif",
        color: "#000000",
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
          padding: `${inches(FACE.padTop)} ${inches(PAGE.marginRight)} ${inches(FACE.padBottom)} ${inches(PAGE.marginX)}`,
          boxSizing: "border-box",
        }}
      >
        {/* Top row: Payer info left, Check number right */}
        <div className="flex justify-between items-start">
          <div className="text-xs leading-tight max-w-[3in]">
            <p className="font-bold" style={{ fontSize: "11pt" }}>{payerDisplayName}</p>
            <p>
              {[account?.payer_city, account?.payer_state].filter(Boolean).join(", ")} {account?.payer_zip || ""}
            </p>
            {account?.payer_phone && <p>{account.payer_phone}</p>}
          </div>
          <div className="text-right text-xs leading-tight">
            <p className="font-semibold" style={{ fontSize: "10pt" }}>{check.check_number || ""}</p>
          </div>
        </div>

        {/* Bank name - aligned with last payer line */}
        {account?.bank_name && (
          <div className="text-center text-xs" style={{ marginTop: inches(-0.14) }}>
            <p>{account.bank_name}</p>
          </div>
        )}

        {/* Date row */}
        <div className="flex items-baseline justify-end" style={{ marginTop: inches(FACE.dateTop), paddingRight: inches(0.3) }}>
          <div className="flex items-baseline gap-1" style={{ fontSize: "10pt" }}>
            <span className="font-semibold">Date</span>
            <span className="border-b border-foreground inline-block min-w-[120px] pb-0.5 text-center">
              {formatDateShort(check.check_date)}
            </span>
          </div>
        </div>

        {/* Pay to line */}
        <div style={{ marginTop: inches(FACE.payLineTop + 0.06) }}>
          <div className="flex items-baseline gap-1.5" style={{ fontSize: "10pt" }}>
            <span className="whitespace-nowrap font-semibold text-xs">Pay to the<br/>order of</span>
            <span className="flex-1 border-b border-foreground pb-0.5 pl-2" style={{ fontSize: "10pt", minHeight: "1.2em" }}>
              {payeeName || "\u00A0"}
            </span>
            <span className="font-bold whitespace-nowrap border border-muted-foreground/40 bg-muted/50 px-2 py-0.5" style={{ fontSize: "10pt", minWidth: "120px", display: "inline-block", textAlign: check.amount > 0 ? "right" : "left" }}>
              $ {check.amount > 0 ? formatCurrency(check.amount).replace("$", "") : ""}
            </span>
          </div>
        </div>

        {/* Amount in words */}
        <div style={{ marginTop: inches(FACE.wordsTop) }}>
          <div className="flex items-baseline gap-1">
            <span
              className="flex-1 border-b border-foreground pb-0.5 pl-1"
              style={{ fontSize: "9pt", minHeight: "1.2em" }}
            >
              {check.amount > 0 ? amountToFullWords(check.amount) : "\u00A0"}
            </span>
            <span style={{ fontSize: "9pt" }} className="whitespace-nowrap font-semibold">Dollars</span>
          </div>
        </div>

        {/* Memo and Signature */}
        <div className="flex justify-between items-end" style={{ marginTop: inches(FACE.memoTop + 0.06) }}>
          <div className="flex items-end gap-1" style={{ fontSize: "9pt", paddingBottom: "0px" }}>
            <span className="font-semibold" style={{ lineHeight: 1, paddingBottom: "2px" }}>Memo</span>
            <span style={{ borderBottom: "1px solid currentColor", display: "inline-block", minWidth: "220px", paddingBottom: "2px", paddingLeft: "8px" }}>
              {check.memo || ""}
            </span>
          </div>
          <div style={{ minWidth: "200px", textAlign: "center" }}>
            <div style={{ height: "3.5rem", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              {showSignature && (
                <img src={signatureImg} alt="Signature" className="h-14 object-contain" />
              )}
            </div>
            <div style={{ borderTop: "1px solid currentColor", marginTop: "2px" }} />
          </div>
        </div>

        {/* MICR line */}
        <div
          className="tracking-[0.16em]"
          style={{
            fontFamily: "'MICR', monospace",
            fontSize: "9pt",
            position: "absolute",
            left: inches(PAGE.marginX),
            right: inches(PAGE.marginRight),
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
          <div className="leading-tight" style={{ maxWidth: "calc(100% - 1.45in)", fontSize: "10pt" }}>
            {account?.payer_name_yiddish && <p className="font-hebrew" style={{ fontSize: "11pt" }}>{account.payer_name_yiddish}</p>}
            <p>{stubPayerName}</p>
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

          {check.stub_memo && (
            <div className="absolute bottom-0 left-0 right-0 border border-muted-foreground/40 rounded-sm px-2 py-1" style={{ fontSize: "10pt" }}>
              {check.stub_memo}
            </div>
          )}
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
          <div className="leading-tight" style={{ maxWidth: "calc(100% - 1.45in)", fontSize: "10pt" }}>
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

          {check.stub_memo && (
            <div className="absolute bottom-0 left-0 right-0 border border-muted-foreground/40 rounded-sm px-2 py-1" style={{ fontSize: "10pt" }}>
              {check.stub_memo}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

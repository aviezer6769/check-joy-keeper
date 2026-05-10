/** Build payee_name from title_to_use, first_name, middle_name, last_name */
export function buildPayeeName(fields: {
  title_to_use?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
}): string {
  return [fields.title_to_use, fields.first_name, fields.middle_name, fields.last_name]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ");
}

/** Format a phone number as (XXX) XXX-XXXX, with optional extension */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  let main = digits;
  let ext = "";
  if (digits.length > 10) {
    main = digits.slice(0, 10);
    ext = digits.slice(10);
  }
  let formatted = main;
  if (main.length <= 3) {
    formatted = `(${main}`;
  } else if (main.length <= 6) {
    formatted = `(${main.slice(0, 3)}) ${main.slice(3)}`;
  } else {
    formatted = `(${main.slice(0, 3)}) ${main.slice(3, 6)}-${main.slice(6, 10)}`;
  }
  if (ext) formatted += ` x${ext}`;
  return formatted;
}

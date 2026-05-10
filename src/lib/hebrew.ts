// Replace ASCII apostrophe ' with Hebrew geresh ׳ (U+05F3) when it follows
// a Hebrew letter. Geresh is a strong RTL char so it sits visually to the
// LEFT of the preceding Hebrew letters (e.g. תחי' renders correctly).
const HEBREW_LETTER = /[\u0590-\u05FF]/;

export function fixHebrewGeresh(text: string | null | undefined): string {
  if (!text) return "";
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ((ch === "'" || ch === "\u2019") && i > 0 && HEBREW_LETTER.test(text[i - 1])) {
      out += "\u05F3"; // ׳
    } else if ((ch === '"' || ch === "\u201D") && i > 0 && HEBREW_LETTER.test(text[i - 1])) {
      out += "\u05F4"; // ״ gershayim
    } else {
      out += ch;
    }
  }
  return out;
}

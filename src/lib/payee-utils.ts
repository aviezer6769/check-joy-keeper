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

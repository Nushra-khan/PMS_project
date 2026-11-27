export type CsvCell = string | number | undefined;

// Cells starting with these characters are treated as formulas by Excel,
// Google Sheets and LibreOffice, which allows CSV formula injection.
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvEscape(value: CsvCell) {
  let normalized = value === undefined ? "" : String(value);

  if (typeof value === "string" && CSV_FORMULA_PREFIX.test(normalized)) {
    normalized = `'${normalized}`;
  }

  if (/[",\r\n]/.test(normalized)) {
    return `"${normalized.replaceAll('"', '""')}"`;
  }

  return normalized;
}

export function toCsv(headers: string[], rows: CsvCell[][]) {
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(","))
  ].join("\n");
}

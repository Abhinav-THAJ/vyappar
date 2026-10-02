import * as XLSX from "xlsx";

export interface SheetColumn {
  key: string;
  label: string;
  /** Column width in characters. */
  width?: number;
}

export interface SheetSpec {
  name: string;
  columns: SheetColumn[];
  /**
   * Accepts plain objects and interface-typed rows alike. A declared interface
   * has no index signature, so `Record<string, unknown>` would reject it.
   */
  rows: readonly object[];
  /** An optional totals row appended at the bottom. */
  totals?: Record<string, unknown>;
  /** Free-text lines placed above the header, e.g. the report period. */
  preamble?: string[];
}

/**
 * Build an .xlsx workbook.
 *
 * Numbers stay numbers so Excel can sum them; only the header and preamble are
 * text. A sheet name is trimmed to Excel's 31-character limit.
 */
export function buildWorkbook(sheets: SheetSpec[]): Buffer {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const aoa: unknown[][] = [];

    for (const line of sheet.preamble ?? []) aoa.push([line]);
    if (sheet.preamble && sheet.preamble.length > 0) aoa.push([]);

    aoa.push(sheet.columns.map((c) => c.label));

    for (const row of sheet.rows) {
      const record = row as Record<string, unknown>;
      aoa.push(sheet.columns.map((c) => normalise(record[c.key])));
    }

    if (sheet.totals) {
      aoa.push(
        sheet.columns.map((c, i) =>
          i === 0 ? "Total" : normalise(sheet.totals?.[c.key] ?? ""),
        ),
      );
    }

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    worksheet["!cols"] = sheet.columns.map((c) => ({
      wch: c.width ?? Math.max(12, c.label.length + 2),
    }));

    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function normalise(value: unknown): string | number {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";

  // Numeric strings become real numbers so Excel can total them.
  if (typeof value === "string" && value !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }

  return String(value);
}

/** Read the first sheet of an uploaded workbook into row objects. */
export function readWorkbook(
  data: ArrayBuffer,
): { headers: string[]; rows: Record<string, string>[] } {
  const workbook = XLSX.read(data, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { headers: [], rows: [] };

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return { headers: [], rows: [] };

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
  if (aoa.length === 0) return { headers: [], rows: [] };

  const headers = (aoa[0] ?? []).map((h) => String(h ?? "").trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < aoa.length; i += 1) {
    const raw = aoa[i] ?? [];
    const row: Record<string, string> = {};
    let hasValue = false;

    headers.forEach((header, index) => {
      const cell = raw[index];
      const value = cell === null || cell === undefined ? "" : String(cell).trim();
      row[header] = value;
      if (value !== "") hasValue = true;
    });

    if (hasValue) rows.push(row);
  }

  return { headers, rows };
}

/** A downloadable template with headers and one example row. */
export function buildTemplate(columns: SheetColumn[], example: Record<string, unknown>): Buffer {
  return buildWorkbook([
    {
      name: "Template",
      columns,
      rows: [example],
      preamble: [
        "Fill in one row per record. Keep the header row exactly as it is.",
        "The example row below is here to show the format — delete it before importing.",
      ],
    },
  ]);
}

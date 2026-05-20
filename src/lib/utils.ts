import clsx from "clsx";

export function cn(...inputs: Array<string | false | null | undefined>) {
  return clsx(inputs);
}

export function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export function formatNullable(value: string | null | undefined) {
  return value && value.trim() ? value : "None";
}

export function toInteger(value: FormDataEntryValue | null, fallback = 0) {
  if (!value) return fallback;

  const parsed = Number.parseInt(value.toString(), 10);

  return Number.isNaN(parsed) ? fallback : parsed;
}

export function escapeCsv(value: string | null | undefined) {
  const input = value ?? "";
  const normalized = input.replace(/\"/g, '""');
  return `"${normalized}"`;
}

export function csvFromRows(headers: string[], rows: string[][]) {
  const headerLine = headers.map((header) => escapeCsv(header)).join(",");
  const rowLines = rows.map((row) => row.map((cell) => escapeCsv(cell)).join(","));
  return [headerLine, ...rowLines].join("\n");
}

export function computeSaturdayNoonLock(now = new Date()) {
  const day = now.getDay();
  const hour = now.getHours();
  return day === 6 && hour >= 12;
}

export function readableDate(value: string) {
  return new Date(value).toLocaleString();
}

import Papa from "papaparse";

import type {
  CsvPlatform,
  CsvRowError,
  NormalizedEmployee,
} from "../../api/hrms";

/**
 * Parses + normalizes a platform CSV into the shared employee shape.
 *
 * Handles the quirks documented in HRMS-CSV-context.md:
 *  - Keka: split first/last name, manager linked by REPORT EMAIL, and the
 *    CEO reports to themselves (→ root).
 *  - Darwinbox: single Full Name column, manager linked by EMPLOYEE ID,
 *    root has an empty / whitespace / "None" Reports To ID.
 *  - PeopleHR: split first/last name, manager linked by EMAIL or NAME
 *    (two-tier resolution), empty Reports To = root.
 *
 * An optional `columnMap` lets the user explicitly map their CSV's headers to
 * the canonical fields we accept (used by the "match your columns" step).
 */

export type PreviewRow = {
  rowNumber: number;
  name: string;
  email: string | null;
  designation: string | null;
  department: string | null;
  error: string | null;
};

export type ParseOutcome = {
  employees: NormalizedEmployee[];
  errors: CsvRowError[];
  preview: PreviewRow[];
  parsedRows: number;
  skippedRows: number;
};

const INACTIVE_STATUS_RE =
  /terminated|inactiv|left|resign|exited|released|separated/i;

// ---------------------------------------------------------------------------
// Column mapping (header validation UI)
// ---------------------------------------------------------------------------

export type CsvCanonicalField =
  | "externalId"
  | "firstName"
  | "lastName"
  | "fullName"
  | "email"
  | "phone"
  | "designation"
  | "department"
  | "region"
  | "managerRef"
  | "hireDate"
  | "status";

/** Maps a canonical field to the source header the user picked. */
export type ColumnMap = Partial<Record<CsvCanonicalField, string>>;

export type HeaderFieldDef = {
  field: CsvCanonicalField;
  label: string;
  required: boolean;
};

/** The accepted format: fields we let the user map their CSV columns to. */
export const MAPPABLE_FIELDS: HeaderFieldDef[] = [
  { field: "externalId", label: "Employee ID", required: true },
  { field: "firstName", label: "First Name", required: false },
  { field: "lastName", label: "Last Name", required: false },
  { field: "fullName", label: "Full Name", required: false },
  { field: "email", label: "Email", required: true },
  { field: "phone", label: "Phone / Mobile", required: false },
  { field: "designation", label: "Designation", required: true },
  { field: "department", label: "Department", required: true },
  { field: "managerRef", label: "Reports To (Manager)", required: true },
  { field: "hireDate", label: "Date of Joining", required: false },
  { field: "region", label: "Location / Region", required: false },
  { field: "status", label: "Employment Status", required: true },
];

export type HeaderOption = { value: string; label: string };
export type HeaderFieldStatus = HeaderFieldDef & { matchedHeader: string | null };
export type HeaderInspection = {
  headers: string[];
  options: HeaderOption[];
  fields: HeaderFieldStatus[];
  missing: string[];
  nameReady: boolean;
  complete: boolean;
};

// ---------------------------------------------------------------------------
// Raw CSV → array of header-keyed records
// ---------------------------------------------------------------------------

export function parseCsvText(text: string): Papa.ParseResult<Record<string, string>> {
  return Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
  });
}

/** Finds a header by fuzzy name; tolerant of spacing/case/punctuation. */
function findKey<T extends Record<string, unknown>>(
  row: T,
  candidates: string[],
): string | null {
  for (const candidate of candidates) {
    const key = Object.keys(row).find(
      (k) =>
        k.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ===
        candidate.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    );
    if (key) return key;
  }
  return null;
}

function cell(row: Record<string, string>, key: string | null): string | null {
  if (!key) return null;
  const value = row[key];
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isInactive(status: string | null): boolean {
  return !!status && INACTIVE_STATUS_RE.test(status);
}

function isBlank(value: string | null): boolean {
  return value === null || /^(none|na|null|n\/a|0)?$/.test(value);
}

// ---------------------------------------------------------------------------
// Field normalization (mirrors server/src/lib/hrms/dates.ts)
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_DATE_RE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/;
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const SCIENTIFIC_PHONE_RE = /^[0-9.+]*e[+-]?\d+$/i;

function validDayMonth(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  if (day > (DAYS_IN_MONTH[month - 1] ?? 0)) return false;
  if (month === 2 && day === 29) {
    if (year % 4 !== 0 || (year % 100 === 0 && year % 400 !== 0)) return false;
  }
  return true;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function normalizeHireDateValue(
  raw: string | null,
): { value: string | null; reason?: string } {
  const value = raw?.trim();
  if (!value) return { value: null };
  if (value.length > 12) {
    return { value: null, reason: `hire date "${value}" could not be read` };
  }

  const iso = ISO_DATE_RE.exec(value);
  if (iso) return { value };

  const dmy = DMY_DATE_RE.exec(value);
  if (dmy) {
    const [, dayRaw, monthRaw, yearRaw] = dmy;
    if (!dayRaw || !monthRaw || !yearRaw) {
      return { value: null, reason: `hire date "${value}" could not be read` };
    }
    const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    if (validDayMonth(year, month, day)) {
      return { value: `${year}-${pad2(month)}-${pad2(day)}` };
    }
  }

  return { value: null, reason: `hire date "${value}" could not be read` };
}

function normalizePhoneValue(
  raw: string | null,
): { value: string | null; reason?: string } {
  const value = raw?.trim();
  if (!value) return { value: null };

  if (SCIENTIFIC_PHONE_RE.test(value)) {
    return {
      value: null,
      reason: `phone "${value}" looks like a spreadsheet number - re-export as text`,
    };
  }

  const digits = value.replace(/[^\d+]/g, "");
  if (!digits) return { value: null };
  if (digits.indexOf("+") !== digits.lastIndexOf("+")) {
    return { value: null, reason: `phone "${value}" could not be read` };
  }
  if (digits === "+") return { value: null };

  return { value: digits.startsWith("+") ? digits : `+${digits}` };
}

/** Resolves the source header key for a canonical field, respecting an explicit user mapping. */
function columnKey(
  row: Record<string, string>,
  candidates: string[],
  field: CsvCanonicalField,
  columnMap?: ColumnMap,
): string | null {
  const mapped = columnMap?.[field];
  if (mapped !== undefined && Object.prototype.hasOwnProperty.call(row, mapped)) {
    return mapped;
  }
  return findKey(row, candidates);
}

// ---------------------------------------------------------------------------
// Per-platform column descriptors
// ---------------------------------------------------------------------------

interface PlatformColumns {
  externalId: string[];
  firstName: string[];
  lastName: string[];
  fullName: string[];
  email: string[];
  phone: string[];
  designation: string[];
  department: string[];
  region: string[];
  managerRef: string[];
  hireDate: string[];
  status: string[];
}

const COLUMNS: Record<CsvPlatform, PlatformColumns> = {
  keka: {
    externalId: ["Employee Number"],
    firstName: ["First Name"],
    lastName: ["Last Name"],
    fullName: [],
    email: ["Work Email"],
    phone: ["Mobile Number"],
    designation: ["Job Title"],
    department: ["Department"],
    region: ["Location"],
    managerRef: ["Reports To Email"],
    hireDate: ["Date of Joining"],
    status: ["Employment Status"],
  },
  darwinbox: {
    externalId: ["Employee ID"],
    firstName: [],
    lastName: [],
    fullName: ["Full Name", "Employee Name"],
    email: ["Official Email ID", "Email"],
    phone: ["Contact Number", "Mobile"],
    designation: ["Designation"],
    department: ["Department"],
    region: ["Work Location", "Location"],
    managerRef: ["Reports To ID", "Manager ID"],
    hireDate: ["Date of Joining"],
    status: ["Employee Status", "Status"],
  },
  peoplehr: {
    externalId: ["Employee Id", "Employee ID"],
    firstName: ["First Name"],
    lastName: ["Last Name"],
    fullName: [],
    email: ["Email"],
    phone: ["Mobile", "Mobile Number"],
    designation: ["Job Title"],
    department: ["Department"],
    region: ["Location"],
    managerRef: ["Reports To"],
    hireDate: ["Start Date", "Start Date of Employment"],
    status: ["Status"],
  },
};

// ---------------------------------------------------------------------------
// Header inspection (for the "match your columns" step)
// ---------------------------------------------------------------------------

export function inspectHeaders(
  text: string,
  platform: CsvPlatform,
): HeaderInspection {
  const parsed = parseCsvText(text);
  const row = parsed.data[0] ?? {};
  const headers = Object.keys(row);
  const raw = parsed.meta?.fields && parsed.meta.fields.length > 0
    ? parsed.meta.fields
    : headers;

  const options: HeaderOption[] = headers.map((value, idx) => ({
    value,
    label: (raw[idx] ?? value).trim() || value,
  }));

  const fields: HeaderFieldStatus[] = MAPPABLE_FIELDS.map((def) => ({
    ...def,
    matchedHeader: findKey(row, COLUMNS[platform][def.field] ?? []),
  }));

  const first = fields.find((f) => f.field === "firstName")?.matchedHeader ?? null;
  const last = fields.find((f) => f.field === "lastName")?.matchedHeader ?? null;
  const full = fields.find((f) => f.field === "fullName")?.matchedHeader ?? null;
  const nameReady = Boolean((first && last) || full);

  const missing = fields
    .filter((f) => f.required && !f.matchedHeader)
    .map((f) => f.label);
  if (!nameReady) missing.unshift("Name (Full Name, or First Name + Last Name)");

  return { headers, options, fields, missing, nameReady, complete: missing.length === 0 };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export function normalizeRows(
  rows: Record<string, string>[],
  platform: CsvPlatform,
  columnMap?: ColumnMap,
): ParseOutcome {
  const columns = COLUMNS[platform];
  const errors: CsvRowError[] = [];
  const preview: PreviewRow[] = [];
  const base: NormalizedEmployee[] = [];

  // Pass 1 — build base records + validate + preview
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNumber = i + 2; // 1-indexed with header line

    const externalId = cell(row, columnKey(row, columns.externalId, "externalId", columnMap));
    const statusValue = cell(row, columnKey(row, columns.status, "status", columnMap));

    if (isInactive(statusValue)) continue;

    if (!externalId) {
      const nameErr = "Missing employee/ID column value; row skipped.";
      errors.push({ rowNumber, message: nameErr });
      continue;
    }

    const firstName = cell(row, columnKey(row, columns.firstName, "firstName", columnMap)) ?? "";
    const lastName = cell(row, columnKey(row, columns.lastName, "lastName", columnMap)) ?? "";
    const fullName = cell(row, columnKey(row, columns.fullName, "fullName", columnMap)) ?? "";
    const name = [firstName, lastName].filter(Boolean).join(" ").trim() || fullName;

    if (!name) {
      errors.push({ rowNumber, message: "Missing employee name; row skipped." });
      continue;
    }

    const hireDate = normalizeHireDateValue(
      cell(row, columnKey(row, columns.hireDate, "hireDate", columnMap)),
    );
    const phone = normalizePhoneValue(
      cell(row, columnKey(row, columns.phone, "phone", columnMap)),
    );
    for (const field of [hireDate, phone]) {
      if (field.value === null && field.reason) {
        errors.push({ rowNumber, message: field.reason });
      }
    }

    base.push({
      externalHrmsId: externalId,
      externalManagerId: null,
      name,
      email: cell(row, columnKey(row, columns.email, "email", columnMap)),
      phone: phone.value,
      department: cell(row, columnKey(row, columns.department, "department", columnMap)),
      designation: cell(row, columnKey(row, columns.designation, "designation", columnMap)),
      hireDate: hireDate.value,
      rowNumber,
    });

    preview.push({
      rowNumber,
      name,
      email: base[base.length - 1].email,
      designation: base[base.length - 1].designation,
      department: base[base.length - 1].department,
      error: null,
    });
  }

  // Pass 2 — resolve manager references to externalHrmsIds
  const byId = new Map(base.map((e) => [e.externalHrmsId, e]));
  const byEmail = new Map(
    base
      .filter((e) => e.email)
      .map((e) => [e.email!.toLowerCase(), e]),
  );
  const byName = new Map(base.map((e) => [e.name.toLowerCase(), e]));

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    // Match back to the base employee by index (rows that were skipped have no base entry)
    const rowNumber = i + 2;
    const externalId = cell(row, columnKey(row, columns.externalId, "externalId", columnMap));
    const employee = byId.get(externalId ?? "");
    if (!employee) continue;

    const managerRef = cell(row, columnKey(row, columns.managerRef, "managerRef", columnMap));
    if (isBlank(managerRef)) {
      employee.externalManagerId = null;
      continue;
    }

    // Self-reporting (Keka CEO) → root
    if (
      employee.email &&
      managerRef!.toLowerCase().trim() === employee.email.toLowerCase()
    ) {
      employee.externalManagerId = null;
      continue;
    }

    let manager: NormalizedEmployee | null = null;
    if (platform === "darwinbox") {
      manager = byId.get(managerRef!) ?? null;
    } else if (platform === "keka") {
      manager = byEmail.get(managerRef!.toLowerCase()) ?? null;
    } else {
      // peoplehr — two-tier: id → email → name
      manager =
        byId.get(managerRef!) ??
        byEmail.get(managerRef!.toLowerCase()) ??
        byName.get(managerRef!.toLowerCase()) ??
        null;
    }

    if (manager) {
      employee.externalManagerId = manager.externalHrmsId;
    } else {
      // Leave as root but surface a warning so the admin can fix the CSV.
      // Only flag when there was actually a manager reference to resolve.
      const previewRow = preview.find((p) => p.rowNumber === rowNumber);
      if (previewRow) {
        previewRow.error = `Unresolved manager "${managerRef}"`;
        errors.push({ rowNumber, message: `Unresolved manager "${managerRef}"` });
      }
    }
  }

  return {
    employees: base,
    errors,
    preview,
    parsedRows: base.length,
    skippedRows: rows.length - base.length,
  };
}

export async function parseCsvFile(
  file: File,
  platform: CsvPlatform,
  columnMap?: ColumnMap,
): Promise<ParseOutcome> {
  const text = await file.text();
  const result = parseCsvText(text);
  if (result.errors.length > 0) {
    const errors = result.errors.map((e, idx) => ({
      rowNumber: e.row ?? idx + 1,
      message: e.message,
    }));
    return { employees: [], errors, preview: [], parsedRows: 0, skippedRows: 0 };
  }
  return normalizeRows(result.data, platform, columnMap);
}
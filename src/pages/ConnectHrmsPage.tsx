import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { useRouter } from "@tanstack/react-router";

import { Button, Spinner } from "../components";
import { apiGetHrmsStatus, apiUploadCsv } from "../api/hrms";
import type {
  CsvPlatform,
  CsvRowError,
  CsvUploadResponse,
  NormalizedEmployee,
} from "../api/hrms";
import { useAuth } from "../features/auth";
import type { AuthErrorPayload } from "../features/auth";
import { EASE, slideUp, fadeIn } from "../lib/animation";
import { CSV_PLATFORMS, getPlatformInfo } from "../features/csv-upload/platforms";
import {
  inspectHeaders,
  parseCsvFile,
} from "../features/csv-upload/csvParser";
import type { ColumnMap, HeaderInspection } from "../features/csv-upload/csvParser";

// ---------------------------------------------------------------------------
// Wizard state machine
// ---------------------------------------------------------------------------

type Phase =
  | "checking"
  | "select_platform"
  | "download_guide"
  | "upload_csv"
  | "map_headers"
  | "preview"
  | "building"
  | "done"
  | "error";

export function ConnectHrmsPage() {
  const router = useRouter();
  const { signOut } = useAuth();

  const [phase, setPhase] = useState<Phase>("checking");
  const [platform, setPlatform] = useState<CsvPlatform | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [employees, setEmployees] = useState<NormalizedEmployee[]>([]);
  const [errors, setErrors] = useState<CsvRowError[]>([]);
  const [result, setResult] = useState<CsvUploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Header-mapping state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<HeaderInspection | null>(null);
  const [columnMap, setColumnMap] = useState<ColumnMap>({});

  // On mount: if already connected, skip ahead to the dashboard.
  useEffect(() => {
    let cancelled = false;

    apiGetHrmsStatus()
      .then((status) => {
        if (cancelled) return;
        if (status.connected) {
          void router.navigate({ to: "/" });
          return;
        }
        setPhase("select_platform");
      })
      .catch(() => {
        if (!cancelled) setPhase("select_platform");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  function selectPlatform(id: CsvPlatform) {
    setPlatform(id);
    setError(null);
    setPhase("download_guide");
  }

  function handleFile(file: File | undefined | null) {
    if (!file || !platform) return;
    setFileName(file.name);
    setError(null);
    setPendingFile(file);
    setColumnMap({});

    // Inspect headers; if any required field is missing, show mapping step.
    void file.text().then((text) => {
      const info = inspectHeaders(text, platform);
      setInspection(info);
      if (info.complete) {
        parseWithFile(file, platform, {});
      } else {
        setPhase("map_headers");
      }
    }).catch(() => {
      setError("Could not read that file. Please upload a .csv export from your HRMS.");
      setPhase("upload_csv");
    });
  }

  function parseWithFile(file: File, plat: CsvPlatform, map: ColumnMap) {
    setPhase("preview");
    void parseCsvFile(file, plat, map)
      .then((outcome) => {
        setEmployees(outcome.employees);
        setErrors(outcome.errors);
      })
      .catch(() => {
        setError("Could not read that file. Please upload a .csv export from your HRMS.");
        setPhase("upload_csv");
      });
  }

  function handleMappingRecheck() {
    if (!pendingFile || !platform || !inspection) return;
    setError(null);

    // Build the effective column map: user overrides + fuzzy-matched defaults.
    const effective: ColumnMap = { ...columnMap };
    for (const f of inspection.fields) {
      if (f.matchedHeader && !effective[f.field as keyof ColumnMap]) {
        (effective as Record<string, string>)[f.field] = f.matchedHeader;
      }
    }

    const nameOk =
      (effective.firstName || effective.lastName) || effective.fullName;

    if (!effective.externalId || !nameOk || !effective.email || !effective.designation || !effective.department || !effective.managerRef || !effective.status) {
      setError("Please map all the required columns before continuing.");
      return;
    }

    parseWithFile(pendingFile, platform, effective);
  }

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  async function handleUpload() {
    if (!platform || employees.length === 0) return;
    setPhase("building");
    setError(null);

    try {
      const res = await apiUploadCsv(platform, employees, errors);
      setResult(res);
      setPhase("done");
    } catch (err) {
      const payload = err as AuthErrorPayload;
      setError(payload?.message ?? "Something went wrong. Please try again.");
      setPhase("preview");
    }
  }

  function handleContinue() {
    void router.navigate({ to: "/" });
  }

  const meta = platform ? getPlatformInfo(platform) : null;

  // -------------------------------------------------------------------------
  // Checking state
  // -------------------------------------------------------------------------

  if (phase === "checking") {
    return (
      <div className="min-h-screen font-sans flex items-center justify-center bg-neutral-50 p-6">
        <div className="flex flex-col items-center gap-3 text-neutral-500">
          <Spinner size="lg" />
          <p className="text-sm font-medium">Checking your workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans flex flex-col items-center justify-center bg-neutral-50 p-6 overflow-x-hidden">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl shadow-neutral-900/5 sm:p-8"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-600">
          Agility OS
        </p>

        {/* ── Done ─────────────────────────────────────────────────────── */}
        {phase === "done" && result && (
          <motion.div
            key="done"
            variants={slideUp}
            initial="initial"
            animate="animate"
            className="mt-4 flex flex-col gap-4"
          >
            <h1 className="font-serif text-3xl font-medium tracking-normal text-neutral-950">
              Directory imported
            </h1>
            <p className="text-xs text-neutral-500">
              We parsed{" "}
              {getPlatformInfo(result.platform).name.toLowerCase()} data from{" "}
              <span className="font-medium text-neutral-950">
                {fileName ?? "your CSV"}
              </span>{" "}
              and built your org tree.
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label="Imported" value={result.summary.inserted} />
              <Metric label="Updated" value={result.summary.updated} />
              <Metric label="Terminated" value={result.summary.terminated} />
              <Metric label="Teams" value={result.tree.teamsCreated} />
              <Metric label="Users" value={result.tree.usersProvisioned} />
              <Metric label="Edges" value={result.tree.edgesCreated} />
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-800">
                <p className="font-semibold">
                  {result.errors.length} row{result.errors.length === 1 ? "" : "s"}{" "}
                  imported with warnings:
                </p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {result.errors.slice(0, 8).map((err, idx) => (
                    <li key={idx}>
                      Row {err.rowNumber}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button className="w-full mt-1" onClick={handleContinue}>
              Continue to dashboard
            </Button>
          </motion.div>
        )}

        {/* ── Select platform ──────────────────────────────────────────── */}
        {phase === "select_platform" && (
          <motion.div
            key="select"
            variants={slideUp}
            initial="initial"
            animate="animate"
            className="mt-4 flex flex-col gap-4"
          >
            <h1 className="font-serif text-3xl font-medium tracking-normal text-neutral-950">
              Connect your HRMS
            </h1>
            <p className="text-xs text-neutral-500">
              Agility OS imports your employee directory from a CSV export of
              your HRMS. Choose your platform — we{"'"}ll guide you through
              downloading the report.
            </p>

            <div className="flex flex-col gap-2">
              {CSV_PLATFORMS.map((p) => (
                <motion.button
                  key={p.id}
                  type="button"
                  onClick={() => selectPlatform(p.id)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ duration: 0.15, ease: EASE }}
                  className="w-full rounded-xl border border-neutral-300 bg-white p-4 text-left transition-colors hover:border-neutral-500"
                >
                  <span className="font-medium text-neutral-950">{p.name}</span>
                  {p.tagline && (
                    <span className="mt-1 block text-xs text-neutral-500">
                      {p.tagline}
                    </span>
                  )}
                  <span className="mt-1 block text-xs text-neutral-400">
                    {p.description}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Download guide ────────────────────────────────────────────── */}
        {(phase === "download_guide" ||
          phase === "upload_csv" ||
          phase === "map_headers" ||
          phase === "preview" ||
          phase === "building") &&
          meta && (
            <motion.div
              key="tutorial"
              variants={slideUp}
              initial="initial"
              animate="animate"
              className="mt-4 flex flex-col gap-4"
            >
              <button
                type="button"
                onClick={() => {
                  setPhase("select_platform");
                  setError(null);
                  setFileName(null);
                }}
                className="text-xs font-medium text-neutral-500 hover:text-neutral-950 transition-colors self-start"
              >
                ← Back
              </button>

              <h1 className="font-serif text-3xl font-medium tracking-normal text-neutral-950">
                {meta.name}
              </h1>

              {/* Download steps */}
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600 leading-relaxed">
                <p className="font-medium text-neutral-950 mb-2">
                  How to download the report:
                </p>
                <ol className="list-inside list-decimal space-y-1">
                  {meta.steps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
                <p className="mt-3 border-t border-neutral-200 pt-2 text-neutral-500">
                  Required columns:{" "}
                  <span className="font-medium text-neutral-700">
                    {meta.requiredFields.join(" · ")}
                  </span>
                </p>
                <p className="mt-2 text-amber-700">{meta.importantNote}</p>
              </div>

              {/* Sample CSV */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-neutral-300 p-3">
                <p className="text-xs text-neutral-500">
                  Not sure what the export looks like? Download a sample.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => downloadSample(platform!, meta.sampleCsv)}
                >
                  Sample CSV
                </Button>
              </div>

              {/* ── Drag & drop / upload zone ─────────────────────────────── */}
              {(phase === "upload_csv" ||
                phase === "preview" ||
                phase === "building") && (
                <div className="flex flex-col gap-3">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors outline-none ${
                      dragging
                        ? "border-neutral-900 bg-neutral-100"
                        : "border-neutral-300 hover:border-neutral-500"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={onInputChange}
                    />
                    <p className="text-sm font-medium text-neutral-700">
                      {phase === "preview" && fileName
                        ? `Imported ${employees.length} rows from ${fileName}`
                        : "Drag & drop your CSV here, or click to browse"}
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">
                      Usually called{" "}
                      <em className="not-italic underline underline-offset-2">
                        Employee Master Details
                      </em>{" "}
                      or{" "}
                      <em className="not-italic underline underline-offset-2">
                        Employee Directory
                      </em>
                    </p>
                  </div>

                  {employees.length > 0 && (
                    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                      <div>
                        <p className="text-sm font-semibold text-neutral-950">
                          {employees.length} employees ready to import
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {errors.length > 0
                            ? `${errors.length} row${errors.length === 1 ? "" : "s"} imported with warnings. `
                            : ""}
                          Confirm to build your org tree from{" "}
                          {fileName ?? "this CSV"}.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPhase("upload_csv")}
                          disabled={phase === "building"}
                        >
                          Choose another file
                        </Button>
                        <Button
                          loading={phase === "building"}
                          onClick={() => void handleUpload()}
                        >
                          {phase === "building"
                            ? "Building org tree…"
                            : "Confirm & build tree"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── I downloaded the CSV ──────────────────────────────────── */}
              {phase === "download_guide" && (
                <Button
                  className="w-full mt-1"
                  onClick={() => {
                    setError(null);
                    setPhase("upload_csv");
                  }}
                >
                  I{"'"}ve downloaded the CSV — continue
                </Button>
              )}

              {error && (
                <motion.div
                  key={error}
                  variants={fadeIn}
                  initial="initial"
                  animate="animate"
                  className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-700"
                  role="alert"
                >
                  {error}
                </motion.div>
              )}
            </motion.div>
          )}

        {/* ── Map headers ──────────────────────────────────────────────── */}
        {phase === "map_headers" && inspection && meta && (
          <motion.div
            key="map"
            variants={slideUp}
            initial="initial"
            animate="animate"
            className="mt-4 flex flex-col gap-4"
          >
            <button
              type="button"
              onClick={() => {
                setPhase("upload_csv");
                setError(null);
              }}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-950 transition-colors self-start"
            >
              ← Back
            </button>

            <h1 className="font-serif text-2xl font-medium tracking-normal text-neutral-950">
              Match your columns
            </h1>
            <p className="text-xs text-neutral-500 leading-relaxed">
              We couldn{"'"}t find all the columns we need in your CSV header.
              Either update the first row to match the accepted header below,
              or map your columns to our fields.
            </p>

            {/* Accepted header prompt */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-[11px] font-semibold text-neutral-700 mb-1.5">
                The accepted header must be:
              </p>
              <code className="block whitespace-pre-wrap break-all rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[10px] leading-relaxed text-neutral-800">
                {meta.acceptedHeader}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(meta.acceptedHeader);
                }}
                className="mt-2 text-[10px] font-semibold text-neutral-600 hover:text-neutral-950 transition-colors"
              >
                Copy header
              </button>
            </div>

            {/* Column mapping selects */}
            <div className="flex flex-col gap-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Or map your columns
              </p>
              {inspection.fields.map((f) => {
                const isNameField =
                  f.field === "firstName" ||
                  f.field === "lastName" ||
                  f.field === "fullName";
                const mappedValue = columnMap[f.field as keyof ColumnMap] ?? "";

                return (
                  <label
                    key={f.field}
                    className="flex flex-col gap-1"
                  >
                    <span className="text-xs font-medium text-neutral-700">
                      {f.label}
                      {f.required && !isNameField && (
                        <span className="ml-0.5 text-red-500">*</span>
                      )}
                    </span>
                    <select
                      value={mappedValue}
                      onChange={(e) =>
                        setColumnMap((prev) => ({
                          ...prev,
                          [f.field]: e.target.value || undefined,
                        }))
                      }
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-800 outline-none transition-colors focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900/10"
                    >
                      <option value="">
                        {f.matchedHeader
                          ? `Auto-detect (${f.matchedHeader})`
                          : "Not mapped"}
                      </option>
                      {inspection.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {f.field === "fullName" && (
                      <p className="text-[10px] text-neutral-400">
                        Alternatively, map both First Name and Last Name above.
                      </p>
                    )}
                  </label>
                );
              })}
            </div>

            <Button
              className="w-full mt-1"
              onClick={handleMappingRecheck}
            >
              Re-check & continue
            </Button>

            {error && (
              <motion.div
                key={error}
                variants={fadeIn}
                initial="initial"
                animate="animate"
                className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-700"
                role="alert"
              >
                {error}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────── */}
        {phase !== "done" && (
          <div className="mt-6 border-t border-neutral-200 pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-neutral-400">Need to change account?</p>
              <Button variant="link" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-center">
      <p className="font-serif text-2xl font-medium text-neutral-950">
        {value.toLocaleString()}
      </p>
      <p className="text-xs font-medium text-neutral-500">{label}</p>
    </div>
  );
}

function downloadSample(id: CsvPlatform, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agilityos-${id}-sample.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { PageHeader } from "@/components/patterns/page-header";
import {
  parseUploadAction,
  validateImportAction,
  commitImportAction,
  type ParsedUpload,
  type ImportOutcome,
} from "@/server/actions/import";
import type { ImportField, ImportKind, RowIssue } from "@/server/services/import";
import { cn } from "@/lib/utils";

const STEPS = ["Template", "Upload", "Map columns", "Check", "Import"] as const;

/**
 * The five-step Excel import shared by parties and items.
 *
 * Nothing is written until the final step, and the whole batch commits in one
 * database transaction, so a partial import can never leave half a record.
 */
export function ImportWizard({
  kind,
  title,
  fields,
}: {
  kind: ImportKind;
  title: string;
  fields: ImportField[];
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [upload, setUpload] = React.useState<ParsedUpload | null>(null);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [issues, setIssues] = React.useState<RowIssue[]>([]);
  const [validCount, setValidCount] = React.useState(0);
  const [updateExisting, setUpdateExisting] = React.useState(false);
  const [outcome, setOutcome] = React.useState<ImportOutcome | null>(null);

  const fileInput = React.useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const result = await parseUploadAction(kind, formData);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setUpload(result.data);
    setMapping(result.data.mapping);
    setStep(2);
  }

  async function check() {
    if (!upload) return;
    setBusy(true);
    setError(null);

    const result = await validateImportAction({ kind, mapping, rows: upload.rows });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setIssues(result.data.issues);
    setValidCount(result.data.validCount);
    setStep(3);
  }

  async function commit() {
    if (!upload) return;
    setBusy(true);
    setError(null);

    const result = await commitImportAction({
      kind,
      mapping,
      rows: upload.rows,
      updateExisting,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOutcome(result.data);
    setStep(4);
    toast.success(
      `Imported ${result.data.created} new and updated ${result.data.updated} ${title.toLowerCase()}`,
    );
    router.refresh();
  }

  const requiredUnmapped = fields
    .filter((f) => f.required && !mapping[f.key])
    .map((f) => f.label);

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title={`Import ${title}`} description="From an Excel or CSV file" />

      <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
        {/* Step rail */}
        <ol className="mb-6 flex items-center gap-2" aria-label="Import progress">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                  i < step
                    ? "bg-brand-600 text-white"
                    : i === step
                      ? "bg-brand-600 text-white"
                      : "bg-[var(--surface-3)] text-[var(--text-muted)]",
                )}
              >
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-[12px] sm:block",
                  i === step ? "font-medium" : "text-[var(--text-muted)]",
                )}
              >
                {label}
              </span>
              {i < STEPS.length - 1 ? (
                <span
                  className={cn("h-0.5 flex-1 rounded", i < step ? "bg-brand-600" : "bg-[var(--surface-3)]")}
                />
              ) : null}
            </li>
          ))}
        </ol>

        {error ? (
          <p className="mb-4 rounded-lg bg-[var(--color-negative-soft)] px-3 py-2.5 text-[13px] text-[var(--color-negative)]">
            {error}
          </p>
        ) : null}

        {/* Step 1: template */}
        {step === 0 ? (
          <div className="surface-card p-6">
            <h2 className="text-[15px] font-semibold">Start from the template</h2>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              The template has the right headers and one example row. You can also upload
              your own sheet — the next step lets you map its columns.
            </p>

            <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border-subtle)]">
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Column</TH>
                    <TH>Required</TH>
                    <TH>Example</TH>
                  </TR>
                </THead>
                <TBody>
                  {fields.map((field) => (
                    <TR key={field.key}>
                      <TD>
                        <div className="font-medium">{field.label}</div>
                        {field.hint ? (
                          <div className="text-[12px] text-[var(--text-muted)]">{field.hint}</div>
                        ) : null}
                      </TD>
                      <TD>
                        {field.required ? (
                          <Badge variant="negative">Required</Badge>
                        ) : (
                          <span className="text-[var(--text-muted)]">Optional</span>
                        )}
                      </TD>
                      <TD className="text-[var(--text-secondary)]">{field.example}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href={`/api/import/template?kind=${kind}`} download>
                  <Download className="size-4" />
                  Download template
                </a>
              </Button>
              <Button onClick={() => setStep(1)}>
                Continue
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {/* Step 2: upload */}
        {step === 1 ? (
          <div className="surface-card p-6">
            <h2 className="text-[15px] font-semibold">Upload your file</h2>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              .xlsx, .xls or .csv, up to 8 MB. Only the first sheet is read.
            </p>

            <label
              htmlFor="importFile"
              className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-strong)] p-10 text-center transition-colors hover:border-brand-400 hover:bg-[var(--surface-2)]"
            >
              <Upload className="size-8 text-[var(--text-muted)]" />
              <span className="mt-3 text-[13px] font-medium">Choose a file</span>
              <span className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                or drag it onto this box
              </span>
              <input
                ref={fileInput}
                id="importFile"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFile(file);
                }}
              />
            </label>

            <div className="mt-5 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              {busy ? <Button loading>Reading…</Button> : null}
            </div>
          </div>
        ) : null}

        {/* Step 3: mapping */}
        {step === 2 && upload ? (
          <div className="surface-card p-6">
            <h2 className="text-[15px] font-semibold">Map your columns</h2>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              {upload.totalRows} row{upload.totalRows === 1 ? "" : "s"} found. We matched
              what we could — check the rest.
            </p>

            <div className="mt-4 space-y-3">
              {fields.map((field) => (
                <div key={field.key} className="flex flex-wrap items-center gap-3">
                  <div className="w-44 shrink-0">
                    <span className="text-[13px] font-medium">{field.label}</span>
                    {field.required ? (
                      <span className="ml-1 text-[var(--color-negative)]">*</span>
                    ) : null}
                  </div>

                  <ArrowLeft className="size-4 shrink-0 text-[var(--text-muted)]" />

                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [field.key]: e.target.value }))
                    }
                    className={cn(
                      "h-9 min-w-[200px] flex-1 rounded-lg border bg-[var(--surface)] px-3 text-sm",
                      field.required && !mapping[field.key]
                        ? "border-[var(--color-negative)]"
                        : "border-[var(--border-strong)]",
                    )}
                    aria-label={`Column for ${field.label}`}
                  >
                    <option value="">— not imported —</option>
                    {upload.headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {requiredUnmapped.length > 0 ? (
              <p className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--color-warning-soft)] px-3 py-2 text-[13px] text-[var(--color-warning)]">
                <AlertTriangle className="size-4 shrink-0" />
                Map {requiredUnmapped.join(", ")} before continuing.
              </p>
            ) : null}

            <div className="mt-5 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button
                onClick={() => void check()}
                disabled={requiredUnmapped.length > 0}
                loading={busy}
              >
                Check rows
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {/* Step 4: validation */}
        {step === 3 ? (
          <div className="surface-card p-6">
            <h2 className="text-[15px] font-semibold">Check before importing</h2>

            <div className="mt-4 flex flex-wrap gap-3">
              <div className="rounded-lg bg-[var(--color-positive-soft)] px-4 py-3">
                <div className="text-[12px] text-[var(--color-positive)]">Ready to import</div>
                <div className="tnum text-xl font-semibold text-[var(--color-positive)]">
                  {validCount}
                </div>
              </div>
              <div
                className={cn(
                  "rounded-lg px-4 py-3",
                  issues.length > 0 ? "bg-[var(--color-negative-soft)]" : "bg-[var(--surface-3)]",
                )}
              >
                <div
                  className={cn(
                    "text-[12px]",
                    issues.length > 0
                      ? "text-[var(--color-negative)]"
                      : "text-[var(--text-muted)]",
                  )}
                >
                  Rows with problems
                </div>
                <div
                  className={cn(
                    "tnum text-xl font-semibold",
                    issues.length > 0 ? "text-[var(--color-negative)]" : "",
                  )}
                >
                  {new Set(issues.map((i) => i.row)).size}
                </div>
              </div>
            </div>

            {issues.length > 0 ? (
              <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-[var(--border-subtle)]">
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Row</TH>
                      <TH>Column</TH>
                      <TH>Problem</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {issues.slice(0, 200).map((issue, i) => (
                      <TR key={i}>
                        <TD className="tnum">{issue.row}</TD>
                        <TD>{issue.field}</TD>
                        <TD className="text-[var(--color-negative)]">{issue.message}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            ) : (
              <p className="mt-4 text-[13px] text-[var(--text-secondary)]">
                Every row passed. Rows with problems, if any, are simply skipped.
              </p>
            )}

            <label className="mt-5 flex items-center gap-2.5">
              <Checkbox
                checked={updateExisting}
                onCheckedChange={(v) => setUpdateExisting(v === true)}
              />
              <span className="text-sm">
                Update records that already exist with the same name
                <span className="block text-[12px] text-[var(--text-muted)]">
                  Leave this off to skip duplicates instead.
                </span>
              </span>
            </label>

            <div className="mt-5 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button onClick={() => void commit()} loading={busy} disabled={validCount === 0}>
                Import {validCount} row{validCount === 1 ? "" : "s"}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {/* Step 5: done */}
        {step === 4 && outcome ? (
          <div className="surface-card p-6">
            <EmptyState
              title="Import complete"
              description={`${outcome.created} created · ${outcome.updated} updated · ${outcome.skipped} skipped`}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep(0);
                      setUpload(null);
                      setIssues([]);
                      setOutcome(null);
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                  >
                    <FileSpreadsheet className="size-4" />
                    Import another file
                  </Button>
                  <Button
                    onClick={() =>
                      router.push(
                        kind === "parties"
                          ? "/parties"
                          : kind === "items"
                            ? "/items"
                            : "/sale/invoices",
                      )
                    }
                  >
                    View {title.toLowerCase()}
                  </Button>
                </div>
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

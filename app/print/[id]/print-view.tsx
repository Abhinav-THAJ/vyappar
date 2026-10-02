"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download, Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { THEMES, ThermalTheme, type ThemeName } from "@/components/print/invoice-themes";
import type { InvoiceDocument } from "@/server/services/document";
import { cn } from "@/lib/utils";

type Paper = "A4-classic" | "A4-modern" | "A4-compact" | "thermal80" | "thermal58";

const PAPERS: { value: Paper; label: string }[] = [
  { value: "A4-classic", label: "A4 — Classic" },
  { value: "A4-modern", label: "A4 — Modern" },
  { value: "A4-compact", label: "A4 — Compact" },
  { value: "thermal80", label: "Thermal 80mm" },
  { value: "thermal58", label: "Thermal 58mm" },
];

/**
 * Invoice preview with a theme picker, copy labels, print, PDF download and
 * WhatsApp share. The toolbar carries `no-print`, so only the document itself
 * reaches the paper.
 */
export function PrintView({
  doc,
  qrDataUrl,
  whatsappUrl,
  backHref,
  autoShare,
}: {
  doc: InvoiceDocument;
  qrDataUrl: string | null;
  whatsappUrl: string | null;
  backHref: string;
  autoShare: boolean;
}) {
  const initialPaper: Paper =
    doc.print.paperSize === "thermal80"
      ? "thermal80"
      : doc.print.paperSize === "thermal58"
        ? "thermal58"
        : (`A4-${doc.print.theme}` as Paper);

  const [paper, setPaper] = React.useState<Paper>(initialPaper);
  const [copyLabel, setCopyLabel] = React.useState<string>(
    doc.print.showCopyLabel ? (doc.print.copyLabels[0] ?? "Original") : "",
  );
  const [showQr, setShowQr] = React.useState(doc.print.showUpiQr && !!qrDataUrl);
  const [downloading, setDownloading] = React.useState(false);

  // Opened from the share icon: go straight to WhatsApp.
  React.useEffect(() => {
    if (autoShare && whatsappUrl) window.open(whatsappUrl, "_blank", "noopener");
  }, [autoShare, whatsappUrl]);

  const isThermal = paper === "thermal80" || paper === "thermal58";
  const themeName = (paper.startsWith("A4-") ? paper.slice(3) : "classic") as ThemeName;
  const Theme = THEMES[themeName];

  async function downloadPdf() {
    setDownloading(true);
    try {
      const response = await fetch(
        `/api/pdf/${doc.id}?theme=${themeName}&paper=${isThermal ? paper : "A4"}${
          copyLabel ? `&copy=${encodeURIComponent(copyLabel)}` : ""
        }`,
      );
      if (!response.ok) throw new Error("PDF generation failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${doc.typeLabel.replace(/\s+/g, "-")}-${doc.displayNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // Falls back to the browser's own print-to-PDF, which always works.
      window.print();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[var(--surface-sunken)]">
      {/* Toolbar */}
      <div className="no-print sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={backHref}>
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">
              {doc.typeLabel} {doc.displayNumber}
            </div>
            <div className="truncate text-[12px] text-[var(--text-muted)]">
              {doc.party?.name ?? "Cash sale"}
            </div>
          </div>

          <Select value={paper} onValueChange={(v) => setPaper(v as Paper)}>
            <SelectTrigger className="w-44" aria-label="Paper and theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAPERS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!isThermal ? (
            <Select
              value={copyLabel || "none"}
              onValueChange={(v) => setCopyLabel(v === "none" ? "" : v)}
            >
              <SelectTrigger className="w-36" aria-label="Copy label">
                <SelectValue placeholder="No label" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No label</SelectItem>
                {doc.print.copyLabels.map((label) => (
                  <SelectItem key={label} value={label}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {qrDataUrl ? (
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox checked={showQr} onCheckedChange={(v) => setShowQr(v === true)} />
              UPI QR
            </label>
          ) : null}

          <div className="flex items-center gap-2">
            {whatsappUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <Share2 className="size-4" />
                  WhatsApp
                </a>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void downloadPdf()} loading={downloading}>
              <Download className="size-4" />
              PDF
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="size-4" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Document */}
      <div className={cn("flex justify-center p-4 sm:p-8", isThermal && "p-4")}>
        <div className="overflow-x-auto bg-white shadow-lg print:shadow-none">
          {isThermal ? (
            <ThermalTheme doc={doc} width={paper === "thermal58" ? 58 : 80} />
          ) : (
            <Theme
              doc={{ ...doc, print: { ...doc.print, showUpiQr: showQr } }}
              copyLabel={copyLabel || undefined}
              qrDataUrl={qrDataUrl}
            />
          )}
        </div>
      </div>
    </div>
  );
}

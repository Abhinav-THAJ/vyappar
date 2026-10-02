import type { Metadata } from "next";
import { Keyboard } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { APP_NAME } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Help & Shortcuts" };

const SHORTCUTS = [
  { group: "Anywhere", items: [
    { keys: ["Ctrl", "F"], label: "Open anything — jump to any screen or report" },
    { keys: ["Ctrl", "K"], label: "The same palette, if you are used to that key" },
    { keys: ["Alt", "S"], label: "New sale invoice" },
    { keys: ["Alt", "P"], label: "New purchase bill" },
  ]},
  { group: "On a transaction form", items: [
    { keys: ["Tab"], label: "Move to the next cell" },
    { keys: ["Enter"], label: "Move down the same column, or add a row at the end" },
    { keys: ["Alt", "N"], label: "Add a line" },
    { keys: ["Ctrl", "S"], label: "Save" },
  ]},
  { group: "In a dialog", items: [
    { keys: ["Esc"], label: "Close without saving" },
  ]},
];

const CONCEPTS = [
  {
    title: "Company and firm",
    body: "A company is the whole data set — the thing you pick when you log in. A firm sits inside it with its own GSTIN, logo and invoice numbering. Parties and items are shared across the firms of a company; invoices belong to one firm.",
  },
  {
    title: "Balances are calculated, not typed",
    body: "Party balances, cash, bank and stock are summed from the ledger and stock movements every time you look at them. That is why Verify My Data can tell you whether anything has drifted.",
  },
  {
    title: "CGST + SGST or IGST",
    body: "If the place of supply matches the firm's state, GST splits into CGST and SGST. Otherwise the whole rate is charged as IGST. The invoice form shows which applies before you save.",
  },
  {
    title: "Editing a saved invoice",
    body: "Editing re-posts the document: the old stock movements and ledger entries are removed and rewritten together, so the books never sit half-updated.",
  },
];

export default function HelpPage() {
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Help & Shortcuts" description={`How ${APP_NAME} works`} />

      <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
        <section className="surface-card p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Keyboard className="size-[18px] text-[var(--text-muted)]" />
            Keyboard shortcuts
          </h2>

          <div className="mt-4 space-y-5">
            {SHORTCUTS.map((group) => (
              <div key={group.group}>
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {group.group}
                </h3>
                <dl className="mt-2 space-y-2">
                  {group.items.map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-4">
                      <dt className="text-[13px] text-[var(--text-secondary)]">{item.label}</dt>
                      <dd className="flex shrink-0 gap-1">
                        {item.keys.map((key) => (
                          <kbd
                            key={key}
                            className="rounded border border-[var(--border-strong)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-medium"
                          >
                            {key}
                          </kbd>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card p-5">
          <h2 className="text-[15px] font-semibold">How things work</h2>
          <div className="mt-4 space-y-4">
            {CONCEPTS.map((concept) => (
              <div key={concept.title}>
                <h3 className="text-[13px] font-semibold">{concept.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {concept.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

/** The product name lives in one place so a rename is a one-line change (D-01). */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Bella Books";

/**
 * An original mark: a ledger page with a rising rule through it.
 * Drawn from primitives — no third-party asset, nothing borrowed.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label={`${APP_NAME} logo`}
      className={cn("size-8", className)}
    >
      <rect width="32" height="32" rx="8" className="fill-brand-600" />
      <path
        d="M9 8.5h9.5a4.5 4.5 0 0 1 4.5 4.5v10.5a0 0 0 0 1 0 0H13a4 4 0 0 1-4-4V8.5Z"
        className="fill-white/15"
      />
      <path
        d="M11.5 22.5 15 18l3 2.5 4.5-7"
        className="stroke-white"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22.5" cy="13.5" r="1.9" className="fill-accent-400" />
    </svg>
  );
}

export function Logo({
  className,
  showName = true,
  tone = "dark",
}: {
  className?: string;
  showName?: boolean;
  tone?: "dark" | "light";
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {showName ? (
        <span
          className={cn(
            "text-[15px] font-semibold tracking-tight",
            tone === "light" ? "text-white" : "text-[var(--text-primary)]",
          )}
        >
          {APP_NAME}
        </span>
      ) : null}
    </span>
  );
}

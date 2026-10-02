import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col px-6 py-10 sm:px-12">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-center text-[12px] text-[var(--text-muted)]">
          GST invoicing, inventory and accounting for Indian businesses.
        </p>
      </div>

      {/* Brand side */}
      <div className="relative hidden overflow-hidden bg-[var(--sidebar-bg)] lg:block">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden
        />
        <div className="relative flex h-full flex-col justify-center px-14 text-white">
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Every invoice, party and rupee in one ledger.
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--sidebar-text)]">
            GST-ready invoicing with CGST/SGST and IGST handled automatically, stock that
            moves with every sale, and party balances derived from the ledger rather than
            typed in.
          </p>

          <ul className="mt-10 space-y-3 text-[14px] text-[var(--sidebar-text)]">
            {[
              "Multiple companies, multiple firms per company",
              "GSTR-1, GSTR-2 and GSTR-3B from your own data",
              "Indian number formats, amounts in words, DD/MM/YYYY",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent-400" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

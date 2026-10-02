"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type BannerTone = "info" | "warning" | "error";

export interface SystemBannerProps {
  /** Stable id; dismissal is remembered per browser under this key. */
  id: string;
  tone?: BannerTone;
  message: React.ReactNode;
  action?: { label: string; href: string };
  dismissible?: boolean;
}

const TONES: Record<BannerTone, { wrap: string; icon: React.ElementType; iconClass: string }> = {
  info: {
    wrap: "bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100",
    icon: Info,
    iconClass: "text-brand-600 dark:text-brand-300",
  },
  warning: {
    wrap: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
    icon: AlertTriangle,
    iconClass: "text-[var(--color-warning)]",
  },
  error: {
    wrap: "bg-[var(--color-negative-soft)] text-[var(--color-negative)]",
    icon: AlertTriangle,
    iconClass: "text-[var(--color-negative)]",
  },
};

/**
 * One generic banner in place of the reference app's stacked plan notices
 * (D-06 in the decisions log). Dismissal is a per-browser convenience, so a
 * blocked or cleared localStorage simply means the banner shows again.
 */
export function SystemBanner({
  id,
  tone = "info",
  message,
  action,
  dismissible = true,
}: SystemBannerProps) {
  const storageKey = `bb.banner.${id}`;
  const [hidden, setHidden] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(storageKey) === "1");
    } catch {
      setHidden(false);
    }
    setReady(true);
  }, [storageKey]);

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // A private window cannot persist this; hiding for the session is enough.
    }
  }

  if (!ready || hidden) return null;

  const { wrap, icon: Icon, iconClass } = TONES[tone];

  return (
    <div className={cn("flex items-center gap-3 px-4 py-2.5 text-[13px]", wrap)} role="status">
      <Icon className={cn("size-4 shrink-0", iconClass)} />
      <div className="min-w-0 flex-1">{message}</div>
      {action ? (
        <Link
          href={action.href}
          className="inline-flex shrink-0 items-center gap-0.5 font-semibold underline-offset-2 hover:underline"
        >
          {action.label}
          <ChevronRight className="size-3.5" />
        </Link>
      ) : null}
      {dismissible ? (
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded p-1 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

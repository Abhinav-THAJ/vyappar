"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTriggerPill,
  SelectValue,
} from "@/components/ui/select";
import { PERIOD_LABELS, PERIOD_PRESETS, type PeriodPreset } from "@/lib/filters";

/** The "This Month" dropdown on the Total Sale card (ref-01). */
export function PeriodPicker({ current, label }: { current: PeriodPreset; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function change(value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("period", value);
    next.delete("from");
    next.delete("to");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <Select value={current} onValueChange={change}>
      <SelectTriggerPill aria-label="Period">
        <SelectValue>{label}</SelectValue>
      </SelectTriggerPill>
      <SelectContent align="end">
        {PERIOD_PRESETS.filter((p) => p !== "custom").map((p) => (
          <SelectItem key={p} value={p}>
            {PERIOD_LABELS[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

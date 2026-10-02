"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckboxField, Switch } from "@/components/ui/controls";
import { InfoHint } from "@/components/ui/display";
import { saveSettingsAction } from "@/server/actions/settings";
import type { SettingsTab } from "@/lib/validators/settings";
import { cn } from "@/lib/utils";

/**
 * A settings tab that tracks dirty state and saves the whole tab at once.
 *
 * The save bar only appears once something changed, which keeps the screen
 * calm while still making it obvious there is unsaved work.
 */
export function SettingsForm<T extends Record<string, unknown>>({
  tab,
  initial,
  children,
  canWrite,
}: {
  tab: SettingsTab;
  initial: T;
  children: (
    values: T,
    set: <K extends keyof T>(key: K, value: T[K]) => void,
  ) => React.ReactNode;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<T>(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const dirty = React.useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial),
    [values, initial],
  );

  React.useEffect(() => setValues(initial), [initial]);

  const set = React.useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);

    const result = await saveSettingsAction({ tab, values });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success("Settings saved");
    router.refresh();
  }

  return (
    <div className="relative">
      {error ? (
        <p className="mb-4 rounded-lg bg-[var(--color-negative-soft)] px-3 py-2 text-[13px] text-[var(--color-negative)]">
          {error}
        </p>
      ) : null}

      <fieldset disabled={!canWrite} className="space-y-6">
        {children(values, set)}
      </fieldset>

      {canWrite && dirty ? (
        <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-3 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 shadow-lg">
          <span className="text-[13px] text-[var(--text-secondary)]">
            You have unsaved changes
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setValues(initial)}>
              Discard
            </Button>
            <Button size="sm" onClick={() => void save()} loading={saving}>
              <Save className="size-4" />
              Save
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** A titled column of settings, matching the three-column General tab. */
export function SettingsGroup({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("", className)}>
      <h2 className="border-b border-[var(--border-subtle)] pb-2 text-[15px] font-semibold">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">{description}</p>
      ) : null}
      <div className="mt-4 space-y-3.5">{children}</div>
    </section>
  );
}

/** A labelled toggle row with an optional info hint and nested children. */
export function SettingToggle({
  id,
  label,
  hint,
  checked,
  onChange,
  children,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5">
        <CheckboxField
          id={id}
          label={label}
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
        />
        {hint ? <InfoHint text={hint} className="mt-1" /> : null}
      </div>
      {checked && children ? <div className="ml-7 space-y-3">{children}</div> : null}
    </div>
  );
}

/** A switch-style row, used where the setting reads as on/off rather than a choice. */
export function SettingSwitch({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm">
        {label}
        {hint ? <InfoHint text={hint} /> : null}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

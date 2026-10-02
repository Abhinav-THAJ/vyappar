"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer size-[18px] shrink-0 rounded border-2 border-[var(--border-strong)] transition-colors",
      "data-[state=checked]:border-brand-600 data-[state=checked]:bg-brand-600",
      "data-[state=indeterminate]:border-brand-600 data-[state=indeterminate]:bg-brand-600",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
      {props.checked === "indeterminate" ? (
        <Minus className="size-3.5" strokeWidth={3} />
      ) : (
        <Check className="size-3.5" strokeWidth={3} />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";

/**
 * The labelled checkbox row that makes up most of the Settings screen, with an
 * optional info tooltip target and nested children (ref-11).
 */
export function CheckboxField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  children,
  className,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          className="mt-0.5"
        />
        <div className="min-w-0">
          <label
            htmlFor={id}
            className={cn(
              "cursor-pointer text-sm",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            {label}
          </label>
          {description ? (
            <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{description}</p>
          ) : null}
        </div>
      </div>
      {children ? <div className="ml-7 space-y-2">{children}</div> : null}
    </div>
  );
}

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-[22px] w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
      "data-[state=checked]:bg-brand-600 data-[state=unchecked]:bg-[var(--border-strong)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block size-[18px] rounded-full bg-white shadow transition-transform",
        "data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root ref={ref} className={cn("grid gap-2", className)} {...props} />
));
RadioGroup.displayName = "RadioGroup";

export const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "aspect-square size-[18px] shrink-0 rounded-full border-2 border-[var(--border-strong)]",
      "data-[state=checked]:border-brand-600 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
      <span className="size-2.5 rounded-full bg-brand-600" />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = "RadioGroupItem";

/** The selectable card used by the import-method chooser (ref-09). */
export function RadioCard({
  value,
  id,
  title,
  description,
  icon,
  badge,
  className,
  selected,
}: {
  value: string;
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  selected: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 p-6 text-center transition-colors",
        selected
          ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/40"
          : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]",
        className,
      )}
    >
      <div className="absolute right-4 top-4">
        <RadioGroupItem value={value} id={id} />
      </div>
      {badge ? <div className="absolute left-4 top-4">{badge}</div> : null}
      {icon ? <div className="mt-2">{icon}</div> : null}
      <div>
        <div className="text-base font-semibold">{title}</div>
        {description ? (
          <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
    </label>
  );
}

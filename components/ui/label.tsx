"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { required?: boolean }
>(({ className, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-[13px] font-medium text-[var(--text-secondary)] peer-disabled:opacity-60",
      className,
    )}
    {...props}
  >
    {children}
    {required ? <span className="ml-0.5 text-[var(--color-negative)]">*</span> : null}
  </LabelPrimitive.Root>
));
Label.displayName = "Label";

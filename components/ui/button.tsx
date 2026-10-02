"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // The filled primary action: "+ Add Sale", "+ Add Party".
        primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm",
        // The tinted secondary: "+ Add Purchase".
        secondary:
          "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-200 dark:hover:bg-brand-900",
        // The amber split button on the Items screen.
        accent: "bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700 shadow-sm",
        outline:
          "border border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--surface-3)]",
        ghost: "hover:bg-[var(--surface-3)]",
        destructive: "bg-[var(--color-negative)] text-white hover:brightness-110",
        link: "text-brand-600 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-[13px] [&_svg]:size-4",
        md: "h-9 px-4 [&_svg]:size-4",
        lg: "h-11 px-6 [&_svg]:size-5",
        icon: "size-9 [&_svg]:size-4",
        iconSm: "size-8 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };

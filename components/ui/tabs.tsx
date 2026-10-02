"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

/**
 * The full-width underlined tab strip above Items (PRODUCTS / SERVICES /
 * CATEGORY / UNITS) and Expenses (CATEGORY / ITEMS).
 */
export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex w-full items-stretch overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--surface)]",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative flex-1 whitespace-nowrap px-4 py-3 text-[13px] font-semibold uppercase tracking-wide transition-colors",
      "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
      "data-[state=active]:text-brand-700 dark:data-[state=active]:text-brand-300",
      "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent",
      "data-[state=active]:after:bg-brand-600",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

/** A compact pill variant for settings sub-navigation. */
export const TabsListPills = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("inline-flex gap-1 rounded-lg bg-[var(--surface-3)] p-1", className)}
    {...props}
  />
));
TabsListPills.displayName = "TabsListPills";

export const TabsTriggerPill = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "rounded-md px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors",
      "data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--text-primary)] data-[state=active]:shadow-sm",
      className,
    )}
    {...props}
  />
));
TabsTriggerPill.displayName = "TabsTriggerPill";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("min-h-0 flex-1 outline-none", className)}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";

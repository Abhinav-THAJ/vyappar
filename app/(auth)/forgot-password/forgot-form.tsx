"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/forms/form-field";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validators/auth";
import { forgotPasswordAction } from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setFormError(null);
    const result = await forgotPasswordAction(values);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--color-positive-soft)]">
          <MailCheck className="size-6 text-[var(--color-positive)]" />
        </span>
        <h2 className="mt-4 text-[15px] font-semibold">Check your inbox</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          If an account exists for {getValues("email")}, a reset link is on its way. The
          link is good for one hour.
        </p>
        <p className="mt-3 text-[12px] text-[var(--text-muted)]">
          In development the link is printed to the server console instead of being emailed.
        </p>
        <Button asChild variant="outline" className="mt-5 w-full">
          <Link href="/login">Back to log in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormError message={formError} />

      <Field id="email" label="Email" required error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="you@business.in"
          invalid={!!errors.email}
          {...register("email")}
        />
      </Field>

      <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>

      <p className="text-center text-[13px] text-[var(--text-secondary)]">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}

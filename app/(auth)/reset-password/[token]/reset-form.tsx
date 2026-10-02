"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/forms/form-field";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validators/auth";
import { resetPasswordAction } from "@/server/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordInput) {
    setFormError(null);
    const result = await resetPasswordAction(values);

    if (!result.ok) {
      setFormError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (field === "password" || field === "confirmPassword") {
          setError(field, { message: messages[0] });
        }
      }
      return;
    }

    toast.success("Password changed. Log in with the new one.");
    router.push("/login");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormError message={formError} />
      <input type="hidden" {...register("token")} />

      <Field
        id="password"
        label="New password"
        required
        hint="At least 8 characters."
        error={errors.password?.message}
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          invalid={!!errors.password}
          {...register("password")}
        />
      </Field>

      <Field
        id="confirmPassword"
        label="Confirm new password"
        required
        error={errors.confirmPassword?.message}
      >
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          invalid={!!errors.confirmPassword}
          {...register("confirmPassword")}
        />
      </Field>

      <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
        {isSubmitting ? "Saving…" : "Change password"}
      </Button>

      <p className="text-center text-[13px] text-[var(--text-secondary)]">
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Back to log in
        </Link>
      </p>
    </form>
  );
}

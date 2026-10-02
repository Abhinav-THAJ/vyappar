"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/forms/form-field";
import { signupSchema, type SignupInput } from "@/lib/validators/auth";
import { signupAction } from "@/server/actions/auth";

export function SignupForm() {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", mobile: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: SignupInput) {
    setFormError(null);
    const result = await signupAction(values);

    if (!result.ok) {
      setFormError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (field in values) {
          setError(field as keyof SignupInput, { message: messages[0] });
        }
      }
      return;
    }

    // A brand new account has no company yet, so go straight to the wizard.
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormError message={formError} />

      <Field id="name" label="Your name" required error={errors.name?.message}>
        <Input
          id="name"
          autoComplete="name"
          autoFocus
          placeholder="Anjali Menon"
          invalid={!!errors.name}
          {...register("name")}
        />
      </Field>

      <Field id="email" label="Email" required error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@business.in"
          invalid={!!errors.email}
          {...register("email")}
        />
      </Field>

      <Field
        id="mobile"
        label="Mobile"
        hint="Optional. Used for invoice sharing and reminders."
        error={errors.mobile?.message}
      >
        <Input
          id="mobile"
          type="tel"
          autoComplete="tel"
          placeholder="9946050006"
          invalid={!!errors.mobile}
          {...register("mobile")}
        />
      </Field>

      <Field
        id="password"
        label="Password"
        required
        hint="At least 8 characters."
        error={errors.password?.message}
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          invalid={!!errors.password}
          {...register("password")}
        />
      </Field>

      <Field
        id="confirmPassword"
        label="Confirm password"
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
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

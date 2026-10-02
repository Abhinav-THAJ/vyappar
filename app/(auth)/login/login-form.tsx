"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/forms/form-field";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { loginAction } from "@/server/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    const result = await loginAction(values);

    if (!result.ok) {
      setFormError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (field === "email" || field === "password") {
          setError(field, { message: messages[0] });
        }
      }
      return;
    }

    router.push(next && next.startsWith("/") ? next : "/companies");
    router.refresh();
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

      <Field id="password" label="Password" required error={errors.password?.message}>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className="pr-10"
            invalid={!!errors.password}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-[13px] text-brand-600 hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
        {isSubmitting ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}

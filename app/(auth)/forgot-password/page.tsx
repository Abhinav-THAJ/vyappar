import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
        We will email you a link to set a new one.
      </p>
      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}

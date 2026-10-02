import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
        You will set up your company in the next step.
      </p>

      <div className="mt-8">
        <SignupForm />
      </div>

      <p className="mt-6 text-center text-[13px] text-[var(--text-secondary)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

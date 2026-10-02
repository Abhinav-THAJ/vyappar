import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
        Choose something you have not used here before.
      </p>
      <div className="mt-8">
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
        Log in to continue to your books.
      </p>

      <div className="mt-8">
        <LoginForm next={next} />
      </div>


    </div>
  );
}
